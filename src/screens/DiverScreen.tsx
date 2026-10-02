import { useEffect, useMemo, useState } from 'react';
import { loadDiverHistory, type DiverResult } from '../data/resultsDataSource';
import {
  MIN_WORLD_RANKING_DIVISOR,
  seriesPointsFor,
  worldPointsFor,
  type Competition,
  type Diver,
} from '../lib/ranking';
import { Card, EmptyState, Pill } from '../components/ui';

/**
 * One diver's record, every season on one page.
 *
 * The per-season figures are computed from this diver's own results, which is all the two
 * formulas need. Their *position* in each table is not shown here: that depends on
 * everybody else's results, so it belongs on the Rankings screen rather than being
 * recomputed from a dozen extra queries behind one page.
 */
export function DiverScreen({
  diver,
  onBack,
  onOpenCompetition,
}: {
  diver: Diver;
  onBack: () => void;
  onOpenCompetition: (competition: Competition) => void;
}) {
  const [history, setHistory] = useState<DiverResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    loadDiverHistory(diver.id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this diver.');
      });
    return () => {
      cancelled = true;
    };
  }, [diver.id]);

  const seasons = useMemo(() => {
    if (!history) return [];
    const bySeason = new Map<number, DiverResult[]>();
    for (const r of history) {
      const list = bySeason.get(r.competition.season) ?? [];
      list.push(r);
      bySeason.set(r.competition.season, list);
    }
    return [...bySeason.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([season, results]) => {
        const series = results.filter((r) => r.competition.countsForSeries);
        const world = results.filter((r) => r.competition.countsForWorldRanking);
        const seriesPoints =
          series.reduce((n, r) => n + seriesPointsFor(r.rank), 0) +
          series.filter((r) => r.bestDive).length;
        const worldTotal = world.reduce((n, r) => n + worldPointsFor(r.rank), 0);
        const divisor = Math.max(world.length, MIN_WORLD_RANKING_DIVISOR);
        return {
          season,
          results,
          seriesPoints,
          seriesAppearances: series.length,
          worldTotal,
          worldAppearances: world.length,
          divisor,
          worldAverage: world.length ? Math.round((worldTotal / divisor) * 100) / 100 : null,
        };
      });
  }, [history]);

  const career = useMemo(() => {
    if (!history) return null;
    const wins = history.filter((r) => r.rank === 1).length;
    const podiums = history.filter((r) => r.rank <= 3).length;
    const best = history.length ? Math.min(...history.map((r) => r.rank)) : null;
    return { starts: history.length, wins, podiums, best };
  }, [history]);

  return (
    <div className="p-4 pb-24">
      <button onClick={onBack} className="mb-2 text-sm text-muted hover:text-text">
        ← Back
      </button>

      <header className="mb-4">
        <h1 className="tight text-[1.75rem] font-bold leading-tight">{diver.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {diver.gender === 'men' ? "Men's" : "Women's"}
          {diver.country ? ` · ${diver.country}` : ''}
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!history && !error ? <p className="text-sm text-muted">Loading…</p> : null}

      {history && history.length === 0 ? (
        <EmptyState title="No results recorded">
          Nothing has been uploaded for this diver yet.
        </EmptyState>
      ) : null}

      {career && history && history.length > 0 ? (
        <Card className="mb-4">
          <dl className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Starts', career.starts],
              ['Wins', career.wins],
              ['Podiums', career.podiums],
              ['Best', career.best],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {label}
                </dt>
                <dd className="tabular mt-0.5 text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {seasons.map((s) => (
        <section key={s.season} className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="tight text-lg font-bold">{s.season}</h2>
            <p className="tabular text-xs text-muted">
              {s.seriesAppearances ? `${s.seriesPoints} series pts` : 'no series events'}
              {s.worldAverage != null
                ? ` · ${s.worldAverage.toFixed(2)} world avg (${s.worldTotal}/${s.divisor})`
                : ''}
            </p>
          </div>

          <div className="glass glass-sheen overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-text/[0.05] text-xs text-muted">
                  <th scope="col" className="w-10 px-2 py-2.5 text-right font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-2 py-2.5 text-left font-semibold">
                    Competition
                  </th>
                  <th scope="col" className="w-20 px-2 py-2.5 text-right font-semibold">
                    Score
                  </th>
                  <th scope="col" className="w-12 px-1 py-2.5 text-right font-semibold">
                    WS
                  </th>
                  <th scope="col" className="w-12 px-2 py-2.5 text-right font-semibold">
                    WR
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.results.map((r) => (
                  <tr key={r.competition.id} className="border-t border-border/40">
                    <td className="tabular px-2 py-2.5 text-right font-bold">{r.rank}</td>
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => onOpenCompetition(r.competition)}
                        className="text-left hover:text-accent-2 hover:underline"
                      >
                        {r.competition.name}
                      </button>
                      <span className="block text-[11px] text-muted">
                        {r.competition.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'}
                        {r.competition.heldOn ? ` · ${r.competition.heldOn}` : ''}
                      </span>
                      {r.bestDive ? (
                        <span className="mt-1 inline-block">
                          <Pill tone="ok">best dive</Pill>
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right align-top">
                      {r.score == null ? <span className="text-muted">—</span> : r.score.toFixed(2)}
                    </td>
                    <td className="tabular px-1 py-2.5 text-right align-top text-muted">
                      {r.competition.countsForSeries
                        ? seriesPointsFor(r.rank) + (r.bestDive ? 1 : 0)
                        : '·'}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right align-top text-muted">
                      {r.competition.countsForWorldRanking ? worldPointsFor(r.rank) : '·'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {s.worldAverage != null && s.worldAppearances < MIN_WORLD_RANKING_DIVISOR ? (
            <p className="mt-2 text-xs text-warn">
              {s.worldAppearances} appearance{s.worldAppearances === 1 ? '' : 's'}, so the World
              Ranking total is still divided by {MIN_WORLD_RANKING_DIVISOR} (6.2).
            </p>
          ) : null}
        </section>
      ))}

      {history && history.length > 0 ? (
        <p className="text-xs text-muted">
          Season position is on the Rankings screen — it depends on every other diver, not
          just this one.
        </p>
      ) : null}
    </div>
  );
}
