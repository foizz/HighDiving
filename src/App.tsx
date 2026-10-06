import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { useApp } from './app/AppState';
import { RULE_SETS, RULE_SET_IDS } from './rules';
import { EntryScreen } from './screens/EntryScreen';
import { ListsScreen } from './screens/ListsScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { SimulatorScreen } from './screens/SimulatorScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RankingsScreen } from './screens/RankingsScreen';
import { ResearchDiverScreen } from './screens/ResearchDiverScreen';
import { AskScreen } from './screens/AskScreen';
import { AdminScreen } from './screens/AdminScreen';
import { MoreScreen } from './screens/MoreScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { TermsOfServiceScreen } from './screens/TermsOfServiceScreen';
import { DMCAScreen } from './screens/DMCAScreen';
import { Button, ScreenLayout } from './components/ui';
import { ConsentBanner } from './components/ConsentBanner';
import { trackPageView, useAnalyticsConsent } from './lib/analytics';

const TABS: { path: string; label: string; icon: (active: boolean) => JSX.Element }[] = [
  {
    path: '/lists',
    label: 'Lists',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    path: '/simulate',
    label: 'Simulate',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: '/rankings',
    label: 'Rankings',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    path: '/research',
    label: 'Research',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    path: '/ask',
    label: 'Ask',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    path: '/more',
    label: 'More',
    icon: (active) => (
      <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    ),
  },
];

export default function App() {
  const { account, authReady, ruleSet, setRuleSet, rules, signOut } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const analyticsConsent = useAnalyticsConsent();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, analyticsConsent]);

  if (!authReady) {
    return <div className="grid min-h-full place-items-center text-sm text-muted">Loading…</div>;
  }

  if (!account) return <EntryScreen />;

  const currentPath = location.pathname;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      {/* The rule-set toggle and login button are always reachable. */}
      <header className="chrome pt-safe sticky top-0 z-20 border-b border-border/30 px-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="Rule set"
            className="flex gap-1.5 rounded-lg border border-border/40 bg-text/[0.04] p-1.5"
          >
            {RULE_SET_IDS.map((id) => {
              const active = id === ruleSet;
              return (
                <button
                  key={id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRuleSet(id)}
                  className={`min-h-9 flex-1 rounded-md px-3 text-sm font-semibold transition duration-150 ${
                    active
                      ? 'accent-fill text-accent-text shadow-md'
                      : 'text-muted hover:bg-text/8 hover:text-text'
                  }`}
                >
                  {RULE_SETS[id].shortName}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" onClick={() => void signOut()}>
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
          <Route path="/research" element={<ResearchDiverScreen />} />
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
          <Route path="/privacy" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <PrivacyPolicyScreen />
            </ScreenLayout>
          } />
          <Route path="/terms" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <TermsOfServiceScreen />
            </ScreenLayout>
          } />
          <Route path="/dmca" element={
            <ScreenLayout onBack={() => navigate('/more')} backLabel="More">
              <DMCAScreen />
            </ScreenLayout>
          } />
          <Route path="*" element={
            account.isGuest ? <RankingsScreen /> : <ListsScreen />
          } />
        </Routes>
      </main>

      <ConsentBanner />

      <nav
        aria-label="Sections"
        className="chrome pb-safe sticky bottom-0 z-20 border-t border-border/40"
      >
        <ul className="mx-auto flex max-w-2xl px-1 pt-2">
          {TABS.map((t) => {
            const active = currentPath === t.path || (t.path === '/lists' && currentPath === '/');
            return (
              <li key={t.path} className="flex-1">
                <Link
                  to={t.path}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 transition duration-150 ${
                    active ? 'text-accent-2' : 'text-muted hover:text-text'
                  }`}
                >
                  {/* Active indicator bar above icon */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -top-1 mx-auto h-0.5 w-8 rounded-full transition duration-200 ${
                      active ? 'bg-accent-2 opacity-100' : 'opacity-0'
                    }`}
                  />
                  {/* Icon */}
                  <div className="flex items-center justify-center">
                    {t.icon(active)}
                  </div>
                  {/* Label */}
                  <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
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
