-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Reporting Time Zone™ — profiles.reporting_timezone
--
-- Adds a user-level IANA time zone preference column to the profiles table.
-- The client resolves this in order:
--   1. profiles.reporting_timezone (authenticated, persisted here)
--   2. localStorage royalte_reporting_tz (anonymous / cached)
--   3. Browser auto-detect via Intl.DateTimeFormat
--
-- Stored value example: "America/Toronto", "Europe/London", "Asia/Tokyo"
-- Displayed as short abbreviation: EDT, BST, JST, etc.
-- Allows artist override from Settings → Preferences (future surface).
--
-- Board Addendum 2026-07-03.
-- Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reporting_timezone text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.reporting_timezone IS
  'IANA time zone string (e.g. "America/New_York"). Populated on first login via browser detection. Artist-overridable from Settings → Preferences. Used as the reporting standard for scans, alerts, and Executive Briefs.';

commit;
