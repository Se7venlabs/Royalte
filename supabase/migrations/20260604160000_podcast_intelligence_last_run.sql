-- ─────────────────────────────────────────────────────────────────────────
-- Brief 015o Phase 2 — Podcast Intelligence API conservation timestamp.
--
-- One column on profiles: the last time podcast discovery actually ran
-- for this user. The orchestrator (api/_lib/podcast-intelligence.js)
-- consults this BEFORE every Listen Notes call and skips if the previous
-- run was within the interval window (default 7 days). Defense in depth
-- on top of the monitoring_subscriptions.next_scan_at cadence —
-- protects the free-tier API quota even if the orchestrator gets called
-- outside the normal cron path (manual retries, future code paths, etc).
--
-- NULL = never run; the first eligible cron tick will run it. After
-- a successful VERIFIED Listen Notes response, the orchestrator UPDATEs
-- this to now().
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-apply per CLAUDE.md.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS podcast_intelligence_last_run timestamptz;

COMMENT ON COLUMN public.profiles.podcast_intelligence_last_run IS
  'Brief 015o Phase 2 — timestamp of last successful Podcast Intelligence run for this user. NULL = never run. The orchestrator updates this on VERIFIED Listen Notes responses and consults it to enforce the 7-day API conservation interval. See api/_lib/podcast-intelligence.js.';

COMMIT;
