const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Whitelist des tables Supabase autorisées
const ALLOWED_SB_TABLES = [
  'workspace', 'tool_content', 'tool_versions',
  'portal_files', 'portal_users', 'admin_accounts',
];

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_AI_TOKENS  = 4096;

function isAllowedSbPath(path) {
  if (!path || typeof path !== 'string') return false;
  return ALLOWED_SB_TABLES.some(t => {
    const prefix = `/rest/v1/${t}`;
    return path === prefix || path.startsWith(prefix + '?') || path.startsWith(prefix + '/');
  });
}

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  // Limite de taille
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Requête trop volumineuse' }, 413);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON invalide' }, 400); }

  const SB_URL = (env.SUPABASE_URL || '').replace(/\/+$/, '');
  const SB_KEY = env.SUPABASE_SERVICE_KEY || '';

  // ── Proxy Supabase ──────────────────────────────────────────────────────────
  if (body._sb) {
    if (!SB_URL || !SB_KEY) return json({ error: 'Configuration serveur incomplète' }, 503);

    const { method = 'GET', path, payload, headers: extra = {} } = body;

    // Validation du chemin (whitelist)
    if (!isAllowedSbPath(path)) return json({ error: 'Opération non autorisée' }, 403);

    // Validation de la méthode
    if (!['GET', 'POST', 'PATCH', 'DELETE', 'HEAD'].includes(method)) {
      return json({ error: 'Méthode non autorisée' }, 405);
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: extra['Prefer'] || 'return=representation',
      ...extra,
    };
    const opts = { method, headers };
    if (payload != null && !['GET', 'HEAD', 'DELETE'].includes(method)) {
      opts.body = JSON.stringify(payload);
    }
    try {
      const resp = await fetch(SB_URL + path, opts);
      const text = await resp.text();
      if (!text || resp.status === 204) return json(null, resp.status);
      return new Response(text, { status: resp.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
    } catch {
      return json({ error: 'Erreur de connexion' }, 502);
    }
  }

  // ── Proxy Anthropic ─────────────────────────────────────────────────────────
  const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return json({ error: 'Service IA non configuré' }, 503);

  // Validation minimale du payload Anthropic
  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: 'Paramètres IA invalides' }, 400);
  }

  // Plafonner max_tokens pour éviter les abus de coûts
  if (!body.max_tokens || body.max_tokens > MAX_AI_TOKENS) {
    body.max_tokens = MAX_AI_TOKENS;
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    return json(await resp.json(), resp.status);
  } catch {
    return json({ error: 'Service IA indisponible' }, 500);
  }
}
