import { describe, expect, it } from 'vitest';
import {
  SERIES_POINTS,
  WORLD_POINTS,
  compareByPlacings,
  seriesPointsFor,
  seriesRanking,
  worldPointsFor,
  worldRanking,
  type Competition,
  type CompetitionResult,
  type Diver,
  type RankingInput,
} from './ranking';

const diver = (id: string, name: string): Diver => ({ id, name, gender: 'men' });

/** A Red Bull tour stop: counts for both tables. */
const stop = (id: string): Competition => ({
  id,
  season: 2026,
  name: `Stop ${id}`,
  ruleSet: 'redbull',
  gender: 'men',
  countsForSeries: true,
  countsForWorldRanking: true,
});

/** A World Aquatics World Cup: counts for the World Ranking only (6.2). */
const worldCup = (id: string): Competition => ({
  id,
  season: 2026,
  name: `World Cup ${id}`,
  ruleSet: 'worldaquatics',
  gender: 'men',
  countsForSeries: false,
  countsForWorldRanking: true,
});

const res = (
  competitionId: string,
  diverId: string,
  rank: number,
  bestDive = false,
): CompetitionResult => ({ competitionId, diverId, rank, bestDive });

function input(partial: Partial<RankingInput> & Pick<RankingInput, 'competitions' | 'results'>): RankingInput {
  return { season: 2026, gender: 'men', divers: [diver('d1', 'A')], ...partial };
}

