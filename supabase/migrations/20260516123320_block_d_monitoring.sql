-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block D: Monitoring foundation
--
-- Scheduled rescans + backend-state evolution. Adds:
--   - profiles.monitoring_status ('active' | 'inactive' | 'grace_period')
--   - profiles.next_rescan_at (timestamptz, nullable)
--   - scan_snapshots — one row per rescan, sequenced, full canonical payload
--   - scan_changes — diff records computed per rescan
--   - RLS on both new tables (users read their own; service-role cron inserts)
--   - backfill: existing profiles → grace_period + signup+7d; existing
--     audit_scans → seq-1 scan_snapshots (latest per user)
--
-- NOTE — deviation from the Block D brief's Step 2 SQL: the brief omitted any
-- handle_new_user() change. Without it, post-Block-D signups would get
-- next_rescan_at = NULL and the cron's `next_rescan_at <= now()` filter would
-- never pick them up — no grace rescan ever. handle_new_user() is recreated
-- here to set monitoring_status + next_rescan_at on signup, the same place it
-- already sets founding_artist + tier. Approved as a Step 2 addition.
--
-- Idempotent throughout. Wrapped in begin/commit. Applied via psql over the
-- Session Pooler per CLAUDE.md (explicit-flags form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. profiles monitoring columns ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monitoring_status text NOT NULL DEFAULT 'grace_period'
  CHECK (monitoring_status IN ('active', 'inactive', 'grace_period'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS next_rescan_at timestamptz;

-- Backfill existing profiles: grace period rescan due at signup + 7 days.
-- WHERE next_rescan_at IS NULL keeps this safe to re-run — it will not clobber
-- a value the cron has since advanced.
UPDATE public.profiles
SET next_rescan_at = COALESCE(created_at, now()) + interval '7 days'
WHERE next_rescan_at IS NULL;

-- Recreate handle_new_user() to schedule monitoring for new signups.
-- Preserves the Chunk 3 advisory-lock + founding_artist logic and the Block B
-- tier='free'; adds monitoring_status + next_rescan_at.
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

  INSERT INTO public.profiles (id, email, display_name, founding_artist, tier, monitoring_status, next_rescan_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_is_founding,
    'free',
    'grace_period',
    now() + interval '7 days'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 2. scan_snapshots — one row per rescan ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scan_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('signup_scan', 'grace_rescan', 'scheduled_rescan', 'manual_rescan')),
  UNIQUE (user_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS scan_snapshots_user_id_created_at_idx
  ON public.scan_snapshots (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scan_snapshots_user_sequence_idx
  ON public.scan_snapshots (user_id, sequence_number DESC);

-- ── 3. scan_changes — diff records per snapshot ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.scan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES public.scan_snapshots(id) ON DELETE CASCADE,
  change_type text NOT NULL CHECK (change_type IN ('issue_new', 'issue_resolved', 'score_change', 'revenue_risk_change', 'platform_change')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_changes_user_id_created_at_idx
  ON public.scan_changes (user_id, created_at DESC);

-- ── 4. RLS — users read their own data; service-role cron bypasses RLS ──────

ALTER TABLE public.scan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_changes   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_snapshots_select_own ON public.scan_snapshots;
CREATE POLICY scan_snapshots_select_own
  ON public.scan_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scan_changes_select_own ON public.scan_changes;
CREATE POLICY scan_changes_select_own
  ON public.scan_changes
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — the cron writes with the service-role
-- key, which bypasses RLS. Clients never write to these tables.

-- ── 5. Backfill: existing audit_scans → seq-1 scan_snapshots ────────────────
-- DISTINCT ON picks each user's most-recent audit_scans row (a user can have
-- several — re-scans, or rows claimed by migrate_anonymous_scans). The
-- UNIQUE (user_id, sequence_number) target makes this safe to re-run.

INSERT INTO public.scan_snapshots (user_id, sequence_number, payload, source, created_at)
SELECT DISTINCT ON (user_id)
  user_id, 1, payload, 'signup_scan', created_at
FROM public.audit_scans
WHERE user_id IS NOT NULL
ORDER BY user_id, created_at DESC
ON CONFLICT (user_id, sequence_number) DO NOTHING;

commit;
