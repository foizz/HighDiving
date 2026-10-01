import type { Position } from '../lib/dive';
import type { Gender, RuleSetId, SlotId } from '../rules/types';

export interface SavedDive {
  slot: SlotId;
  number: string;
  position: Position;
}

export interface DiveList {
  id: string;
  name: string;
  ruleSet: RuleSetId;
  gender: Gender;
  dives: SavedDive[];
  updatedAt: string;
}

export interface Account {
  id: string;
  /** Display name; for a guest this is simply "Guest". */
  name: string;
  isGuest: boolean;
}

/**
 * Storage for dive lists. Guest mode and signed-in mode run the same screens against
 * this interface, which is also what makes it possible to hand a guest's local lists
 * over to their account when they sign up.
 */
export interface DataSource {
  readonly isGuest: boolean;
  listLists(): Promise<DiveList[]>;
  getList(id: string): Promise<DiveList | null>;
  saveList(list: DiveList): Promise<void>;
  deleteList(id: string): Promise<void>;
}

export function newListId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `list-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyList(ruleSet: RuleSetId, gender: Gender, name = 'New list'): DiveList {
  return {
    id: newListId(),
    name,
    ruleSet,
    gender,
    dives: [],
    updatedAt: new Date().toISOString(),
  };
}
