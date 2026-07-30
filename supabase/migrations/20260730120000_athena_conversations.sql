-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Ask ATHENA™ — ATHENA™ Phase 3E
--
-- Conversation Memory™: short-lived, per-conversation turn history for
-- pronoun/reference resolution across a multi-turn Ask ATHENA session.
-- Explicitly and completely distinct from Executive Memory™
-- (executive_memory_items, Phase 3C) -- curated, long-lived executive facts.
-- Nothing in this schema, and nothing in api/ask-athena.js or
-- api/_lib/athena-conversation-store.js, ever writes to
-- executive_memory_items. Memory Promotion™ stays a separate, deliberate
-- artist action against /api/executive-memory-actions.
--
-- Two tables: one row per conversation (athena_conversations), one row per
-- turn (athena_conversation_turns), matching this codebase's house style
-- (uuid PK, timestamptz DEFAULT now(), real FK to auth.users(id), RLS
-- select/insert-own, heavy COMMENT ON). Turns are never updated or deleted
-- in place -- a conversation's history is immutable once written, matching
-- the Executive Brief Archive's "immutable history" convention.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.athena_conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_turn_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.athena_conversations IS
  'Ask ATHENA(tm) Phase 3E. One row per conversation session. Conversation
   Memory(tm) is short-lived turn history for pronoun/reference resolution --
   distinct from Executive Memory(tm) (executive_memory_items), which this
   table never writes to.';

CREATE TABLE IF NOT EXISTS public.athena_conversation_turns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid NOT NULL REFERENCES public.athena_conversations(id) ON DELETE CASCADE,

  -- Denormalized for a direct RLS check on this table without a join on
  -- every row read -- see policy below. Always equals the parent
  -- conversation's artist_profile_id; enforced in application code
  -- (api/_lib/athena-conversation-store.js), not by a DB constraint, since
  -- Postgres has no native cross-table CHECK.
  artist_profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role                text NOT NULL CHECK (role IN ('user', 'athena')),
  content             text NOT NULL,

  -- The full Response Contract for an 'athena' turn (null for 'user' turns)
  -- -- lets a resumed conversation re-render citations/recommendations
  -- exactly as originally returned, not just the plain answer text.
  response_contract   jsonb,

  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.athena_conversation_turns IS
  'Ask ATHENA(tm) Phase 3E. One row per turn (user question or ATHENA
   answer). Immutable once written -- never updated or deleted in place.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_athena_conversations_artist
  ON public.athena_conversations(artist_profile_id, last_turn_at DESC);

CREATE INDEX IF NOT EXISTS idx_athena_conversation_turns_conversation
  ON public.athena_conversation_turns(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_athena_conversation_turns_artist
  ON public.athena_conversation_turns(artist_profile_id, created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Same convention as executive_brief_archive / executive_memory_items:
-- client-readable (own rows only), never client-writable. All writes go
-- through the service-role key inside api/_lib/athena-conversation-store.js.

ALTER TABLE public.athena_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athena_conversation_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athena_conversations_select_own ON public.athena_conversations;
CREATE POLICY athena_conversations_select_own
  ON public.athena_conversations
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

DROP POLICY IF EXISTS athena_conversation_turns_select_own ON public.athena_conversation_turns;
CREATE POLICY athena_conversation_turns_select_own
  ON public.athena_conversation_turns
  FOR SELECT
  USING (auth.uid() = artist_profile_id);

-- No client INSERT/UPDATE/DELETE policies -- absence of a policy is a deny
-- with RLS enabled. The service role bypasses RLS entirely for the write
-- path in api/_lib/athena-conversation-store.js.

commit;
