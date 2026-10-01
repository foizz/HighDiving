/**
 * Turns the Red Bull results spreadsheet into an idempotent SQL seed.
 *
 * It emits SQL rather than writing to Supabase directly: creating competitions and
 * results needs admin rights, the SQL editor already has them, and a file can be read
 * before it is run. Re-running it is safe — competitions and divers are keyed on
 * deterministic ids, and each seeded competition's results are replaced wholesale.
 *
 * An .xlsx is a zip of XML, so no spreadsheet library is involved.
 *
 * Run: npm run data:results-seed
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX = join(ROOT, 'Red_Bull_Cliff_Diving_2022-2026_Simplified_Results.xlsx');
const OUT = join(ROOT, 'supabase', 'seed', 'redbull_results.sql');

// ---------------------------------------------------------------------------
// Read the workbook
// ---------------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'xlsx-'));
try {
  execFileSync('unzip', ['-q', '-o', XLSX, '-d', work]);

  const decode = (s) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&amp;/g, '&');

  const sharedXml = readFileSync(join(work, 'xl', 'sharedStrings.xml'), 'utf8');
  const shared = [...sharedXml.matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)].map((m) =>
    decode([...m[1].matchAll(/<(?:x:)?t\b[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((t) => t[1]).join('')),
  );

  const colOf = (ref) => {
    const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  function readSheet(file) {
    const xml = readFileSync(join(work, 'xl', 'worksheets', file), 'utf8');
    const rows = [];
    for (const rm of xml.matchAll(/<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
      const cells = [];
      for (const cm of rm[1].matchAll(/<(?:x:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)) {
        const attrs = cm[1] ?? '';
        const inner = cm[2] ?? '';
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '';
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        let value = '';
        if (type === 'inlineStr') {
          value = decode(
            [...inner.matchAll(/<(?:x:)?t\b[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((t) => t[1]).join(''),
          );
        } else {
          const v = /<(?:x:)?v\b[^>]*>([\s\S]*?)<\/(?:x:)?v>/.exec(inner)?.[1];
          if (v != null) value = type === 's' ? (shared[Number(v)] ?? '') : decode(v);
        }
        cells[colOf(ref)] = value;
      }
      rows.push(Array.from({ length: cells.length }, (_, i) => (cells[i] ?? '').trim()));
    }
    return rows;
  }

  const sheet = readSheet('sheet1.xml');
  const headerAt = sheet.findIndex((r) => r[0] === 'Season' && r[4] === 'Category');
  if (headerAt === -1) throw new Error('Could not find the header row in the Results sheet.');
  const dataRows = sheet.slice(headerAt + 1).filter((r) => r[0] && r[6]);

  // -------------------------------------------------------------------------
  // Shape it
  // -------------------------------------------------------------------------

  /** Stable ids, so re-running the seed updates rather than duplicates. */
  const NAMESPACE = 'redbull-cliff-diving-results';
  function uuidFor(...parts) {
    const h = createHash('sha1').update(`${NAMESPACE}:${parts.join('|')}`).digest();
    const b = Buffer.from(h.subarray(0, 16));
    b[6] = (b[6] & 0x0f) | 0x50; // version 5
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const hex = b.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  const sql = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

  const competitions = new Map();
  const divers = new Map();
  const results = [];
  const warnings = [];

  for (const row of dataRows) {
    const [season, stopNo, stop, dateRaw, category, placement, athlete, scoreRaw] = row;
    const gender = category.toLowerCase() === 'women' ? 'women' : 'men';
    const heldOn = /^\d{4}-\d{2}-\d{2}/.exec(dateRaw)?.[0] ?? null;
    const rank = Number(placement);
    if (!Number.isInteger(rank) || rank < 1) {
      warnings.push(`skipped ${season} ${stop} ${category} "${athlete}": placement "${placement}"`);
      continue;
    }

    // The spreadsheet records a withdrawal as text in the score column; the placing is
    // still real, so keep the result and leave the score unknown.
    const numeric = /^\d+(\.\d+)?$/.test(scoreRaw);
    if (!numeric && scoreRaw) {
      warnings.push(`${season} ${stop} ${category} ${athlete}: no numeric total ("${scoreRaw}") — stored as null`);
    }

    const compId = uuidFor('competition', season, stopNo, stop, gender);
    if (!competitions.has(compId)) {
      competitions.set(compId, {
        id: compId,
        season: Number(season),
        name: stop,
        location: null,
        heldOn,
        gender,
      });
    }

    const diverKey = `${athlete.toLowerCase()}|${gender}`;
    if (!divers.has(diverKey)) divers.set(diverKey, { name: athlete, gender });

    results.push({
      compId,
      name: athlete,
      gender,
      rank,
      score: numeric ? Number(scoreRaw) : null,
    });
  }

  // -------------------------------------------------------------------------
  // Check it before writing it
  //
  // `results` is keyed on (competition_id, diver_id) and carries a unique index on
  // (competition_id, rank). A spreadsheet with a repeated placing or a diver listed
  // twice would fail halfway through the transaction in the SQL editor, which is a
  // much worse place to find out.
  // -------------------------------------------------------------------------

  const problems = [];
  const seenRank = new Set();
  const seenDiver = new Set();
  for (const r of results) {
    const comp = competitions.get(r.compId);
    const where = `${comp.season} ${comp.name} ${comp.gender}`;
    const rankKey = `${r.compId}|${r.rank}`;
    if (seenRank.has(rankKey)) problems.push(`${where}: position ${r.rank} appears twice`);
    seenRank.add(rankKey);
    const diverKey = `${r.compId}|${r.name.toLowerCase()}`;
    if (seenDiver.has(diverKey)) problems.push(`${where}: ${r.name} appears twice`);
    seenDiver.add(diverKey);
  }
  for (const c of competitions.values()) {
    if (!c.heldOn) problems.push(`${c.season} ${c.name} ${c.gender}: no date`);
  }
  if (problems.length) {
    console.error(`${problems.length} problem(s); nothing written:`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Emit
  // -------------------------------------------------------------------------

  const lines = [];
  lines.push(`-- Red Bull Cliff Diving World Series results, ${[...new Set([...competitions.values()].map((c) => c.season))].sort().join(', ')}.`);
  lines.push('-- Generated by scripts/build-results-seed.mjs from');
  lines.push('-- Red_Bull_Cliff_Diving_2022-2026_Simplified_Results.xlsx. Do not edit by hand.');
  lines.push('--');
  lines.push('-- Safe to re-run: competitions and divers are keyed on stable ids, and the');
  lines.push('-- results of each seeded competition are replaced rather than appended to.');
  lines.push('--');
  lines.push('-- Every event here is a Red Bull tour stop, so each counts towards both the');
  lines.push('-- World Series ranking (3.3.1) and the World Ranking (6.2). The spreadsheet does');
  lines.push('-- not record which dive won the best-dive bonus, so best_dive is false');
  lines.push('-- throughout and World Series totals may be up to one point per stop below the');
  lines.push('-- official figure. Tick the bonus on the Admin screen where you know it.');
  lines.push('');
  lines.push('begin;');
  lines.push('');

  lines.push('-- Divers -------------------------------------------------------------------');
  lines.push('insert into public.divers (name, gender) values');
  lines.push(
    [...divers.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => `  (${sql(d.name)}, ${sql(d.gender)})`)
      .join(',\n') + '\non conflict (name, gender) do nothing;',
  );
  lines.push('');

  lines.push('-- Competitions -------------------------------------------------------------');
  lines.push(
    'insert into public.competitions\n' +
      '  (id, season, name, location, held_on, rule_set, gender, counts_for_series, counts_for_world_ranking)\nvalues',
  );
  lines.push(
    [...competitions.values()]
      .sort((a, b) => a.season - b.season || (a.heldOn ?? '').localeCompare(b.heldOn ?? '') || a.gender.localeCompare(b.gender))
      .map(
        (c) =>
          `  (${sql(c.id)}::uuid, ${c.season}, ${sql(c.name)}, ${sql(c.location)}, ` +
          `${c.heldOn ? `${sql(c.heldOn)}::date` : 'null'}, 'redbull', ${sql(c.gender)}, true, true)`,
      )
      .join(',\n') +
      '\non conflict (id) do update set\n' +
      '  season = excluded.season, name = excluded.name, location = excluded.location,\n' +
      '  held_on = excluded.held_on, rule_set = excluded.rule_set, gender = excluded.gender,\n' +
      '  counts_for_series = excluded.counts_for_series,\n' +
      '  counts_for_world_ranking = excluded.counts_for_world_ranking;',
  );
  lines.push('');

  lines.push('-- Results ------------------------------------------------------------------');
  lines.push('-- Cleared first so a re-run cannot leave a stale placing behind.');
  lines.push(
    'delete from public.results where competition_id in (\n' +
      [...competitions.keys()].map((id) => `  ${sql(id)}::uuid`).join(',\n') +
      '\n);',
  );
  lines.push('');
  lines.push('with incoming (competition_id, name, gender, rank, score) as (values');
  lines.push(
    results
      .map(
        (r) =>
          `  (${sql(r.compId)}::uuid, ${sql(r.name)}, ${sql(r.gender)}, ${r.rank}, ` +
          `${r.score == null ? 'null::numeric' : r.score.toFixed(2)})`,
      )
      .join(',\n') + '\n)',
  );
  lines.push('insert into public.results (competition_id, diver_id, rank, score, best_dive)');
  lines.push('select i.competition_id, d.id, i.rank, i.score, false');
  lines.push('from incoming i');
  lines.push('join public.divers d on d.name = i.name and d.gender = i.gender;');
  lines.push('');
  lines.push('commit;');
  lines.push('');

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join('\n'));

  const bySeason = {};
  for (const c of competitions.values()) bySeason[c.season] = (bySeason[c.season] ?? 0) + 1;
  console.log(`competitions: ${competitions.size}`, bySeason);
  console.log(`divers: ${divers.size}`);
  console.log(`results: ${results.length}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} note(s):`);
    for (const w of warnings) console.log('  ' + w);
  }
  console.log(`\nwrote ${OUT}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
