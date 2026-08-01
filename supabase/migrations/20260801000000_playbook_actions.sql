-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Playbook Action Engine™ — Phase 4A, Executive Actions™
--
-- Two tables: one row per playbook instance an artist has engaged with
-- (playbook_actions), one row per state transition (playbook_action_history,
-- the Board's required "Audit History").
--
-- Stable identity (Board directive): a Playbook ID is a fixed, hand-authored
-- slug (api/playbooks/definitions/*.js), never generated. An Action ID is
-- stable-by-construction because it is keyed to the (artist_profile_id,
-- playbook_id) pair -- an artist who starts a playbook today resumes the
-- same row after a future scan, rather than creating a duplicate. Enforced
-- here by a partial unique index (one non-archived row per pair) backing
-- api/_lib/playbook-action-store.js's own lookup-before-insert logic.
--
-- Facts only, never derived values (Board Final Refinement #3): this table
-- stores completed_steps/total_steps; progress percentage is always
-- calculated at read time (api/_lib/playbook-action-store.js's
-- withProgressPercentage()), never persisted as a column.
--
-- Evidence First™: completion_outcome records the artist's own confirmation
-- only. It never means the underlying issue was independently re-verified --
-- only a future real scan can do that. See governance/PLAYBOOK_ACTION_ENGINE_ARCHITECTURE.md.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.playbook_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- Action ID

  artist_profile_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stable slug from the Playbook Registry (api/playbooks/definitions/*.js),
  -- e.g. 'mlc-registration' -- never generated, never changes.
  playbook_id           text NOT NULL,

  -- Content version and definition-format version at start time -- two
  -- independent concerns (Board Final Refinement #2). An artist always
  -- knows which content version they completed, even if the definition's
  -- own shape (definition_schema) evolves later.
  playbook_version      text NOT NULL,
  definition_schema     integer NOT NULL,

  status                text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'started', 'in_progress', 'completed', 'archived')),

  -- FACTS ONLY (Board Final Refinement #3) -- completed_steps/total_steps
  -- are stored; percentage is always computed at read time, never persisted.
  completed_steps       integer NOT NULL DEFAULT 0 CHECK (completed_steps >= 0),
  total_steps           integer NOT NULL CHECK (total_steps > 0),

  -- Stable step id (e.g. 'MLC-002'), never an array index/position --
  -- Board Refinement #4. Null until the first advance.
  current_step_id       text,

  -- Snapshot at start time of how confident the underlying evidence was
  -- that this playbook should be recommended. Canonical owner: Canonical
  -- Intelligence Engine (the same CIM/CIO fields the Playbook Definition's
  -- evidenceConfidence() reads) -- never fabricated here or in the UI.
  evidence_confidence   text
    CHECK (evidence_confidence IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA')),

  -- Historical evidence pointer only (which risk/scan/brief prompted this
  -- playbook to surface) -- audit trail, never the identity key.
  recommendation_source jsonb,
  supporting_evidence   jsonb,

  completion_outcome    text,

  started_at            timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.playbook_actions IS
  'Playbook Action Engine(tm) -- Phase 4A. One row per (artist, playbook)
   instance. Stable identity via the partial unique index below, not via
   any hash of unstable risk/opportunity data. Status/progress/completion
   history are exclusively owned and written by
   api/_lib/playbook-action-store.js -- presentation layers only render.';

COMMENT ON COLUMN public.playbook_actions.completed_steps IS
  'A fact, not a derived value. progressPercentage is always computed at
   read time (completed_steps / total_steps) -- never stored, per Board
   Final Refinement #3.';

-- One active (non-archived) instance per artist+playbook -- THIS is the
-- stable-identity guarantee ("an artist who starts an MLC playbook today
-- continues the same playbook after tomorrow's scan"). A partial unique
-- index is the correct, standard Postgres tool for "unique except for
-- soft-deleted/archived rows" -- simpler than an EXCLUDE constraint and
-- needs no extension.
CREATE UNIQUE INDEX IF NOT EXISTS playbook_actions_one_active_per_playbook
  ON public.playbook_actions (artist_profile_id, playbook_id)
  WHERE (status != 'archived');

CREATE INDEX IF NOT EXISTS idx_playbook_actions_artist_status
  ON public.playbook_actions(artist_profile_id, status);

-- ── Audit History (Board-required) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playbook_action_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id           uuid NOT NULL REFERENCES public.playbook_actions(id) ON DELETE CASCADE,
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_status         text,
  to_status           text NOT NULL,
  -- Keyed by stable step_id, never by position, so history stays meaningful
  -- even if a future playbookVersion reorders steps.
  from_step_id        text,
  to_step_id          text,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.playbook_action_history IS
  'Playbook Action Engine(tm) -- Phase 4A. Append-only audit history, one
   row per state transition. Never updated or deleted in place.';

CREATE INDEX IF NOT EXISTS idx_playbook_action_history_action
  ON public.playbook_action_history(action_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_playbook_action_history_artist
  ON public.playbook_action_history(artist_profile_id, created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same convention as executive_brief_archive / executive_memory_items /
-- athena_conversations: client-readable (own rows only), never
-- client-writable. All writes go through the service-role key inside
-- api/_lib/playbook-action-store.js.

ALTER TABLE public.playbook_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_action_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS playbook_actions_select_own ON public.playbook_actions;
CREATE POLICY playbook_actions_select_own
  ON public.playbook_actions
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

DROP POLICY IF EXISTS playbook_action_history_select_own ON public.playbook_action_history;
CREATE POLICY playbook_action_history_select_own
  ON public.playbook_action_history
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

-- No client INSERT/UPDATE/DELETE policies -- absence of a policy is a deny
-- with RLS enabled. The service role bypasses RLS entirely for the write
-- path in api/_lib/playbook-action-store.js.

commit;
