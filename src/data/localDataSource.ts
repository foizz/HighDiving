import type { DataSource, DiveList } from './DataSource';

const KEY = 'highdive.lists.v1';

/**
 * Guest storage. localStorage is enough here — a dive list is a few hundred bytes and
 * there is never more than a handful of them — and it keeps guest mode working with no
 * network and no account.
 *
 * Every access is guarded: in a private window or with site data blocked, the accessor
 * itself can throw, and the app should still run rather than fail to start.
 */
function read(): DiveList[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiveList[]) : [];
  } catch {
    return [];
  }
}

function write(lists: DiveList[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    // Storage unavailable or full; the list stays in memory for this session only.
  }
}

export class LocalDataSource implements DataSource {
  readonly isGuest = true;

  async listLists(): Promise<DiveList[]> {
    return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getList(id: string): Promise<DiveList | null> {
    return read().find((l) => l.id === id) ?? null;
  }

  async saveList(list: DiveList): Promise<void> {
    const lists = read();
    const next = { ...list, updatedAt: new Date().toISOString() };
    const i = lists.findIndex((l) => l.id === list.id);
    if (i === -1) lists.push(next);
    else lists[i] = next;
    write(lists);
  }

  async deleteList(id: string): Promise<void> {
    write(read().filter((l) => l.id !== id));
  }
}

/** Lists held locally, used when migrating a guest's work into a new account. */
export function localLists(): DiveList[] {
  return read();
}

export function clearLocalLists(): void {
  write([]);
}
