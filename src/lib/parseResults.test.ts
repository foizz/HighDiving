import { describe, expect, it } from 'vitest';
import { parseResults } from './parseResults';

describe('parseResults', () => {
  it('reads tab separated rows', () => {
    const { importable, problems } = parseResults('1\tGary Hunt\t428.50\n2\tCatalin Preda\t410.25');
    expect(problems).toEqual([]);
    expect(importable).toHaveLength(2);
    expect(importable[0]).toMatchObject({ rank: 1, name: 'Gary Hunt', score: 428.5 });
    expect(importable[1]).toMatchObject({ rank: 2, name: 'Catalin Preda', score: 410.25 });
  });

  it('reads comma separated rows', () => {
    const { importable } = parseResults('1,Gary Hunt,428.50\n2,Catalin Preda,410.25');
    expect(importable.map((r) => r.name)).toEqual(['Gary Hunt', 'Catalin Preda']);
  });

  it('reads rows separated by runs of spaces', () => {
    const { importable } = parseResults('1    Gary Hunt     428.50\n2    Catalin Preda  410.25');
    expect(importable[0]).toMatchObject({ rank: 1, name: 'Gary Hunt', score: 428.5 });
  });

  it('reads rows with only single spaces', () => {
    const { importable } = parseResults('1 Gary Hunt 428.50\n2 Catalin Preda 410.25');
    expect(importable[0]).toMatchObject({ rank: 1, name: 'Gary Hunt', score: 428.5 });
    expect(importable[1]).toMatchObject({ rank: 2, name: 'Catalin Preda', score: 410.25 });
  });

  it('accepts ordinals and trailing dots in the rank', () => {
    const { importable } = parseResults('1st\tA\n2.\tB\n3\tC');
    expect(importable.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('accepts a decimal comma in the score', () => {
    const { importable } = parseResults('1\tGary Hunt\t428,50');
    expect(importable[0].score).toBe(428.5);
  });

  it('treats a row with no score as importable', () => {
    const { importable } = parseResults('1\tGary Hunt');
    expect(importable[0]).toMatchObject({ rank: 1, name: 'Gary Hunt', score: null });
    expect(importable[0].problems).toEqual([]);
  });

  it('skips a header row and blank lines', () => {
    const { importable, rows } = parseResults('Rank\tName\tScore\n\n1\tGary Hunt\t428.50\n\n');
    expect(rows).toHaveLength(1);
    expect(importable[0].name).toBe('Gary Hunt');
  });

  it('marks the best dive and strips the marker from the name', () => {
    const { importable, problems } = parseResults('1\tGary Hunt\t428.50\t*\n2\tCatalin Preda\t410');
    expect(problems).toEqual([]);
    expect(importable[0].bestDive).toBe(true);
    expect(importable[0].name).toBe('Gary Hunt');
    expect(importable[1].bestDive).toBe(false);
  });

  it('objects when more than one row claims the best dive', () => {
    const { problems } = parseResults('1\tA\t1\t*\n2\tB\t2\tbest dive');
    expect(problems.join(' ')).toMatch(/only one dive per competition/);
  });

  it('reports a duplicate position without throwing', () => {
    const { rows, importable } = parseResults('1\tA\n1\tB');
    expect(importable).toHaveLength(1);
    expect(rows[1].problems.join(' ')).toMatch(/Position 1 is already used on line 1/);
  });

  it('reports the same diver twice', () => {
    const { rows } = parseResults('1\tGary Hunt\n2\tgary hunt');
    expect(rows[1].problems.join(' ')).toMatch(/already appears on line 1/);
  });

  it('reports a row with no usable rank', () => {
    const { rows, importable } = parseResults('winner\tGary Hunt');
    expect(importable).toHaveLength(0);
    expect(rows[0].problems.join(' ')).toMatch(/not a finishing position/);
  });

  it('reports a row with no name', () => {
    const { rows } = parseResults('1\t\t428.50');
    expect(rows[0].problems.join(' ')).toMatch(/No diver name/);
  });

  it('keeps good rows when one row is bad', () => {
    const { rows, importable } = parseResults('1\tA\t10\nrubbish\n3\tC\t30');
    expect(rows).toHaveLength(3);
    expect(importable.map((r) => r.name)).toEqual(['A', 'C']);
  });

  it('returns rows in finishing order regardless of paste order', () => {
    const { importable } = parseResults('3\tC\n1\tA\n2\tB');
    expect(importable.map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });

  it('reports an empty paste rather than throwing', () => {
    expect(parseResults('   \n\n').problems).toEqual(['Nothing to import.']);
  });
});
