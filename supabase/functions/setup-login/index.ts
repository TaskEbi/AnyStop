// Supabase Edge Function: POST { username, password } → creates the one member account.
// Works exactly once: after the first member exists every call is refused (the members
// table also holds at most one row, so two racing calls can't both succeed).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/** Must match usernameEmail() in src/features/auth/username.ts. */
const EMAIL_DOMAIN = 'any-stop.vercel.app';
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body.username ?? '').trim().toLowerCase();
    password = String(body.password ?? '');
  } catch {
    /* fall through to validation */
  }
  if (!USERNAME.test(username)) return reply(400, { error: 'Usernames are 3–30 letters, numbers, dots, dashes or underscores.' });
  if (password.length < 8 || password.length > 72) return reply(400, { error: 'Passwords are 8–72 characters.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error: countError } = await admin.from('members').select('user_id', { count: 'exact', head: true });
  if (countError) return reply(500, { error: countError.message });
  if (count) return reply(409, { error: 'This cabinet already has its login. Sign in instead.' });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@${EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) return reply(400, { error: createError?.message ?? 'Could not create the login.' });

  const { error: memberError } = await admin.from('members').insert({ user_id: created.user.id, username });
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply(409, { error: 'This cabinet already has its login. Sign in instead.' });
  }
  return reply(200, { ok: true });
});
