-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — V5 Phase 2: Founding Artist reservations
--
-- Lightweight pre-Stripe intent capture. The Reserve flow records that an
-- email wants Founding Artist Access — it does NOT grant entitlement, flip
-- founding_artist, or change tier. Block C wires real activation post-Stripe.
--
-- Founding Artist is a billing flag, not a tier — profiles.tier stays
-- ('free','pro'); this table is purely intent capture.
--
-- Adds:
--   - founding_artist_reservations (email UNIQUE — re-submission is
--     idempotent; user_id nullable + ON DELETE SET NULL — a reservation can
--     come from a logged-in user or, in future, an anonymous visitor)
--   - RLS: a user reads their own reservation; the API inserts/upserts with
--     the service-role key, which bypasses RLS (no INSERT policy needed)
--
-- Idempotent (CREATE ... IF NOT EXISTS, DROP POLICY IF EXISTS + CREATE).
-- Wrapped in begin/commit. Applied via psql over the Session Pooler per
-- CLAUDE.md (explicit-flags form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.founding_artist_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS founding_artist_reservations_user_id_idx
  ON public.founding_artist_reservations (user_id);

CREATE INDEX IF NOT EXISTS founding_artist_reservations_created_at_idx
  ON public.founding_artist_reservations (created_at DESC);

ALTER TABLE public.founding_artist_reservations ENABLE ROW LEVEL SECURITY;

-- A user can read their own reservation. No INSERT/UPDATE/DELETE policy —
-- the reserve API writes with the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS founding_artist_reservations_select_own ON public.founding_artist_reservations;
CREATE POLICY founding_artist_reservations_select_own
  ON public.founding_artist_reservations
  FOR SELECT
  USING (auth.uid() = user_id);

commit;
