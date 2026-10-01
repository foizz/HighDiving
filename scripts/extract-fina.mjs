/**
 * Extracts the World Aquatics / FINA high diving Degree of Difficulty tables
 * (Appendix 2) out of the official rules PDF into src/data/dd-table.json.
 *
 * The PDF has a real text layer, so no OCR is involved. Xpdf's `pdftotext -table`
 * renders each appendix page as fixed-position text; we read the A/B/C/D/E header
 * row to learn each column's character offset, then assign every `d,d` value on a
 * row to its nearest column. Each appendix page carries TWO heights side by side
 * (10/12m + 15m on one spread, 27m + 20m on the other).
 *
 * Run: npm run data:fina
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PDF = join(ROOT, '2017-2021_high_diving_13082019_0.pdf');
const OUT = join(ROOT, 'src', 'data', 'dd-table.json');

/** Appendix 2 occupies these pages; each holds two heights side by side. */
const PAGES = [22, 23, 24, 25];
const POSITIONS = ['A', 'B', 'C', 'D', 'E'];

/** A dive number token: digits, with `(n)` for counts >= 10 or flying, optional `m` for mid-turn. */
const DIVE_NO = /^(?:\d|\(\d+\))+m?$/;
const VALUE = /\d,\d/g;
const GROUP = /Group\s+(\d+)\s*-\s*(.+?)\s*$/i;
const HEIGHT_LABEL = /DD\s+TABLE\s*-\s*([\d/]+)\s*mts/gi;

function pdftotext(page) {
  return execFileSync(
    'pdftotext',
    ['-f', String(page), '-l', String(page), '-table', PDF, '-'],
    { encoding: 'latin1', maxBuffer: 32 * 1024 * 1024 },
  ).split(/\r?\n/);
}

/** Character offsets of the ten single-letter position headers (5 per height). */
function findColumns(lines) {
  for (const line of lines) {
    const found = [...line.matchAll(/(?<![A-Za-z])[ABCDE](?![A-Za-z])/g)];
    if (found.length === 10) return found.map((m) => m.index);
  }
  return null;
}

/** The two height labels on a page, left-to-right, normalised to keys. */
function findHeights(lines) {
  for (const line of lines) {
    const found = [...line.matchAll(HEIGHT_LABEL)];
    if (found.length === 2) return found.map((m) => m[1].replace('/', '_'));
  }
  return null;
}

/**
 * The header letters and the value columns beneath them are rendered at slightly
 * different offsets (by up to ~6 chars, varying per page). Rather than guess with a
 * distance tolerance, snap the page's observed value offsets onto the header columns
 * and assert the mapping is one-to-one and order-preserving — if the layout ever
 * shifts enough to make assignment ambiguous, this fails loudly instead of silently
 * filing a DD under the wrong position.
 */
function mapValueOffsets(lines, cols, headerLine) {
  const seen = new Set();
  for (const line of lines) {
    if (line === headerLine) continue;
    for (const m of line.matchAll(VALUE)) if (m.index >= cols[0] - 6) seen.add(m.index);
  }
  const offsets = [...seen].sort((a, b) => a - b);
  const map = new Map();
  for (const off of offsets) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < cols.length; i++) {
      const d = Math.abs(cols[i] - off);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    map.set(off, best);
  }
  const used = [...map.values()];
  const dupes = used.filter((v, i) => used.indexOf(v) !== i);
  const monotonic = used.every((v, i) => i === 0 || v > used[i - 1]);
  return { map, ok: dupes.length === 0 && monotonic, offsets, used };
}

const dives = new Map();
const warnings = [];

for (const page of PAGES) {
  const lines = pdftotext(page);
  const cols = findColumns(lines);
  const headerLine = lines.find(
    (l) => [...l.matchAll(/(?<![A-Za-z])[ABCDE](?![A-Za-z])/g)].length === 10,
  );
  const heights = findHeights(lines);
  if (!cols || !heights) {
    warnings.push(`page ${page}: could not locate header row (cols=${!!cols} heights=${!!heights})`);
    continue;
  }
  const { map: offsetToCol, ok, offsets, used } = mapValueOffsets(lines, cols, headerLine);
  if (!ok) {
    throw new Error(
      `page ${page}: value columns are ambiguous — offsets ${offsets.join(',')} mapped to ` +
        `columns ${used.join(',')} against headers ${cols.join(',')}. Refusing to guess.`,
    );
  }
  // cols[0..4] belong to heights[0], cols[5..9] to heights[1]
  const colMeta = cols.map((offset, i) => ({
    offset,
    height: heights[i < 5 ? 0 : 1],
    position: POSITIONS[i % 5],
  }));

  let group = null;
  let groupName = null;

  for (const line of lines) {
    const g = GROUP.exec(line);
    if (g) {
      group = Number(g[1]);
      groupName = g[2].trim();
      continue;
    }

    const tokens = [...line.matchAll(/\S+/g)];
    if (!tokens.length) continue;
    const first = tokens[0];
    if (!DIVE_NO.test(first[0])) continue;
    // A bare year/page number is not a dive; real dive numbers are >= 3 chars
    // or an armstand form like 611. Require a description to follow.
    if (first.index >= colMeta[0].offset) continue;

    const number = first[0];
    const description = line
      .slice(first.index + number.length, colMeta[0].offset)
      .trim()
      .replace(/\s+/g, ' ');
    if (!description) continue;

    const entry =
      dives.get(number) ??
      { number, description, group, groupName, dd: {} };
    // Descriptions repeat identically across pages; keep the first non-empty one.
    if (!entry.description) entry.description = description;
    if (entry.group == null) { entry.group = group; entry.groupName = groupName; }

    for (const m of line.matchAll(VALUE)) {
      const value = Number(m[0].replace(',', '.'));
      const col = offsetToCol.get(m.index);
      if (col == null) {
        warnings.push(`page ${page} dive ${number}: value ${m[0]} at col ${m.index} unmapped`);
        continue;
      }
      const best = colMeta[col];
      entry.dd[best.height] ??= {};
      const existing = entry.dd[best.height][best.position];
      if (existing != null && existing !== value) {
        warnings.push(
          `page ${page} dive ${number}: conflicting ${best.height}m ${best.position} — ${existing} vs ${value}`,
        );
      }
      entry.dd[best.height][best.position] = value;
    }

    dives.set(number, entry);
  }
}

const list = [...dives.values()].sort(
  (a, b) => a.group - b.group || a.number.localeCompare(b.number, 'en', { numeric: true }),
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    { source: '2017-2021_high_diving_13082019_0.pdf (Appendix 2)', dives: list },
    null,
    2,
  ) + '\n',
);

const cells = list.reduce(
  (n, d) => n + Object.values(d.dd).reduce((m, h) => m + Object.keys(h).length, 0),
  0,
);
console.log(`dives: ${list.length}  dd cells: ${cells}`);
const byGroup = {};
for (const d of list) byGroup[d.group] = (byGroup[d.group] ?? 0) + 1;
console.log('per group:', byGroup);
console.log('heights:', [...new Set(list.flatMap((d) => Object.keys(d.dd)))].join(', '));
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 40)) console.log('  ' + w);
  if (warnings.length > 40) console.log(`  ... ${warnings.length - 40} more`);
}
if (!existsSync(PDF)) console.error('PDF missing:', PDF);
