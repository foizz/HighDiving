import { useMemo, useState } from 'react';
import { GROUP_NAMES, POSITIONS, POSITION_NAMES, type Position } from '../lib/dive';
import { allDives, type HeightKey, type TableDive } from '../lib/ddTable';
import type { RuleSetId } from '../rules';
import { Button, Input, Pill } from './ui';

/**
 * Searchable list of every tabled dive, filtered to those actually available at the
 * competition height. Choosing a dive also picks a position, because a dive's legal
 * positions depend on the dive — so the two are chosen together rather than leaving the
 * user to discover afterwards that their combination is not tabled.
 */
export function DivePicker({
  ruleSet,
  height,
  maxDD,
  onPick,
  onCancel,
}: {
  ruleSet: RuleSetId;
  height: HeightKey;
  /** When set, dives above this DD are marked, since they break the slot's limit. */
  maxDD: number | null;
  onPick: (number: string, position: Position) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<number | 'all'>('all');

  const available = useMemo(
    () => allDives(ruleSet).filter((d) => d.dd[height] && Object.keys(d.dd[height]!).length > 0),
    [ruleSet, height],
  );

  const groups = useMemo(
    () => [...new Set(available.map((d) => d.group))].sort((a, b) => a - b),
    [available],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((d) => {
      if (group !== 'all' && d.group !== group) return false;
      if (!q) return true;
      return d.number.toLowerCase().includes(q) || d.description.toLowerCase().includes(q);
    });
  }, [available, query, group]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-xl">
      <div className="pt-safe border-b border-border/40 px-4 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="flex-1 text-lg font-bold">Choose a dive</h2>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number or name, e.g. 5141 or back 3"
          aria-label="Search dives"
          inputMode="search"
        />
        <div className="-mx-4 mt-3 overflow-x-auto px-4">
          <div className="flex gap-1.5 pb-1">
            <GroupChip active={group === 'all'} onClick={() => setGroup('all')}>
              All
            </GroupChip>
            {groups.map((g) => (
              <GroupChip key={g} active={group === g} onClick={() => setGroup(g)}>
                {GROUP_NAMES[g] ?? `Group ${g}`}
              </GroupChip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-safe">
        {results.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            No dive matches “{query}”.
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((d) => (
              <DiveRow key={d.number} dive={d} height={height} maxDD={maxDD} onPick={onPick} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GroupChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
        active
          ? 'accent-fill text-accent-text shadow-sm'
          : 'border border-border/50 bg-text/[0.05] text-muted hover:bg-text/10 hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function DiveRow({
  dive,
  height,
  maxDD,
  onPick,
}: {
  dive: TableDive;
  height: HeightKey;
  maxDD: number | null;
  onPick: (number: string, position: Position) => void;
}) {
  const entries = dive.dd[height] ?? {};
  return (
    <li className="glass glass-sheen rounded-2xl p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="tabular font-bold">{dive.number}</span>
        <span className="flex-1 text-sm text-muted">{dive.description}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {POSITIONS.filter((p) => entries[p] != null).map((p) => {
          const dd = entries[p]!;
          const over = maxDD != null && dd > maxDD;
          return (
            <button
              key={p}
              onClick={() => onPick(dive.number, p)}
              title={`${POSITION_NAMES[p]} — DD ${dd.toFixed(1)}`}
              className="min-h-10 rounded-lg border border-border/60 bg-text/[0.05] px-2.5 text-left transition duration-150 hover:border-accent-2/50 hover:bg-text/10"
            >
              <span className="mr-1.5 font-bold">{p}</span>
              <span className="tabular text-sm">{dd.toFixed(1)}</span>
              {over ? (
                <span className="ml-1.5">
                  <Pill tone="warn">over</Pill>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </li>
  );
}
