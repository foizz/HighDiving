/**
 * The two season rankings defined by the Red Bull Cliff Diving 2026 rule book.
 *
 * They are NOT two views of one total. They count different events, award different
 * points, aggregate differently, and only one of them carries the best-dive bonus:
 *
 *   World Series ranking (3.3.1)  Red Bull tour stops only. Sum of points. +1 for the
 *                                 best dive of a competition (3.4.1 — "this bonus will
 *                                 count only for the ... overall ranking").
 *   World Ranking (6.2)           Red Bull stops AND World Aquatics High Diving World
 *                                 Cups. Average of points over appearances, where the
 *                                 divisor is never less than 4.
 *
 * A World Aquatics result therefore moves a diver's World Ranking and must leave their
 * Series ranking untouched. The two functions below share no accumulator so that this
 * cannot be broken by accident, and `ranking.test.ts` asserts it directly.
 */
import type { Gender, RuleSetId } from '../rules/types';

export interface Competition {
  id: string;
  season: number;
  name: string;
  location?: string | null;
  heldOn?: string | null;
  ruleSet: RuleSetId;
  gender: Gender;
  /** Counts towards the World Series ranking — Red Bull tour stops. */
  countsForSeries: boolean;
  /** Counts towards the World Ranking — Red Bull stops plus World Aquatics World Cups. */
  countsForWorldRanking: boolean;
}

export interface Diver {
  id: string;
  name: string;
  country?: string | null;
  gender: Gender;
}

export interface CompetitionResult {
  competitionId: string;
  diverId: string;
  /** Finishing position, 1 for the winner. */
  rank: number;
  score?: number | null;
  /** Awarded the best dive of that competition (3.4.1). */
  bestDive?: boolean;
}

