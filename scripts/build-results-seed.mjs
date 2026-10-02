/**
 * Turns the results spreadsheets into idempotent SQL seeds.
 *
 * SQL rather than direct writes: creating competitions and results needs admin rights,
 * the SQL editor already has them, and a file can be read before it is run. Re-running is
 * safe — competitions and divers are keyed on ids derived from the event and the name, and
 * each seeded competition's results are deleted before insert.
 *
 * Run: npm run data:results-seed
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSheet, rowsAfterHeader, sql } from './lib/xlsx.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Each workbook has its own column layout and its own answer to which season tables an
 * event counts towards, so the differences live here rather than in the shared code.
 *
 *   Red Bull tour stops count for both tables (3.3.1 and 6.2).
 *   World Aquatics events count for the World Ranking only — they are not Red Bull
 *   stops, so they can never touch the World Series ranking. Rule 6.2 names World Cups;
 *   Championships are included here as a deliberate choice, and either can be turned off
 *   per event on the Admin screen.
 */
const SOURCES = [
  {
    key: 'redbull',
    title: 'Red Bull Cliff Diving World Series',
    file: 'Red_Bull_Cliff_Diving_2022-2026_Simplified_Results.xlsx',
    out: 'redbull_results.sql',
    headerLabels: ['Season', 'Category', 'Placement', 'Athlete'],
    ruleSet: 'redbull',
    countsForSeries: true,
    countsForWorldRanking: true,
    note:
      'Every event here is a Red Bull tour stop, so each counts towards both the World\n' +
      '-- Series ranking (3.3.1) and the World Ranking (6.2).',
    read: (r) => ({
      season: Number(r[0]),
      // The stop number disambiguates two visits to one place in a season.
      idParts: [r[0], r[1], r[2]],
      name: r[2],
      location: null,
      date: r[3],
      category: r[4],
      placement: r[5],
      athlete: r[6],
      score: r[7],
    }),
  },
  {
    key: 'worldaquatics',
    title: 'World Aquatics high diving',
    file: 'World_Aquatics_High_Diving_2022-2026_Simplified_Results.xlsx',
    out: 'worldaquatics_results.sql',
    headerLabels: ['Year', 'Competition', 'Category', 'Placement', 'Athlete'],
    ruleSet: 'worldaquatics',
    countsForSeries: false,
    countsForWorldRanking: true,
    note:
      'These are World Aquatics events, not Red Bull tour stops, so counts_for_series is\n' +
      "-- false throughout and they cannot affect the World Series ranking. They are\n" +
      '-- counted towards the World Ranking (6.2), World Championships included.',
    read: (r) => ({
      season: Number(r[0]),
      idParts: [r[0], r[1], r[2]],
      name: r[1],
      location: r[2] || null,
      date: r[3],
      category: r[4], // "Men · 27m" / "Women · 20m"
      placement: r[5],
      athlete: r[6],
      score: r[7],
    }),
  },
];

/**
 * Divers are matched across the two workbooks by name, so a diver spelled differently in
 * each would end up as two records with half a World Ranking apiece. These are the same
 * person under two spellings; the Red Bull form wins because that seed was applied first.
 * The near-miss report at the end of this script is what surfaces new ones.
 */
const ALIASES = new Map([
  ['Jucelino Lima Junior', 'Jucelino Junior'],
  ['Maike Elena Halbisch', 'Maike Halbisch'],
  ['Isabel Cristina Perez', 'Isabel Perez'],
]);

