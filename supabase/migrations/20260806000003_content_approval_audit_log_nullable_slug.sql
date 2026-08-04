-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Content Approval Center™ — production defect fix
--
-- content_approval_audit_log.article_slug was NOT NULL, but the
-- verification-failure audit path (a malformed/invalid-signature/expired
-- token) legitimately cannot always resolve an article identity -- the
-- token payload itself is never trusted for this, only a Supabase row
-- lookup by requestId is (api/content/decide.js). The NOT NULL
-- constraint caused every such insert to fail silently (logAudit()
-- never checked the Supabase error), making the audit table appear
-- empty for the exact class of event -- invalid links -- it exists to
-- explain. Found via a live reproducible probe against production
-- 2026-08-04.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.content_approval_audit_log ALTER COLUMN article_slug DROP NOT NULL;

COMMENT ON COLUMN public.content_approval_audit_log.article_slug IS
  'Nullable, deliberately -- a malformed or invalid-signature token
   cannot always be resolved to an article identity, and this table must
   never fabricate or substitute one. Only ever set from a trusted
   Supabase content_approval_requests row lookup (by requestId), never
   from the token payload or client input directly.';

commit;
