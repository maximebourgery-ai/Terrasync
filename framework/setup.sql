-- ════════════════════════════════════════════════════════════════════════
-- TERRASSEMENT.IO — Schéma Supabase v2
-- Multi-tenant, scalable 10-25 clients, htmlContent externalisé
-- Exécuter dans : Supabase Dashboard > SQL Editor > New Query > Run
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. WORKSPACE ─────────────────────────────────────────────────────────
-- Une row par installation (= un admin ou groupe d'admins).
-- data contient clients[], tools[] (sans htmlContent), users[], compta[].
-- htmlContent est dans tool_content pour éviter le payload énorme.
CREATE TABLE IF NOT EXISTS workspace (
  id          TEXT PRIMARY KEY DEFAULT 'main',
  data        JSONB NOT NULL DEFAULT '{"clients":[],"tools":[],"users":[],"compta":[]}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO workspace (id, data)
VALUES ('main', '{"clients":[],"tools":[],"users":[],"compta":[]}')
ON CONFLICT (id) DO NOTHING;

-- ── 2. TOOL CONTENT ──────────────────────────────────────────────────────
-- HTML des outils web stocké séparément (peut faire 300KB+ chacun).
-- Chargé à la demande uniquement quand l'outil est ouvert.
CREATE TABLE IF NOT EXISTS tool_content (
  id           TEXT PRIMARY KEY,   -- = tool.id dans workspace.data
  workspace_id TEXT NOT NULL DEFAULT 'main',
  name         TEXT NOT NULL DEFAULT '',
  html         TEXT NOT NULL,
  size_bytes   INTEGER GENERATED ALWAYS AS (octet_length(html)) STORED,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_content_workspace ON tool_content(workspace_id);

-- ── 3. PORTAL FILES ──────────────────────────────────────────────────────
-- Fichiers uploadés par les utilisateurs dans leur portail.
CREATE TABLE IF NOT EXISTS portal_files (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  cid          TEXT NOT NULL,   -- client ID
  name         TEXT NOT NULL,
  mime         TEXT NOT NULL DEFAULT 'application/octet-stream',
  content      TEXT NOT NULL,  -- base64 ou texte brut
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_files_cid ON portal_files(workspace_id, cid);
CREATE INDEX IF NOT EXISTS portal_files_expires ON portal_files(expires_at);

-- ── 4. PORTAL USERS ──────────────────────────────────────────────────────
-- Comptes utilisateurs des portails clients.
CREATE TABLE IF NOT EXISTS portal_users (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  cid          TEXT NOT NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  pwd          TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  tool_ids     JSONB NOT NULL DEFAULT '[]',
  last         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_users_cid ON portal_users(workspace_id, cid);
CREATE UNIQUE INDEX IF NOT EXISTS portal_users_email_cid
  ON portal_users(email, cid, workspace_id);

-- ── 5. REALTIME ──────────────────────────────────────────────────────────
-- Activer la sync temps réel sur workspace uniquement (léger).
ALTER TABLE workspace REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE workspace;
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 6. SÉCURITÉ ──────────────────────────────────────────────────────────
-- RLS désactivé : sécurité assurée par service_role key côté proxy Netlify.
-- Le client ne voit jamais la service_role key.
ALTER TABLE workspace    DISABLE ROW LEVEL SECURITY;
ALTER TABLE tool_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users DISABLE ROW LEVEL SECURITY;

-- ── 7. FONCTIONS UTILITAIRES ─────────────────────────────────────────────
-- Nettoyer les fichiers expirés (à appeler via cron ou manuellement)
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM portal_files WHERE expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── 8. VÉRIFICATION ──────────────────────────────────────────────────────
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('workspace','tool_content','portal_files','portal_users')
ORDER BY table_name;
