import type { Position, Takeoff } from '../lib/dive';

export type RuleSetId = 'redbull' | 'worldaquatics';
export type Gender = 'men' | 'women';

/** The four slots a competition list is built from, in diving order. */
export type SlotId = 'required' | 'intermediate' | 'optional1' | 'optional2';

export interface SlotDef {
  id: SlotId;
  label: string;
  /** Maximum DD for this slot, or null when the slot is unlimited. */
  maxDD: number | null;
}

/**
 * What happens when a dive exceeds its slot's DD limit.
 *
 *  - `cap`  The dive is legal, the DD is simply clamped to the limit — World Aquatics:
 *           "If a diver performs a dive above 2.8 they will only receive 2.8". Both
 *           rule sets use this.
 *  - `zero` The dive is a failed dive and scores nothing.
 */
export type OverLimitBehaviour = 'cap' | 'zero';

/**
 * How take-off variety is enforced across the list.
 *
 *  - `allDistinct` all four dives must use different take-offs (Red Bull 3.5.1).
 *  - `pairwise`    the required and intermediate must differ from each other, and the
 *                  two optionals from each other (World Aquatics 3.4.1/3.4.2).
 *
 * Both books speak of take-off "groups"; Red Bull makes the equivalence explicit —
 * "4 different take offs out of the 5 take off groups" — so both are evaluated against
 * the five take-off positions rather than the ten table groups.
 */
export type TakeoffRule = 'allDistinct' | 'pairwise';

export interface RuleSet {
  id: RuleSetId;
  name: string;
  shortName: string;
  /** Where the rules below come from, shown in the UI so figures are traceable. */
  source: string;
  /** Platform height in metres, keyed by gender, used to pick the DD column. */
  heights: Record<Gender, { table: '27' | '20'; label: string }>;
  judgeCounts: number[];
  defaultJudgeCount: number;
  slots: (gender: Gender) => SlotDef[];
  overLimit: OverLimitBehaviour;
  takeoffRule: TakeoffRule;
  /** Rule citation shown alongside a repeated-dive violation. */
  citations: {
    repeat: string;
    takeoff: string;
    overLimit: string;
    scoring: string;
  };
}

export interface ListEntry {
  slot: SlotId;
  /** Dive number without position letter, e.g. "5141". */
  number: string;
  position: Position;
}

export type ViolationLevel = 'error' | 'warning';

export interface Violation {
  level: ViolationLevel;
  /** The slot the problem belongs to, or null when it is about the list as a whole. */
  slot: SlotId | null;
  message: string;
  citation: string;
}

export interface EvaluatedDive {
  slot: SlotId;
  number: string;
  position: Position;
  description: string;
  takeoff: Takeoff | null;
  group: number | null;
  /** DD as tabled or computed, before any slot limit is applied. */
  rawDD: number | null;
  /** DD actually used for scoring, after the rule set's over-limit behaviour. */
  effectiveDD: number;
  /** True when rawDD exceeded the slot limit and the rule set caps rather than zeroes. */
  capped: boolean;
  /** True when this dive scores nothing because it breaks a rule. */
  failed: boolean;
  violations: Violation[];
}

export interface ListEvaluation {
  dives: EvaluatedDive[];
  violations: Violation[];
  /** Sum of effective DDs for dives that can score. */
  totalDD: number;
  /** Highest total reachable with straight 10s, i.e. totalDD * 3 * 10. */
  maxScore: number;
  valid: boolean;
}
