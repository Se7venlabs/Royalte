-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Content Approval Center™ — Phase 1, Executive Email Approval
--
-- Two tables, same pattern as playbook_actions/playbook_action_history:
-- content_approval_requests is one row per signed approval link ever issued
-- (live state -- has it been used, what was decided); content_approval_audit_log
-- is append-only, one row per event, including failed/replayed/invalid
-- attempts -- the Board's required "Executive Audit" trail, and the direct
-- evidence for the Security Review's replay/tamper/expiry claims.
--
-- No artist_profile_id / RLS-select-own here, unlike playbook_actions --
-- this data isn't artist-facing. Only api/content/decide.js and the
-- scheduled-publish.yml sync step ever touch it, both via the service-role
-- key, which bypasses RLS entirely. RLS is still enabled with zero client
-- policies (absence of a policy is a deny), so a leaked anon key can never
-- read or write this table.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

CREATE TABLE IF NOT EXISTS public.content_approval_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- content-registry/articles/<article_slug>.json -- the registry entry
  -- this request governs. Not a foreign key: the registry lives in git,
  -- not Postgres.
  article_slug        text NOT NULL,

  -- Set only once decided -- a request covers both Approve and Reject
  -- outcomes; the token itself doesn't predetermine which button gets
  -- clicked.
  action_requested     text CHECK (action_requested IN ('approve', 'reject')),

  -- sha256 of the raw token, never the token itself -- a leaked table
  -- (backup, replica, log) can never be used to forge a valid link.
  token_hash          text NOT NULL,

  recipient_email     text NOT NULL,

  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  requested_at         timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL,

  -- Single-use guard -- the approval endpoint's atomic
  -- "UPDATE ... WHERE used_at IS NULL" is what actually enforces
  -- single-use; this column is that guard's state.
  used_at              timestamptz,
  decided_at           timestamptz,
  decided_ip           text,
  decided_user_agent   text,

  -- When sync-approvals.mjs folded this decision into the git registry.
  -- Null means "decided but not yet reflected in content-registry/".
  synced_at            timestamptz
);

COMMENT ON TABLE public.content_approval_requests IS
  'Content Approval Center(tm) -- Phase 1. One row per signed approval link
   issued. The registry (content-registry/articles/*.json, in git) remains
   the source of truth for what is actually approved/published -- this
   table is the live-state staging area sync-approvals.mjs reconciles into
   it, never a second source of truth for publishing.';

CREATE INDEX IF NOT EXISTS idx_content_approval_requests_slug
  ON public.content_approval_requests(article_slug, requested_at DESC);

-- sync-approvals.mjs's own query: "decided, not yet synced."
CREATE INDEX IF NOT EXISTS idx_content_approval_requests_unsynced
  ON public.content_approval_requests(status, synced_at)
  WHERE status IN ('approved', 'rejected') AND synced_at IS NULL;

-- ── Executive Audit (Board-required, append-only) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.content_approval_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid REFERENCES public.content_approval_requests(id) ON DELETE SET NULL,
  article_slug  text NOT NULL,

  -- Every attempt, not just successes -- 'issued', 'viewed' (the GET
  -- confirm page), 'approved', 'rejected', 'expired_attempt',
  -- 'replay_attempt', 'invalid_signature'. This table is the direct,
  -- queryable evidence for the Security Review's "replay/tamper/expiry
  -- attempts fail" claims -- not just asserted, verifiable.
  event         text NOT NULL,

  recipient_email      text,
  ip                   text,
  user_agent           text,
  previous_status      text,
  new_status           text,
  detail               text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_approval_audit_log IS
  'Content Approval Center(tm) -- Phase 1. Append-only, one row per
   approval-link event (including failed/replayed/invalid attempts).
   Never updated or deleted in place.';

CREATE INDEX IF NOT EXISTS idx_content_approval_audit_log_slug
  ON public.content_approval_audit_log(article_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_approval_audit_log_request
  ON public.content_approval_audit_log(request_id, created_at ASC);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Zero client policies, deliberately -- this is internal executive/
-- engineering data, not artist-facing. Enabling RLS with no policies means
-- a leaked anon/publishable key can never read or write either table; all
-- access is via the service-role key (api/content/decide.js,
-- sync-approvals.mjs, weekly-digest.yml), which bypasses RLS entirely.

ALTER TABLE public.content_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_approval_audit_log ENABLE ROW LEVEL SECURITY;

commit;
