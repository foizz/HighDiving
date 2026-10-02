import { useEffect, useMemo, useState } from 'react';
import { loadSeason, setBestDive, type SeasonData } from '../data/resultsDataSource';
import type { Competition, Diver } from '../lib/ranking';
import { Button, Card, EmptyState, Pill } from '../components/ui';

/**
 * Awarding the best dive of each competition (rule 3.4.1).
 *
 * This exists separately from the results editor because it is a different job: the
 * results arrive once, in bulk, from a scoreboard; the best dive is one judgement per
 * competition that is often known later. Doing it here writes a single field rather than
 * re-saving a whole field of placings.
 *
 * Only Red Bull tour stops appear. The bonus "will count only for the Red Bull Cliff
 * Diving World Series overall ranking" (3.4.1), and World Aquatics events do not feed
 * that table at all, so awarding one there would have no effect and only mislead.
 */
export function BestDivesScreen({ season }: { season: number }) {
  const [data, setData] = useState<SeasonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function refresh() {
    try {
      setData(await loadSeason(season));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the season.');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const competitions = useMemo(
    () =>
      (data?.competitions ?? [])
        .filter((c) => c.countsForSeries)
        .sort(
          (a, b) =>
            (a.heldOn ?? '').localeCompare(b.heldOn ?? '') ||
            a.name.localeCompare(b.name) ||
            a.gender.localeCompare(b.gender),
        ),
    [data],
  );

  const diversById = useMemo(
    () => new Map((data?.divers ?? []).map((d) => [d.id, d])),
    [data],
  );

  /** Everyone who finished at a competition, best placing first. */
  function fieldFor(competitionId: string) {
    return (data?.results ?? [])
      .filter((r) => r.competitionId === competitionId)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => ({ ...r, diver: diversById.get(r.diverId) ?? null }));
  }

  async function award(competition: Competition, diverIds: string[]) {
    setBusy(competition.id);
    try {
      await setBestDive(competition.id, diverIds);
      // Reflect it locally rather than refetching the season for one field.
      setData((prev) =>
        prev
          ? {
              ...prev,
              results: prev.results.map((r) =>
                r.competitionId === competition.id
                  ? { ...r, bestDive: diverIds.includes(r.diverId) }
                  : r,
              ),
            }
          : prev,
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the best dive.');
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {error}
      </div>
    );
  }
  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  if (!competitions.length) {
    return (
      <EmptyState title={`No Red Bull tour stops in ${season}`}>
        The bonus applies to the World Series ranking only, so there is nothing to award.
      </EmptyState>
    );
  }

  const awarded = competitions.filter((c) =>
    fieldFor(c.id).some((r) => r.bestDive),
  ).length;

  return (
    <div>
      {error ? (
        <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <p className="mb-3 text-sm text-muted">
        One point for the best dive of each competition, counting towards the World Series
        ranking only (3.4.1). {awarded} of {competitions.length} awarded.
      </p>

      <ul className="space-y-2">
        {competitions.map((competition) => {
          const field = fieldFor(competition.id);
          const holders = field.filter((r) => r.bestDive);
          const isOpen = open === competition.id;
          const saving = busy === competition.id;

          return (
            <li key={competition.id}>
              <Card>
                <button
                  onClick={() => setOpen(isOpen ? null : competition.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {competition.name}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {competition.gender === 'men' ? "Men's" : "Women's"}
                          {competition.heldOn ? ` · ${competition.heldOn}` : ''}
                        </span>
                      </p>
                      <p className="mt-1 truncate text-sm">
                        {holders.length ? (
                          <span className="text-text">
                            {holders.map((h) => h.diver?.name ?? 'Unknown').join(' and ')}
                          </span>
                        ) : (
                          <span className="text-muted">Not awarded</span>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {holders.length ? (
                        <Pill tone="ok">+{holders.length}</Pill>
                      ) : (
                        <Pill>none</Pill>
                      )}
                      <p className="mt-1 text-xs text-muted">{isOpen ? 'Close' : 'Choose'}</p>
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div className="mt-3 border-t border-border/40 pt-3">
                    {field.length === 0 ? (
                      <p className="text-sm text-muted">
                        No results uploaded for this competition yet.
                      </p>
                    ) : (
                      <>
                        <ul className="space-y-1">
                          {field.map((r) => {
                            const selected = r.bestDive;
                            return (
                              <li key={r.diverId}>
                                <button
                                  disabled={saving}
                                  aria-pressed={selected}
                                  onClick={() =>
                                    void award(
                                      competition,
                                      // Tap to award, tap again to take it back. A second
                                      // diver can be added for a tie (3.4.3).
                                      selected
                                        ? holders
                                            .filter((h) => h.diverId !== r.diverId)
                                            .map((h) => h.diverId)
                                        : [...holders.map((h) => h.diverId), r.diverId],
                                    )
                                  }
                                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition disabled:opacity-50 ${
                                    selected
                                      ? 'bg-ok/15 text-ok ring-1 ring-inset ring-ok/30'
                                      : 'hover:bg-text/5'
                                  }`}
                                >
                                  <span className="tabular w-6 shrink-0 text-right font-semibold">
                                    {r.rank}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">
                                    {r.diver?.name ?? 'Unknown diver'}
                                  </span>
                                  {r.score != null ? (
                                    <span className="tabular shrink-0 text-xs text-muted">
                                      {r.score.toFixed(2)}
                                    </span>
                                  ) : null}
                                  <span className="w-12 shrink-0 text-right text-xs font-semibold">
                                    {selected ? '+1' : ''}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        {holders.length > 1 ? (
                          <p className="mt-2 text-xs text-warn">
                            {holders.length} dives share the bonus. That is only right if the
                            judges' awards and the DD were both tied (3.4.3).
                          </p>
                        ) : null}

                        {holders.length ? (
                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              disabled={saving}
                              onClick={() => void award(competition, [])}
                            >
                              Clear the bonus
                            </Button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-muted">
        3.4.2: the best dive is the one with the highest awards after the highest and lowest
        are eliminated. On a tie the higher DD takes it, then the higher finishing position;
        if it is still tied, both divers get the point.
      </p>
    </div>
  );
}

/** Re-exported for the Admin screen's season picker. */
export type { Diver };
