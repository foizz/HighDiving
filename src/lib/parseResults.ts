/**
 * Parses results pasted from a scoreboard or spreadsheet into rows an admin can review
 * before anything is written.
 *
 * The input is whatever someone had to hand, so the parser is deliberately permissive
 * about separators and column order, and reports problems per row instead of throwing —
 * a single bad line should not cost the operator the other twenty.
 */

export interface ParsedRow {
  /** 1-based line number in the pasted text, for pointing at the problem. */
  line: number;
  raw: string;
  rank: number | null;
  name: string;
  score: number | null;
  bestDive: boolean;
  /** Problems with this row. A row with any problem is not importable. */
  problems: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Rows with no problems, in rank order. */
  importable: ParsedRow[];
  /** Problems that concern the paste as a whole rather than one row. */
  problems: string[];
}

/** Split a line on tabs, semicolons, commas, or runs of two or more spaces. */
function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes(';')) return line.split(';').map((c) => c.trim());
  if (/,/.test(line) && !/,\d{1,2}(\D|$)/.test(line)) {
    // Commas as separators, unless they look like decimal commas (e.g. "328,50").
    return line.split(',').map((c) => c.trim());
  }
  return line.split(/\s{2,}/).map((c) => c.trim());
}

/** "1." / "1st" / "1" -> 1 */
function parseRank(cell: string): number | null {
  const m = /^(\d{1,3})\s*(?:\.|st|nd|rd|th)?$/i.exec(cell.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n : null;
}

/** Accepts "328.50" and "328,50"; rejects anything that is not a plain number. */
function parseScore(cell: string): number | null {
  const cleaned = cell.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * `\b` is useless against `*`, which is not a word character, so the asterisk is matched
 * on its own rather than inside a word-boundary group.
 */
const BEST_DIVE = /\bbest\s*dive\b|\bbd\b|\*/i;

/**
 * Parse pasted results. Expected shape per line is rank, name and optionally a score, in
 * any of the usual separators; a trailing `*` or "best dive" marks the best dive bonus.
 */
export function parseResults(text: string): ParseResult {
  const problems: string[] = [];
  const rows: ParsedRow[] = [];

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    // Skip an obvious header row.
    if (/^(rank|pos|place|position)\b/i.test(line) && !/\d/.test(line.slice(0, 4))) return;

    const rowProblems: string[] = [];
    const bestDive = BEST_DIVE.test(line);
    // Empty cells are kept: with an explicit separator the column position is what tells
    // a missing name apart from a name that happens to sit one column further along.
    const cells = splitCells(line.replace(BEST_DIVE, '').trim());

    let rank: number | null = null;
    let name = '';
    let score: number | null = null;

    if (cells.length === 1) {
      // Possibly "1 Gary Hunt 428.50" with single spaces throughout.
      const m = /^(\d{1,3})\s*(?:\.|st|nd|rd|th)?\s+(.+?)(?:\s+(\d+(?:[.,]\d+)?))?$/i.exec(
        cells[0],
      );
      if (m) {
        rank = Number(m[1]);
        name = m[2].trim();
        score = m[3] ? parseScore(m[3]) : null;
      } else {
        rowProblems.push('Could not find a rank and a name on this line.');
      }
    } else {
      rank = parseRank(cells[0]);
      if (rank == null) rowProblems.push(`"${cells[0]}" is not a finishing position.`);
      name = (cells[1] ?? '').trim();
      // The score is the last cell that parses as a number, if any.
      for (let c = cells.length - 1; c >= 2; c--) {
        const parsed = parseScore(cells[c]);
        if (parsed != null) {
          score = parsed;
          break;
        }
      }
    }

    if (!name) rowProblems.push('No diver name on this line.');
    if (name && /^\d+([.,]\d+)?$/.test(name)) {
      rowProblems.push(`"${name}" looks like a number, not a diver name.`);
    }

    rows.push({ line: i + 1, raw: line, rank, name, score, bestDive, problems: rowProblems });
  });

  if (!rows.length) problems.push('Nothing to import.');

  // Duplicate ranks and duplicate divers are almost always a paste mistake.
  const seenRank = new Map<number, ParsedRow>();
  const seenName = new Map<string, ParsedRow>();
  for (const row of rows) {
    if (row.rank != null) {
      const prior = seenRank.get(row.rank);
      if (prior) row.problems.push(`Position ${row.rank} is already used on line ${prior.line}.`);
      else seenRank.set(row.rank, row);
    }
    const key = row.name.trim().toLowerCase();
    if (key) {
      const prior = seenName.get(key);
      if (prior) row.problems.push(`${row.name} already appears on line ${prior.line}.`);
      else seenName.set(key, row);
    }
  }

  const bestDives = rows.filter((r) => r.bestDive);
  if (bestDives.length > 1) {
    problems.push(
      `${bestDives.length} rows are marked as the best dive; only one dive per competition earns the bonus.`,
    );
  }

  const importable = rows
    .filter((r) => r.problems.length === 0 && r.rank != null)
    .sort((a, b) => a.rank! - b.rank!);

  return { rows, importable, problems };
}
