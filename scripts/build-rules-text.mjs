/**
 * Extracts the readable text of both rule books into one file the `ask` edge function
 * loads as its system prompt.
 *
 * Both books fit in a single context window, so the assistant reads them whole rather
 * than through a retrieval index — simpler, and it cannot silently drop the clause that
 * decides an answer. The appendices that are scanned images carry no text; the DD figures
 * they contain reach the assistant through the `lookup_dd` tool instead, which reads the
 * same table the app uses.
 *
 * Run: npm run data:rules-text
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'supabase', 'functions', '_shared', 'rules-text.js');

const BOOKS = [
  {
    key: 'worldaquatics',
    title: 'FINA / World Aquatics High Diving Rules 2017-2021',
    note:
      'Rule numbers are of the form HD 1.2.3. The senior competition format lives in ' +
      'By-Law BL 15 and is NOT in this document; it is given separately below.',
    file: '2017-2021_high_diving_13082019_0.pdf',
  },
  {
    key: 'redbull',
    title: 'Red Bull Cliff Diving World Series 2026 Rule Book',
    note: 'Rule numbers are of the form 3.5.1.',
    file: 'RED BULL CLIFF DIVING WORLD SERIES 2026 RULE BOOK_final.pdf',
  },
];

/**
 * The current World Aquatics senior format, which the 2017-2021 PDF defers to BL 15 for.
 * Taken from the World Aquatics High Diving Competition Regulations in force 9 Nov 2024.
 */
const SENIOR_FORMAT = `
WORLD AQUATICS SENIOR COMPETITION FORMAT
(World Aquatics High Diving Competition Regulations, in force 9 November 2024.
Not present in the 2017-2021 PDF above, which defers to By-Law BL 15.)

3.3.1 The competitions for men and women shall comprise four (4) dives. A dive of the same
number shall be regarded as the same dive.

3.4.1 Women 20m Platform. Four (4) dives: one (1) required dive with a maximum Degree of
Difficulty of 2.6 and one (1) intermediate dive with a maximum DD of 3.4 from two (2)
different groups, and two (2) optional dives without limit of DD from two (2) different
groups. If the DD of the required dive is less than 2.6 or of the intermediate dive less
than 3.4, the calculated DD is used. If a diver performs a dive above 2.6 respectively 3.4
they will only receive 2.6 respectively 3.4.

3.4.2 Men 27m Platform. Four (4) dives: one (1) required dive with a maximum DD of 2.8 and
one (1) intermediate dive with a maximum DD of 3.6 from two (2) different groups, and two
(2) optional dives without limit of DD from two (2) different groups. The same capping rule
applies at 2.8 and 3.6.
`.trim();

function extract(file) {
  return execFileSync('pdftotext', ['-layout', join(ROOT, file), '-'], {
    encoding: 'latin1',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Collapse the runs of spaces `-layout` leaves behind; they are pure token cost. */
function tidy(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, '').replace(/ {2,}/g, '  '))
    .filter((line, i, all) => line.trim() !== '' || all[i - 1]?.trim() !== '')
    .join('\n')
    .replace(/\u0000/g, '');
}

/**
 * Sections cut from each book before it reaches the prompt.
 *
 * Two kinds go: material that cannot answer a question about diving rules — travel,
 * media obligations, contacts, ethics, the doctor protocol — and the DD tables, which
 * reach the assistant through `lookup_dd` instead. The tables are the bigger win twice
 * over: they are thousands of tokens, and a table in the prompt is a second copy of the
 * figures that can disagree with the one the dive picker uses.
 *
 * Each range is [from, to]; `to` of null means "to the end of the book". The build fails
 * if a marker is missing, so a reformatted PDF cannot silently prune nothing — or
 * everything.
 */
const PRUNE = {
  worldaquatics: [
    ['APPENDIX 1', null], // DD formula components, then the DD tables
  ],
  redbull: [
    ['8. CODE OF CONDUCT & ETHICS', '9. ATHLETES'],
    ['16. CODE OF ETHICS', '17. AWARDS'],
    ['APPENDIX 4\n', null], // doctor protocol, dive clock, contacts, travel
  ],
};

function prune(body, ranges, label) {
  let out = body;
  for (const [from, to] of ranges) {
    // Search from the back: these markers also appear in the table of contents, and it
    // is the real section we want, not the line pointing at it.
    const start = out.lastIndexOf(from);
    if (start === -1) throw new Error(`${label}: prune marker not found: ${JSON.stringify(from)}`);
    let end = out.length;
    if (to !== null) {
      end = out.indexOf(to, start + from.length);
      if (end === -1) throw new Error(`${label}: prune end not found: ${JSON.stringify(to)}`);
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out.trimEnd();
}

const est = (s) => Math.round(s.length / 3.6);
const books = {};

for (const book of BOOKS) {
  const full = tidy(extract(book.file));
  let body = prune(full, PRUNE[book.key] ?? [], book.title);
  if (book.key === 'worldaquatics') body = `${body}\n\n\n${SENIOR_FORMAT}`;
  books[book.key] = `===== ${book.title} =====\n${book.note}\n\n${body}`;
  console.log(
    `${book.title.padEnd(46)} ${String(est(full)).padStart(6)} -> ${String(
      est(books[book.key]),
    ).padStart(6)} tokens`,
  );
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  '// Generated by scripts/build-rules-text.mjs — do not edit by hand.\n' +
    '//\n' +
    '// One export per rule book. The assistant is sent only the book being asked about,\n' +
    '// because both together exceed the per-minute token budget of a modest API tier and\n' +
    '// a question is almost always about one of them.\n' +
    `export const RULES = ${JSON.stringify(books, null, 0)};\n\n` +
    `export const RULE_SET_IDS = ${JSON.stringify(Object.keys(books))};\n`,
);

console.log(
  `\nwrote ${OUT}\n` +
    Object.entries(books)
      .map(([k, v]) => `  ${k.padEnd(14)} ~${est(v).toLocaleString()} tokens`)
      .join('\n'),
);
