const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) return json({ error: 'Email invalide' }, 400);
    const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
    const supabaseKey = env.SUPABASE_SERVICE_KEY || '';
    if (!supabaseUrl || !supabaseKey) return json({ error: 'Supabase credentials manquants.' }, 503);
    const resp = await fetch(`${supabaseUrl}/rest/v1/workspace?id=eq.main&select=blob`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
    const rows = await resp.json();
    if (!rows || rows.length === 0) throw new Error('Workspace non trouvé');
    const S = JSON.parse(rows[0].blob);
    let foundPortal = null;
    for (const client of S.clients) {
      const users = S.portalUsers?.[client.id] || [];
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase() && u.status === 'approved');
      if (user) { foundPortal = client.id; break; }
    }
    if (foundPortal) return json({ success: true, portalId: foundPortal, message: 'Portail trouvé !' });
    return json({ success: false, message: 'Aucun compte trouvé avec cet email' }, 404);
  } catch (error) {
    return json({ success: false, error: 'Erreur serveur', details: error.message }, 500);
  }
}