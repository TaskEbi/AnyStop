import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Where the sign-in is kept, so the installed phone app stays signed in between launches. */
export const AUTH_STORAGE_KEY = 'curio-auth';

/** Null when no project is configured: the app then runs in local-only mode. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_STORAGE_KEY } }) : null;
