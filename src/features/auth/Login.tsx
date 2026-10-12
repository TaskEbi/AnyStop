import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './login.css';

type Step = 'password' | 'email' | 'code' | 'choose';

/**
 * Members' entrance. Normally email + password (which the phone or browser can remember).
 * Without a password yet, or having forgotten it, you sign in once with an emailed 6-digit code
 * and then choose one. A code rather than a magic link, because a link doesn't sign in the
 * installed phone app (which doesn't share Safari's login).
 *
 * `onChoosing` keeps this screen up after a code sign-in until a password is chosen or skipped.
 */
export function Login({ sb, onChoosing }: { sb: SupabaseClient; onChoosing: (on: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message);
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setError(error.message);
    else goTo('code');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    onChoosing(true);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) {
      onChoosing(false);
      setError(error.message);
    } else {
      setPassword('');
      goTo('choose');
    }
  }

  async function choose(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else onChoosing(false);
  }

  const emailField = (
    <label className="field">
      <span>Your email</span>
      <input
        className="input"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus={!email}
      />
    </label>
  );

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__tape" aria-hidden="true" />
        <p className="login__kicker type">Private collection · members only</p>
        <h1 className="login__title hand">Curio Cabinet</h1>
        {step === 'password' && (
          <form onSubmit={signIn} className="login__form">
            {emailField}
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={!!email}
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !email.includes('@') || !password}>
              {busy ? 'Checking…' : 'Enter the cabinet'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => goTo('email')}>
              No password yet, or forgot it? Email me a code
            </button>
          </form>
        )}
        {step === 'email' && (
          <form onSubmit={sendCode} className="login__form">
            {emailField}
            <button className="btn btn--primary" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => goTo('password')}>
              Back to password
            </button>
          </form>
        )}
        {step === 'code' && (
          <form onSubmit={verify} className="login__form">
            <p className="login__hint">
              A code is on its way to <strong>{email}</strong>. Type it below.
            </p>
            <label className="field">
              <span>Code</span>
              <input
                className="input login__code type"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>
            <button className="btn btn--primary" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => goTo('email')}>
              Use a different email
            </button>
          </form>
        )}
        {step === 'choose' && (
          <form onSubmit={choose} className="login__form">
            <p className="login__hint">
              You’re in. Choose a password so next time it’s just <strong>{email}</strong> and this, no code.
            </p>
            {/* Lets the browser or phone save the new password against this email. */}
            <input type="email" autoComplete="username" value={email} readOnly hidden />
            <label className="field">
              <span>New password</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </label>
            <button className="btn btn--primary" disabled={busy || password.length < 6}>
              {busy ? 'Saving…' : 'Save and enter'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => onChoosing(false)}>
              Skip for now
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
