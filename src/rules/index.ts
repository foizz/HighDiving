import type { Gender, RuleSet, RuleSetId, SlotDef } from './types';

/**
 * Both books cap the required dive at 2.8 (men) / 2.6 (women) and the intermediate at
 * 3.6 / 3.4, and leave both optionals unlimited. They differ in what happens when a
 * dive exceeds its cap, and in how much take-off variety the list must show.
 */
function slots(gender: Gender): SlotDef[] {
  const required = gender === 'men' ? 2.8 : 2.6;
  const intermediate = gender === 'men' ? 3.6 : 3.4;
  return [
    { id: 'required', label: 'Required', maxDD: required },
    { id: 'intermediate', label: 'Intermediate', maxDD: intermediate },
    { id: 'optional1', label: 'Optional 1', maxDD: null },
    { id: 'optional2', label: 'Optional 2', maxDD: null },
  ];
}

export const REDBULL: RuleSet = {
  id: 'redbull',
  name: 'Red Bull Cliff Diving World Series',
  shortName: 'Red Bull',
  source: 'Red Bull Cliff Diving World Series 2026 Rule Book',
  heights: {
    men: { table: '27', label: '26.5–28 m' },
    women: { table: '20', label: '20–22 m' },
  },
  judgeCounts: [5],
  defaultJudgeCount: 5,
  slots,
  overLimit: 'cap',
  takeoffRule: 'allDistinct',
  citations: {
    repeat: 'Red Bull 3.5.3',
    takeoff: 'Red Bull 3.5.1',
    overLimit: 'Red Bull 3.1 / 3.5.3',
    scoring: 'Red Bull 12.1.3',
  },
};

export const WORLD_AQUATICS: RuleSet = {
  id: 'worldaquatics',
  name: 'World Aquatics High Diving',
  shortName: 'World Aquatics',
  source: 'World Aquatics High Diving Competition Regulations (in force 9 Nov 2024)',
  heights: {
    men: { table: '27', label: '27 m' },
    women: { table: '20', label: '20 m' },
  },
  judgeCounts: [7, 5],
  defaultJudgeCount: 7,
  slots,
  overLimit: 'cap',
  takeoffRule: 'pairwise',
  citations: {
    repeat: 'HD 3.3.1',
    takeoff: 'HD 3.4.1 / 3.4.2',
    overLimit: 'HD 3.4.1 / 3.4.2',
    scoring: 'HD 6.5 / 6.6',
  },
};

export const RULE_SETS: Record<RuleSetId, RuleSet> = {
  redbull: REDBULL,
  worldaquatics: WORLD_AQUATICS,
};

export const RULE_SET_IDS: RuleSetId[] = ['redbull', 'worldaquatics'];

export * from './types';
export * from './validate';
