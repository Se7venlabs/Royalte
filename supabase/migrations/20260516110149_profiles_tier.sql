-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Block B: profiles.tier column
--
-- Adds tier ('free' | 'pro') to profiles, default 'free'. Block B renders the
-- tier-gating UI off this value; Block C will flip it to 'pro' on Stripe
-- checkout success.
--
-- handle_new_user() is recreated to set tier='free' explicitly on new signups,
-- preserving the Chunk 3 advisory-lock + founding_artist logic unchanged.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION). Wrapped in
-- begin/commit. Applied via psql over the Session Pooler per CLAUDE.md
-- (explicit-flags form — the dotted pooler username breaks the URL form).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'
  CHECK (tier IN ('free', 'pro'));

-- Recreate handle_new_user() with tier set explicitly. Preserves the Chunk 3
-- advisory-lock + founding_artist counter logic.
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

  INSERT INTO public.profiles (id, email, display_name, founding_artist, tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    v_is_founding,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

commit;
