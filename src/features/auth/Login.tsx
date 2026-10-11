import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import './login.css';

/**
 * Members' entrance. Email a 6-digit code and type it here: unlike a magic link,
 * this also signs in the installed phone app (which doesn't share Safari's login).
 */
export function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    else setStep('code');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <main className="login">
      <div className="login__card">
        <span className="login__tape" aria-hidden="true" />
        <p className="login__kicker type">Private collection · members only</p>
        <h1 className="login__title hand">Curio Cabinet</h1>
        {step === 'email' ? (
          <form onSubmit={sendCode} className="login__form">
            <label className="field">
              <span>Your email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </label>
            <button className="btn btn--primary" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="login__form">
            <p className="login__hint">
              A code is on its way to <strong>{email}</strong>. Type it below, or tap the link in the email.
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
              {busy ? 'Checking…' : 'Enter the cabinet'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setStep('email')}>
              Use a different email
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
