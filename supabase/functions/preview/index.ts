// Supabase Edge Function: POST { url } → link preview metadata.
// JWT verification is on (the default), so only signed-in users can call it.
import { fetchPreview } from '../_shared/preview.ts';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const resolve = async (host: string) => {
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(host, 'A').catch(() => [] as string[]),
    Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]),
  ]);
  return [...a, ...aaaa];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  let url = '';
  try {
    url = String((await req.json()).url ?? '');
  } catch {
    /* fall through */
  }
  if (!url || url.length > 2048) {
    return Response.json({ ok: false, error: 'Missing url' }, { status: 400, headers: cors });
  }

  const preview = await fetchPreview(url, resolve);
  return Response.json(preview, { headers: { ...cors, 'cache-control': 'private, max-age=3600' } });
});
