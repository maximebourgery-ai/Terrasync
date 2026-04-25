// netlify/functions/find-portal.js
import { createClient } from '@supabase/supabase-js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { email } = JSON.parse(event.body);
    if (!email || !email.includes('@')) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Email invalide' }) };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Supabase non configuré — vérifiez les variables d'environnement Netlify" }) };

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: users, error } = await supabase
      .from('portal_users')
      .select('cid, status')
      .ilike('email', email)
      .eq('status', 'approved');

    if (error) throw error;
    if (users && users.length > 0) return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, portalId: users[0].cid }) };
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ success: false, message: 'Aucun compte trouvé avec cet email' }) };

  } catch (error) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ success: false, error: 'Erreur serveur', details: error.message }) };
  }
};
