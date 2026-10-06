import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { AWARD_STEP, MAX_AWARD, awardNeededForTarget, round2, scoreDive } from '../lib/scoring';
import { evaluateList, type EvaluatedDive } from '../rules';
import type { DiveList } from '../data/DataSource';
import { Button, Card, EmptyState, Field, Input, Pill, ScreenHeader } from '../components/ui';

/** Awards are given in half points, so the picker offers exactly those. */
const AWARD_OPTIONS = Array.from({ length: MAX_AWARD / AWARD_STEP + 1 }, (_, i) => i * AWARD_STEP);
const JUDGE_COUNT = 3;

export function SimulatorScreen() {
  const { data, rules, gender } = useApp();
  const [lists, setLists] = useState<DiveList[] | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  // An award slot is `null` until a mark is entered. A cleared slot must stay empty
  // rather than collapsing to 0.0, which is itself a valid award.
  const [awards, setAwards] = useState<Record<string, (number | null)[]>>({});
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (!data) return;
    void data.listLists().then((ls) => {
      setLists(ls);
      setListId((id) => id ?? ls[0]?.id ?? null);
    });
  }, [data]);

  // Scored under whichever book is currently selected, at the list's own gender, so the
  // DDs here always match the ones the editor shows for that list.
  const list = lists?.find((l) => l.id === listId) ?? null;
  const listRules = rules;
  const listGender = list?.gender ?? gender;

  const evaluation = useMemo(
    () => (list ? evaluateList(list.dives, listRules, listGender) : null),
    [list, listRules, listGender],
  );

  const scored = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.dives.map((dive) => {
      const given = awards[dive.slot] ?? [];
      const entered = given.filter((v): v is number => v != null);
      const score = scoreDive(entered, dive.failed ? 0 : dive.effectiveDD, JUDGE_COUNT);
      return { dive, given, score, complete: entered.length >= JUDGE_COUNT };
    });
  }, [evaluation, awards]);

  const total = round2(scored.reduce((n, s) => n + (s.complete ? s.score.points : 0), 0));
  const remainingDDs = scored.filter((s) => !s.complete).map((s) => s.dive.effectiveDD);
  const targetValue = Number(target);
  const targetResult =
    target.trim() && Number.isFinite(targetValue)
      ? awardNeededForTarget(targetValue, total, remainingDDs)
      : null;

  function setAward(slot: string, index: number, value: number | null) {
    setAwards((prev) => {
      const next = [...(prev[slot] ?? [])];
      while (next.length <= index) next.push(null);
      next[index] = value;
      return { ...prev, [slot]: next };
    });
  }

  function fillAll(value: number) {
    if (!evaluation) return;
    const next: Record<string, (number | null)[]> = {};
    for (const d of evaluation.dives) next[d.slot] = Array(JUDGE_COUNT).fill(value);
    setAwards(next);
  }

  if (lists === null) return <p className="p-4 text-sm text-muted">Loading…</p>;

  if (!lists.length) {
    return (
      <div className="p-4 pb-24">
        <ScreenHeader title="Simulate" />
        <EmptyState title="No lists to simulate">
          Build a list first, then come back to try scores against it.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <ScreenHeader
        title="Simulate"
        subtitle={`Drop the highest and lowest award, add the rest, multiply by DD (${listRules.citations.scoring}).`}
      />

      <Field label="List">
        <select
          value={listId ?? ''}
          onChange={(e) => {
            setListId(e.target.value);
            setAwards({});
          }}
          className="min-h-11 w-full rounded-xl border border-border/60 bg-text/[0.04] px-3 text-base text-text transition focus:border-accent-2/50"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>


      <div className="mt-3 flex flex-wrap gap-2">
        <span className="self-center text-xs text-muted">Fill all:</span>
        {[6, 7, 7.5, 8, 8.5, 9].map((v) => (
          <Button key={v} variant="secondary" onClick={() => fillAll(v)} className="px-3">
            {v.toFixed(1)}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => setAwards({})}>
          Clear
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {scored.map(({ dive, given, score, complete }) => (
          <DiveScoreCard
            key={dive.slot}
            dive={dive}
            given={given}
            judgeCount={JUDGE_COUNT}
            complete={complete}
            points={score.points}
            counted={score.counted}
            onAward={(i, v) => setAward(dive.slot, i, v)}
          />
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Total so far</span>
          <span className="tabular text-3xl font-bold">{total.toFixed(2)}</span>
        </div>
      </Card>

      <Card className="mt-3">
        <Field
          label="Score to beat"
          hint="What each counting judge would have to give on the dives you have not scored yet."
        >
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 400"
          />
        </Field>

        {targetResult ? (
          <div className="mt-3 text-sm">
            {targetResult.alreadyReached ? (
              <p className="text-ok">
                Already past {targetValue.toFixed(2)} with {total.toFixed(2)}.
              </p>
            ) : targetResult.impossible ? (
              <p className="text-danger">
                {remainingDDs.length === 0
                  ? 'Every dive is already scored, so the total cannot change.'
                  : `Out of reach — the most still available is ${targetResult.maxAchievable.toFixed(2)}.`}
              </p>
            ) : (
              <p>
                Needs <strong className="tabular text-lg">{targetResult.requiredAward!.toFixed(1)}</strong>{' '}
                from each counting judge on the remaining {remainingDDs.length}{' '}
                {remainingDDs.length === 1 ? 'dive' : 'dives'} —{' '}
                <span className="tabular">{targetResult.remaining.toFixed(2)}</span> points to find.
              </p>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function DiveScoreCard({
  dive,
  given,
  judgeCount,
  complete,
  points,
  counted,
  onAward,
}: {
  dive: EvaluatedDive;
  given: (number | null)[];
  judgeCount: number;
  complete: boolean;
  points: number;
  counted: number[];
  onAward: (index: number, value: number | null) => void;
}) {
  return (
    <Card className={dive.failed ? 'border-danger/50' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">
            <span className="tabular">{dive.number}</span> {dive.position}
          </p>
          <p className="truncate text-xs text-muted">{dive.description}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold">{complete ? points.toFixed(2) : '—'}</p>
          <p className="tabular text-xs text-muted">
            DD {dive.failed ? '0.0' : dive.effectiveDD.toFixed(1)}
          </p>
        </div>
      </div>

      {dive.failed ? (
        <p className="mt-2 text-xs text-danger">
          This dive scores zero under the current rules, whatever the judges award.
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {Array.from({ length: judgeCount }, (_, i) => (
          <select
            key={i}
            value={given[i] ?? ''}
            onChange={(e) => onAward(i, e.target.value === '' ? null : Number(e.target.value))}
            aria-label={`Judge ${i + 1} award`}
            className="tabular min-h-10 rounded-lg border border-border/60 bg-text/[0.04] px-1 text-center text-sm transition focus:border-accent-2/50"
          >
            <option value="">–</option>
            {AWARD_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v.toFixed(1)}
              </option>
            ))}
          </select>
        ))}
      </div>

      {complete ? (
        <p className="mt-2 text-xs text-muted">
          Counting <span className="tabular">{counted.map((c) => c.toFixed(1)).join(' + ')}</span> ={' '}
          <span className="tabular">{counted.reduce((a, b) => a + b, 0).toFixed(1)}</span>
          {dive.capped ? (
            <span className="ml-1">
              <Pill tone="warn">DD capped</Pill>
            </span>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}
