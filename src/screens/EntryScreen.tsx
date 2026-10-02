import { useState } from 'react';
import { useApp } from '../app/AppState';
import { Button, Card, Field, Input } from '../components/ui';

type Mode = 'signin' | 'signup';

export function EntryScreen() {
  const { signIn, signUp, continueAsGuest, supabaseConfigured } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice('Check your email to confirm the account, then sign in.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">High Dive List</h1>
        <p className="mt-1 text-sm text-muted">
          Build a competition list, check it against the rules, and work out the score you need.
        </p>
      </div>

      {supabaseConfigured ? (
        <Card>
          <div className="mb-4 flex gap-1 rounded-xl border border-border/50 bg-text/[0.05] p-1">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setNotice(null);
                }}
                aria-pressed={mode === m}
                className={`min-h-10 flex-1 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${
                  mode === m ? 'accent-fill text-accent-text shadow-sm' : 'text-muted hover:text-text'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field
              label="Password"
              hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </Field>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {notice ? <p className="text-sm text-ok">{notice}</p> : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Accounts are not configured for this build, so lists are saved on this device only.
            Add <code className="text-text">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-text">VITE_SUPABASE_ANON_KEY</code> to enable sign-in.
          </p>
        </Card>
      )}

      <div className="text-center">
        <Button variant="secondary" onClick={continueAsGuest} className="w-full">
          Continue as guest
        </Button>
        <p className="mt-2 text-xs text-muted">
          Guest lists stay on this device. You can move them into an account later.
        </p>
      </div>
    </div>
  );
}
