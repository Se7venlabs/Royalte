-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Executive Opportunity Engine™ — Phase 4B
--
-- Two tables: one row per current ranking of a Playbook Action
-- (opportunity_scores), one row per ranking change (opportunity_score_history,
-- the Board's required permanent Opportunity History™).
--
-- Stable Opportunity Identity™ (Objective 13): an Opportunity ID is NOT a
-- new identity system -- it IS the existing Playbook Action ID
-- (playbook_actions.id), enforced here by a UNIQUE (not just FK) constraint
-- on action_id, one current score row per action. A second, parallel
-- identity system for the same underlying entity was deliberately avoided.
--
-- Facts only, never derived values (same discipline as playbook_actions):
-- score/band/rank are stored as computed by api/_lib/opportunity-scoring-engine.js
-- at recompute time; nothing here is calculated live from other columns.
--
-- Opportunity History™ (Objective 16) is written unconditionally on every
-- recompute -- no "was this change big enough" filter, matching
-- playbook_action_history's own unconditional recordHistory() precedent.
--
-- scoring_version is stored on every row (mirrors playbook_version/
-- definition_schema snapshotting) so a future change to the scoring
-- weights never makes historical scores uninterpretable.
--
-- No DB-level transition enforcement is implied here, matching the
-- Playbook Action Engine's own actual discipline: CHECK constrains valid
-- band VALUES only; band-assignment and any sequencing logic is entirely
-- application-code-owned (api/_lib/opportunity-store.js).
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.opportunity_scores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable Opportunity Identity™ -- reuses the Playbook Action's own UUID,
  -- never a second identity system. UNIQUE (not just a FK) enforces one
  -- current score row per action.
  action_id           uuid NOT NULL UNIQUE REFERENCES public.playbook_actions(id) ON DELETE CASCADE,
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Denormalized snapshot of playbook_actions.playbook_id at compute time --
  -- lets every read (roadmap, dashboard metrics) resolve a Playbook
  -- Definition via getPlaybook() without a join, matching how
  -- playbook_actions itself already snapshots playbook_version/
  -- definition_schema rather than joining back to the Registry.
  playbook_id         text NOT NULL,

  scoring_version     text NOT NULL,

  score               integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  band                text NOT NULL CHECK (band IN ('DO_NOW', 'DO_NEXT', 'DO_LATER')),
  is_quick_win        boolean NOT NULL DEFAULT false,
  rank                integer NOT NULL,

  -- Per-factor contribution snapshot (revenuePotential, businessImpact,
  -- evidenceConfidence, difficulty, estimatedTime, priorityWeight) --
  -- Ranking Transparency™ (Objective 12): the system must always be able
  -- to answer "what factors caused this rank," never a black box.
  factor_breakdown    jsonb NOT NULL,

  computed_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.opportunity_scores IS
  'Executive Opportunity Engine(tm) -- Phase 4B. One row per current
   ranking of a Playbook Action. Sole write path:
   api/_lib/opportunity-store.js. Never overwritten silently -- every
   recompute also writes an opportunity_score_history row.';

COMMENT ON COLUMN public.opportunity_scores.action_id IS
  'Stable Opportunity Identity(tm) -- this IS the Playbook Action ID
   (playbook_actions.id), not a second parallel identity system. UNIQUE
   enforces one current score per action.';

COMMENT ON COLUMN public.opportunity_scores.scoring_version IS
  'Snapshot of OPPORTUNITY_SCORING_VERSION (api/schema/opportunity.js) at
   compute time -- so a future change to SCORE_WEIGHTS never makes
   historical scores uninterpretable.';

CREATE INDEX IF NOT EXISTS idx_opportunity_scores_artist_band
  ON public.opportunity_scores(artist_profile_id, band);

-- ── Opportunity History™ (Board-required, Objective 16) ─────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_score_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id           uuid NOT NULL REFERENCES public.playbook_actions(id) ON DELETE CASCADE,
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  scoring_version     text NOT NULL,
  score               integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  band                text NOT NULL CHECK (band IN ('DO_NOW', 'DO_NEXT', 'DO_LATER')),
  is_quick_win        boolean NOT NULL,
  rank                integer NOT NULL,
  factor_breakdown    jsonb NOT NULL,

  -- Previous values, null on an action's first-ever score. Lets
  -- describeScoreHistoryEvent() (api/_lib/opportunity-store.js) compute a
  -- human-readable label at read time without a second lookup.
  from_score          integer,
  from_band           text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.opportunity_score_history IS
  'Executive Opportunity Engine(tm) -- Phase 4B. Append-only, one row per
   recompute of an action''s ranking. Written unconditionally, never
   updated or deleted in place -- matches playbook_action_history''s own
   unconditional-write precedent (no "was this change big enough" filter).';

CREATE INDEX IF NOT EXISTS idx_opportunity_score_history_action
  ON public.opportunity_score_history(action_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_opportunity_score_history_artist
  ON public.opportunity_score_history(artist_profile_id, created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same convention as playbook_actions/playbook_action_history: client-
-- readable (own rows only), never client-writable. All writes go through
-- the service-role key inside api/_lib/opportunity-store.js.

ALTER TABLE public.opportunity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opportunity_scores_select_own ON public.opportunity_scores;
CREATE POLICY opportunity_scores_select_own
  ON public.opportunity_scores
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

DROP POLICY IF EXISTS opportunity_score_history_select_own ON public.opportunity_score_history;
CREATE POLICY opportunity_score_history_select_own
  ON public.opportunity_score_history
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

-- No client INSERT/UPDATE/DELETE policies -- absence of a policy is a deny
-- with RLS enabled. The service role bypasses RLS entirely for the write
-- path in api/_lib/opportunity-store.js.

commit;
