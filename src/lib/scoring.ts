/**
 * Score calculation, which is identical in both rule books:
 * cancel the highest and lowest awards, add the remaining three, multiply by the DD.
 *
 *   5 judges (Red Bull 12.1.3)      drop 1 high + 1 low
 *   7 judges (World Aquatics HD 6.5) drop 2 high + 2 low
 *
 * Both books give the same worked example: 8.0, 7.5, 7.5, 7.5, 7.0 = 22.5 x 3.8 = 85.5
 */

export const MIN_AWARD = 0;
export const MAX_AWARD = 10;

/** Awards are given in half points (Red Bull 12.1.2 / HD 6.2). */
export const AWARD_STEP = 0.5;

export interface DiveScore {
  /** The awards actually counted, after the highest and lowest were cancelled. */
  counted: number[];
  /** Awards dropped as too high. */
  droppedHigh: number[];
  /** Awards dropped as too low. */
  droppedLow: number[];
  /** Sum of the counted awards. */
  sum: number;
  /** The DD applied — already capped by the rule set, where it caps. */
  dd: number;
  /** sum x dd, rounded to 2dp to avoid floating point noise in totals. */
  points: number;
}

/** How many awards are cancelled from each end for a given panel size. */
export function dropPerSide(judgeCount: number): number {
  if (judgeCount >= 7) return 2;
  if (judgeCount >= 5) return 1;
  // With fewer than five judges the rules give no cancellation scheme; count them all.
  return 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Score a single dive. `awards` may be shorter than `judgeCount` while a user is still
 * filling the panel in; the cancellation is applied only once enough awards are present
 * for it to be meaningful, so a partially entered dive still shows a sensible running sum.
 */
export function scoreDive(awards: number[], dd: number, judgeCount: number): DiveScore {
  const sorted = [...awards].sort((a, b) => a - b);
  const drop = sorted.length >= judgeCount ? dropPerSide(judgeCount) : 0;
  const droppedLow = sorted.slice(0, drop);
  const droppedHigh = drop > 0 ? sorted.slice(-drop) : [];
  const counted = sorted.slice(drop, drop === 0 ? undefined : -drop);
  const sum = counted.reduce((a, b) => a + b, 0);
  return {
    counted,
    droppedHigh,
    droppedLow,
    sum: round2(sum),
    dd,
    points: round2(sum * dd),
  };
}

/**
 * The award each remaining dive would need to average in order to reach `target`.
 *
 * This is the "what do I need to beat that score?" question. It returns the per-judge
 * award needed, assuming the three counting judges all give the same mark, and tells
 * the caller when the target is already met or is out of reach even with straight 10s.
 */
export interface TargetResult {
  /** Points still needed. Zero when the target is already reached. */
  remaining: number;
  /** Award each counting judge must give on every remaining dive. Null if unreachable. */
  requiredAward: number | null;
  /** True when the target cannot be reached even with a perfect 10 from every judge. */
  impossible: boolean;
  /** True when the target has already been exceeded. */
  alreadyReached: boolean;
  /** The best total still achievable from the remaining dives. */
  maxAchievable: number;
}

export function awardNeededForTarget(
  target: number,
  scoredSoFar: number,
  remainingDDs: number[],
): TargetResult {
  const remaining = round2(target - scoredSoFar);
  const ddSum = remainingDDs.reduce((a, b) => a + b, 0);
  const maxAchievable = round2(scoredSoFar + ddSum * 3 * MAX_AWARD);

  if (remaining <= 0) {
    return {
      remaining: 0,
      requiredAward: null,
      impossible: false,
      alreadyReached: true,
      maxAchievable,
    };
  }
  if (ddSum === 0) {
    return { remaining, requiredAward: null, impossible: true, alreadyReached: false, maxAchievable };
  }

  // remaining = sum(dd_i) * 3 * award  =>  award = remaining / (3 * sum(dd_i))
  const award = remaining / (3 * ddSum);
  if (award > MAX_AWARD) {
    return { remaining, requiredAward: null, impossible: true, alreadyReached: false, maxAchievable };
  }
  // Round up to the next half point: a lower award would fall short of the target.
  const rounded = Math.ceil(award / AWARD_STEP) * AWARD_STEP;
  return {
    remaining,
    requiredAward: round2(Math.min(rounded, MAX_AWARD)),
    impossible: false,
    alreadyReached: false,
    maxAchievable,
  };
}
