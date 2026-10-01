import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import {
  seriesRanking,
  worldRanking,
  type SeriesStanding,
  type WorldStanding,
} from '../lib/ranking';
import {
  listSeasons,
  loadSeason,
  resultsAvailable,
  type SeasonData,
} from '../data/resultsDataSource';
import type { Gender } from '../rules';
import { Card, EmptyState, Pill, ScreenHeader, Segmented } from '../components/ui';

type Table = 'series' | 'world';

/**
 * The two season standings. They are presented as separate tables rather than as columns
 * of one, because they count different events on different scales — showing them side by
 * side would invite exactly the comparison the rules do not support.
 */
export function RankingsScreen() {
  const { gender, setGender } = useApp();
  const [table, setTable] = useState<Table>('series');
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [seasons, setSeasons] = useState<number[]>([]);
  const [data, setData] = useState<SeasonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resultsAvailable()) {
      setLoading(false);
      return;
    }
    listSeasons()
      .then((list) => {
        setSeasons(list);
        if (list.length) setSeason((s) => (list.includes(s) ? s : list[0]));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load seasons.'));
  }, []);

  useEffect(() => {
    if (!resultsAvailable()) return;
    setLoading(true);
    loadSeason(season)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load results.'))
      .finally(() => setLoading(false));
  }, [season]);

  const series = useMemo(
    () => (data ? seriesRanking({ ...data, season, gender }) : []),
    [data, season, gender],
  );
  const world = useMemo(
    () => (data ? worldRanking({ ...data, season, gender }) : []),
    [data, season, gender],
  );

  const counted = useMemo(() => {
    if (!data) return [];
    return data.competitions.filter(
      (c) =>
        c.gender === gender &&
        (table === 'series' ? c.countsForSeries : c.countsForWorldRanking),
    );
  }, [data, gender, table]);

  if (!resultsAvailable()) {
    return (
      <div className="p-4 pb-24">
        <ScreenHeader title="Rankings" />
        <EmptyState title="Rankings need a Supabase project">
          Add your project URL and anon key, then apply the migrations in
          <code className="mx-1 text-text">supabase/migrations</code>.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <ScreenHeader
        title="Rankings"
        subtitle={
          table === 'series'
            ? 'Red Bull tour stops, points summed (3.3.1).'
            : 'Tour stops and World Aquatics World Cups, points averaged (6.2).'
        }
      />

      <div className="mb-3">
        <Segmented
          ariaLabel="Ranking"
          value={table}
          onChange={setTable}
          options={[
            { value: 'series' as const, label: 'World Series', sublabel: 'sum' },
            { value: 'world' as const, label: 'World Ranking', sublabel: 'average' },
          ]}
        />
      </div>

      <div className="mb-3">
        <Segmented
          ariaLabel="Competition"
          value={gender}
          onChange={(g: Gender) => setGender(g)}
          options={[
            { value: 'men' as const, label: 'Men' },
            { value: 'women' as const, label: 'Women' },
          ]}
        />
      </div>

      {seasons.length > 1 ? (
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Season
          </span>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="min-h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2"
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : table === 'series' ? (
        <SeriesTable rows={series} events={counted.length} />
      ) : (
        <WorldTable rows={world} events={counted.length} />
      )}

      {counted.length ? (
        <Card className="mt-4">
          <h2 className="mb-2 text-sm font-bold">Counting events</h2>
          <ul className="space-y-1 text-xs text-muted">
            {counted.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span>{c.name}</span>
                <span>{c.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Position({ value }: { value: number }) {
  return <span className="tabular w-7 shrink-0 text-right font-bold">{value}</span>;
}

function SeriesTable({ rows, events }: { rows: SeriesStanding[]; events: number }) {
  if (!rows.length) {
    return <EmptyState title="No results yet">Upload a competition to build the table.</EmptyState>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.diverId}>
          <Card className="flex items-center gap-3">
            <Position value={r.position} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.diver?.name ?? 'Unknown diver'}</p>
              <p className="text-xs text-muted">
                {r.appearances} of {events} events
                {r.bestDives > 0
                  ? ` · ${r.bestDives} best ${r.bestDives === 1 ? 'dive' : 'dives'} (+${r.bestDives})`
                  : ''}
              </p>
            </div>
            <span className="tabular text-xl font-bold">{r.points}</span>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function WorldTable({ rows, events }: { rows: WorldStanding[]; events: number }) {
  if (!rows.length) {
    return <EmptyState title="No results yet">Upload a competition to build the table.</EmptyState>;
  }
  return (
    <>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.diverId}>
            <Card className="flex items-center gap-3">
              <Position value={r.position} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.diver?.name ?? 'Unknown diver'}</p>
                <p className="text-xs text-muted">
                  {r.totalPoints} points over {r.appearances} of {events} events ÷ {r.divisor}
                </p>
                {r.divisorFloored ? (
                  <span className="mt-1 inline-block">
                    <Pill tone="warn">divided by 4, the minimum</Pill>
                  </span>
                ) : null}
              </div>
              <span className="tabular text-xl font-bold">{r.average.toFixed(2)}</span>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Rule 6.2: a diver with fewer than four appearances is still divided by four, so an
        incomplete season cannot win on a small sample.
      </p>
    </>
  );
}
