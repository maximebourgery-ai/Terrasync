/**
 * TERRASSEMENT.IO — Proxy Netlify v2
 * Routes : Anthropic AI + Supabase REST
 *
 * VARIABLES D'ENVIRONNEMENT (Netlify > Site settings > Env vars) :
 *   ANTHROPIC_API_KEY    — clé Anthropic
 *   SUPABASE_URL         — https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY — service_role key (jamais côté client)
 */

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const respond = (body, status = 200) => ({
  statusCode: status,
  headers: { ...CORS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")    return respond({ error: "Method Not Allowed" }, 405);

  let body;
  try { body = JSON.parse(event.body); }
  catch { return respond({ error: "Invalid JSON" }, 400); }

  // SUPABASE PROXY
  if (body._sb) {
    if (!SB_URL) return respond({ error: "SUPABASE_URL manquant — Netlify > Site settings > Environment variables." }, 503);
    if (!SB_KEY) return respond({ error: "SUPABASE_SERVICE_KEY manquant dans les variables Netlify." }, 503);

    const { method = "GET", path, payload, headers: extra = {} } = body;
    const url = SB_URL + path;
    const headers = {
      "Content-Type":  "application/json",
      "apikey":        SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Prefer":        extra["Prefer"] || "return=representation",
      ...extra,
    };
    const opts = { method, headers };
    if (payload !== undefined && payload !== null && !["GET","HEAD","DELETE"].includes(method)) {
      opts.body = JSON.stringify(payload);
    }
    try {
      const resp = await fetch(url, opts);
      const text = await resp.text();
      if (!text || resp.status === 204) return respond(null, resp.status);
      return { statusCode: resp.status, headers: { ...CORS, "Content-Type": "application/json" }, body: text };
    } catch (e) {
      return respond({ error: `Supabase network error: ${e.message}` }, 502);
    }
  }

  // ANTHROPIC PROXY
  if (!ANTHROPIC_KEY) return respond({ error: "ANTHROPIC_API_KEY manquant dans les variables Netlify." }, 503);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return respond(data, response.status);
  } catch (e) {
    return respond({ error: e.message }, 500);
  }
};
