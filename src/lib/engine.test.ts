import { describe, expect, it } from 'vitest';
import { describeDive, parseDiveNumber, positionOf } from './dive';
import { allDives, findDive, lookupDD } from './ddTable';
import { awardNeededForTarget, scoreDive } from './scoring';
import { REDBULL, WORLD_AQUATICS, evaluateList } from '../rules';
import type { ListEntry } from '../rules';

describe('dive number parsing', () => {
  it('reads a plain three-digit dive', () => {
    const d = parseDiveNumber('102C');
    expect(d).toMatchObject({
      number: '102',
      rotation: 1,
      takeoff: 'Front',
      group: 1,
      halfSomersaults: 2,
      halfTwists: 0,
      flying: false,
      armstand: false,
    });
    expect(positionOf('102C')).toBe('C');
  });

  it('reads the flying flag from the middle digit', () => {
    expect(parseDiveNumber('112B')).toMatchObject({ flying: true, halfSomersaults: 2 });
    expect(parseDiveNumber('102B').flying).toBe(false);
  });

  it('reads a four-digit twisting dive', () => {
    expect(parseDiveNumber('5141B')).toMatchObject({
      rotation: 1,
      takeoff: 'Front',
      halfSomersaults: 4,
      halfTwists: 1,
      group: 1, // a half twist alone keeps the dive in its base group
    });
    expect(parseDiveNumber('5142D').group).toBe(6); // a full twist moves it to the twist group
  });

  it('reads the parenthesised flying form', () => {
    expect(parseDiveNumber('5(1)161B')).toMatchObject({
      flying: true,
      rotation: 1,
      halfSomersaults: 6,
      halfTwists: 1,
    });
  });

  it('reads counts of ten or more in parentheses', () => {
    expect(parseDiveNumber('51(10)1B')).toMatchObject({ halfSomersaults: 10, halfTwists: 1 });
    expect(parseDiveNumber('20(10)B')).toMatchObject({ rotation: 2, halfSomersaults: 10 });
    expect(parseDiveNumber('524(10)D')).toMatchObject({ halfSomersaults: 4, halfTwists: 10 });
  });

  it('reads armstand dives and keeps the take-off as Armstand', () => {
    expect(parseDiveNumber('611A')).toMatchObject({
      armstand: true,
      takeoff: 'Armstand',
      rotation: 1,
      halfSomersaults: 1,
      group: 5,
    });
    // Armstand inward rotation still takes off from the armstand.
    expect(parseDiveNumber('6431B')).toMatchObject({ takeoff: 'Armstand', rotation: 4 });
    expect(parseDiveNumber('6232D').group).toBe(10);
  });

  it('reads the mid-turn suffix', () => {
    expect(parseDiveNumber('5161mB')).toMatchObject({ midTurn: true, number: '5161' });
  });

  it('rejects numbers that are not a shape the rules define', () => {
    for (const bad of ['', 'abc', '7', '10', '1024', '5(2)141', '9999']) {
      expect(() => parseDiveNumber(bad), bad).toThrow();
    }
  });

  it('describes a dive from its number alone', () => {
    expect(describeDive(parseDiveNumber('5141'))).toBe('Forward 2 Somersaults 1/2 Twist');
    expect(describeDive(parseDiveNumber('611'))).toBe('Armstand Forward 1/2 Somersault');
  });
});

describe('DD tables', () => {
  // Values read directly from the two rule books.
  it('matches the World Aquatics 27 m table', () => {
    expect(findDive('worldaquatics', '102')!.dd['27']).toEqual({ A: 3.0, B: 2.8, C: 2.7, E: 2.9 });
    expect(findDive('worldaquatics', '204')!.dd['27']).toEqual({ A: 3.3, B: 3.1, C: 2.9, E: 3.2 });
  });

  it('matches the World Aquatics 20 m table', () => {
    expect(findDive('worldaquatics', '102')!.dd['20']).toEqual({ A: 2.9, B: 2.7, C: 2.6, E: 2.8 });
  });

  it('matches the Red Bull 2025 table', () => {
    expect(findDive('redbull', '102')!.dd['27']).toEqual({ A: 3.0, B: 2.8, C: 2.7, E: 2.9 });
    expect(findDive('redbull', '202')!.dd['27']).toEqual({ A: 2.8, B: 2.6, C: 2.5, E: 2.7 });
  });

  it('keeps the two rule books distinct where they genuinely differ', () => {
    // Red Bull's 2025 table is not the same document as the FINA 2017-2021 table.
    expect(findDive('worldaquatics', '202')!.dd['27']!.A).toBe(2.9);
    expect(findDive('redbull', '202')!.dd['27']!.A).toBe(2.8);
    expect(findDive('worldaquatics', '106')!.dd['27']!.B).toBe(3.8);
    expect(findDive('redbull', '106')!.dd['27']!.B).toBe(3.9);
  });

  it('reports an untabled position as unavailable rather than inventing a DD', () => {
    // 102 has no Free (D) entry in either book.
    expect(lookupDD('redbull', '102', 'D', '27')).toMatchObject({ dd: null, source: 'none' });
    expect(lookupDD('redbull', '102', 'A', '27')).toMatchObject({ dd: 3.0, source: 'table' });
  });

  it('has every tabled dive number parseable by the dive parser', () => {
    for (const ruleSet of ['redbull', 'worldaquatics'] as const) {
      for (const dive of allDives(ruleSet)) {
        expect(() => parseDiveNumber(dive.number), `${ruleSet} ${dive.number}`).not.toThrow();
      }
    }
  });

  it('agrees with the table about which group each dive belongs to', () => {
    for (const ruleSet of ['redbull', 'worldaquatics'] as const) {
      for (const dive of allDives(ruleSet)) {
        // Mid-turn dives are tabled with their base group; the parser agrees.
        expect(parseDiveNumber(dive.number).group, `${ruleSet} ${dive.number}`).toBe(dive.group);
      }
    }
  });
});

