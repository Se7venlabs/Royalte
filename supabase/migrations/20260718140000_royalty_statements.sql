-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Royalty Statements™ — tables, storage bucket, and RLS
--
-- Foundation for the Settings → Royalty Statements™ feature. This migration
-- creates the metadata tables, audit log, and a private Supabase Storage
-- bucket for uploaded statement files. No parsing, no analysis — pure
-- secure storage and record-keeping, per the Board brief's explicit
-- "Out of Scope" list (AI parsing, OCR, royalty calculations, audit engine,
-- payment verification are all future work).
--
-- Architecture:
--   - File bytes upload directly from the browser to Supabase Storage,
--     using the same RLS-scoped anon client already used everywhere else
--     in this codebase (public/js/supabase-client.js) — not routed through
--     a Vercel serverless function, to avoid body-size/timeout limits on
--     multi-megabyte PDF/XLSX files. Storage RLS below enforces that a
--     user can only read/write objects under their own auth.uid() folder.
--   - Metadata (source, category, reporting period, etc.) and audit log
--     entries are written server-side (api/royalty-statements.js, admin
--     client + Bearer auth — the same pattern as
--     api/save-music-rights-profile.js and api/save-profile-info.js),
--     which verifies the uploaded object actually exists at the claimed
--     path under the caller's own folder before trusting it.
--   - No public URLs: downloads are served via short-lived Supabase
--     Storage signed URLs, generated server-side per request, never a
--     permanent public link.
--
-- Idempotent. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── royalty_statements ──────────────────────────────────────────────────────
-- One row per uploaded statement (or per version, when "Replace" is used —
-- see replaces_statement_id). Soft-delete only (deleted_at), never a hard
-- DELETE, so version/audit history is preserved.

CREATE TABLE IF NOT EXISTS public.royalty_statements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  source_category        text NOT NULL, -- 'pro' | 'publishing_admin' | 'distributor' | 'label' | 'neighboring_rights' | 'sync_agency'
  source_name            text NOT NULL, -- e.g. 'SOCAN', 'TuneCore', 'Other: <artist-entered name>'

  reporting_period       text,          -- artist-entered, e.g. "Q1 2026" or "Jan 2026" — free text by design, see brief
  currency               text,          -- e.g. 'USD', 'CAD', 'EUR'
  statement_date         date,          -- date printed on the statement itself
  notes                  text,

  file_path              text NOT NULL, -- Supabase Storage object path: "{user_id}/{uuid}-{filename}"
  file_name              text NOT NULL, -- original filename, for display
  file_type              text NOT NULL, -- 'pdf' | 'csv' | 'xlsx'
  file_size_bytes        bigint,

  status                 text NOT NULL DEFAULT 'active', -- 'active' | 'replaced' | 'deleted'
  version                integer NOT NULL DEFAULT 1,
  replaces_statement_id  uuid REFERENCES public.royalty_statements(id) ON DELETE SET NULL,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

COMMENT ON TABLE public.royalty_statements IS
  'Royalty Statements™ — artist-uploaded royalty statement metadata. File bytes live in
   Supabase Storage (private bucket royalty-statements), not in this table. Soft-delete
   only. This is a secure repository, not an analysis engine — no parsing or calculation
   logic reads from this table in this Build Pass.';

CREATE INDEX IF NOT EXISTS idx_royalty_statements_user_active
  ON public.royalty_statements(user_id, status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- (public.set_updated_at() already exists from 20260515184037_auth_schema_foundation.sql
--  — CREATE OR REPLACE here is a no-op if identical, safe to re-run.)

DROP TRIGGER IF EXISTS royalty_statements_set_updated_at ON public.royalty_statements;
CREATE TRIGGER royalty_statements_set_updated_at
  BEFORE UPDATE ON public.royalty_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.royalty_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS royalty_statements_select_own ON public.royalty_statements;
CREATE POLICY royalty_statements_select_own
  ON public.royalty_statements
  FOR SELECT
  USING (auth.uid() = user_id);

-- No direct client INSERT/UPDATE/DELETE policies — all writes go through
-- api/royalty-statements.js using the service-role key, so metadata writes
-- are always paired with a verified storage object and an audit log entry.
-- (Mirrors the profiles-table convention already established in this repo.)

-- ── royalty_statement_audit_log ─────────────────────────────────────────────
-- Append-only. Records every upload, replace, delete, and download/view,
-- per the Board brief's explicit security requirement ("Audit logging for
-- uploads, replacements, and deletions").

CREATE TABLE IF NOT EXISTS public.royalty_statement_audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id   uuid REFERENCES public.royalty_statements(id) ON DELETE SET NULL,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action         text NOT NULL, -- 'upload' | 'replace' | 'delete' | 'download' | 'view'
  detail         jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.royalty_statement_audit_log IS
  'Append-only audit trail for Royalty Statements™ uploads, replacements, deletions, and
   downloads. Written exclusively by api/royalty-statements.js (service-role key) — never
   client-writable, so the log cannot be bypassed or forged by the browser.';

CREATE INDEX IF NOT EXISTS idx_royalty_statement_audit_user
  ON public.royalty_statement_audit_log(user_id, created_at DESC);

ALTER TABLE public.royalty_statement_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS royalty_statement_audit_select_own ON public.royalty_statement_audit_log;
CREATE POLICY royalty_statement_audit_select_own
  ON public.royalty_statement_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- No client INSERT policy — the service role writes every entry.

-- ── Storage bucket ──────────────────────────────────────────────────────────
-- Private bucket. public = false is the entire security model for "no
-- public URLs" — every read requires either RLS-authenticated direct access
-- (owner only, via the policies below) or a server-generated short-lived
-- signed URL (api/royalty-statements.js, createSignedUrl()).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'royalty-statements',
  'royalty-statements',
  false,
  26214400, -- 25 MB per file
  ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: object path convention is "{auth.uid()}/{uuid}-{filename}" —
-- policies below key off the first path segment matching the caller's own
-- user id, so an artist can only ever read/write/delete their own files.

DROP POLICY IF EXISTS royalty_statements_storage_select_own ON storage.objects;
CREATE POLICY royalty_statements_storage_select_own
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'royalty-statements'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS royalty_statements_storage_insert_own ON storage.objects;
CREATE POLICY royalty_statements_storage_insert_own
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'royalty-statements'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS royalty_statements_storage_delete_own ON storage.objects;
CREATE POLICY royalty_statements_storage_delete_own
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'royalty-statements'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE policy — "Replace" uploads a new object under a new path and
-- writes a new royalty_statements row (replaces_statement_id), rather than
-- overwriting bytes in place. This is what preserves version history.

commit;
