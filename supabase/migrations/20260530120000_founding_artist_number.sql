-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Brief 015 (Mission Control): per-user Founding Artist ordinal
--
-- Adds profiles.founding_artist_number — the ordinal claim number used by
-- the Mission Control sidebar badge ("Founding Artist #N · Member Since ...").
--
-- Backfills existing founding_artist=true profiles by created_at ASC so the
-- earliest claimer is #1, the next is #2, etc. New signups receive their
-- number atomically inside handle_new_user(), under the same advisory lock
-- that guards the founding_artist boolean (Block A Chunk 3 + Block B).
--
-- Partial UNIQUE index — only enforces uniqueness across rows where the
-- number is assigned (founding_artist=false rows stay NULL).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION). Wrapped in begin/commit. Apply via psql
-- over the Session Pooler per CLAUDE.md (explicit-flags form — the dotted
-- pooler username breaks the URL form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_artist_number integer;

-- Partial UNIQUE — only enforce across assigned numbers.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_founding_artist_number_unique
  ON public.profiles (founding_artist_number)
  WHERE founding_artist_number IS NOT NULL;

-- Backfill existing founding artists in claim order (earliest created_at = #1).
-- Skipped for any row that already has a number (re-runs are safe).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS n
  FROM public.profiles
  WHERE founding_artist = true AND founding_artist_number IS NULL
)
UPDATE public.profiles p
SET founding_artist_number = ranked.n
FROM ranked
WHERE p.id = ranked.id;

-- Update handle_new_user() to assign founding_artist_number atomically
-- when claiming founding status. Same advisory lock as Chunk 3 — no race.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count integer;
  v_is_founding   boolean := false;
  v_number        integer := NULL;
BEGIN
  -- Serialize the count-and-set across concurrent inserts.
  PERFORM pg_advisory_xact_lock(hashtext('founding_artist_counter'));

  SELECT count(*) INTO v_current_count
  FROM public.profiles
  WHERE founding_artist = true;

  IF v_current_count < public.founding_artist_cap() THEN
    v_is_founding := true;
    -- Next ordinal = current max assigned number + 1. Under advisory lock,
    -- this is race-safe against concurrent claims.
    SELECT COALESCE(MAX(founding_artist_number), 0) + 1
    INTO v_number
    FROM public.profiles;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, founding_artist, founding_artist_number, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_is_founding,
    v_number,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

commit;
