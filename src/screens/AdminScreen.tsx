import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { parseResults, type ParsedRow } from '../lib/parseResults';
import { seriesPointsFor, worldPointsFor, type Competition } from '../lib/ranking';
import {
  createCompetition,
  deleteCompetition,
  listSeasons,
  loadResults,
  loadSeason,
  resolveDivers,
  saveResults,
  unknownDivers,
  type ResultInput,
} from '../data/resultsDataSource';
import type { Gender, RuleSetId } from '../rules';
import { Button, Card, EmptyState, Field, Input, Pill, ScreenHeader, Segmented } from '../components/ui';

type Mode = 'paste' | 'form';

interface Row {
  rank: number;
  name: string;
  score: number | null;
  bestDive: boolean;
}

/**
 * Uploading results. Visible only to admins, though the real enforcement is the row level
 * security policy — this screen being hidden is a convenience, not the control.
 */
export function AdminScreen() {
  const { gender } = useApp();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(forSeason = season) {
    try {
      const data = await loadSeason(forSeason);
      setCompetitions(data.competitions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load competitions.');
    }
  }

  useEffect(() => {
    void listSeasons().then((list) => {
      if (list.length && !list.includes(season)) setSeason(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh(season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const competition = competitions.find((c) => c.id === selected) ?? null;

  return (
    <div className="p-4 pb-24">
      <ScreenHeader title="Admin" subtitle="Add a competition, then upload its results." />

      {error ? (
        <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {notice ? <p className="mb-3 text-sm text-ok">{notice}</p> : null}

      {competition ? (
        <ResultsEditor
          competition={competition}
          onBack={() => {
            setSelected(null);
            void refresh();
          }}
          onSaved={(n) => setNotice(`Saved ${n} ${n === 1 ? 'result' : 'results'}.`)}
          onError={setError}
        />
      ) : (
        <>
          <NewCompetitionForm
            season={season}
            gender={gender}
            busy={busy}
            onCreate={async (input) => {
              setBusy(true);
              try {
                const created = await createCompetition(input);
                await refresh(input.season);
                setSeason(input.season);
                setSelected(created.id);
                setNotice(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not create the competition.');
              } finally {
                setBusy(false);
              }
            }}
          />

          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-muted">
            {season} competitions
          </h2>
          {competitions.length === 0 ? (
            <EmptyState title="Nothing yet">Add the first competition above.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {competitions.map((c) => (
                <li key={c.id}>
                  <Card>
                    <button onClick={() => setSelected(c.id)} className="w-full text-left">
                      <p className="font-semibold">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {c.gender === 'men' ? "Men's" : "Women's"} ·{' '}
                        {c.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'}
                        {c.location ? ` · ${c.location}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.countsForSeries ? <Pill tone="accent">World Series</Pill> : null}
                        {c.countsForWorldRanking ? <Pill tone="ok">World Ranking</Pill> : null}
                        {!c.countsForSeries && !c.countsForWorldRanking ? (
                          <Pill tone="warn">counts for neither table</Pill>
                        ) : null}
                      </div>
                    </button>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await deleteCompetition(c.id);
                          void refresh();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NewCompetitionForm({
  season,
  gender,
  busy,
  onCreate,
}: {
  season: number;
  gender: Gender;
  busy: boolean;
  onCreate: (input: Omit<Competition, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [heldOn, setHeldOn] = useState('');
  const [ruleSet, setRuleSet] = useState<RuleSetId>('redbull');
  const [forGender, setForGender] = useState<Gender>(gender);
  const [year, setYear] = useState(season);

  // A Red Bull tour stop counts for both tables; a World Aquatics World Cup counts only
  // towards the World Ranking (6.2). Both remain editable for one-off events.
  const [countsForSeries, setCountsForSeries] = useState(true);
  const [countsForWorld, setCountsForWorld] = useState(true);

  function chooseRuleSet(next: RuleSetId) {
    setRuleSet(next);
    setCountsForSeries(next === 'redbull');
    setCountsForWorld(true);
  }

  return (
    <Card>
      <h2 className="mb-3 font-bold">New competition</h2>
      <div className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Polignano a Mare" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Italy" />
          </Field>
          <Field label="Date">
            <Input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} />
          </Field>
        </div>
        <Field label="Season">
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            inputMode="numeric"
          />
        </Field>
        <Field label="Judged under">
          <Segmented
            ariaLabel="Rule set"
            value={ruleSet}
            onChange={chooseRuleSet}
            options={[
              { value: 'redbull' as const, label: 'Red Bull' },
              { value: 'worldaquatics' as const, label: 'World Aquatics' },
            ]}
          />
        </Field>
        <Field label="Competition">
          <Segmented
            ariaLabel="Competition"
            value={forGender}
            onChange={setForGender}
            options={[
              { value: 'men' as const, label: 'Men' },
              { value: 'women' as const, label: 'Women' },
            ]}
          />
        </Field>

        <fieldset>
          <legend className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Counts towards
          </legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={countsForSeries}
              onChange={(e) => setCountsForSeries(e.target.checked)}
              className="h-5 w-5"
            />
            World Series ranking <span className="text-muted">(3.3.1 — Red Bull stops)</span>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={countsForWorld}
              onChange={(e) => setCountsForWorld(e.target.checked)}
              className="h-5 w-5"
            />
            World Ranking <span className="text-muted">(6.2 — stops and World Cups)</span>
          </label>
        </fieldset>

        <Button
          disabled={busy || !name.trim()}
          className="w-full"
          onClick={() =>
            onCreate({
              season: year,
              name: name.trim(),
              location: location.trim() || null,
              heldOn: heldOn || null,
              ruleSet,
              gender: forGender,
              countsForSeries,
              countsForWorldRanking: countsForWorld,
            })
          }
        >
          Create
        </Button>
      </div>
    </Card>
  );
}

function ResultsEditor({
  competition,
  onBack,
  onSaved,
  onError,
}: {
  competition: Competition;
  onBack: () => void;
  onSaved: (count: number) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('paste');
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [newNames, setNewNames] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Show what is already stored, so an edit starts from the current field.
    void loadResults(competition.id)
      .then(async (existing) => {
        if (!existing.length) return;
        const data = await loadSeason(competition.season);
        const byId = new Map(data.divers.map((d) => [d.id, d]));
        setRows(
          existing.map((r) => ({
            rank: r.rank,
            name: byId.get(r.diverId)?.name ?? '',
            score: r.score ?? null,
            bestDive: Boolean(r.bestDive),
          })),
        );
        setMode('form');
      })
      .catch(() => {
        /* An empty competition is the normal case; nothing to report. */
      });
  }, [competition.id, competition.season]);

  const parsed = useMemo(() => (text.trim() ? parseResults(text) : null), [text]);

  function adoptParsed(importable: ParsedRow[]) {
    setRows(
      importable.map((r) => ({
        rank: r.rank!,
        name: r.name,
        score: r.score,
        bestDive: r.bestDive,
      })),
    );
    setMode('form');
  }

  async function save() {
    setBusy(true);
    try {
      const names = rows.map((r) => r.name);
      const unknown = await unknownDivers(names, competition.gender);
      if (unknown.length && !newNames) {
        // Make the operator confirm before a typo becomes a second diver.
        setNewNames(unknown);
        return;
      }
      const divers = await resolveDivers(names, competition.gender);
      const payload: ResultInput[] = rows.map((r) => {
        const diver = divers.get(r.name.trim());
        if (!diver) throw new Error(`No diver record for "${r.name}".`);
        return { diverId: diver.id, rank: r.rank, score: r.score, bestDive: r.bestDive };
      });
      await saveResults(competition.id, payload);
      setNewNames(null);
      onSaved(payload.length);
      onBack();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save the results.');
    } finally {
      setBusy(false);
    }
  }

  const bestDiveCount = rows.filter((r) => r.bestDive).length;

  return (
    <div>
      <button onClick={onBack} className="mb-2 text-sm text-muted hover:text-text">
        ← All competitions
      </button>
      <ScreenHeader
        title={competition.name}
        subtitle={`${competition.gender === 'men' ? "Men's" : "Women's"} · ${
          competition.ruleSet === 'redbull' ? 'Red Bull' : 'World Aquatics'
        } · ${competition.season}`}
      />

      <div className="mb-3">
        <Segmented
          ariaLabel="Entry method"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'paste' as const, label: 'Paste a table' },
            { value: 'form' as const, label: `Row by row${rows.length ? ` (${rows.length})` : ''}` },
          ]}
        />
      </div>

      {mode === 'paste' ? (
        <Card>
          <Field
            label="Results"
            hint="One diver per line: position, name, score. Tabs, commas or spaces all work. Mark the best dive with *."
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'1\tGary Hunt\t428.50\t*\n2\tCatalin Preda\t410.25'}
              className="w-full rounded-xl border border-border/60 bg-text/[0.04] p-3 font-mono text-sm leading-relaxed text-text transition focus:border-accent-2/50"
            />
          </Field>

          {parsed ? (
            <div className="mt-3">
              {parsed.problems.map((p, i) => (
                <p key={i} className="mb-2 text-sm text-warn">
                  {p}
                </p>
              ))}
              <ul className="space-y-1.5">
                {parsed.rows.map((r) => (
                  <li
                    key={r.line}
                    className={`rounded-lg px-2.5 py-2 text-sm ${
                      r.problems.length
                        ? 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/20'
                        : 'bg-text/[0.05]'
                    }`}
                  >
                    <span className="tabular font-bold">{r.rank ?? '—'}</span>{' '}
                    <span>{r.name || <em>no name</em>}</span>
                    {r.score != null ? (
                      <span className="tabular text-muted"> · {r.score.toFixed(2)}</span>
                    ) : null}
                    {r.bestDive ? <span className="ml-1"><Pill tone="accent">best dive</Pill></span> : null}
                    {r.problems.map((p, i) => (
                      <span key={i} className="mt-0.5 block text-xs">
                        {p}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-3 w-full"
                disabled={!parsed.importable.length}
                onClick={() => adoptParsed(parsed.importable)}
              >
                Use these {parsed.importable.length} rows
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <FormRows rows={rows} setRows={setRows} competition={competition} />
      )}

      {mode === 'form' && rows.length ? (
        <>
          {bestDiveCount > 1 ? (
            <p className="mt-3 text-sm text-warn">
              {bestDiveCount} rows are marked as the best dive; only one earns the bonus (3.4.1).
            </p>
          ) : null}

          {newNames ? (
            <Card className="mt-3 border-warn/50">
              <p className="text-sm">
                {newNames.length} {newNames.length === 1 ? 'name is' : 'names are'} not in the
                database yet and will be created as new divers:
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-muted">
                {newNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => void save()} disabled={busy}>
                  Create and save
                </Button>
                <Button variant="ghost" onClick={() => setNewNames(null)}>
                  Let me fix the spelling
                </Button>
              </div>
            </Card>
          ) : (
            <Button className="mt-3 w-full" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : `Save ${rows.length} results`}
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

function FormRows({
  rows,
  setRows,
  competition,
}: {
  rows: Row[];
  setRows: (rows: Row[]) => void;
  competition: Competition;
}) {
  function update(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <Card key={i}>
          <div className="flex items-start gap-2">
            <div className="w-14 shrink-0">
              <Field label="Pos">
                <Input
                  type="number"
                  min={1}
                  value={row.rank}
                  onChange={(e) => update(i, { rank: Number(e.target.value) })}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <div className="min-w-0 flex-1">
              <Field label="Diver">
                <Input value={row.name} onChange={(e) => update(i, { name: e.target.value })} />
              </Field>
            </div>
            <div className="w-24 shrink-0">
              <Field label="Score">
                <Input
                  value={row.score ?? ''}
                  onChange={(e) =>
                    update(i, { score: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  inputMode="decimal"
                />
              </Field>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={row.bestDive}
                onChange={(e) => update(i, { bestDive: e.target.checked })}
                className="h-5 w-5"
              />
              Best dive
              <span className="text-muted">
                {competition.countsForSeries ? '(+1 series)' : '(no bonus for this event)'}
              </span>
            </label>
            <div className="text-right">
              <p className="tabular text-xs text-muted">
                {competition.countsForSeries ? `${seriesPointsFor(row.rank)} series` : '—'} ·{' '}
                {competition.countsForWorldRanking ? `${worldPointsFor(row.rank)} world` : '—'}
              </p>
              <Button variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
          setRows([
            ...rows,
            {
              rank: rows.length ? Math.max(...rows.map((r) => r.rank)) + 1 : 1,
              name: '',
              score: null,
              bestDive: false,
            },
          ])
        }
      >
        Add a placing
      </Button>
    </div>
  );
}
