import finaTable from '../data/dd-table.json';
import redbullTable from '../data/dd-table.redbull.json';
import { GROUP_NAMES, describeDive, parseDiveNumber, tryParseDiveNumber } from './dive';
import type { ParsedDive, Position } from './dive';
import type { RuleSetId } from '../rules/types';

/** Platform heights the tables are published for. */
export type HeightKey = '27' | '20' | '15' | '10_12';

export interface TableDive {
  number: string;
  description: string;
  group: number;
  groupName: string;
  dd: Partial<Record<HeightKey, Partial<Record<Position, number>>>>;
}

interface TableFile {
  source: string;
  dives: TableDive[];
}

const TABLES: Record<RuleSetId, TableFile> = {
  worldaquatics: finaTable as TableFile,
  redbull: redbullTable as TableFile,
};

const INDEX: Record<RuleSetId, Map<string, TableDive>> = {
  worldaquatics: new Map(finaTable.dives.map((d) => [d.number, d as TableDive])),
  redbull: new Map(redbullTable.dives.map((d) => [d.number, d as TableDive])),
};

export function tableSource(ruleSet: RuleSetId): string {
  return TABLES[ruleSet].source;
}

/** Every tabled dive for a rule set, in group then number order. */
export function allDives(ruleSet: RuleSetId): TableDive[] {
  return TABLES[ruleSet].dives;
}

/** The heights a rule set's table actually publishes. */
export function heightsFor(ruleSet: RuleSetId): HeightKey[] {
  const seen = new Set<HeightKey>();
  for (const d of TABLES[ruleSet].dives) {
    for (const h of Object.keys(d.dd)) seen.add(h as HeightKey);
  }
  return [...seen];
}

export function findDive(ruleSet: RuleSetId, number: string): TableDive | null {
  return INDEX[ruleSet].get(number.trim().toUpperCase()) ?? null;
}

/** The positions a dive is tabled for at a height — i.e. the legal positions. */
export function positionsFor(
  ruleSet: RuleSetId,
  number: string,
  height: HeightKey,
): Position[] {
  const dive = findDive(ruleSet, number);
  if (!dive) return [];
  const at = dive.dd[height];
  return at ? (Object.keys(at) as Position[]) : [];
}

export interface DDLookup {
  dd: number | null;
  /** Where the number came from. `none` means the dive is not tabled at this height. */
  source: 'table' | 'none';
  dive: TableDive | null;
  parsed: ParsedDive | null;
  description: string;
}

/**
 * Look up the degree of difficulty for a dive at a height in a position.
 *
 * Both rule books publish a table rather than only a formula, and a dive that is not
 * in the table for a given height/position is not a dive that may be performed there,
 * so an absent entry is reported as `none` rather than being computed and presented as
 * if it were official.
 */
export function lookupDD(
  ruleSet: RuleSetId,
  number: string,
  position: Position,
  height: HeightKey,
): DDLookup {
  const key = number.trim().toUpperCase();
  const dive = findDive(ruleSet, key);
  const parsed = tryParseDiveNumber(key);
  const description = dive?.description ?? (parsed ? describeDive(parsed) : key);
  const dd = dive?.dd[height]?.[position];
  return {
    dd: dd ?? null,
    source: dd == null ? 'none' : 'table',
    dive,
    parsed,
    description,
  };
}

/** Group label for display, preferring the table's own wording. */
export function groupLabel(dive: TableDive | null, parsed: ParsedDive | null): string {
  if (dive) return `${dive.group} · ${dive.groupName}`;
  if (parsed) return `${parsed.group} · ${GROUP_NAMES[parsed.group] ?? ''}`.trim();
  return '';
}

/** Re-exported so callers do not need to reach into the parser for the common case. */
export { parseDiveNumber, tryParseDiveNumber };
