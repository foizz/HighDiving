import { useMemo } from 'react';
import { seriesPointsFor, worldPointsFor, type Competition, type Diver } from '../lib/ranking';
import type { SeasonData } from '../data/resultsDataSource';
import { Card, EmptyState, Pill } from '../components/ui';

/**
 * One competition's full result.
 *
 * The two points columns are the reason this page exists rather than just a list of
 * placings: the same finish is worth different amounts in the two tables, and seeing
 * 20 next to 45 explains the rankings better than any wording can.
 */
export function CompetitionScreen({
  competition,
  data,
  onBack,
  onOpenDiver,
}: {
  competition: Competition;
  data: SeasonData;
  onBack: () => void;
  onOpenDiver: (diver: Diver) => void;
}) {
  const diversById = useMemo(() => new Map(data.divers.map((d) => [d.id, d])), [data.divers]);

  const rows = useMemo(
    () =>
      data.results
        .filter((r) => r.competitionId === competition.id)
        .sort((a, b) => a.rank - b.rank)
        .map((r) => ({ ...r, diver: diversById.get(r.diverId) ?? null })),
    [data.results, competition.id, diversById],
  );

  const bestDives = rows.filter((r) => r.bestDive);

  return (
    <div className="p-4 pb-24">
      <button onClick={onBack} className="mb-2 text-sm text-muted hover:text-text">
        ← Rankings
      </button>

      <header className="mb-4">
        <h1 className="tight text-[1.75rem] font-bold leading-tight">{competition.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {competition.gender === 'men' ? "Men's" : "Women's"}
          {competition.location ? ` · ${competition.location}` : ''}
          {competition.heldOn ? ` · ${competition.heldOn}` : ''}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill tone={competition.ruleSet === 'redbull' ? 'danger' : 'accent'}>
            {competition.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'}
          </Pill>
          {competition.countsForSeries ? <Pill tone="ok">World Series</Pill> : null}
          {competition.countsForWorldRanking ? <Pill tone="ok">World Ranking</Pill> : null}
          {!competition.countsForSeries && !competition.countsForWorldRanking ? (
            <Pill tone="warn">counts for neither table</Pill>
          ) : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState title="No results uploaded">
          Add them from the Admin screen.
        </EmptyState>
      ) : (
        <>
          <div className="glass glass-sheen overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-text/[0.05] text-xs text-muted">
                  <th scope="col" className="w-10 px-2 py-2.5 text-right font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-2 py-2.5 text-left font-semibold">
                    Diver
                  </th>
                  <th scope="col" className="w-20 px-2 py-2.5 text-right font-semibold">
                    Score
                  </th>
                  <th
                    scope="col"
                    title="Points towards the World Series ranking"
                    className="w-12 px-1 py-2.5 text-right font-semibold"
                  >
                    WS
                  </th>
                  <th
                    scope="col"
                    title="Points towards the World Ranking"
                    className="w-12 px-2 py-2.5 text-right font-semibold"
                  >
                    WR
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const series = competition.countsForSeries ? seriesPointsFor(r.rank) : null;
                  const world = competition.countsForWorldRanking ? worldPointsFor(r.rank) : null;
                  return (
                    <tr key={r.diverId} className="border-t border-border/40">
                      <td className="tabular px-2 py-2.5 text-right font-bold">{r.rank}</td>
                      <td className="px-2 py-2.5">
                        {r.diver ? (
                          <button
                            onClick={() => onOpenDiver(r.diver!)}
                            className="text-left hover:text-accent-2 hover:underline"
                          >
                            {r.diver.name}
                          </button>
                        ) : (
                          <span className="text-muted">Unknown diver</span>
                        )}
                        {r.bestDive ? (
                          <span className="ml-1.5">
                            <Pill tone="ok">best dive</Pill>
                          </span>
                        ) : null}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right">
                        {r.score == null ? (
                          <span className="text-muted" title="No numeric total published">
                            —
                          </span>
                        ) : (
                          r.score.toFixed(2)
                        )}
                      </td>
                      <td className="tabular px-1 py-2.5 text-right text-muted">
                        {series == null ? '·' : series + (r.bestDive ? 1 : 0)}
                      </td>
                      <td className="tabular px-2 py-2.5 text-right text-muted">
                        {world == null ? '·' : world}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-bold">Points from this competition</h2>
            <ul className="space-y-1.5 text-xs text-muted">
              <li>
                <strong className="text-text">WS</strong> — World Series ranking (3.3.1),
                summed across Red Bull tour stops.
                {bestDives.length
                  ? ` Includes the +1 best-dive bonus for ${bestDives
                      .map((b) => b.diver?.name ?? 'unknown')
                      .join(' and ')} (3.4.1).`
                  : competition.countsForSeries
                    ? ' No best dive awarded yet.'
                    : ''}
              </li>
              <li>
                <strong className="text-text">WR</strong> — World Ranking (6.2), averaged
                over appearances. The best-dive bonus does not apply here.
              </li>
              {!competition.countsForSeries ? (
                <li>
                  This is not a Red Bull tour stop, so it earns no World Series points.
                </li>
              ) : null}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
