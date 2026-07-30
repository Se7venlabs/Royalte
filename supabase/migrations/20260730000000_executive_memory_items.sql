-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Executive Memory™ — ATHENA™ Phase 3C
--
-- The writable store Phase 3B's api/_lib/executive-memory.js explicitly and
-- permanently deferred: Goals, Dismissed Recommendations, and Milestones are
-- artist-authored intent, not derivable from archived Executive Intelligence
-- Objects. This table is that missing persistence layer -- a general-purpose
-- memory-item store, not limited to those three original examples.
--
-- Executive Memory™ is not a cache, not conversation history, and not a
-- duplicate of the Executive Brief Archive™ -- it is curated, long-lived
-- executive context that survives across scans. Every row is either a real
-- fact (Canonical Evidence), an artist's own statement (User Confirmed), a
-- computed observation (Derived Intelligence), a still-suggested idea
-- (ATHENA Recommendation), a past fact no longer current (Historical
-- Context), or a superseded prior version (Superseded).
--
-- Constitutional rule: an ATHENA Recommendation may never be silently
-- promoted into this table. Only the write path
-- (api/_lib/executive-memory-store.js) enforces this -- see that file's
-- Memory Promotion™ guard. This migration does not and cannot enforce
-- promotion consent at the SQL layer; it is enforced entirely in application
-- code, which is the sole writer (service-role key; no client INSERT policy
-- exists below).
--
-- Rows are never hard-deleted -- lifecycle is expressed through `status`
-- (active | superseded | expired), matching the Executive Brief Archive's
-- own "immutable history, no destructive writes" convention.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.executive_memory_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership. NOT NULL by design -- memory is always artist-scoped, never
  -- created for an anonymous/unauthenticated session (matching
  -- executive_brief_archive's ownership rule).
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Free text, not a fixed enum -- future capabilities may introduce new
  -- memory types without a migration. 'goal' | 'dismissed_action' |
  -- 'milestone' | 'recurring_risk_context' | 'general', etc.
  memory_type         text NOT NULL,

  -- Where this statement came from. Governs what the UI may claim about it
  -- and, per the write path, whether it required explicit user promotion.
  source              text NOT NULL
    CHECK (source IN ('Canonical Evidence', 'User Confirmed', 'Derived Intelligence', 'ATHENA Recommendation', 'Historical Context', 'Superseded')),

  statement           text NOT NULL,

  -- Traceability back to the real evidence this statement rests on -- e.g.
  -- {domain, executiveBriefId, scanId}. Nullable only for pure User Confirmed
  -- statements with no underlying canonical evidence (an artist's own
  -- free-text goal has no scan to point at).
  evidence_reference  jsonb,

  confidence          text NOT NULL DEFAULT 'MEDIUM'
    CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA')),

  -- Lifecycle status. 'active' is the only state a memory item is ever
  -- created in. A row moves to 'superseded' only when a newer row replaces
  -- it (superseded_by set on this row); to 'expired' only via an explicit
  -- expire action. Never reused for anything else.
  status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'expired')),

  -- Set on the OLD row when correctMemoryItem()/supersedeMemoryItem() creates
  -- a replacement -- points forward to the new row, never backward.
  superseded_by       uuid REFERENCES public.executive_memory_items(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Set by confirmMemoryItem() -- the last time an artist explicitly
  -- re-affirmed this item still holds. NULL until first confirmed.
  last_confirmed_at   timestamptz
);

COMMENT ON TABLE public.executive_memory_items IS
  'Executive Memory(tm) -- ATHENA(tm) Phase 3C. Curated, long-lived executive
   context that survives across scans: goals, dismissed recommendations,
   milestones, and confirmed/derived observations. Written exclusively
   server-side (service-role key) via api/_lib/executive-memory-store.js,
   which enforces Memory Promotion(tm) (an ATHENA Recommendation requires
   explicit user confirmation before it may be written). Rows are never
   hard-deleted -- lifecycle moves through the status column.';

COMMENT ON COLUMN public.executive_memory_items.source IS
  'Canonical Evidence | User Confirmed | Derived Intelligence |
   ATHENA Recommendation | Historical Context | Superseded. Governs what the
   UI may claim about this item and, in the write path, whether creating it
   required explicit user promotion.';

COMMENT ON COLUMN public.executive_memory_items.status IS
  'active | superseded | expired. A row is never overwritten in place --
   correction/supersession always inserts a new row and marks the old one
   superseded, pointed at by superseded_by.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_executive_memory_items_artist_status
  ON public.executive_memory_items(artist_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_executive_memory_items_artist_type
  ON public.executive_memory_items(artist_profile_id, memory_type);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same convention as executive_brief_archive: client-readable (own rows
-- only), never client-writable. All writes go through the service-role key
-- inside api/_lib/executive-memory-store.js -- RLS is defense-in-depth for
-- reads, not the primary access control (the read/write APIs additionally
-- scope every query to the Bearer-authenticated caller's own auth.uid()).

ALTER TABLE public.executive_memory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS executive_memory_items_select_own ON public.executive_memory_items;
CREATE POLICY executive_memory_items_select_own
  ON public.executive_memory_items
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

-- No client INSERT/UPDATE/DELETE policies -- absence of a policy is a deny,
-- not an implicit allow, per Postgres RLS semantics with RLS enabled. The
-- service role bypasses RLS entirely for the write path.

commit;
