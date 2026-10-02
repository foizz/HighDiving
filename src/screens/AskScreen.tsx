import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppState';
import { supabase } from '../data/supabaseDataSource';
import { Button, Card, EmptyState, Pill, ScreenHeader } from '../components/ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** Tools the assistant used for this answer, shown so the figures are traceable. */
  tools?: string[];
}

/** One conversation per account, kept until the user clears it. */
const historyKey = (accountId: string) => `highdive.ask.v1.${accountId}`;

function loadTurns(accountId: string): Turn[] {
  try {
    const raw = localStorage.getItem(historyKey(accountId));
    return raw ? (JSON.parse(raw) as Turn[]) : [];
  } catch {
    return [];
  }
}

function saveTurns(accountId: string, turns: Turn[]): void {
  try {
    if (turns.length) localStorage.setItem(historyKey(accountId), JSON.stringify(turns));
    else localStorage.removeItem(historyKey(accountId));
  } catch {
    // Not fatal; the conversation simply will not survive leaving the screen.
  }
}

const SUGGESTIONS = [
  'What is the DD limit for a women’s intermediate dive?',
  'Can I put two armstand dives in a Red Bull list?',
  'What happens if my required dive is over the limit?',
  'Who leads the world ranking this season?',
];

const TOOL_LABELS: Record<string, string> = {
  lookup_dd: 'looked up the DD table',
  find_dives: 'searched the dive table',
  validate_list: 'checked the list against the rules',
  score_dive: 'calculated the score',
  award_needed_for_target: 'worked out the award needed',
  get_ranking: 'read the standings',
  placing_needed: 'worked out the place needed',
  query_results: 'read past results',
  score_by_place: 'averaged past winning scores',
  get_my_lists: 'read your lists',
};

/**
 * Chat with the rules assistant. The answer streams in; the tools it used are listed
 * underneath so a number can always be traced back to the table it came from.
 */
export function AskScreen() {
  const { account, rules } = useApp();
  const accountId = account?.id ?? 'anonymous';
  const [turns, setTurnsState] = useState<Turn[]>(() => loadTurns(accountId));
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  /*
   * Every change is written straight to storage, not from an effect, so an answer that
   * keeps streaming after the user switches tab still lands in the saved conversation.
   * The ref is the source of truth for the same reason: state updates stop once the
   * screen unmounts.
   */
  const turnsRef = useRef(turns);
  function setTurns(update: Turn[] | ((prev: Turn[]) => Turn[])) {
    const next = typeof update === 'function' ? update(turnsRef.current) : update;
    turnsRef.current = next;
    saveTurns(accountId, next);
    setTurnsState(next);
  }

  // Signing in as someone else swaps in their conversation.
  useEffect(() => {
    const loaded = loadTurns(accountId);
    turnsRef.current = loaded;
    setTurnsState(loaded);
  }, [accountId]);

  function clear() {
    setTurns([]);
    setError(null);
  }

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const available = supabase !== null && !account?.isGuest;

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !supabase) return;

    // An answer cut off by leaving mid-stream is saved empty; it is not worth resending.
    const history: Turn[] = [
      ...turnsRef.current.filter((t) => t.role === 'user' || t.content),
      { role: 'user', content: trimmed },
    ];
    setTurns([...history, { role: 'assistant', content: '', tools: [] }]);
    setQuestion('');
    setBusy(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired — sign in again.');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: history.map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      if (!response.ok || !response.body) {
        const message = await response.json().catch(() => null);
        throw new Error(message?.error ?? `The assistant returned ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Server-sent events are separated by a blank line.
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const event = /^event:\s*(.+)$/m.exec(chunk)?.[1];
          const raw = /^data:\s*(.+)$/m.exec(chunk)?.[1];
          if (!event || !raw) continue;
          let payload: Record<string, string>;
          try {
            payload = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event === 'text') {
            setTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + payload.text };
              return next;
            });
          } else if (event === 'tool') {
            setTurns((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, tools: [...(last.tools ?? []), payload.name] };
              return next;
            });
          } else if (event === 'error') {
            setError(payload.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The assistant failed to answer.');
    } finally {
      setBusy(false);
    }
  }

  if (!available) {
    return (
      <div className="p-4 pb-24">
        <ScreenHeader title="Ask" />
        <EmptyState title="The assistant needs an account">
          {supabase
            ? 'Sign in rather than continuing as a guest — the assistant answers using your lists and the uploaded results.'
            : 'Add your Supabase project details, then deploy the ask function.'}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col p-4 pb-24">
      <ScreenHeader
        title="Ask"
        subtitle={`Questions about either rule book, your lists, and past results. Currently reading ${rules.shortName} by default.`}
      />

      {turns.length === 0 ? (
        <div className="space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void ask(s)}
              className="glass glass-sheen w-full rounded-xl px-3.5 py-3 text-left text-sm transition duration-150 hover:brightness-110"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <ul className="flex-1 space-y-3">
          {turns.map((turn, i) => (
            <li key={i}>
              {turn.role === 'user' ? (
                <div className="ml-8 rounded-2xl bg-accent px-3 py-2 text-sm text-accent-text">
                  {turn.content}
                </div>
              ) : (
                <Card className="mr-4">
                  {turn.content ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</p>
                  ) : (
                    <p className="text-sm text-muted">Thinking…</p>
                  )}
                  {turn.tools?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...new Set(turn.tools)].map((t) => (
                        <Pill key={t}>{TOOL_LABELS[t] ?? t}</Pill>
                      ))}
                    </div>
                  ) : null}
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <div className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {turns.length && !busy ? (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={clear}>
            Clear conversation
          </Button>
        </div>
      ) : null}

      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="sticky bottom-20 mt-4 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about the rules…"
          aria-label="Your question"
          className="glass min-h-11 flex-1 rounded-xl px-3 text-base text-text placeholder:text-muted/70"
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          {busy ? '…' : 'Ask'}
        </Button>
      </form>

      <p className="mt-2 text-center text-xs text-muted">
        Answers cite the rule they rely on. Check anything that decides a competition.
      </p>
    </div>
  );
}
