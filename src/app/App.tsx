import { useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Login } from '../features/auth/Login';
import { Museum } from './Museum';
import './app.css';

function AuthGate({ sb }: { sb: SupabaseClient }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (session === undefined) return <p className="loading hand">Opening the cabinet…</p>;
  if (!session) return <Login sb={sb} />;
  return <Museum key={session.user.id} userId={session.user.id} />;
}

/** With a Supabase project configured you sign in and sync; without one it runs locally in this browser. */
export function App() {
  return supabase ? <AuthGate sb={supabase} /> : <Museum userId={null} />;
}
