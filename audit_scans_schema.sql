-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — audit_scans schema migration
--
-- Run manually in the Supabase SQL Editor on the royalte.ai project.
-- Idempotent — safe to re-run; uses IF NOT EXISTS guards throughout.
--
-- Creates:
--   - pdf_render_status enum
--   - audit_scans table (canonical AuditResponse v1.0.0 + PDF render lifecycle)
--   - functional index for short-form report-ID lookup (first 8 chars of id)
--   - audit_requests.scan_id column linking email submissions back to a scan
--
-- Companion code lands in later files:
--   - api/audit.js              writes new audit_scans rows (canonical payload)
--   - lib/render-audit-pdf.js   updates pdf_* columns after PDFShift returns
--   - api/submit-audit.js       reads pdf_url, sets audit_requests.scan_id
-- ─────────────────────────────────────────────────────────────────────────────

-- gen_random_uuid() is in core since Postgres 13; pgcrypto kept as a safety net.
create extension if not exists pgcrypto;

-- ── PDF render lifecycle states ──────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pdf_render_status') then
    create type pdf_render_status as enum ('pending', 'rendering', 'ready', 'failed');
  end if;
end $$;

-- ── audit_scans ──────────────────────────────────────────────────────────────
create table if not exists audit_scans (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Source
  source_url      text not null,
  url_type        text,           -- engine-detected: 'spotify_artist' | 'spotify_track' | 'spotify_album' | 'apple'
  artist_name     text,           -- resolved canonical artist name (subject.artistName)

  -- Canonical AuditResponse v1.0.0 (output of normalizeAuditResponse).
  -- Single source of truth for the PDF renderer; never re-derived.
  payload         jsonb not null,
  schema_version  text generated always as (payload->>'schemaVersion') stored,

  -- PDF render lifecycle (lazy: starts 'pending', advanced by submit-audit).
  -- pdf_attempts is informational; retry caps are enforced in submit-audit.js.
  pdf_status      pdf_render_status not null default 'pending',
  pdf_url         text,
  pdf_error       text,
  pdf_rendered_at timestamptz,
  pdf_attempts    integer not null default 0,

  -- A 'ready' row must carry both the URL and the rendered_at timestamp.
  constraint audit_scans_ready_has_url
    check (pdf_status <> 'ready' or (pdf_url is not null and pdf_rendered_at is not null)),

  -- Soft schema guard: payload must declare a schemaVersion. Exact-version
  -- enforcement lives in api/schema/auditResponse.js so DB upgrades don't
  -- require a coordinated SQL bump.
  constraint audit_scans_payload_has_schema_version
    check (payload ? 'schemaVersion')
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists audit_scans_created_at_idx
  on audit_scans (created_at desc);

-- Partial — non-terminal states only; 'ready' rows dominate over time.
create index if not exists audit_scans_pdf_status_idx
  on audit_scans (pdf_status)
  where pdf_status in ('pending', 'rendering', 'failed');

-- Functional index for short-form report-ID lookup.
-- The PDF prints the first 8 chars of id (uppercased). Query as:
--   select * from audit_scans where left(id::text, 8) = lower($1);
create index if not exists audit_scans_short_id_idx
  on audit_scans (left(id::text, 8));

-- ── audit_requests linkage ───────────────────────────────────────────────────
-- When the user submits their email after a scan, audit_requests.scan_id
-- ties the submission to the saved canonical payload + rendered PDF.
-- ON DELETE SET NULL so a future scan-row purge cannot cascade-delete the
-- email submission record.
alter table audit_requests
  add column if not exists scan_id uuid references audit_scans(id) on delete set null;

create index if not exists audit_requests_scan_id_idx
  on audit_requests (scan_id)
  where scan_id is not null;

-- ── Notes ────────────────────────────────────────────────────────────────────
-- RLS: not enabled. audit_scans is server-only — written by /api/audit and
-- updated by lib/render-audit-pdf.js, both via the service role key (which
-- bypasses RLS regardless). If client-side reads ever land, enable RLS and
-- add a SELECT policy gated on a public-facing identifier.
--
-- Storage: the 'audit-reports' bucket (public for beta) is configured in the
-- Supabase dashboard, not here. pdf_url stores the public object URL; key
-- format is '<scan_id>.pdf'.
