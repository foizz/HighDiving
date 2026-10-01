import { useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { POSITION_NAMES, type Position } from '../lib/dive';
import type { HeightKey } from '../lib/ddTable';
import { evaluateList, type EvaluatedDive, type ListEntry, type SlotId } from '../rules';
import type { DiveList } from '../data/DataSource';
import { DivePicker } from '../components/DivePicker';
import { Button, Card, Input, Pill, ScreenHeader, Violations } from '../components/ui';

/**
 * The list editor. Every edit re-evaluates the whole list, because most of the rules —
 * repeats, take-off variety — are properties of the list rather than of a single dive.
 */
export function ListEditorScreen({
  list,
  onChange,
  onBack,
}: {
  list: DiveList;
  onChange: (next: DiveList) => void;
  onBack: () => void;
}) {
  const { rules, gender } = useApp();
  const [picking, setPicking] = useState<SlotId | null>(null);

  const slots = rules.slots(gender);
  const height = rules.heights[gender].table as HeightKey;

  const entries: ListEntry[] = useMemo(
    () => list.dives.map((d) => ({ slot: d.slot, number: d.number, position: d.position })),
    [list.dives],
  );

  const evaluation = useMemo(
    () => evaluateList(entries, rules, gender),
    [entries, rules, gender],
  );

  function setDive(slot: SlotId, number: string, position: Position) {
    const dives = list.dives.filter((d) => d.slot !== slot);
    dives.push({ slot, number, position });
    onChange({ ...list, dives });
  }

  function clearDive(slot: SlotId) {
    onChange({ ...list, dives: list.dives.filter((d) => d.slot !== slot) });
  }

  const pickingSlot = slots.find((s) => s.id === picking) ?? null;

  return (
    <div className="p-4 pb-24">
      <button onClick={onBack} className="mb-2 text-sm text-muted hover:text-text">
        ← All lists
      </button>

      <ScreenHeader
        title={list.name}
        subtitle={`${rules.shortName} · ${gender === 'men' ? "Men's" : "Women's"} ${rules.heights[gender].label}`}
      />

      <Input
        value={list.name}
        onChange={(e) => onChange({ ...list, name: e.target.value })}
        aria-label="List name"
        className="mb-4"
      />

      <div className="space-y-3">
        {slots.map((slot) => {
          const dive = evaluation.dives.find((d) => d.slot === slot.id) ?? null;
          return (
            <SlotCard
              key={slot.id}
              label={slot.label}
              maxDD={slot.maxDD}
              dive={dive}
              onChoose={() => setPicking(slot.id)}
              onClear={() => clearDive(slot.id)}
            />
          );
        })}
      </div>

      <Violations items={evaluation.violations} />

      <Card className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Total DD</span>
          <span className="tabular text-2xl font-bold">{evaluation.totalDD.toFixed(1)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm text-muted">Maximum possible score</span>
          <span className="tabular font-semibold">{evaluation.maxScore.toFixed(1)}</span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Three counting awards per dive × 10 × total DD, under {rules.citations.scoring}.
        </p>
        <div className="mt-3">
          {evaluation.valid ? (
            <Pill tone="ok">List is legal</Pill>
          ) : (
            <Pill tone="warn">List is not competition-legal yet</Pill>
          )}
        </div>
      </Card>

      {picking && pickingSlot ? (
        <DivePicker
          ruleSet={rules.id}
          height={height}
          maxDD={pickingSlot.maxDD}
          onPick={(number, position) => {
            setDive(picking, number, position);
            setPicking(null);
          }}
          onCancel={() => setPicking(null)}
        />
      ) : null}
    </div>
  );
}

function SlotCard({
  label,
  maxDD,
  dive,
  onChoose,
  onClear,
}: {
  label: string;
  maxDD: number | null;
  dive: EvaluatedDive | null;
  onChoose: () => void;
  onClear: () => void;
}) {
  return (
    <Card className={dive?.failed ? 'border-danger/50' : ''}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        {maxDD != null ? (
          <Pill>max DD {maxDD.toFixed(1)}</Pill>
        ) : (
          <Pill tone="accent">no DD limit</Pill>
        )}
      </div>

      {dive ? (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                <span className="tabular">{dive.number}</span>
                <span className="ml-1">{dive.position}</span>
              </p>
              <p className="truncate text-sm text-muted">{dive.description}</p>
              <p className="mt-0.5 text-xs text-muted">
                {POSITION_NAMES[dive.position]}
                {dive.takeoff ? ` · ${dive.takeoff} take-off` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-xl font-bold">
                {dive.failed ? '0.0' : dive.effectiveDD.toFixed(1)}
              </p>
              {dive.capped && dive.rawDD != null ? (
                <p className="tabular text-xs text-warn line-through">{dive.rawDD.toFixed(1)}</p>
              ) : null}
            </div>
          </div>
          <Violations items={dive.violations} />
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={onChoose} className="flex-1">
              Change
            </Button>
            <Button variant="ghost" onClick={onClear}>
              Clear
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={onChoose} className="w-full">
          Choose a dive
        </Button>
      )}
    </Card>
  );
}