/** 3.3.1 — tour stop points, by finishing position. 13th and below score nothing. */
export const SERIES_POINTS = [20, 16, 13, 10, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/** 6.2 — World Ranking points, by finishing position. 21st and below score nothing. */
export const WORLD_POINTS = [
  45, 38, 32, 27, 23, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
] as const;

/** 6.2 — "if diver appearances are less than 4 events then the divisor ... is still 4". */
export const MIN_WORLD_RANKING_DIVISOR = 4;

/** The bonus for the best dive of a competition (3.4.1). Series ranking only. */
export const BEST_DIVE_BONUS = 1;

export function seriesPointsFor(rank: number): number {
  return SERIES_POINTS[rank - 1] ?? 0;
}

export function worldPointsFor(rank: number): number {
  return WORLD_POINTS[rank - 1] ?? 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Standing {
  diverId: string;
  diver: Diver | null;
  /** How many counting events the diver appeared in. */
  appearances: number;
  /** placings[n] is how many times the diver finished in position n. */
  placings: number[];
  /** Position in this table, 1-based. Ties share a position. */
  position: number;
}

export interface SeriesStanding extends Standing {
  /** Points from placings, before the best-dive bonus. */
  placingPoints: number;
  /** Number of best-dive bonuses earned. */
  bestDives: number;
  /** placingPoints + bestDives. */
  points: number;
}

export interface WorldStanding extends Standing {
  /** Sum of 6.2 points across counting events. */
  totalPoints: number;
  /** The divisor actually applied: appearances, or 4 when fewer. */
  divisor: number;
  /** totalPoints / divisor. */
  average: number;
  /** True when the divisor was floored at 4 rather than being the appearance count. */
  divisorFloored: boolean;
}

export interface RankingInput {
  season: number;
  gender: Gender;
  competitions: Competition[];
  results: CompetitionResult[];
  divers?: Diver[];
}

/**
 * 3.3.2 / 6.2 — "the better ranked diver will be the diver who has more wins, more second
 * places, etc." Returns a negative number when `a` should rank ahead of `b`.
 */
export function compareByPlacings(a: number[], b: number[]): number {
  const depth = Math.max(a.length, b.length);
  for (let rank = 1; rank < depth; rank++) {
    const diff = (b[rank] ?? 0) - (a[rank] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface Gathered {
  diverId: string;
  appearances: number;
  placings: number[];
  points: number;
  bestDives: number;
}

/**
 * Collect per-diver totals over whichever competitions `counts` selects. Private, and
 * called separately by each ranking so neither can read the other's figures.
 */
function gather(
  input: RankingInput,
  counts: (c: Competition) => boolean,
  pointsFor: (rank: number) => number,
): Map<string, Gathered> {
  const eligible = new Map(
    input.competitions
      .filter((c) => c.season === input.season && c.gender === input.gender && counts(c))
      .map((c) => [c.id, c]),
  );

  const byDiver = new Map<string, Gathered>();
  for (const result of input.results) {
    if (!eligible.has(result.competitionId)) continue;
    const entry =
      byDiver.get(result.diverId) ??
      { diverId: result.diverId, appearances: 0, placings: [], points: 0, bestDives: 0 };
    entry.appearances += 1;
    entry.placings[result.rank] = (entry.placings[result.rank] ?? 0) + 1;
    entry.points += pointsFor(result.rank);
    if (result.bestDive) entry.bestDives += 1;
    byDiver.set(result.diverId, entry);
  }
  return byDiver;
}

/** Assign 1-based positions, letting genuinely tied rows share one. */
function assignPositions<T extends { position: number }>(
  rows: T[],
  tied: (a: T, b: T) => boolean,
): T[] {
  rows.forEach((row, i) => {
    row.position = i === 0 || !tied(rows[i - 1], row) ? i + 1 : rows[i - 1].position;
  });
  return rows;
}

/**
 * World Series ranking (3.3.1): Red Bull tour stops only, points summed, plus one point
 * per best dive of a competition.
 */
export function seriesRanking(input: RankingInput): SeriesStanding[] {
  const divers = new Map((input.divers ?? []).map((d) => [d.id, d]));
  const gathered = gather(input, (c) => c.countsForSeries, seriesPointsFor);

  const rows: SeriesStanding[] = [...gathered.values()].map((g) => ({
    diverId: g.diverId,
    diver: divers.get(g.diverId) ?? null,
    appearances: g.appearances,
    placings: g.placings,
    placingPoints: g.points,
    bestDives: g.bestDives,
    points: g.points + g.bestDives * BEST_DIVE_BONUS,
    position: 0,
  }));

  rows.sort((a, b) => b.points - a.points || compareByPlacings(a.placings, b.placings));
  return assignPositions(
    rows,
    (a, b) => a.points === b.points && compareByPlacings(a.placings, b.placings) === 0,
  );
}

/**
 * World Ranking (6.2): Red Bull stops and World Aquatics High Diving World Cups, scored on
 * the 45-point scale and averaged. The divisor is the number of appearances, or 4 when the
 * diver appeared fewer than four times — so a strong three-event season is still divided
 * by four.
 */
export function worldRanking(input: RankingInput): WorldStanding[] {
  const divers = new Map((input.divers ?? []).map((d) => [d.id, d]));
  const gathered = gather(input, (c) => c.countsForWorldRanking, worldPointsFor);

  const rows: WorldStanding[] = [...gathered.values()].map((g) => {
    const divisor = Math.max(g.appearances, MIN_WORLD_RANKING_DIVISOR);
    return {
      diverId: g.diverId,
      diver: divers.get(g.diverId) ?? null,
      appearances: g.appearances,
      placings: g.placings,
      totalPoints: g.points,
      divisor,
      average: round2(g.points / divisor),
      divisorFloored: g.appearances < MIN_WORLD_RANKING_DIVISOR,
      position: 0,
    };
  });

  rows.sort((a, b) => b.average - a.average || compareByPlacings(a.placings, b.placings));
  return assignPositions(
    rows,
    (a, b) => a.average === b.average && compareByPlacings(a.placings, b.placings) === 0,
  );
}
