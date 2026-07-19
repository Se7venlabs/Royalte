-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Settings™ Profile Information — additional profiles columns
--
-- Adds the remaining Profile Information fields needed by the Settings™
-- workspace (Phase 2 Build Pass) that do not already exist on public.profiles:
--   - country              text  — artist-selected country (ISO 3166-1 alpha-2)
--   - preferred_language   text  — artist-selected language (BCP 47, e.g. "en", "fr")
--   - artist_url_slug      text  — artist-chosen slug for a future public Royaltē
--                                  artist URL (royalte.ai/a/<slug>); unique when set
--
-- reporting_timezone already exists (20260703000000_reporting_timezone.sql) and
-- is reused as-is for the Settings™ Time Zone field — not duplicated here.
--
-- display_name and email already exist (20260515184037_auth_schema_foundation.sql)
-- and are reused as-is for the Settings™ Display Name / Email fields.
--
-- Also adds:
--   - preferences            jsonb — Settings → Preferences and Privacy toggles
--                             (notifications, default landing workspace, ATHENA
--                             notifications, communication/privacy preferences).
--                             One object, saved as a whole per Settings section,
--                             not field-by-field — mirrors the merge discipline
--                             already established for music_rights_profile.
--   - deletion_requested_at  timestamptz — set when an artist requests account
--                             deletion from Settings → Privacy. Deletion itself
--                             is a manual/support-handled process for this
--                             Build Pass, not an automated cascade — this column
--                             only records the request.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country              text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_language   text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS artist_url_slug      text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferences          jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.profiles.country IS
  'ISO 3166-1 alpha-2 country code, artist-selected from Settings → Profile Information.';

COMMENT ON COLUMN public.profiles.preferred_language IS
  'BCP 47 language tag (e.g. "en", "fr", "es"), artist-selected from Settings → Profile Information.';

COMMENT ON COLUMN public.profiles.artist_url_slug IS
  'Artist-chosen slug for a future public Royaltē artist URL. Uniqueness enforced at the
   application layer for this migration; a DB-level UNIQUE constraint can be added once
   the public artist URL feature itself is scheduled.';

COMMENT ON COLUMN public.profiles.preferences IS
  'Artist-editable notification and privacy preferences from Settings. Saved as a whole
   object per section (not field-by-field) via api/save-profile-info.js.';

COMMENT ON COLUMN public.profiles.deletion_requested_at IS
  'Set when an artist submits an account deletion request from Settings → Privacy.
   Deletion itself is handled manually by support for this Build Pass — no automated
   cascade delete is triggered by this column.';

commit;
