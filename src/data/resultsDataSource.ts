import { rethrow, supabase } from './supabaseDataSource';
import type { Competition, CompetitionResult, Diver } from '../lib/ranking';
import type { Gender, RuleSetId } from '../rules/types';

/**
 * Reads and writes competitions, divers and results.
 *
 * Reads are open to any signed-in user and writes are rejected by row level security
 * unless the caller is an admin, so this module does not re-check permission — it would
 * only be advisory. The UI hides the admin screen; the database is what enforces it.
 */

interface CompetitionRow {
  id: string;
  season: number;
  name: string;
  location: string | null;
  held_on: string | null;
  rule_set: RuleSetId;
  gender: Gender;
  counts_for_series: boolean;
  counts_for_world_ranking: boolean;
}

interface ResultRow {
  competition_id: string;
  diver_id: string;
  rank: number;
  score: string | number | null;
  best_dive: boolean;
}

function toCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    season: row.season,
    name: row.name,
    location: row.location,
    heldOn: row.held_on,
    ruleSet: row.rule_set,
    gender: row.gender,
    countsForSeries: row.counts_for_series,
    countsForWorldRanking: row.counts_for_world_ranking,
  };
}

function toResult(row: ResultRow): CompetitionResult {
  return {
    competitionId: row.competition_id,
    diverId: row.diver_id,
    rank: row.rank,
    // numeric comes back as a string from PostgREST; keep it a number here.
    score: row.score == null ? null : Number(row.score),
    bestDive: row.best_dive,
  };
}

function client() {
  if (!supabase) throw new Error('Results need a Supabase project; none is configured.');
  return supabase;
}

export function resultsAvailable(): boolean {
  return supabase !== null;
}

export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from('admins').select('user_id').maybeSingle();
  // A non-admin simply reads nothing back; only a real failure is worth surfacing.
  if (error && error.code !== 'PGRST116') return false;
  return Boolean(data);
}

export interface SeasonData {
  competitions: Competition[];
  results: CompetitionResult[];
  divers: Diver[];
}

/** Everything the ranking functions need for one season, in three queries. */
export async function loadSeason(season: number): Promise<SeasonData> {
  const db = client();
  const [comps, divers] = await Promise.all([
    db.from('competitions').select('*').eq('season', season).order('held_on'),
    db.from('divers').select('*').order('name'),
  ]);
  if (comps.error) rethrow(comps.error, 'competitions');
  if (divers.error) rethrow(divers.error, 'divers');

  const competitions = (comps.data as CompetitionRow[]).map(toCompetition);
  if (!competitions.length) return { competitions: [], results: [], divers: [] };

  const { data, error } = await db
    .from('results')
    .select('*')
    .in('competition_id', competitions.map((c) => c.id));
  if (error) rethrow(error, 'results');

  return {
    competitions,
    results: (data as ResultRow[]).map(toResult),
    divers: divers.data as Diver[],
  };
}

/** Seasons that have at least one competition, newest first. */
export async function listSeasons(): Promise<number[]> {
  const { data, error } = await client()
    .from('competitions')
    .select('season')
    .order('season', { ascending: false });
  if (error) rethrow(error, 'competitions');
  return [...new Set((data as { season: number }[]).map((r) => r.season))];
}

export type NewCompetition = Omit<Competition, 'id'>;

export async function createCompetition(input: NewCompetition): Promise<Competition> {
  const { data, error } = await client()
    .from('competitions')
    .insert({
      season: input.season,
      name: input.name,
      location: input.location ?? null,
      held_on: input.heldOn ?? null,
      rule_set: input.ruleSet,
      gender: input.gender,
      counts_for_series: input.countsForSeries,
      counts_for_world_ranking: input.countsForWorldRanking,
    })
    .select()
    .single();
  if (error) rethrow(error, 'competitions');
  return toCompetition(data as CompetitionRow);
}

export async function deleteCompetition(id: string): Promise<void> {
  const { error } = await client().from('competitions').delete().eq('id', id);
  if (error) rethrow(error, 'competitions');
}

/**
 * Find divers by name, or create them.
 *
 * Matching is case-insensitive on name and gender so that "gary hunt" does not become a
 * second Gary Hunt. The caller is expected to have shown the user which names are new
 * before calling this.
 */
export async function resolveDivers(
  names: string[],
  gender: Gender,
): Promise<Map<string, Diver>> {
  const db = client();
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const byKey = new Map<string, Diver>();
  if (!wanted.length) return byKey;

  const { data, error } = await db.from('divers').select('*').eq('gender', gender);
  if (error) rethrow(error, 'divers');
  for (const d of data as Diver[]) byKey.set(d.name.trim().toLowerCase(), d);

  const missing = wanted.filter((n) => !byKey.has(n.toLowerCase()));
  if (missing.length) {
    const { data: created, error: insertError } = await db
      .from('divers')
      .insert(missing.map((name) => ({ name, gender })))
      .select();
    if (insertError) throw insertError;
    for (const d of created as Diver[]) byKey.set(d.name.trim().toLowerCase(), d);
  }

  const out = new Map<string, Diver>();
  for (const name of wanted) {
    const found = byKey.get(name.toLowerCase());
    if (found) out.set(name, found);
  }
  return out;
}

/** Which of these names do not yet exist, so the user can confirm before they are created. */
export async function unknownDivers(names: string[], gender: Gender): Promise<string[]> {
  const { data, error } = await client().from('divers').select('name').eq('gender', gender);
  if (error) rethrow(error, 'divers');
  const known = new Set((data as { name: string }[]).map((d) => d.name.trim().toLowerCase()));
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].filter(
    (n) => !known.has(n.toLowerCase()),
  );
}

export interface ResultInput {
  diverId: string;
  rank: number;
  score: number | null;
  bestDive: boolean;
}

/** Replace a competition's results wholesale — an upload is the full field, not a delta. */
export async function saveResults(
  competitionId: string,
  rows: ResultInput[],
): Promise<void> {
  const db = client();
  const { error: clearError } = await db
    .from('results')
    .delete()
    .eq('competition_id', competitionId);
  if (clearError) throw clearError;

  if (!rows.length) return;
  const { error } = await db.from('results').insert(
    rows.map((r) => ({
      competition_id: competitionId,
      diver_id: r.diverId,
      rank: r.rank,
      score: r.score,
      best_dive: r.bestDive,
    })),
  );
  if (error) rethrow(error, 'results');
}

export async function loadResults(competitionId: string): Promise<CompetitionResult[]> {
  const { data, error } = await client()
    .from('results')
    .select('*')
    .eq('competition_id', competitionId)
    .order('rank');
  if (error) rethrow(error, 'results');
  return (data as ResultRow[]).map(toResult);
}
