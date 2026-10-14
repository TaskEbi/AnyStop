import { useState, type FormEvent } from 'react';
import { toast, ui } from '../../data/ui';
import { supabase } from '../../lib/supabase';
import { Sheet } from '../../ui/Sheet';

/** Choose a new password for the cabinet's login. */
export function PasswordSheet() {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => ui.set({ passwordOpen: false });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) return setError('The two passwords don’t match.');
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(navigator.onLine ? error.message : 'You’re offline. Try again when you’re connected.');
    toast('Password changed');
    close();
  }

  return (
    <Sheet title="Change password" onClose={close}>
      <form className="login__form" onSubmit={save}>
        <label className="field">
          <span>New password</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} data-autofocus />
        </label>
        <label className="field">
          <span>New password again</span>
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" disabled={busy || password.length < 8 || !repeat}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </Sheet>
  );
}
