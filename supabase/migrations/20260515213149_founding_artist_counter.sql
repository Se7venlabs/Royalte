-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block A Chunk 3: Founding Artist counter
--
-- Determines and locks in founding_artist status atomically at signup time.
-- The handle_new_user() trigger (created in Chunk 1) is updated to check the
-- claimed count under a transaction-scoped advisory lock, set the flag if the
-- signup is within the 1,000 cap, and insert the profile row.
--
-- Server-authoritative: the client never sets profiles.founding_artist.
--
-- Adds:
--   - public.founding_artist_cap() — the cap as a one-place constant
--   - public.founding_artist_status — view exposing claimed / cap / remaining /
--     spots_available; readable by anon so the homepage can show the count
--   - updated public.handle_new_user() — sets founding_artist atomically
--
-- Idempotent (CREATE OR REPLACE throughout, GRANT is a no-op if already held).
-- Wrapped in begin/commit. Applied via psql over the Session Pooler per
-- CLAUDE.md (explicit-flags form — the dotted pooler username breaks URL form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- The cap. Hardcoded constant via a helper function so it's queryable and
-- changeable in one place.
CREATE OR REPLACE FUNCTION public.founding_artist_cap()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 1000;
$$;

-- A view that exposes the current claimed count + remaining slots.
-- anon can read it — the homepage needs this for copy without requiring
-- sign-in. The view runs with the owner's privileges (not security_invoker),
-- so it returns the aggregate count without exposing individual profile rows
-- through RLS.
CREATE OR REPLACE VIEW public.founding_artist_status AS
SELECT
  (SELECT count(*)::integer FROM public.profiles WHERE founding_artist = true) AS claimed,
  public.founding_artist_cap() AS cap,
  GREATEST(
    public.founding_artist_cap() - (SELECT count(*)::integer FROM public.profiles WHERE founding_artist = true),
    0
  ) AS remaining,
  (SELECT count(*) FROM public.profiles WHERE founding_artist = true) < public.founding_artist_cap() AS spots_available;

-- Grant read on the view to anon + authenticated so the homepage can show
-- "X spots remaining" without requiring sign-in.
GRANT SELECT ON public.founding_artist_status TO anon, authenticated;

-- Update handle_new_user() to set founding_artist atomically. Uses a
-- transaction-scoped advisory lock so concurrent signups can't race past the
-- cap (count-then-insert is otherwise a TOCTOU race). The lock is released at
-- transaction end.
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

  INSERT INTO public.profiles (id, email, display_name, founding_artist)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_is_founding
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

commit;
