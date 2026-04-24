const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // ── JSONBIN PROXY ─────────────────────────────────────────────
  // Triggered when body contains { _jb: true, method, path, payload?, headers? }
  if (body._jb) {
    const JB_KEY = "$2a$10$TDFZxCJqU3xH/sCC.S9TZeFdmKPSHn3ptw42RuQRIiBtU5SngJtBK";
    const url = "https://api.jsonbin.io" + body.path;
    const method = body.method || "GET";
    const opts = {
      method,
      headers: { "Content-Type": "application/json", "X-Master-Key": JB_KEY, "X-Bin-Versioning": "false" },
    };
    if (body.headers) Object.assign(opts.headers, body.headers);
    if (body.payload && method !== "GET") opts.body = JSON.stringify(body.payload);
    try {
      const resp = await fetch(url, opts);
      const text = await resp.text();
      return { statusCode: resp.status, headers: { ...CORS, "Content-Type": "application/json" }, body: text };
    } catch (err) {
      return { statusCode: 502, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── ANTHROPIC PROXY ───────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { statusCode: response.status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: { message: err.message } }) };
  }
};
