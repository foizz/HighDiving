/**
 * Converts the hand-transcribed Red Bull DD table (scripts/rb-dd-source.txt) into
 * src/data/dd-table.redbull.json, matching the shape the FINA extractor emits.
 *
 * Run: npm run data:rb
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'scripts', 'rb-dd-source.txt');
const OUT = join(ROOT, 'src', 'data', 'dd-table.redbull.json');

const POSITIONS = ['A', 'B', 'C', 'D', 'E'];
const HEIGHTS = ['27', '20'];

const dives = [];
let group = null;
let groupName = null;
const errors = [];

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/);
lines.forEach((line, i) => {
  const at = `${SRC}:${i + 1}`;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  const header = /^\[(\d+)\s+(.+)\]$/.exec(trimmed);
  if (header) {
    group = Number(header[1]);
    groupName = header[2];
    return;
  }

  const parts = trimmed.split('|').map((p) => p.trim());
  if (parts.length !== 4) {
    errors.push(`${at}: expected 4 pipe-separated fields, got ${parts.length}`);
    return;
  }
  const [number, description, ...cells] = parts;
  if (group == null) {
    errors.push(`${at}: dive ${number} appears before any group header`);
    return;
  }

  const dd = {};
  cells.forEach((cell, h) => {
    const values = cell.split(',').map((v) => v.trim());
    if (values.length !== 5) {
      errors.push(`${at}: dive ${number} height ${HEIGHTS[h]}m has ${values.length} values, expected 5`);
      return;
    }
    values.forEach((v, p) => {
      if (v === '-') return;
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 10) {
        errors.push(`${at}: dive ${number} ${HEIGHTS[h]}m ${POSITIONS[p]} = "${v}" is not a plausible DD`);
        return;
      }
      (dd[HEIGHTS[h]] ??= {})[POSITIONS[p]] = n;
    });
  });

  if (!Object.keys(dd).length) {
    errors.push(`${at}: dive ${number} has no DD values at any height`);
  }
  if (dives.some((d) => d.number === number)) {
    errors.push(`${at}: duplicate dive number ${number}`);
  }
  dives.push({ number, description, group, groupName, dd });
});

if (errors.length) {
  console.error(`${errors.length} problem(s) in the transcription:`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source:
        'RED BULL CLIFF DIVING WORLD SERIES 2026 RULE BOOK, Appendix 3 ("2025 DD TABLE"), ' +
        'transcribed from the scanned pages — see scripts/rb-dd-source.txt',
      heights: HEIGHTS,
      dives,
    },
    null,
    2,
  ) + '\n',
);

const cells = dives.reduce(
  (n, d) => n + Object.values(d.dd).reduce((m, h) => m + Object.keys(h).length, 0),
  0,
);
const byGroup = {};
for (const d of dives) byGroup[d.group] = (byGroup[d.group] ?? 0) + 1;
console.log(`dives: ${dives.length}  dd cells: ${cells}`);
console.log('per group:', byGroup);
