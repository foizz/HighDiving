import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import {
  seriesRanking,
  worldRanking,
  type Competition,
  type Diver,
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
import { CompetitionScreen } from './CompetitionScreen';
import { DiverScreen } from './DiverScreen';

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
  const [openCompetition, setOpenCompetition] = useState<Competition | null>(null);
  const [openDiver, setOpenDiver] = useState<Diver | null>(null);

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

  /** Every competition this season, counting or not — the list is also how you reach one. */
  const seasonCompetitions = useMemo(
    () =>
      (data?.competitions ?? [])
        .filter((c) => c.gender === gender)
        .sort((a, b) => (a.heldOn ?? '').localeCompare(b.heldOn ?? '')),
    [data, gender],
  );

  if (openCompetition && data) {
    return (
      <CompetitionScreen
        competition={openCompetition}
        data={data}
        onBack={() => setOpenCompetition(null)}
        onOpenDiver={(d) => {
          setOpenCompetition(null);
          setOpenDiver(d);
        }}
      />
    );
  }

  if (openDiver) {
    return (
      <DiverScreen
        diver={openDiver}
        onBack={() => setOpenDiver(null)}
        onOpenCompetition={(c) => {
          setOpenDiver(null);
          // Only this season's results are loaded here, so jumping to a competition from
          // another season has to move the season with it.
          if (c.season !== season) setSeason(c.season);
          setOpenCompetition(c);
        }}
      />
    );
  }

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
            className="min-h-11 w-full rounded-xl border border-border/60 bg-text/[0.04] px-3 text-base text-text transition focus:border-accent-2/50"
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
        <SeriesTable rows={series} events={counted.length} onOpenDiver={setOpenDiver} />
      ) : (
        <WorldTable rows={world} events={counted.length} onOpenDiver={setOpenDiver} />
      )}

      {seasonCompetitions.length ? (
        <Card className="mt-4">
          <h2 className="mb-1 text-sm font-bold">Competitions this season</h2>
          <p className="mb-2.5 text-xs text-muted">
            Open one for its full result.
          </p>
          <ul className="-mx-1.5 space-y-0.5">
            {seasonCompetitions.map((c) => {
              const counts = table === 'series' ? c.countsForSeries : c.countsForWorldRanking;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenCompetition(c)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-1.5 text-left text-sm transition hover:bg-text/5"
                  >
                    <span className={`min-w-0 flex-1 truncate ${counts ? '' : 'text-muted'}`}>
                      {c.name}
                      {c.heldOn ? (
                        <span className="ml-1.5 text-[11px] text-muted">{c.heldOn.slice(5)}</span>
                      ) : null}
                    </span>
                    {!counts ? <Pill>not counted here</Pill> : null}
                    <span className="shrink-0 text-[11px] text-muted">
                      {c.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Position({ value }: { value: number }) {
  return <span className="tabular w-7 shrink-0 text-right font-bold">{value}</span>;
}

function SeriesTable({
  rows,
  events,
  onOpenDiver,
}: {
  rows: SeriesStanding[];
  events: number;
  onOpenDiver: (diver: Diver) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="No results yet">Upload a competition to build the table.</EmptyState>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.diverId}>
          <Card className="p-0">
            <button
              disabled={!r.diver}
              onClick={() => r.diver && onOpenDiver(r.diver)}
              className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-text/5 disabled:pointer-events-none"
            >
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
            </button>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function WorldTable({
  rows,
  events,
  onOpenDiver,
}: {
  rows: WorldStanding[];
  events: number;
  onOpenDiver: (diver: Diver) => void;
}) {
  if (!rows.length) {
    return <EmptyState title="No results yet">Upload a competition to build the table.</EmptyState>;
  }
  return (
    <>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.diverId}>
            <Card className="p-0">
              <button
                disabled={!r.diver}
                onClick={() => r.diver && onOpenDiver(r.diver)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-text/5 disabled:pointer-events-none"
              >
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
              </button>
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
