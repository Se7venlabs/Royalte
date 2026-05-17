-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block D.2: Trial state refactor
--
-- V5 Phase 2 locked corrections to the Block D monitoring defaults:
--   - 14-day trial, not 7
--   - Trial starts on first Royaltē OS login, not at signup
--   - New signups are inactive-by-default (no auto-monitoring)
--   - Existing grace_period users extended to 14d from their created_at
--   - Brand-new signups who never log in are left untouched (slot reclaim
--     is Block C.1.6, deferred)
--
-- Adds:
--   - profiles.trial_started_at (timestamptz, nullable) — NULL = trial not begun
--   - partial index on trial_started_at
--   - monitoring_status column DEFAULT flipped 'grace_period' → 'inactive'
--   - handle_new_user() recreated: inactive / next_rescan_at NULL /
--     trial_started_at NULL on signup. Founding-artist counter + advisory
--     lock + display_name handling preserved verbatim from Block D.
--   - backfill: existing grace_period users → 14d window from created_at,
--     trial_started_at = created_at
--
-- Idempotent throughout. Wrapped in begin/commit. Applied via psql over the
-- Session Pooler per CLAUDE.md (explicit-flags form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. trial_started_at column ──────────────────────────────────────────────
-- NULL means the trial has not begun. dashboard.js flips this to now() on the
-- user's first OS login (activateTrialIfNeeded).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_trial_started_at_idx
  ON public.profiles (trial_started_at)
  WHERE trial_started_at IS NOT NULL;

-- ── 2. monitoring_status column DEFAULT → 'inactive' ────────────────────────
-- Defense in depth: handle_new_user() always passes monitoring_status
-- explicitly, but any future insert path that omits it should land inactive,
-- not auto-enrolled in monitoring.

ALTER TABLE public.profiles
  ALTER COLUMN monitoring_status SET DEFAULT 'inactive';

-- ── 3. Recreate handle_new_user() — inactive-by-default at signup ───────────
-- Body preserved verbatim from Block D (20260516123320_block_d_monitoring.sql):
-- shared-key advisory lock, founding_artist_cap() count, display_name COALESCE,
-- tier='free'. ONLY the monitoring fields change — monitoring_status 'inactive',
-- next_rescan_at NULL, trial_started_at NULL — so signups no longer auto-start
-- the trial. The trial activates on first dashboard login.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_is_founding boolean := false;
BEGIN
  -- Serialize the count-and-set across concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtext('founding_artist_counter'));

  SELECT count(*) INTO v_current_count
  FROM public.profiles
  WHERE founding_artist = true;

  IF v_current_count < public.founding_artist_cap() THEN
    v_is_founding := true;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, founding_artist, tier, monitoring_status, next_rescan_at, trial_started_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_is_founding,
    'free',
    'inactive',
    NULL,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 4. Backfill existing grace_period users ─────────────────────────────────
-- Their original 7d window is corrected to 14d from created_at. trial_started_at
-- is set to created_at — under the old model they entered the OS at signup, so
-- signup is treated as the trial activation moment. Strictly additive: only
-- touches grace_period rows that have not already had a trial recorded.

UPDATE public.profiles
SET
  next_rescan_at = created_at + interval '14 days',
  trial_started_at = created_at
WHERE monitoring_status = 'grace_period'
  AND trial_started_at IS NULL;

commit;
