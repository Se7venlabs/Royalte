-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Royalty Statements™ — status model expansion + AI readiness state
--
-- Archive Intelligence & Future-Readiness enhancement pass (Board brief,
-- 2026-07-19), extending supabase/migrations/20260718140000_royalty_statements.sql.
--
--   1. A controlled `status` vocabulary via CHECK constraint — current
--      production values (uploaded/archived/replaced/deleted) plus reserved
--      future values for a processing pipeline that does not exist yet
--      (pending_analysis/processing/analysis_complete/review_required/
--      processing_failed). The API remains the only writer (no client
--      INSERT/UPDATE policy exists on this table); the constraint is
--      defense-in-depth so a bug can never persist an arbitrary status string.
--   2. `ai_readiness_state` — a field separate from `status`, communicating
--      whether a statement is available for future analysis. Every statement
--      created by this Build Pass gets 'not_processed' — no parsing or AI
--      analysis exists yet, and this field must never claim otherwise.
--
-- Idempotent. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Existing rows (if any) used 'active' as the initial status; the new
-- vocabulary calls that same state 'uploaded'.
UPDATE public.royalty_statements SET status = 'uploaded' WHERE status = 'active';

ALTER TABLE public.royalty_statements
  ALTER COLUMN status SET DEFAULT 'uploaded';

ALTER TABLE public.royalty_statements
  DROP CONSTRAINT IF EXISTS royalty_statements_status_check;

ALTER TABLE public.royalty_statements
  ADD CONSTRAINT royalty_statements_status_check
  CHECK (status IN (
    -- current production statuses
    'uploaded', 'archived', 'replaced', 'deleted',
    -- reserved for a future processing pipeline — not used by this Build Pass
    'pending_analysis', 'processing', 'analysis_complete', 'review_required', 'processing_failed'
  ));

ALTER TABLE public.royalty_statements
  ADD COLUMN IF NOT EXISTS ai_readiness_state text NOT NULL DEFAULT 'not_processed';

ALTER TABLE public.royalty_statements
  DROP CONSTRAINT IF EXISTS royalty_statements_ai_readiness_check;

ALTER TABLE public.royalty_statements
  ADD CONSTRAINT royalty_statements_ai_readiness_check
  CHECK (ai_readiness_state IN (
    -- current production value — this Build Pass performs no analysis
    'not_processed',
    -- reserved for future Royalty Intelligence™ / ATHENA™ work
    'ready_for_analysis', 'processing', 'parsed', 'insights_available', 'review_required', 'unsupported_format'
  ));

COMMENT ON COLUMN public.royalty_statements.ai_readiness_state IS
  'Separate from status — communicates whether a statement is available for future
   analysis. Every statement in this Build Pass is not_processed; no parsing or AI
   analysis exists yet. Never set by the client — the API is the sole writer.';

commit;