describe('points tables', () => {
  it('matches the rule book scales', () => {
    // 3.3.1
    expect([...SERIES_POINTS]).toEqual([20, 16, 13, 10, 8, 7, 6, 5, 4, 3, 2, 1]);
    // 6.2
    expect([...WORLD_POINTS]).toEqual([
      45, 38, 32, 27, 23, 20, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it('scores nothing below the end of each scale', () => {
    // "If 13 divers participate in a tour stop, the 13th place will receive 0 points"
    expect(seriesPointsFor(12)).toBe(1);
    expect(seriesPointsFor(13)).toBe(0);
    expect(seriesPointsFor(99)).toBe(0);
    expect(worldPointsFor(20)).toBe(1);
    expect(worldPointsFor(21)).toBe(0);
  });
});

describe('World Series ranking (3.3.1)', () => {
  it('sums tour stop points', () => {
    const table = seriesRanking(
      input({
        competitions: [stop('s1'), stop('s2'), stop('s3')],
        results: [res('s1', 'd1', 1), res('s2', 'd1', 4), res('s3', 'd1', 6)],
      }),
    );
    // 20 + 10 + 7
    expect(table[0].points).toBe(37);
    expect(table[0].appearances).toBe(3);
    expect(table[0].position).toBe(1);
  });

  it('adds one point for the best dive of a competition (3.4.1)', () => {
    const table = seriesRanking(
      input({
        competitions: [stop('s1')],
        results: [res('s1', 'd1', 3, true)],
      }),
    );
    expect(table[0].placingPoints).toBe(13);
    expect(table[0].bestDives).toBe(1);
    expect(table[0].points).toBe(14);
  });

  it('ignores World Aquatics competitions entirely', () => {
    const table = seriesRanking(
      input({
        competitions: [stop('s1'), worldCup('w1')],
        results: [res('s1', 'd1', 2), res('w1', 'd1', 1, true)],
      }),
    );
    // Only the tour stop counts: 16, and the World Cup best dive is not a series bonus.
    expect(table[0].points).toBe(16);
    expect(table[0].appearances).toBe(1);
  });
});

describe('World Ranking (6.2)', () => {
  it('averages over appearances once there are at least four', () => {
    const comps = ['s1', 's2', 's3', 's4'].map(stop);
    const table = worldRanking(
      input({
        competitions: comps,
        results: [
          res('s1', 'd1', 1), // 45
          res('s2', 'd1', 2), // 38
          res('s3', 'd1', 3), // 32
          res('s4', 'd1', 4), // 27
        ],
      }),
    );
    expect(table[0].totalPoints).toBe(142);
    expect(table[0].divisor).toBe(4);
    expect(table[0].average).toBe(35.5);
    expect(table[0].divisorFloored).toBe(false);
  });

  it('still divides by four when the diver appeared fewer than four times', () => {
    const table = worldRanking(
      input({
        competitions: [stop('s1'), stop('s2'), stop('s3')],
        results: [res('s1', 'd1', 1), res('s2', 'd1', 4), res('s3', 'd1', 6)],
      }),
    );
    // 45 + 27 + 20 = 92, over a floored divisor of 4
    expect(table[0].totalPoints).toBe(92);
    expect(table[0].appearances).toBe(3);
    expect(table[0].divisor).toBe(4);
    expect(table[0].average).toBe(23);
    expect(table[0].divisorFloored).toBe(true);
  });

  it('divides by the real count above four', () => {
    const comps = ['s1', 's2', 's3', 's4', 's5'].map(stop);
    const table = worldRanking(
      input({
        competitions: comps,
        results: comps.map((c) => res(c.id, 'd1', 1)),
      }),
    );
    expect(table[0].divisor).toBe(5);
    expect(table[0].average).toBe(45);
  });

  it('counts World Aquatics World Cups', () => {
    const table = worldRanking(
      input({
        competitions: [stop('s1'), worldCup('w1')],
        results: [res('s1', 'd1', 2), res('w1', 'd1', 1)],
      }),
    );
    // 38 + 45 = 83 over the floored divisor of 4
    expect(table[0].totalPoints).toBe(83);
    expect(table[0].appearances).toBe(2);
    expect(table[0].average).toBe(20.75);
  });

  it('gives no best-dive bonus', () => {
    const withBonus = worldRanking(
      input({ competitions: [stop('s1')], results: [res('s1', 'd1', 1, true)] }),
    );
    const without = worldRanking(
      input({ competitions: [stop('s1')], results: [res('s1', 'd1', 1, false)] }),
    );
    expect(withBonus[0].totalPoints).toBe(without[0].totalPoints);
    expect(withBonus[0].average).toBe(without[0].average);
  });
});

describe('the two tables never merge', () => {
  it('a World Aquatics result moves the World Ranking and leaves the series table identical', () => {
    const base: RankingInput = {
      season: 2026,
      gender: 'men',
      divers: [diver('d1', 'A')],
      competitions: [stop('s1')],
      results: [res('s1', 'd1', 3)],
    };
    const withWorldCup: RankingInput = {
      ...base,
      competitions: [...base.competitions, worldCup('w1')],
      results: [...base.results, res('w1', 'd1', 1)],
    };

    // The series table is byte-identical.
    expect(JSON.stringify(seriesRanking(withWorldCup))).toBe(
      JSON.stringify(seriesRanking(base)),
    );

    // The World Ranking is not.
    expect(worldRanking(base)[0].totalPoints).toBe(32);
    expect(worldRanking(withWorldCup)[0].totalPoints).toBe(32 + 45);
  });

  it('keeps the two point scales apart for the same placing', () => {
    const one: RankingInput = {
      season: 2026,
      gender: 'men',
      divers: [diver('d1', 'A')],
      competitions: [stop('s1')],
      results: [res('s1', 'd1', 1)],
    };
    expect(seriesRanking(one)[0].points).toBe(20);
    expect(worldRanking(one)[0].totalPoints).toBe(45);
  });
});

describe('filtering', () => {
  it('ignores other seasons and the other competition', () => {
    const otherSeason: Competition = { ...stop('s2'), season: 2025 };
    const otherGender: Competition = { ...stop('s3'), gender: 'women' };
    const table = seriesRanking(
      input({
        competitions: [stop('s1'), otherSeason, otherGender],
        results: [res('s1', 'd1', 1), res('s2', 'd1', 1), res('s3', 'd1', 1)],
      }),
    );
    expect(table[0].points).toBe(20);
    expect(table[0].appearances).toBe(1);
  });
});

describe('ties', () => {
  it('orders by points before any tie-break applies', () => {
    const table = seriesRanking({
      season: 2026,
      gender: 'men',
      divers: [diver('d1', 'A'), diver('d2', 'B')],
      competitions: [stop('s1'), stop('s2')],
      results: [
        res('s1', 'd1', 1), // 20
        res('s2', 'd1', 12), // 1  -> 21
        res('s1', 'd2', 2), // 16
        res('s2', 'd2', 5), // 8  -> 24
      ],
    });
    // B wins on points alone, despite A having the only victory.
    expect(table[0].diverId).toBe('d2');
    expect(table[0].points).toBe(24);
    expect(table[1].points).toBe(21);
  });

  it('puts the diver with more wins first when totals are identical', () => {
    const table = seriesRanking({
      season: 2026,
      gender: 'men',
      divers: [diver('d1', 'A'), diver('d2', 'B')],
      competitions: [stop('s1'), stop('s2')],
      results: [
        // A: 1st + 12th = 20 + 1 = 21
        res('s1', 'd1', 1),
        res('s2', 'd1', 12),
        // B: 3rd + 5th = 13 + 8 = 21
        res('s1', 'd2', 3),
        res('s2', 'd2', 5),
      ],
    });
    expect(table[0].points).toBe(21);
    expect(table[1].points).toBe(21);
    expect(table[0].diverId).toBe('d1'); // one win beats none
    expect(table[0].position).toBe(1);
    expect(table[1].position).toBe(2);
  });

  it('shares a position when nothing separates two divers', () => {
    const table = seriesRanking({
      season: 2026,
      gender: 'men',
      divers: [diver('d1', 'A'), diver('d2', 'B')],
      competitions: [stop('s1'), stop('s2')],
      results: [
        res('s1', 'd1', 1),
        res('s2', 'd1', 5),
        res('s1', 'd2', 5),
        res('s2', 'd2', 1),
      ],
    });
    expect(table[0].points).toBe(table[1].points);
    expect(table[0].position).toBe(1);
    expect(table[1].position).toBe(1);
  });

  it('compares placings depth-first', () => {
    const oneWin = [0, 1, 0, 0];
    const noWins = [0, 0, 3, 0];
    expect(compareByPlacings(oneWin, noWins)).toBeLessThan(0);
    expect(compareByPlacings(noWins, oneWin)).toBeGreaterThan(0);
    expect(compareByPlacings(oneWin, [...oneWin])).toBe(0);
  });
});
