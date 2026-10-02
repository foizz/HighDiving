import { useState } from 'react';
import { useApp } from './app/AppState';
import { RULE_SETS, RULE_SET_IDS } from './rules';
import { EntryScreen } from './screens/EntryScreen';
import { ListsScreen } from './screens/ListsScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RankingsScreen } from './screens/RankingsScreen';
import { AskScreen } from './screens/AskScreen';
import { AdminScreen } from './screens/AdminScreen';
import { MoreScreen, type MoreTarget } from './screens/MoreScreen';

type Tab = 'lists' | 'simulate' | 'rankings' | 'ask' | 'more';

const TABS: { id: Tab; label: string }[] = [
  { id: 'lists', label: 'Lists' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'ask', label: 'Ask' },
  { id: 'more', label: 'More' },
];

export default function App() {
  const { account, authReady, ruleSet, setRuleSet, rules } = useApp();
  const [tab, setTab] = useState<Tab>('lists');
  const [more, setMore] = useState<MoreTarget | null>(null);

  if (!authReady) {
    return <div className="grid min-h-full place-items-center text-sm text-muted">Loading…</div>;
  }

  if (!account) return <EntryScreen />;

  function openTab(next: Tab) {
    setMore(null);
    setTab(next);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      {/* The rule-set toggle is always reachable: it changes the DD figures, the
          legality verdict and the whole palette, so it belongs in the chrome. */}
      <header className="chrome sticky top-0 z-20 border-b border-border/40 px-4 py-2.5">
        <div
          role="radiogroup"
          aria-label="Rule set"
          className="glass glass-sheen flex gap-1 rounded-xl p-1"
        >
          {RULE_SET_IDS.map((id) => {
            const active = id === ruleSet;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                onClick={() => setRuleSet(id)}
                className={`min-h-9 flex-1 rounded-lg px-2 text-sm font-bold transition duration-200 ${
                  active
                    ? 'accent-fill text-accent-text shadow-sm'
                    : 'text-muted hover:bg-text/5 hover:text-text'
                }`}
              >
                {RULE_SETS[id].shortName}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1">
        {tab === 'lists' ? <ListsScreen /> : null}
        {tab === 'simulate' ? <SimulatorScreen /> : null}
        {tab === 'rankings' ? <RankingsScreen /> : null}
        {tab === 'ask' ? <AskScreen /> : null}
        {tab === 'more' ? (
          more === null ? (
            <MoreScreen onOpen={setMore} />
          ) : (
            <div>
              <button
                onClick={() => setMore(null)}
                className="px-4 pt-4 text-sm text-muted hover:text-text"
              >
                ← More
              </button>
              {more === 'table' ? <CatalogScreen /> : null}
              {more === 'settings' ? <SettingsScreen /> : null}
              {more === 'admin' ? <AdminScreen /> : null}
            </div>
          )
        ) : null}
      </main>

      <nav
        aria-label="Sections"
        className="chrome pb-safe sticky bottom-0 z-20 border-t border-border/40"
      >
        <ul className="mx-auto flex max-w-2xl px-1 pt-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <li key={t.id} className="flex-1">
                <button
                  onClick={() => openTab(t.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative min-h-12 w-full rounded-lg px-1 text-xs font-semibold transition duration-150 ${
                    active ? 'text-accent-2' : 'text-muted hover:text-text'
                  }`}
                >
                  {/* A short bar above the label, rather than a filled tab — quieter,
                      and it leaves the glass behind it visible. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -top-1 mx-auto h-0.5 w-8 rounded-full transition duration-200 ${
                      active ? 'bg-accent-2 opacity-100' : 'opacity-0'
                    }`}
                  />
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <span className="sr-only" aria-live="polite">
        {rules.name} rules active
      </span>
    </div>
  );
}
