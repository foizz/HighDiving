import { useEffect, useState } from 'react';
import { useApp } from '../app/AppState';
import { emptyList, type DiveList } from '../data/DataSource';
import { evaluateList } from '../rules';
import { Button, Card, EmptyState, Pill, ScreenHeader } from '../components/ui';
import { ListEditorScreen } from './ListEditorScreen';

export function ListsScreen() {
  const { data, rules, gender } = useApp();
  const [lists, setLists] = useState<DiveList[] | null>(null);
  const [editing, setEditing] = useState<DiveList | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!data) return;
    try {
      setLists(await data.listLists());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your lists.');
      setLists([]);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function save(next: DiveList) {
    setEditing(next);
    if (!data) return;
    try {
      await data.saveList(next);
      setLists((prev) =>
        prev ? [next, ...prev.filter((l) => l.id !== next.id)] : [next],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  async function remove(id: string) {
    if (!data) return;
    await data.deleteList(id);
    void refresh();
  }

  if (editing) {
    return (
      <ListEditorScreen
        list={editing}
        onChange={save}
        onBack={() => {
          setEditing(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="p-4 pb-24">
      <ScreenHeader title="My lists" subtitle="Each list is four dives for one competition." />

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <Button
        onClick={() => {
          const list = emptyList(rules.id, gender);
          setEditing(list);
          void save(list);
        }}
        className="mb-4 w-full"
      >
        New list
      </Button>

      {lists === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : lists.length === 0 ? (
        <EmptyState title="No lists yet">
          Create one to start picking dives and checking them against the rules.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => {
            // Evaluated under the rule set currently selected, so the verdict shown here
            // always agrees with what the editor and simulator show.
            const evaluation = evaluateList(list.dives, rules, gender);
            return (
              <li key={list.id}>
                <Card>
                  <button onClick={() => setEditing(list)} className="w-full text-left">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-bold">{list.name}</span>
                      <span className="tabular text-sm text-muted">
                        DD {evaluation.totalDD.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {rules.shortName} · {gender === 'men' ? "Men's" : "Women's"} ·{' '}
                      {evaluation.dives.length}/4 dives
                    </p>
                    <div className="mt-2">
                      {evaluation.valid ? (
                        <Pill tone="ok">Legal</Pill>
                      ) : (
                        <Pill tone="warn">Incomplete or illegal</Pill>
                      )}
                    </div>
                  </button>
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" onClick={() => void remove(list.id)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
