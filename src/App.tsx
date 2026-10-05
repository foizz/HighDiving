import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
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
import { MoreScreen } from './screens/MoreScreen';
import { Button, ScreenLayout } from './components/ui';

const TABS: { path: string; label: string }[] = [
  { path: '/lists', label: 'Lists' },
  { path: '/simulate', label: 'Simulate' },
  { path: '/rankings', label: 'Rankings' },
  { path: '/ask', label: 'Ask' },
  { path: '/more', label: 'More' },
];

export default function App() {
  const { account, authReady, ruleSet, setRuleSet, rules } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  if (!authReady) {
    return <div className="grid min-h-full place-items-center text-sm text-muted">Loading…</div>;
  }

  if (!account) return <EntryScreen />;

  const currentPath = location.pathname;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      {/* The rule-set toggle and login button are always reachable. */}
      <header className="chrome sticky top-0 z-20 border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
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
          <Button variant="ghost" onClick={() => navigate('/entry')}>
            {account.isGuest ? 'Sign in' : 'Sign out'}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ListsScreen />} />
          <Route path="/lists" element={<ListsScreen />} />
          <Route path="/simulate" element={<SimulatorScreen />} />
          <Route path="/rankings" element={<RankingsScreen />} />
          <Route path="/ask" element={<AskScreen />} />
          <Route path="/more" element={<MoreScreen onOpen={(target) => navigate(`/more/${target}`)} />} />
          <Route path="/more/table" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <CatalogScreen />
            </ScreenLayout>
          } />
          <Route path="/more/settings" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <SettingsScreen />
            </ScreenLayout>
          } />
          <Route path="/more/admin" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <AdminScreen />
            </ScreenLayout>
          } />
          <Route path="/entry" element={<EntryScreen />} />
          <Route path="*" element={
            account.isGuest ? <RankingsScreen /> : <ListsScreen />
          } />
        </Routes>
      </main>

      <nav
        aria-label="Sections"
        className="chrome pb-safe sticky bottom-0 z-20 border-t border-border/40"
      >
        <ul className="mx-auto flex max-w-2xl px-1 pt-1">
          {TABS.map((t) => {
            const active = currentPath === t.path || (t.path === '/lists' && currentPath === '/');
            return (
              <li key={t.path} className="flex-1">
                <Link
                  to={t.path}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-12 w-full items-center justify-center rounded-lg px-1 text-xs font-semibold transition duration-150 ${
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
                </Link>
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
