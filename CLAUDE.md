# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terrasync is a French-language SaaS platform for AI-powered HR & recruitment automation. It runs entirely on **Cloudflare Pages** (static assets + serverless functions) backed by **Supabase** (PostgreSQL) and **Anthropic Claude** for AI features.

## No Build Process

There is no build step, bundler, or transpilation. HTML files are served directly by Cloudflare Pages. There are no test scripts, no lint scripts, and no dev server configured in `package.json`. The single npm dependency (`@supabase/supabase-js`) is referenced via CDN in the HTML files, not bundled.

```bash
npm install   # only needed to satisfy package-lock.json; installs nothing at runtime
```

Deployment is triggered by pushing to the connected Cloudflare Pages branch.

## Architecture

### Frontend
Each page is a **fully self-contained HTML file** with all CSS and JavaScript inlined as `<style>` and `<script>` blocks — no imports, no modules, no external JS files. The two main application files are large monoliths:

- `app.html` (~465 KB) — the main SaaS dashboard (clients, tools, users, billing)
- `admin-platform.html` (~322 KB) — internal admin dashboard
- `recruiter-ai-v3.html` — standalone recruiter AI tool

### Serverless Functions (Cloudflare Pages Functions)
Located in `functions/api/`. Each function exports `onRequestPost` and `onRequestOptions` (CORS preflight).

- **`anthropic.js`** — dual-purpose proxy: if the request body contains `_sb: true`, it forwards to Supabase REST API; otherwise it forwards to `https://api.anthropic.com/v1/messages`. This single endpoint handles all backend communication from the frontend.
- **`find-portal.js`** — looks up a candidate portal by email, querying the `workspace` table.

### Database (Supabase)
Schema is in `setup.sql`. Run it once in the Supabase SQL Editor to initialize.

| Table | Purpose |
|---|---|
| `workspace` | Single-row (`id='main'`) JSONB blob storing all app state: clients, tools, users, compta |
| `tool_content` | HTML content of user-created tools |
| `tool_versions` | Version history for tools (max 5 per tool) |
| `portal_files` | Files shared with candidates via portal (with expiry) |
| `portal_users` | Candidate portal accounts with approval workflow |

Row Level Security is **disabled** on all tables. Access is controlled by using the `SUPABASE_SERVICE_KEY` exclusively server-side in the functions.

## Environment Variables

Set these in **Cloudflare Pages > Settings > Environment variables**. They are never in `.env` files.

| Variable | Used in |
|---|---|
| `ANTHROPIC_API_KEY` | `functions/api/anthropic.js` |
| `SUPABASE_URL` | `functions/api/anthropic.js`, `functions/api/find-portal.js` |
| `SUPABASE_SERVICE_KEY` | `functions/api/anthropic.js`, `functions/api/find-portal.js` |

## Key Conventions

### CSS Variables (theming)
The HTML files use CSS custom properties throughout:
- `--ag` — primary/accent color
- `--bg` — background color
- `--dark` — primary text color
- `--bfnt`, `--cfnt`, `--mfnt` — body, condensed, and mono fonts

### API Routing Pattern
All frontend API calls go through `POST /api/anthropic`. The frontend distinguishes Supabase calls from Claude calls by setting `_sb: true` in the request body for Supabase operations. Supabase calls also include `method`, `path`, `payload`, and `headers` fields.

### Cloudflare Routing
`_redirects` defines two rules:
1. `/api/*` → Cloudflare Pages Functions
2. `/*` → `index.html` (SPA fallback for the marketing site)

### Language
The codebase, comments, UI text, and error messages are primarily in **French**.
