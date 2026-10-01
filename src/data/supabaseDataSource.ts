import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DataSource, DiveList, SavedDive } from './DataSource';
import type { Gender, RuleSetId } from '../rules/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase is optional: with no keys configured the app still runs, guest-only, and the
 * entry screen says so rather than offering a sign-in that cannot work.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true } }) : null;

export const supabaseConfigured = supabase !== null;

interface Row {
  id: string;
  user_id: string;
  name: string;
  rule_set: RuleSetId;
  gender: Gender;
  dives: SavedDive[];
  updated_at: string;
}

function toList(row: Row): DiveList {
  return {
    id: row.id,
    name: row.name,
    ruleSet: row.rule_set,
    gender: row.gender,
    dives: row.dives ?? [],
    updatedAt: row.updated_at,
  };
}

export class SupabaseDataSource implements DataSource {
  readonly isGuest = false;

  constructor(private readonly userId: string) {}

  private get client(): SupabaseClient {
    if (!supabase) throw new Error('Supabase is not configured');
    return supabase;
  }

  async listLists(): Promise<DiveList[]> {
    const { data, error } = await this.client
      .from('dive_lists')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as Row[]).map(toList);
  }

  async getList(id: string): Promise<DiveList | null> {
    const { data, error } = await this.client.from('dive_lists').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toList(data as Row) : null;
  }

  async saveList(list: DiveList): Promise<void> {
    const { error } = await this.client.from('dive_lists').upsert({
      id: list.id,
      user_id: this.userId,
      name: list.name,
      rule_set: list.ruleSet,
      gender: list.gender,
      dives: list.dives,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteList(id: string): Promise<void> {
    const { error } = await this.client.from('dive_lists').delete().eq('id', id);
    if (error) throw error;
  }
}
