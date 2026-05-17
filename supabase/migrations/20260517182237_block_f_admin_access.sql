-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block F: Admin OS Access
--
-- Internal QA tooling — gives the founder an admin path into Royaltē OS for
-- pre-launch state inspection. Admin accounts authenticate via Supabase
-- email/password and are kept entirely off the customer side:
--
--   - admin_users — server-side allowlist (email + linked auth user_id)
--   - RLS: an authenticated user may read only their own admin row, so the
--     client-side checkAdminStatus() query works without exposing the list
--   - handle_new_user() recreated with an admin short-circuit: if the new
--     auth.users email is on the allowlist, link it to admin_users and RETURN
--     with NO profile insert — so an admin signup never creates a customer
--     profile, never consumes a founding-artist slot, never starts a trial
--
-- The customer branch of handle_new_user() is preserved verbatim from Block
-- D.2 (20260517110748) — Block F is purely additive, no customer-flow change.
--
-- Idempotent throughout. Wrapped in begin/commit. Applied via psql over the
-- Session Pooler per CLAUDE.md (explicit-flags form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── 1. admin_users — server-side allowlist ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  note       text
);

CREATE INDEX IF NOT EXISTS admin_users_email_idx   ON public.admin_users (email);
CREATE INDEX IF NOT EXISTS admin_users_user_id_idx ON public.admin_users (user_id);

-- ── 2. Seed the founder admin email ─────────────────────────────────────────
-- The allowlist row must exist BEFORE the admin auth.users account is created
-- (in the Supabase dashboard), so handle_new_user() can link user_id and
-- short-circuit the customer flow.

INSERT INTO public.admin_users (email, note)
VALUES ('darryl.west+admin@gmail.com', 'Founder admin access for pre-launch QA')
ON CONFLICT (email) DO NOTHING;

-- ── 3. RLS — an authenticated user reads only their own admin row ───────────
-- checkAdminStatus() in dashboard.js queries this table with the authenticated
-- key. The self-read policy lets an admin confirm their own status without the
-- allowlist being readable by anyone else. No INSERT/UPDATE/DELETE policies —
-- the table is managed by service-role SQL and by handle_new_user()
-- (SECURITY DEFINER, which bypasses RLS).

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 4. handle_new_user() — admin short-circuit before the customer flow ─────
-- The admin check runs BEFORE the founding-artist advisory lock, so an admin
-- signup never touches the counter. If the email is on the allowlist: link
-- user_id and RETURN — no profile row. Otherwise the customer branch runs
-- exactly as in Block D.2. SECURITY DEFINER lets the trigger UPDATE
-- admin_users despite RLS.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_is_founding boolean := false;
  v_is_admin boolean;
BEGIN
  -- Admin allowlist check — short-circuit before any customer-side work.
  SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE email = NEW.email)
    INTO v_is_admin;

  IF v_is_admin THEN
    -- Link the auth.users row to the allowlist; create no customer artifacts.
    UPDATE public.admin_users SET user_id = NEW.id WHERE email = NEW.email;
    RETURN NEW;
  END IF;

  -- ── Customer flow — preserved verbatim from Block D.2 ─────────────────────
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

commit;
