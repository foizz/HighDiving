import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { RULE_SETS, type Gender, type RuleSet, type RuleSetId } from '../rules';
import type { Account, DataSource } from '../data/DataSource';
import { LocalDataSource, clearLocalLists, localLists } from '../data/localDataSource';
import { SupabaseDataSource, supabase, supabaseConfigured } from '../data/supabaseDataSource';

interface Settings {
  ruleSet: RuleSetId;
  gender: Gender;
  judgeCount: number;
}

const SETTINGS_KEY = 'highdive.settings.v1';
const GUEST_KEY = 'highdive.guest.v1';

function setGuestFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Not fatal; guest mode simply will not survive a reload.
  }
}

function loadSettings(): Settings {
  const fallback: Settings = { ruleSet: 'redbull', gender: 'men', judgeCount: 5 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

interface AppContextValue extends Settings {
  rules: RuleSet;
  setRuleSet: (id: RuleSetId) => void;
  setGender: (g: Gender) => void;
  setJudgeCount: (n: number) => void;
  account: Account | null;
  data: DataSource | null;
  authReady: boolean;
  supabaseConfigured: boolean;
  continueAsGuest: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Number of guest lists waiting to be copied into a new account. */
  pendingGuestLists: number;
  migrateGuestLists: () => Promise<number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [session, setSession] = useState<Session | null>(null);
  // Guest mode survives a reload: a guest's lists are already on the device, so sending
  // them back to the entry screen every refresh would be pure friction.
  const [guest, setGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const [pendingGuestLists, setPendingGuestLists] = useState(0);

  // Reflect the rule set onto <html> so the CSS tokens — and the browser chrome
  // colour — follow the toggle.
  useEffect(() => {
    document.documentElement.dataset.ruleset = settings.ruleSet;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', settings.ruleSet === 'redbull' ? '#060e26' : '#f4f8fc');
    }
  }, [settings.ruleSet]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Not fatal; settings simply will not persist.
    }
  }, [settings]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setPendingGuestLists(localLists().length);
  }, [session, guest]);

  const account: Account | null = useMemo(() => {
    if (session?.user) {
      return {
        id: session.user.id,
        name: session.user.email ?? 'Signed in',
        isGuest: false,
      };
    }
    if (guest) return { id: 'guest', name: 'Guest', isGuest: true };
    return null;
  }, [session, guest]);

  const data: DataSource | null = useMemo(() => {
    if (session?.user) return new SupabaseDataSource(session.user.id);
    if (guest) return new LocalDataSource();
    return null;
  }, [session, guest]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Accounts are not configured for this build.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setGuestFlag(false);
    setGuest(false);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Accounts are not configured for this build.');
    const { data: result, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    setGuestFlag(false);
    setGuest(false);
    // With email confirmation enabled Supabase returns a user but no session.
    return { needsConfirmation: !result.session };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setGuestFlag(false);
    setGuest(false);
    setSession(null);
  }, []);

  const migrateGuestLists = useCallback(async () => {
    if (!session?.user) return 0;
    const lists = localLists();
    if (!lists.length) return 0;
    const target = new SupabaseDataSource(session.user.id);
    for (const list of lists) await target.saveList(list);
    clearLocalLists();
    setPendingGuestLists(0);
    return lists.length;
  }, [session]);

  const value: AppContextValue = {
    ...settings,
    rules: RULE_SETS[settings.ruleSet],
    setRuleSet: (ruleSet) =>
      setSettings((s) => {
        const rules = RULE_SETS[ruleSet];
        // Red Bull judges on a panel of five only; keep the count legal across a switch.
        const judgeCount = rules.judgeCounts.includes(s.judgeCount)
          ? s.judgeCount
          : rules.defaultJudgeCount;
        return { ...s, ruleSet, judgeCount };
      }),
    setGender: (gender) => setSettings((s) => ({ ...s, gender })),
    setJudgeCount: (judgeCount) => setSettings((s) => ({ ...s, judgeCount })),
    account,
    data,
    authReady,
    supabaseConfigured,
    continueAsGuest: () => {
      setGuestFlag(true);
      setGuest(true);
    },
    signIn,
    signUp,
    signOut,
    pendingGuestLists,
    migrateGuestLists,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
