const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sbGet(sbUrl, sbKey, path) {
  const r = await fetch(sbUrl + path, {
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function sbPatch(sbUrl, sbKey, path, payload) {
  const r = await fetch(sbUrl + path, {
    method: 'PATCH',
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Supabase PATCH ${r.status}: ${await r.text()}`);
}

// Verify portal session token and deduct credits atomically (read-modify-write).
// Returns { ok: true } or { ok: false, error: string, status: number }
async function verifyAndDeductCredits(sbUrl, sbKey, { uid, token, cid, cost }) {
  // 1. Verify session token
  const users = await sbGet(sbUrl, sbKey,
    `/rest/v1/portal_users?id=eq.${encodeURIComponent(uid)}&session_token=eq.${encodeURIComponent(token)}&status=eq.approved&select=id&limit=1`
  );
  if (!users || !users.length) return { ok: false, error: 'Session invalide ou expirée.', status: 401 };

  if (!cost || cost <= 0) return { ok: true };

  // 2. Read workspace, find client credits
  const ws = await sbGet(sbUrl, sbKey, '/rest/v1/workspace?id=eq.main&select=data&limit=1');
  if (!ws || !ws.length) return { ok: false, error: 'Workspace introuvable.', status: 503 };
  const data = ws[0].data;
  const clients = Array.isArray(data.clients) ? data.clients : [];
  const clientIdx = clients.findIndex(c => c.id === cid);
  if (clientIdx === -1) return { ok: false, error: 'Client introuvable.', status: 403 };

  const current = Number(clients[clientIdx].credits) || 0;
  if (current < cost) return { ok: false, error: 'Crédits insuffisants.', status: 402 };

  // 3. Deduct credits and save
  clients[clientIdx] = { ...clients[clientIdx], credits: current - cost };
  await sbPatch(sbUrl, sbKey, '/rest/v1/workspace?id=eq.main', { data: { ...data, clients } });

  return { ok: true };
}

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
    const isP2 = body._profile === '2';
    const sbUrl = isP2 ? (env.SUPABASE_URL_2 || '').replace(/\/+$/, '') : SB_URL;
    const sbKey = isP2 ? (env.SUPABASE_SERVICE_KEY_2 || '') : SB_KEY;
    if (!sbUrl) return json({ error: 'SUPABASE_URL manquant dans les variables Cloudflare Pages.' }, 503);
    if (!sbKey) return json({ error: 'SUPABASE_SERVICE_KEY manquant dans les variables Cloudflare Pages.' }, 503);
    const { method = 'GET', path, payload, headers: extra = {} } = body;
    const ALLOWED_TABLES = ['workspace','tool_content','tool_versions','portal_files','portal_users','admin_accounts'];
    const pathAllowed = typeof path === 'string' && ALLOWED_TABLES.some(t => path.startsWith('/rest/v1/' + t));
    if (!pathAllowed) return json({ error: 'Chemin non autorisé.' }, 403);
    const headers = {
      'Content-Type': 'application/json',
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      Prefer: extra['Prefer'] || 'return=representation',
      ...extra,
    };
    const opts = { method, headers };
    if (payload != null && !['GET', 'HEAD', 'DELETE'].includes(method)) opts.body = JSON.stringify(payload);
    try {
      const resp = await fetch(sbUrl + path, opts);
      const text = await resp.text();
      if (!text || resp.status === 204) return json(null, resp.status);
      return new Response(text, { status: resp.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
    } catch (e) { return json({ error: `Supabase network error: ${e.message}` }, 502); }
  }

  const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY manquant dans Cloudflare Pages > Settings > Environment variables.' }, 503);

  // Portal credit check — required when _portal field is present
  if (body._portal) {
    if (!SB_URL || !SB_KEY) return json({ error: 'Supabase credentials manquants.' }, 503);
    const { uid, token, cid, cost } = body._portal;
    if (!uid || !token || !cid) return json({ error: 'Paramètres portail manquants.' }, 400);
    try {
      const result = await verifyAndDeductCredits(SB_URL, SB_KEY, { uid, token, cid, cost: Number(cost) || 0 });
      if (!result.ok) return json({ error: result.error }, result.status);
    } catch (e) {
      return json({ error: `Erreur vérification crédits: ${e.message}` }, 502);
    }
  }

  // Strip internal fields before forwarding to Anthropic
  const { _portal: _p, ...anthropicBody } = body;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(anthropicBody),
    });
    return json(await resp.json(), resp.status);
  } catch (e) { return json({ error: e.message }, 500); }
}
