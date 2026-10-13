import { supabase } from '../lib/supabase';
import { Museum } from './Museum';
import './app.css';

/** With a Supabase project configured everything syncs to the shared cloud cabinet; without one it stays in this browser. */
export function App() {
  return <Museum cloud={!!supabase} />;
}
