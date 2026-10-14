import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY, supabase } from '../lib/supabase';
import { Login } from '../features/auth/Login';
import { Museum } from './Museum';
import './app.css';

/** A sign-in saved on this device, even if it can't be refreshed right now (e.g. opened offline). */
function hasSavedSignIn(): boolean {
  try {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}

function AuthGate({ sb }: { sb: SupabaseClient }) {
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    void sb.auth.getSession().then(({ data, error }) => {
      // Offline with an expired token: open the local copy anyway; sync resumes once it refreshes.
      setSignedIn(!!data.session || (!!error && hasSavedSignIn()));
    });
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') setSignedIn(false);
      else if (s) setSignedIn(true);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (signedIn === undefined) return <p className="loading hand">Opening the cabinet…</p>;
  if (!signedIn) return <Login sb={sb} />;
  return <Museum cloud />;
}

/** With a Supabase project configured you sign in and sync; without one it runs locally in this browser. */
export function App() {
  return supabase ? <AuthGate sb={supabase} /> : <Museum cloud={false} />;
}
