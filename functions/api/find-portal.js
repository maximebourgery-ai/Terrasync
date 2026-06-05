import { CORS, json } from './_shared.js';

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

    const resp = await fetch(
      `${supabaseUrl}/rest/v1/portal_users?email=eq.${encodeURIComponent(email.toLowerCase())}&status=eq.approved&select=id,cid,pwd&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!resp.ok) throw new Error(`Supabase error: ${resp.status}`);
    const rows = await resp.json();

    if (!rows || rows.length === 0 || !rows[0].cid) {
      return json({ success: false, message: 'Aucun compte trouvé avec cet email' }, 404);
    }

    // Vérification mot de passe (supporte PBKDF2 et legacy plaintext)
    if (!rows[0].pwd) {
      return json({ success: false, message: 'Compte non configuré, contactez votre administrateur' }, 403);
    }
    if (!password) {
      return json({ success: false, message: 'Mot de passe requis' }, 401);
    }
    const pwdOk = await verifyPassword(password, rows[0].pwd);
    if (!pwdOk) {
      return json({ success: false, message: 'Mot de passe incorrect' }, 401);
    }

    return json({ success: true, portalId: rows[0].cid, userId: rows[0].id, message: 'Portail trouvé !' });
  } catch (error) {
    return json({ success: false, error: 'Erreur serveur', details: error.message }, 500);
  }
}