describe('scoring', () => {
  it('reproduces the worked example printed in both rule books', () => {
    // 8.0, 7.5, 7.5, 7.5, 7.0 = 22.5 x 3.8 = 85.5
    const five = scoreDive([8.0, 7.5, 7.5, 7.5, 7.0], 3.8, 5);
    expect(five.sum).toBe(22.5);
    expect(five.points).toBe(85.5);
    expect(five.droppedHigh).toEqual([8.0]);
    expect(five.droppedLow).toEqual([7.0]);

    // 8.0, 7.5, 7.5, 7.5, 7.5, 7.5, 7.0 = 22.5 x 3.8 = 85.5
    const seven = scoreDive([8.0, 7.5, 7.5, 7.5, 7.5, 7.5, 7.0], 3.8, 7);
    expect(seven.sum).toBe(22.5);
    expect(seven.points).toBe(85.5);
    expect(seven.counted).toHaveLength(3);
  });

  it('drops two from each end on a panel of seven', () => {
    const s = scoreDive([10, 9, 8, 7, 6, 5, 4], 2.0, 7);
    expect(s.counted).toEqual([6, 7, 8]);
    expect(s.droppedLow).toEqual([4, 5]);
    expect(s.droppedHigh).toEqual([9, 10]);
  });

  it('counts every award until the panel is complete', () => {
    const s = scoreDive([8.0, 7.5], 3.0, 5);
    expect(s.counted).toEqual([7.5, 8.0]);
  });
});

describe('target score', () => {
  it('solves for the award needed across the remaining dives', () => {
    // Need 100 more points over dives of DD 3.0 and 3.4: 100 / (3 * 6.4) = 5.208 -> 5.5
    const r = awardNeededForTarget(300, 200, [3.0, 3.4]);
    expect(r.remaining).toBe(100);
    expect(r.requiredAward).toBe(5.5);
    expect(r.impossible).toBe(false);
  });

  it('rounds up so the target is actually met', () => {
    const r = awardNeededForTarget(100, 0, [3.0]);
    // 100 / 9 = 11.1 -> beyond a perfect panel
    expect(r.impossible).toBe(true);
    expect(r.requiredAward).toBeNull();
  });

  it('reports a target already reached', () => {
    expect(awardNeededForTarget(100, 120, [3.0])).toMatchObject({
      alreadyReached: true,
      remaining: 0,
    });
  });
});

const entry = (slot: ListEntry['slot'], number: string, position: ListEntry['position']): ListEntry => ({
  slot,
  number,
  position,
});

