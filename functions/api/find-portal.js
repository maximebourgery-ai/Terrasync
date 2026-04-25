const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const EMAIL_RE  = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const NOT_FOUND = { success: false, message: 'Aucun compte trouvé avec cet email' };

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'JSON invalide' }, 400);

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return json({ error: 'Email invalide' }, 400);
    }

    const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
    const supabaseKey = env.SUPABASE_SERVICE_KEY || '';
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Service temporairement indisponible' }, 503);
    }

    // Correction bug : la colonne est "data" (JSONB), pas "blob"
    const resp = await fetch(`${supabaseUrl}/rest/v1/workspace?id=eq.main&select=data`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!resp.ok) return json({ error: 'Service temporairement indisponible' }, 503);

    const rows = await resp.json();
    if (!rows || rows.length === 0) return json(NOT_FOUND, 404);

    // La colonne JSONB est déjà désérialisée par PostgREST — pas besoin de JSON.parse
    const S = rows[0].data;
    if (!S || !Array.isArray(S.clients)) return json(NOT_FOUND, 404);

    let foundPortal = null;
    for (const client of S.clients) {
      const users = (S.portalUsers && S.portalUsers[client.id]) || [];
      const match = users.find(
        u => u.email && u.email.toLowerCase() === email && u.status === 'approved'
      );
      if (match) { foundPortal = client.id; break; }
    }

    if (!foundPortal) return json(NOT_FOUND, 404);
    return json({ success: true, portalId: foundPortal });

  } catch {
    return json({ error: 'Service temporairement indisponible' }, 500);
  }
}
