/**
 * Everything the `ask` edge function is allowed to compute with.
 *
 * This file exists so the assistant runs the same code as the app rather than a copy:
 * `npm run build:engine` bundles it to supabase/functions/_shared/engine.js, which the
 * Deno function imports. If a DD or a ruling changes here, it changes for the assistant
 * too, and the tests that cover these functions cover both callers.
 *
 * Keep this surface pure — no React, no browser APIs, no Supabase client.
 */
export {
  POSITIONS,
  POSITION_NAMES,
  TAKEOFFS,
  GROUP_NAMES,
  parseDiveNumber,
  tryParseDiveNumber,
  describeDive,
  positionOf,
} from './lib/dive';

export { allDives, findDive, lookupDD, positionsFor, tableSource } from './lib/ddTable';

export {
  scoreDive,
  awardNeededForTarget,
  dropPerSide,
  MAX_AWARD,
  AWARD_STEP,
} from './lib/scoring';

export { RULE_SETS, RULE_SET_IDS, REDBULL, WORLD_AQUATICS, evaluateList } from './rules';

export {
  seriesRanking,
  worldRanking,
  seriesPointsFor,
  worldPointsFor,
  SERIES_POINTS,
  WORLD_POINTS,
  MIN_WORLD_RANKING_DIVISOR,
  BEST_DIVE_BONUS,
} from './lib/ranking';

export type { Position, Takeoff, ParsedDive } from './lib/dive';
export type { HeightKey, TableDive } from './lib/ddTable';
export type { Gender, RuleSetId, ListEntry, SlotId } from './rules/types';
export type {
  Competition,
  CompetitionResult,
  Diver,
  RankingInput,
  SeriesStanding,
  WorldStanding,
} from './lib/ranking';
