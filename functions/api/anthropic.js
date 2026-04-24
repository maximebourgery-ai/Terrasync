const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const SB_URL = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const SB_KEY = env.SUPABASE_SERVICE_KEY || '';

  if (body._sb) {
    if (!SB_URL) return json({ error: 'SUPABASE_URL manquant dans les variables Cloudflare Pages.' }, 503);
    if (!SB_KEY) return json({ error: 'SUPABASE_SERVICE_KEY manquant dans les variables Cloudflare Pages.' }, 503);
    const { method = 'GET', path, payload, headers: extra = {} } = body;
    const headers = {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: extra['Prefer'] || 'return=representation',
      ...extra,
    };
    const opts = { method, headers };
    if (payload != null && !['GET', 'HEAD', 'DELETE'].includes(method)) opts.body = JSON.stringify(payload);
    try {
      const resp = await fetch(SB_URL + path, opts);
      const text = await resp.text();
      if (!text || resp.status === 204) return json(null, resp.status);
      return new Response(text, { status: resp.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
    } catch (e) { return json({ error: `Supabase network error: ${e.message}` }, 502); }
  }

  const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY manquant dans Cloudflare Pages > Settings > Environment variables.' }, 503);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    return json(await resp.json(), resp.status);
  } catch (e) { return json({ error: e.message }, 500); }
}