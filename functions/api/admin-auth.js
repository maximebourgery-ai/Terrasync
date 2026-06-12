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

  const { username, password } = body || {};
  if (!username || !password) return json({ error: 'Missing credentials' }, 400);

  const expectedUser = env.ADMIN2_USERNAME || '';
  const expectedPass = env.ADMIN2_PASSWORD || '';

  if (!expectedUser || !expectedPass) return json({ error: 'Profile 2 not configured' }, 503);

  const valid = username.toLowerCase() === expectedUser.toLowerCase() && password === expectedPass;
  if (!valid) return json({ error: 'Invalid credentials' }, 401);

  const sbUrl = (env.SUPABASE_URL_2 || '').replace(/\/+$/, '');
  const sbAnon = env.SUPABASE_ANON_KEY_2 || '';
  if (!sbUrl || !sbAnon) return json({ error: 'Profile 2 Supabase not configured' }, 503);

  return json({ profile: 2, sbUrl, sbAnon });
}
