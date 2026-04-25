-- TERRASSEMENT.IO — Schéma Supabase
-- Exécuter dans : Supabase Dashboard > SQL Editor > New Query > Run

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL DEFAULT '{"clients":[],"tools":[],"users":[],"compta":[]}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO workspace (id, data) VALUES ('main', '{"clients":[],"tools":[],"users":[],"compta":[]}') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tool_content (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  name TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL,
  size_bytes INTEGER GENERATED ALWAYS AS (octet_length(html)) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_content_workspace ON tool_content(workspace_id);

-- Historique versions (max 5 par outil)
CREATE TABLE IF NOT EXISTS tool_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tool_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  name TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_versions_tool ON tool_versions(tool_id, archived_at DESC);

CREATE TABLE IF NOT EXISTS portal_files (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  cid TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_files_cid ON portal_files(workspace_id, cid);
CREATE INDEX IF NOT EXISTS portal_files_expires ON portal_files(expires_at);

CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'main',
  cid TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  pwd TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  tool_ids JSONB NOT NULL DEFAULT '[]',
  last TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portal_users_cid ON portal_users(workspace_id, cid);
CREATE UNIQUE INDEX IF NOT EXISTS portal_users_email_cid ON portal_users(email, cid, workspace_id);

ALTER TABLE workspace REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE workspace; EXCEPTION WHEN others THEN NULL; END $$;

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Toutes les tables sont protégées : seul le service_role (clé serveur) a accès.
-- L'application passe par /api/anthropic (Cloudflare Worker) qui détient la
-- clé service côté serveur — jamais exposée au navigateur.

ALTER TABLE workspace     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_files  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_users  ENABLE ROW LEVEL SECURITY;

-- Seul le service_role peut lire/écrire (bypass RLS automatique pour service_role)
-- Aucune politique anon n'est créée → clé publique ne peut plus accéder aux données

-- Nettoyage des anciennes politiques permissives si elles existent
DROP POLICY IF EXISTS "workspace_service_only"    ON workspace;
DROP POLICY IF EXISTS "tool_content_service_only" ON tool_content;
DROP POLICY IF EXISTS "tool_versions_service_only" ON tool_versions;
DROP POLICY IF EXISTS "portal_files_service_only" ON portal_files;
DROP POLICY IF EXISTS "portal_users_service_only" ON portal_users;