/** Stable ids, so re-running updates rather than duplicates. */
const NAMESPACE = 'highdiving-results-seed';
function uuidFor(...parts) {
  const h = createHash('sha1').update(`${NAMESPACE}:${parts.join('|')}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function build(source) {
  const rows = readSheet(join(ROOT, source.file));
  const { data } = rowsAfterHeader(rows, ...source.headerLabels);

  const competitions = new Map();
  const divers = new Map();
  const results = [];
  const skipped = [];
  const notes = [];

  for (const raw of data) {
    const row = source.read(raw);
    if (!Number.isInteger(row.season) || !row.athlete) continue;
    row.athlete = ALIASES.get(row.athlete) ?? row.athlete;

    const gender = /women/i.test(row.category) ? 'women' : 'men';
    const heldOn = /^\d{4}-\d{2}-\d{2}/.exec(row.date)?.[0] ?? null;

    // A withdrawal or disqualification has no finishing position. It scores nothing and
    // the results table is keyed on a real placing, so it is recorded as skipped rather
    // than invented into the table.
    if (!/^\d+$/.test(row.placement)) {
      skipped.push(`${row.season} ${row.name} ${gender}: ${row.athlete} — no placement`);
      continue;
    }

    const compId = uuidFor('competition', source.key, ...row.idParts, gender);
    if (!competitions.has(compId)) {
      competitions.set(compId, {
        id: compId,
        season: row.season,
        name: row.name,
        location: row.location,
        heldOn,
        gender,
      });
    }

    const numeric = /^\d+(\.\d+)?$/.test(row.score);
    if (!numeric && row.score) {
      notes.push(`${row.season} ${row.name} ${gender} ${row.athlete}: score "${row.score}" stored as null`);
    }

    divers.set(`${row.athlete.toLowerCase()}|${gender}`, { name: row.athlete, gender });
    results.push({
      compId,
      name: row.athlete,
      gender,
      rank: Number(row.placement),
      score: numeric ? Number(row.score) : null,
    });
  }

  // A diver cannot be recorded twice in one competition — that is the primary key, and it
  // would fail partway through the transaction rather than here. Tied placings are fine
  // and expected (Red Bull 3.3.2), so ranks are deliberately not checked for uniqueness.
  const problems = [];
  const seen = new Set();
  for (const r of results) {
    const key = `${r.compId}|${r.name.toLowerCase()}`;
    if (seen.has(key)) {
      const c = competitions.get(r.compId);
      problems.push(`${c.season} ${c.name} ${c.gender}: ${r.name} appears twice`);
    }
    seen.add(key);
  }
  for (const c of competitions.values()) {
    if (!c.heldOn) problems.push(`${c.season} ${c.name} ${c.gender}: no date`);
  }

  return { source, competitions, divers, results, skipped, notes, problems };
}

function emit({ source, competitions, divers, results }) {
  const seasons = [...new Set([...competitions.values()].map((c) => c.season))].sort();
  const lines = [];
  lines.push(`-- ${source.title} results, ${seasons.join(', ')}.`);
  lines.push('-- Generated by scripts/build-results-seed.mjs from');
  lines.push(`-- ${source.file}. Do not edit by hand.`);
  lines.push('--');
  lines.push('-- Safe to re-run: competitions and divers are keyed on stable ids, and the');
  lines.push('-- results of each seeded competition are replaced rather than appended to.');
  lines.push('--');
  lines.push(`-- ${source.note}`);
  lines.push('--');
  lines.push('-- Divers are matched on name, so a diver who appears in both this file and the');
  lines.push('-- other seed shares one record and one World Ranking.');
  lines.push('--');
  lines.push('-- Withdrawals and disqualifications have no finishing position and are not');
  lines.push('-- imported. The best-dive bonus (3.4.1) is not in the source, so best_dive is');
  lines.push('-- false throughout.');
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
      .sort(
        (a, b) =>
          a.season - b.season ||
          (a.heldOn ?? '').localeCompare(b.heldOn ?? '') ||
          a.name.localeCompare(b.name) ||
          a.gender.localeCompare(b.gender),
      )
      .map(
        (c) =>
          `  (${sql(c.id)}::uuid, ${c.season}, ${sql(c.name)}, ${sql(c.location)}, ` +
          `${c.heldOn ? `${sql(c.heldOn)}::date` : 'null'}, ${sql(source.ruleSet)}, ${sql(c.gender)}, ` +
          `${source.countsForSeries}, ${source.countsForWorldRanking})`,
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
  return lines.join('\n');
}

const built = SOURCES.map(build);
const failed = built.filter((b) => b.problems.length);
if (failed.length) {
  for (const b of failed) {
    console.error(`${b.source.title}: ${b.problems.length} problem(s)`);
    for (const p of b.problems) console.error('  ' + p);
  }
  console.error('\nNothing written.');
  process.exit(1);
}

const outDir = join(ROOT, 'supabase', 'seed');
mkdirSync(outDir, { recursive: true });

for (const b of built) {
  writeFileSync(join(outDir, b.source.out), emit(b));
  const bySeason = {};
  for (const c of b.competitions.values()) bySeason[c.season] = (bySeason[c.season] ?? 0) + 1;
  console.log(`\n${b.source.title} -> supabase/seed/${b.source.out}`);
  console.log(`  competitions: ${b.competitions.size}`, bySeason);
  console.log(`  divers: ${b.divers.size}  results: ${b.results.length}`);
  for (const n of b.notes) console.log(`  note: ${n}`);
  if (b.skipped.length) {
    console.log(`  skipped ${b.skipped.length} entry/entries with no placement:`);
    for (const s of b.skipped) console.log(`    ${s}`);
  }
}

// A diver who competes in both series must resolve to ONE record, or their World Ranking
// silently splits in two. Names are the join key, so report how they overlap.
const [rb, wa] = built;
const rbNames = new Set([...rb.divers.values()].map((d) => `${d.name}|${d.gender}`));
const waNames = new Set([...wa.divers.values()].map((d) => `${d.name}|${d.gender}`));
const shared = [...waNames].filter((n) => rbNames.has(n));
console.log(
  `\nDivers: ${rbNames.size} Red Bull, ${waNames.size} World Aquatics, ${shared.length} in both.`,
);

/**
 * The expensive mistake here is quiet: one diver under two spellings becomes two records
 * and two half rankings, and nothing errors. Flag names that look like the same person so
 * a new spreadsheet cannot introduce one unnoticed.
 */
const normalise = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '');
const tokens = (s) => new Set(normalise(s).split(/\s+/).filter(Boolean));
const suspects = [];
for (const wn of waNames) {
  if (rbNames.has(wn)) continue;
  const [waName, waGender] = wn.split('|');
  for (const rn of rbNames) {
    const [rbName, rbGender] = rn.split('|');
    if (rbGender !== waGender) continue;
    const a = tokens(waName);
    const b = tokens(rbName);
    const overlap = [...a].filter((t) => b.has(t)).length;
    // Two shared name parts, but not the same name: almost always a middle name or a
    // dropped surname rather than two different people.
    if (overlap >= 2 && normalise(waName) !== normalise(rbName)) {
      suspects.push(`  "${waName}" (World Aquatics) ~ "${rbName}" (Red Bull) · ${waGender}`);
    }
  }
}
if (suspects.length) {
  console.log('\nPossible duplicate divers — add to ALIASES if they are the same person:');
  for (const s of suspects) console.log(s);
} else {
  console.log('No near-duplicate diver names across the two files.');
}

console.log('\nOnly in the World Aquatics file:');
for (const n of [...waNames].filter((x) => !rbNames.has(x)).sort()) {
  console.log(`  ${n.replace('|', ' · ')}`);
}
