-- ─────────────────────────────────────────────────────────────────────────
-- Brief 015o Phase 1 — Podcast Intelligence storage.
--
-- One row per unique (user_id, source_episode_id) tuple. The unique
-- constraint is the canonical dedup mechanism: re-running a discovery
-- scan never duplicates or re-alerts on known episodes.
--
-- The source_episode_id / source_podcast_id columns store Listen Notes
-- identifiers, but Listen Notes is never named in any UI surface
-- consuming this table (per Brief 015n's Intelligence Network rule).
-- Outcome columns (episode_title / podcast_name / etc.) carry the
-- artist-facing text.
--
-- RLS: users read their own rows. Writes only via service-role from
-- api/_lib/podcast-intelligence.js. Idempotent (IF NOT EXISTS / CREATE
-- POLICY IF NOT EXISTS); safe to re-apply via psql per CLAUDE.md.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.podcast_appearances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id           text,
  artist_name         text,

  -- Source identifiers (Listen Notes). Used for deduplication only.
  source_episode_id   text NOT NULL,
  source_podcast_id   text,

  -- Episode metadata — outcomes the artist sees.
  episode_title       text,
  episode_url         text,
  podcast_name        text,
  podcast_url         text,
  publish_date        timestamptz,
  description_snippet text,

  detected_at         timestamptz NOT NULL DEFAULT now(),

  -- Dedup constraint: re-inserting a known episode for a given user
  -- is a no-op when paired with INSERT ... ON CONFLICT DO NOTHING /
  -- upsert(..., { ignoreDuplicates: true }).
  CONSTRAINT podcast_appearances_user_episode_unique
    UNIQUE (user_id, source_episode_id)
);

CREATE INDEX IF NOT EXISTS podcast_appearances_user_detected_idx
  ON public.podcast_appearances (user_id, detected_at DESC);

ALTER TABLE public.podcast_appearances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users read own podcast appearances"
    ON public.podcast_appearances FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
