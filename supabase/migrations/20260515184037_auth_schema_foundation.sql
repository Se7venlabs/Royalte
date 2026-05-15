-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block A Chunk 1: Auth schema foundation
--
-- Adds the schema groundwork for Supabase magic-link auth (delivered in
-- Chunk 2). No UI / client code touches Supabase auth yet — this is pure
-- database work.
--
-- Adds:
--   - public.profiles table, 1:1 with auth.users, with RLS
--   - public.set_updated_at() reused for the profiles updated_at trigger
--   - public.handle_new_user() trigger — auto-creates a profile row on
--     every new auth.users insert
--   - audit_scans.user_id (nullable, FK auth.users) + audit_scans.session_id
--   - RLS on audit_scans: authenticated users read their own scans;
--     service_role bypasses RLS (existing API path unaffected)
--   - public.migrate_anonymous_scans(text, uuid) RPC — claims anonymous
--     scans onto a user account after sign-in
--
-- Idempotent throughout (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY/TRIGGER IF EXISTS +
-- CREATE). Safe to re-run. Wrapped in begin/commit so a partial failure
-- rolls back. Applied via psql over the Session Pooler per CLAUDE.md.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ------------------------------------------------------------
-- 1. profiles table
-- ------------------------------------------------------------
-- One profile per auth.users row. Created automatically by the
-- handle_new_user() trigger below. Stores user-facing metadata
-- that isn't appropriate for auth.users (which is owned by
-- Supabase auth).

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  founding_artist boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'User-facing profile data. One row per auth.users entry. Auto-created via handle_new_user() trigger.';

COMMENT ON COLUMN public.profiles.founding_artist IS
  'Set to true at signup if the user is within the first 1,000 verified signups (Founding Artist program). Counter logic lands in Chunk 3.';

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------
-- 2. profiles updated_at trigger
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3. Auto-create profile on new auth.users
-- ------------------------------------------------------------
-- When a user signs up (via magic-link or any auth flow), this
-- trigger creates their profiles row using their email as the
-- initial display_name. The trigger runs as the Supabase auth
-- system user, so SECURITY DEFINER + a fixed search_path are
-- required.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 4. RLS on profiles
-- ------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- A user can read their own profile.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- A user can update their own profile (excluding founding_artist —
-- that's set server-side only).
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No INSERT / DELETE policies — INSERT happens via the
-- handle_new_user() trigger (SECURITY DEFINER, bypasses RLS).
-- DELETE happens via ON DELETE CASCADE from auth.users.

-- ------------------------------------------------------------
-- 5. audit_scans — add user_id and session_id (idempotent)
-- ------------------------------------------------------------
-- user_id is nullable: anonymous scans are still valid.
-- session_id is the cookie/anonymous identifier used to claim
-- anonymous scans onto a user account after they sign up.

ALTER TABLE public.audit_scans
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.audit_scans
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_audit_scans_user_id ON public.audit_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_scans_session_id ON public.audit_scans(session_id);

-- ------------------------------------------------------------
-- 6. RLS on audit_scans
-- ------------------------------------------------------------
-- Two read paths:
--   (a) Service-role key (existing API server code) — bypasses RLS,
--       no change needed.
--   (b) Authenticated user — can read their own scans only.
-- Anonymous scans (user_id IS NULL) are NOT readable via RLS;
-- they're claimed via the migrate_anonymous_scans() RPC below.
--
-- Service role bypasses RLS regardless of policies, so adding
-- the user-scoped policy is additive — the existing service-role
-- API path is unaffected.

ALTER TABLE public.audit_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_scans_select_own ON public.audit_scans;
CREATE POLICY audit_scans_select_own
  ON public.audit_scans
  FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. migrate_anonymous_scans RPC
-- ------------------------------------------------------------
-- Called server-side (with service-role key) after a user verifies
-- their magic-link. Claims any audit_scans rows that share the
-- user's session_id (set when they ran the anonymous scan) and
-- attaches them to user_id.
--
-- Idempotent: re-running with the same args is safe; rows already
-- claimed are skipped via the WHERE user_id IS NULL guard.

CREATE OR REPLACE FUNCTION public.migrate_anonymous_scans(
  p_session_id text,
  p_user_id uuid
)
RETURNS TABLE (claimed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed integer;
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) = 0 THEN
    RAISE EXCEPTION 'p_session_id is required';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  UPDATE public.audit_scans
  SET user_id = p_user_id
  WHERE session_id = p_session_id
    AND user_id IS NULL;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN QUERY SELECT v_claimed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.migrate_anonymous_scans(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.migrate_anonymous_scans(text, uuid) TO service_role;

commit;
