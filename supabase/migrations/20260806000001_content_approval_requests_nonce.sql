-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Content Approval Center™ — Phase 1 correction
--
-- One content_approval_requests row backs TWO signed links (Approve and
-- Reject), sharing one requestId -- whichever is used first atomically
-- consumes the row (status flips away from 'pending', used_at is set),
-- which naturally invalidates the other. token_hash (singular) doesn't
-- fit two tokens; a server-stored nonce does, and makes Objective 4's
-- required "Nonce" field a real, checked defense (the token's signature
-- alone already proves authenticity -- cross-checking payload.nonce
-- against the row lets a specific outstanding request be revoked
-- server-side without waiting for natural expiry, and adds a second
-- factor beyond the shared HMAC secret alone).
--
-- Zero rows exist in this table (applied moments after creation, nothing
-- has used it yet) -- safe to alter directly rather than layering a
-- migration around production data.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.content_approval_requests DROP COLUMN IF EXISTS token_hash;
ALTER TABLE public.content_approval_requests ADD COLUMN IF NOT EXISTS nonce text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE public.content_approval_requests ALTER COLUMN nonce DROP DEFAULT;

COMMENT ON COLUMN public.content_approval_requests.nonce IS
  'Cross-checked against the signed token''s own nonce field at decide
   time -- defense-in-depth beyond the HMAC signature alone (Objective 4).
   Always explicitly supplied at insert by scripts/content-publishing/
   publish.mjs, never left to the column default.';

commit;