describe('list validation', () => {
  /** A legal Red Bull men's list: four different take-offs, within the DD limits. */
  const legal: ListEntry[] = [
    entry('required', '102', 'B'), // Front,    DD 2.8
    entry('intermediate', '202', 'B'), // Back,  DD 2.6
    entry('optional1', '307', 'B'), // placeholder, replaced per test
    entry('optional2', '611', 'A'), // Armstand
  ];

  it('accepts a compliant Red Bull list', () => {
    const list = [...legal];
    list[2] = entry('optional1', '406', 'B'); // Inward
    const result = evaluateList(list, REDBULL, 'men');
    expect(result.violations.filter((v) => v.level === 'error')).toEqual([]);
    expect(result.dives.every((d) => !d.failed)).toBe(true);
    expect(result.valid).toBe(true);
    // 2.8 + 2.6 + 4.2 + 3.0
    expect(result.totalDD).toBe(12.6);
    expect(result.maxScore).toBe(378);
  });

  it('fails a Red Bull list that reuses a take-off', () => {
    const list = [...legal];
    list[2] = entry('optional1', '206', 'B'); // Back again, clashing with the intermediate
    const result = evaluateList(list, REDBULL, 'men');
    const clash = result.dives.filter((d) => d.violations.some((v) => /different take-offs/.test(v.message)));
    expect(clash.map((d) => d.number).sort()).toEqual(['202', '206']);
    expect(clash.every((d) => d.failed)).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('allows the same take-off across the two pairs under World Aquatics', () => {
    // Required Front / intermediate Back, optionals Front / Armstand: legal for World
    // Aquatics (each pair differs) but illegal for Red Bull (four distinct required).
    const list: ListEntry[] = [
      entry('required', '102', 'B'),
      entry('intermediate', '202', 'B'),
      entry('optional1', '107', 'B'),
      entry('optional2', '611', 'A'),
    ];
    const wa = evaluateList([...list], WORLD_AQUATICS, 'men');
    expect(wa.violations.some((v) => /take-offs/.test(v.message))).toBe(false);

    const rb = evaluateList([...list], REDBULL, 'men');
    expect(rb.dives.some((d) => d.violations.some((v) => /different take-offs/.test(v.message)))).toBe(true);
  });

  it('caps an over-limit required dive under World Aquatics but zeroes it under Red Bull', () => {
    // 106B at 27 m is well above the 2.8 required limit in both books.
    const list: ListEntry[] = [
      entry('required', '106', 'B'),
      entry('intermediate', '202', 'B'),
      entry('optional1', '406', 'B'),
      entry('optional2', '611', 'A'),
    ];
    const wa = evaluateList([...list], WORLD_AQUATICS, 'men');
    const waDive = wa.dives.find((d) => d.slot === 'required')!;
    expect(waDive.rawDD).toBe(3.8);
    expect(waDive.effectiveDD).toBe(2.8);
    expect(waDive.capped).toBe(true);
    expect(waDive.failed).toBe(false);

    const rb = evaluateList([...list], REDBULL, 'men');
    const rbDive = rb.dives.find((d) => d.slot === 'required')!;
    expect(rbDive.rawDD).toBe(3.9);
    expect(rbDive.effectiveDD).toBe(0);
    expect(rbDive.failed).toBe(true);
  });

  it('uses the lower women limits and the 20 m column', () => {
    const list: ListEntry[] = [entry('required', '102', 'A')];
    const men = evaluateList(list, REDBULL, 'men');
    const women = evaluateList(list, REDBULL, 'women');
    expect(men.dives[0].rawDD).toBe(3.0);
    expect(women.dives[0].rawDD).toBe(2.9);
    // 2.9 is above the women's required limit of 2.6, so Red Bull zeroes it.
    expect(women.dives[0].failed).toBe(true);
  });

  it('judges a women\'s list at the 20 m column and the lower limits', () => {
    // 102C is 2.7 at 27 m and 2.6 at 20 m, so it is inside the required limit for both.
    const legalForBoth: ListEntry[] = [
      entry('required', '102', 'C'),
      entry('intermediate', '202', 'B'),
      entry('optional1', '406', 'B'),
      entry('optional2', '611', 'B'),
    ];
    const women = evaluateList(legalForBoth, REDBULL, 'women');
    expect(women.dives[0].rawDD).toBe(2.6); // the 20 m column, not the 27 m one
    expect(women.valid).toBe(true);
    const men = evaluateList(legalForBoth, REDBULL, 'men');
    expect(men.dives[0].rawDD).toBe(2.7);
    expect(men.valid).toBe(true);
  });

  it('rejects a required dive that is inside the men limit but over the women one', () => {
    // 102B is 2.8 at 27 m — exactly the men's required limit — and 2.7 at 20 m, which is
    // over the women's 2.6. The identical list is legal as a men's list and not as a women's.
    const list: ListEntry[] = [
      entry('required', '102', 'B'),
      entry('intermediate', '202', 'B'),
      entry('optional1', '406', 'B'),
      entry('optional2', '611', 'B'),
    ];
    const men = evaluateList(list, REDBULL, 'men');
    expect(men.dives[0].rawDD).toBe(2.8);
    expect(men.dives[0].failed).toBe(false);
    expect(men.valid).toBe(true);

    const women = evaluateList(list, REDBULL, 'women');
    expect(women.dives[0].rawDD).toBe(2.7);
    expect(women.dives[0].failed).toBe(true);
    expect(women.valid).toBe(false);
  });

  it('applies the women intermediate limit of 3.4', () => {
    const slots = REDBULL.slots('women');
    expect(slots.find((s) => s.id === 'required')!.maxDD).toBe(2.6);
    expect(slots.find((s) => s.id === 'intermediate')!.maxDD).toBe(3.4);
    expect(WORLD_AQUATICS.slots('women').find((s) => s.id === 'intermediate')!.maxDD).toBe(3.4);
  });

  it('zeroes every copy of a repeated dive', () => {
    const list: ListEntry[] = [
      entry('required', '102', 'B'),
      entry('intermediate', '102', 'C'),
      entry('optional1', '406', 'B'),
      entry('optional2', '611', 'A'),
    ];
    const result = evaluateList(list, REDBULL, 'men');
    const repeats = result.dives.filter((d) => d.number === '102');
    expect(repeats).toHaveLength(2);
    expect(repeats.every((d) => d.failed)).toBe(true);
  });

  it('flags a dive that is not in the chosen book', () => {
    const result = evaluateList([entry('required', '999', 'B')], REDBULL, 'men');
    expect(result.dives[0].failed).toBe(true);
    expect(result.dives[0].violations[0].message).toMatch(/not in the Red Bull table/);
  });
});
