const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2$')) return stored === password; // legacy plaintext → migration
  const [, saltHex, iter, hashHex] = stored.split('$');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: parseInt(iter) }, key, 256);
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hashHex;
}

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

    const findUser = async (url, key) => {
      const resp = await fetch(
        `${url}/rest/v1/portal_users?email=eq.${encodeURIComponent(email.toLowerCase())}&status=eq.approved&select=id,cid,pwd&limit=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
      const rows = await resp.json();
      return rows && rows.length && rows[0].cid ? rows[0] : null;
    };

    // Chercher dans l'instance principale, puis dans celle du profil 2
    let user = await findUser(supabaseUrl, supabaseKey);
    let p2 = false;
    let activeUrl = supabaseUrl;
    let activeKey = supabaseKey;
    if (!user) {
      const url2 = (env.SUPABASE_URL_2 || '').replace(/\/+$/, '');
      const key2 = env.SUPABASE_SERVICE_KEY_2 || '';
      if (url2 && key2) {
        try { user = await findUser(url2, key2); } catch (e) { /* instance 2 indisponible — ignorer */ }
        if (user) { p2 = true; activeUrl = url2; activeKey = key2; }
      }
    }

    if (!user) {
      return json({ success: false, message: 'Aucun compte trouvé avec cet email' }, 404);
    }

    // Vérification mot de passe (supporte PBKDF2 et legacy plaintext)
    if (!user.pwd) {
      return json({ success: false, message: 'Compte non configuré, contactez votre administrateur' }, 403);
    }
    if (!password) {
      return json({ success: false, message: 'Mot de passe requis' }, 401);
    }
    const pwdOk = await verifyPassword(password, user.pwd);
    if (!pwdOk) {
      return json({ success: false, message: 'Mot de passe incorrect' }, 401);
    }

    // Générer un token de session et le stocker en DB
    const token = crypto.randomUUID();
    await fetch(
      `${activeUrl}/rest/v1/portal_users?id=eq.${encodeURIComponent(user.id)}`,
      { method: 'PATCH', headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ session_token: token }) }
    ).catch(() => {});

    return json({ success: true, portalId: user.cid, userId: user.id, token, p2, message: 'Portail trouvé !' });
  } catch (error) {
    return json({ success: false, error: 'Erreur serveur', details: error.message }, 500);
  }
}
