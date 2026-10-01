import { lookupDD } from '../lib/ddTable';
import { tryParseDiveNumber } from '../lib/dive';
import { round2 } from '../lib/scoring';
import type { HeightKey } from '../lib/ddTable';
import type {
  EvaluatedDive,
  Gender,
  ListEntry,
  ListEvaluation,
  RuleSet,
  SlotId,
  Violation,
} from './types';

const SLOT_ORDER: SlotId[] = ['required', 'intermediate', 'optional1', 'optional2'];

/**
 * Evaluate a dive list against a rule set: resolve each dive's DD, apply the slot
 * limits the way this rule set applies them, and report every rule the list breaks.
 *
 * Violations are reported rather than thrown — a half-built list is a normal state in
 * the editor, and the caller wants to show the problems, not stop.
 */
export function evaluateList(
  entries: ListEntry[],
  ruleSet: RuleSet,
  gender: Gender,
): ListEvaluation {
  const height = ruleSet.heights[gender].table as HeightKey;
  const slotDefs = ruleSet.slots(gender);
  const listViolations: Violation[] = [];

  const dives: EvaluatedDive[] = [];

  for (const def of slotDefs) {
    const entry = entries.find((e) => e.slot === def.id);
    if (!entry || !entry.number.trim()) continue;

    const violations: Violation[] = [];
    const lookup = lookupDD(ruleSet.id, entry.number, entry.position, height);
    const parsed = lookup.parsed ?? tryParseDiveNumber(entry.number);

    let rawDD = lookup.dd;
    let effectiveDD = rawDD ?? 0;
    let capped = false;
    let failed = false;

    if (rawDD == null) {
      failed = true;
      violations.push({
        level: 'error',
        slot: def.id,
        message: lookup.dive
          ? `${entry.number} is not listed in position ${entry.position} at ${ruleSet.heights[gender].label}.`
          : `${entry.number} is not in the ${ruleSet.shortName} table.`,
        citation: ruleSet.source,
      });
    } else if (def.maxDD != null && rawDD > def.maxDD) {
      if (ruleSet.overLimit === 'cap') {
        capped = true;
        effectiveDD = def.maxDD;
        violations.push({
          level: 'warning',
          slot: def.id,
          message: `DD ${rawDD.toFixed(1)} is above the ${def.label.toLowerCase()} limit of ${def.maxDD.toFixed(1)} — it will score as ${def.maxDD.toFixed(1)}.`,
          citation: ruleSet.citations.overLimit,
        });
      } else {
        failed = true;
        effectiveDD = 0;
        violations.push({
          level: 'error',
          slot: def.id,
          message: `DD ${rawDD.toFixed(1)} is above the ${def.label.toLowerCase()} limit of ${def.maxDD.toFixed(1)} — this counts as a failed dive.`,
          citation: ruleSet.citations.overLimit,
        });
      }
    }

    dives.push({
      slot: def.id,
      number: entry.number.trim().toUpperCase(),
      position: entry.position,
      description: lookup.description,
      takeoff: parsed?.takeoff ?? null,
      group: lookup.dive?.group ?? parsed?.group ?? null,
      rawDD,
      effectiveDD,
      capped,
      failed,
      violations,
    });
  }

  // --- Repeated dives. Both books treat the same dive number as the same dive,
  // regardless of the position it is performed in.
  const byNumber = new Map<string, EvaluatedDive[]>();
  for (const d of dives) {
    const list = byNumber.get(d.number) ?? [];
    list.push(d);
    byNumber.set(d.number, list);
  }
  for (const [number, group] of byNumber) {
    if (group.length < 2) continue;
    for (const d of group) {
      d.failed = true;
      d.effectiveDD = 0;
      d.violations.push({
        level: 'error',
        slot: d.slot,
        message: `${number} appears ${group.length} times — a repeated dive scores zero.`,
        citation: ruleSet.citations.repeat,
      });
    }
  }

  // --- Take-off variety.
  const withTakeoff = dives.filter((d) => d.takeoff);
  if (ruleSet.takeoffRule === 'allDistinct') {
    const seen = new Map<string, EvaluatedDive[]>();
    for (const d of withTakeoff) {
      const list = seen.get(d.takeoff!) ?? [];
      list.push(d);
      seen.set(d.takeoff!, list);
    }
    for (const [takeoff, group] of seen) {
      if (group.length < 2) continue;
      const where = group.map((d) => d.number).join(' and ');
      for (const d of group) {
        d.failed = true;
        d.effectiveDD = 0;
        d.violations.push({
          level: 'error',
          slot: d.slot,
          message: `All four dives must use different take-offs; ${where} are both ${takeoff}.`,
          citation: ruleSet.citations.takeoff,
        });
      }
    }
  } else {
    const pairs: [SlotId, SlotId, string][] = [
      ['required', 'intermediate', 'The required and intermediate dives'],
      ['optional1', 'optional2', 'The two optional dives'],
    ];
    for (const [a, b, label] of pairs) {
      const first = dives.find((d) => d.slot === a);
      const second = dives.find((d) => d.slot === b);
      if (!first?.takeoff || !second?.takeoff) continue;
      if (first.takeoff !== second.takeoff) continue;
      for (const d of [first, second]) {
        d.violations.push({
          level: 'error',
          slot: d.slot,
          message: `${label} must come from different take-offs; both are ${first.takeoff}.`,
          citation: ruleSet.citations.takeoff,
        });
      }
      listViolations.push({
        level: 'error',
        slot: null,
        message: `${label} must come from different take-offs.`,
        citation: ruleSet.citations.takeoff,
      });
    }
  }

  // --- Completeness.
  const filled = dives.length;
  if (filled < SLOT_ORDER.length) {
    listViolations.push({
      level: 'warning',
      slot: null,
      message: `${SLOT_ORDER.length - filled} of ${SLOT_ORDER.length} dives still to choose.`,
      citation: ruleSet.source,
    });
  }

  const totalDD = round2(dives.reduce((n, d) => n + (d.failed ? 0 : d.effectiveDD), 0));
  const hasError =
    listViolations.some((v) => v.level === 'error') ||
    dives.some((d) => d.violations.some((v) => v.level === 'error'));

  return {
    dives,
    violations: listViolations,
    totalDD,
    maxScore: round2(totalDD * 3 * 10),
    valid: filled === SLOT_ORDER.length && !hasError,
  };
}
