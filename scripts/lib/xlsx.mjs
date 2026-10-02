/**
 * Just enough .xlsx reading for the results workbooks.
 *
 * An .xlsx is a zip of XML, so `unzip` plus two regexes beats pulling in a spreadsheet
 * library for two files that are read at build time.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    // Ampersand last, or an escaped entity would be decoded twice.
    .replace(/&amp;/g, '&');
}

/**
 * The attribute capture must be lazy. Greedy, it runs past a self-closing empty cell
 * (`<c r="F36" s="10" />`) looking for a closing tag, swallows the NEXT cell's contents,
 * and silently shifts every later column in that row by one — which looks like clean
 * data until you notice an athlete's name in the placement column.
 */
const CELL = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
const ROW = /<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
const TEXT = /<(?:x:)?t\b[^>]*>([\s\S]*?)<\/(?:x:)?t>/g;
const VALUE = /<(?:x:)?v\b[^>]*>([\s\S]*?)<\/(?:x:)?v>/;

/** "C12" -> 2 */
function columnOf(ref) {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Read one worksheet as an array of string rows. Cells are placed by their own `r`
 * reference, so a gap in the middle of a row stays a gap.
 */
export function readSheet(xlsxPath, sheet = 'sheet1.xml') {
  const work = mkdtempSync(join(tmpdir(), 'xlsx-'));
  try {
    execFileSync('unzip', ['-q', '-o', xlsxPath, '-d', work]);

    let shared = [];
    try {
      const xml = readFileSync(join(work, 'xl', 'sharedStrings.xml'), 'utf8');
      shared = [...xml.matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)].map((m) =>
        decode([...m[1].matchAll(TEXT)].map((t) => t[1]).join('')),
      );
    } catch {
      // A workbook with no shared strings is valid; everything will be inline.
    }

    const xml = readFileSync(join(work, 'xl', 'worksheets', sheet), 'utf8');
    const rows = [];
    for (const rowMatch of xml.matchAll(ROW)) {
      const cells = [];
      for (const cellMatch of rowMatch[1].matchAll(CELL)) {
        const attrs = cellMatch[1] ?? '';
        const inner = cellMatch[2] ?? '';
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '';
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        let value = '';
        if (type === 'inlineStr') {
          value = decode([...inner.matchAll(TEXT)].map((t) => t[1]).join(''));
        } else {
          const v = VALUE.exec(inner)?.[1];
          if (v != null) value = type === 's' ? (shared[Number(v)] ?? '') : decode(v);
        }
        cells[columnOf(ref)] = value;
      }
      rows.push(Array.from({ length: cells.length }, (_, i) => (cells[i] ?? '').trim()));
    }
    return rows;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Find the header row by the labels it must contain, and return the rows after it. */
export function rowsAfterHeader(rows, ...required) {
  const at = rows.findIndex((r) => required.every((label) => r.includes(label)));
  if (at === -1) throw new Error(`No header row containing ${required.join(', ')}`);
  return { header: rows[at], data: rows.slice(at + 1) };
}

/** Escape a value for a single-quoted SQL literal, or render null. */
export function sql(value) {
  return value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`;
}
