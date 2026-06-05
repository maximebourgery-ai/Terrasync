const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function onRequestOptions() {
  return new Response('', { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    if (!email || !email.includes('@')) return json({ error: 'Email invalide' }, 400);
    const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
    const supabaseKey = env.SUPABASE_SERVICE_KEY || '';
    if (!supabaseUrl || !supabaseKey) return json({ error: 'Supabase credentials manquants.' }, 503);

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/portal_users?email=eq.${encodeURIComponent(email.toLowerCase())}&status=eq.approved&select=id,cid,pwd&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
    const rows = await resp.json();

    if (!rows || rows.length === 0 || !rows[0].cid) {
      return json({ success: false, message: 'Aucun compte trouvé avec cet email' }, 404);
    }

    // Vérification mot de passe
    if (!rows[0].pwd) {
      return json({ success: false, message: 'Compte non configuré, contactez votre administrateur' }, 403);
    }
    if (!password || rows[0].pwd !== password) {
      return json({ success: false, message: 'Mot de passe incorrect' }, 401);
    }

    return json({ success: true, portalId: rows[0].cid, userId: rows[0].id, message: 'Portail trouvé !' });
  } catch (error) {
    return json({ success: false, error: 'Erreur serveur', details: error.message }, 500);
  }
}
