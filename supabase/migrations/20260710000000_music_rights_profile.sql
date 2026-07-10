-- Music Rights Profile™ — Phase 1
--
-- Adds two columns to public.profiles:
--   music_rights_profile   JSONB     — artist-supplied rights intelligence (nullable)
--   onboarding_completed_at TIMESTAMPTZ — gate sentinel; NULL = onboarding not yet shown
--
-- The gate sentinel is set to NOW() when the artist either completes the profile
-- or explicitly chooses "Skip for Now". Once set the onboarding gate never fires again;
-- the artist can edit the profile from Settings.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS music_rights_profile      jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at   timestamptz;
