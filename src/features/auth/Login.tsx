import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanUsername, USERNAME, usernameEmail } from './username';
import './login.css';

type Step = 'checking' | 'signin' | 'setup';

/**
 * Members' entrance: username + password, which the phone or browser can remember.
 * The very first time (no login exists yet) it asks you to choose them instead.
 */
export function Login({ sb }: { sb: SupabaseClient }) {
  const [step, setStep] = useState<Step>('checking');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void sb.rpc('login_setup_needed').then(({ data, error }) => setStep(!error && data === true ? 'setup' : 'signin'));
  }, [sb]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email: usernameEmail(username), password });
    setBusy(false);
    if (!error) return;
    if (error.message === 'Invalid login credentials') setError('That username and password don’t match.');
    else if (!navigator.onLine) setError('You’re offline. Signing in needs the internet the first time on a device.');
    else setError(error.message);
  }

  async function setUp(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await sb.functions.invoke<{ ok?: boolean; error?: string }>('setup-login', {
      body: { username: cleanUsername(username), password },
    });
    if (error || !data?.ok) {
      setBusy(false);
      // Function errors carry the JSON reply in their context.
      let message = data?.error ?? error?.message ?? 'Could not set up the login.';
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        /* keep the generic message */
      }
      setError(message);
      if (/already has its login/.test(message)) setStep('signin');
      return;
    }
    const signed = await sb.auth.signInWithPassword({ email: usernameEmail(username), password });
    setBusy(false);
    if (signed.error) {
      setError(signed.error.message);
      setStep('signin');
    }
  }

  const validName = USERNAME.test(cleanUsername(username));

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__tape" aria-hidden="true" />
        <p className="login__kicker type">Private collection · members only</p>
        <h1 className="login__title hand">Curio Cabinet</h1>
        {step === 'checking' && <p className="login__hint">Unlocking the door…</p>}
        {step === 'signin' && (
          <form onSubmit={signIn} className="login__form">
            <label className="field">
              <span>Username</span>
              <input
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !username.trim() || !password}>
              {busy ? 'Checking…' : 'Enter the cabinet'}
            </button>
          </form>
        )}
        {step === 'setup' && (
          <form onSubmit={setUp} className="login__form">
            <p className="login__hint">First time here: choose the username and password that will open this cabinet. Only this one login will work.</p>
            <label className="field">
              <span>Username</span>
              <input
                className="input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-describedby="username-rule"
                autoFocus
              />
              <small id="username-rule" className="login__hint">3–30 letters or numbers (dots, dashes and underscores are fine too)</small>
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password again</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !validName || password.length < 8 || !repeat}>
              {busy ? 'Setting up…' : 'Create login and enter'}
            </button>
          </form>
        )}
        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
