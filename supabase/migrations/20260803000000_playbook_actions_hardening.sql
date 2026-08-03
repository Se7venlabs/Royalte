-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Playbook Action Engine™ Hardening — Phase 4A, Executive Actions™
--
-- Follow-up to 20260801000000_playbook_actions.sql, per the Board's Final
-- Hardening & Merge Readiness directive. Purely additive/alterative --
-- table had zero production rows at the time of this migration (confirmed
-- before writing it), so no data migration is needed, but this is written
-- as a genuine incremental ALTER, not a drop/recreate, matching how real
-- production schema evolution should look going forward.
--
-- Executive Change Request 3 -- Executive Health States™: expands the
-- status lifecycle to make Evidence First™ real, not just documented.
-- 'completed' is no longer reachable directly from artist self-report --
-- an artist's own confirmation moves a playbook to 'waiting_verification'
-- only; 'verified' (and then 'completed') requires a real re-check of
-- fresh canonical evidence via the same isEligible() the playbook was
-- triggered by (api/_lib/playbook-action-store.js's verifyPlaybook()).
--
-- Executive Change Request 4 -- Confidence History™: playbook_action_history
-- gains a confidence column, so every transition's evidence confidence is
-- preserved as a timeline, not overwritten.
--
-- Executive Change Request 6 -- Executive Action Numbers™: a human-readable
-- sequential identifier (EA-000001) distinct from the canonical uuid.
-- Stored as a fact (bigserial); the 'EA-NNNNNN' display string is always
-- formatted at read time (api/_lib/playbook-action-store.js's
-- formatActionNumber()), matching the "store facts, calculate derived
-- values" principle already established for progressPercentage.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- ── Executive Health States™ (Executive Change Request 3) ──────────────────
ALTER TABLE public.playbook_actions DROP CONSTRAINT IF EXISTS playbook_actions_status_check;
ALTER TABLE public.playbook_actions ADD CONSTRAINT playbook_actions_status_check
  CHECK (status IN ('available', 'recommended', 'started', 'in_progress', 'waiting_verification', 'verified', 'completed', 'archived'));

COMMENT ON COLUMN public.playbook_actions.status IS
  'Executive Health States(tm): available -> recommended -> started ->
   in_progress -> waiting_verification -> verified -> completed -> archived.
   An artists own confirmation (completePlaybook()) only ever reaches
   waiting_verification -- verified/completed require a real re-check of
   fresh canonical evidence (verifyPlaybook()), never self-report alone.
   Evidence First(tm), enforced structurally.';

-- verified_at is a new milestone timestamp, parallel to started_at/completed_at.
ALTER TABLE public.playbook_actions ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- ── Executive Action Numbers™ (Executive Change Request 6) ─────────────────
ALTER TABLE public.playbook_actions ADD COLUMN IF NOT EXISTS action_number bigserial;

COMMENT ON COLUMN public.playbook_actions.action_number IS
  'Executive Action Number(tm) fact -- a sequential integer, globally unique
   across all artists. The artist-facing "EA-000001" display string is
   always formatted at read time (formatActionNumber()), never persisted as
   text -- the same "store facts, calculate derived values" discipline
   already applied to progressPercentage.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_actions_action_number
  ON public.playbook_actions(action_number);

-- ── Confidence History™ (Executive Change Request 4) ────────────────────────
ALTER TABLE public.playbook_action_history ADD COLUMN IF NOT EXISTS confidence text
  CHECK (confidence IS NULL OR confidence IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'));

COMMENT ON COLUMN public.playbook_action_history.confidence IS
  'Confidence History(tm) -- the evidence confidence at the moment of this
   transition, preserved permanently rather than overwritten. Read
   sequentially per action_id, this becomes a real confidence timeline
   (e.g. HIGH -> HIGH -> MEDIUM -> VERIFIED) for future ATHENA(tm)/Executive
   Memory(tm) trend analysis.';

commit;
