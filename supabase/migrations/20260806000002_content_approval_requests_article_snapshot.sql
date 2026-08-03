-- ─────────────────────────────────────────────────────────────────────────────
-- Royaltē — Content Approval Center™ — Phase 1 correction 2
--
-- api/content/decide.js (a live Vercel function, no git access) needs the
-- article's real title and publish date for its confirmation email and
-- result pages -- content-registry/articles/*.json lives in git, not
-- reachable from a serverless function. A denormalized snapshot taken at
-- request-issue time (publish.mjs, which does have git access) is the
-- correct fix: these fields don't change after an approval request is
-- already outstanding, and if they did, the snapshot is what the
-- executive was actually shown when they decided -- arguably more
-- correct than a live re-read would be.
--
-- Idempotent. Safe to re-run once applied.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

ALTER TABLE public.content_approval_requests ADD COLUMN IF NOT EXISTS article_title text;
ALTER TABLE public.content_approval_requests ADD COLUMN IF NOT EXISTS article_publish_date text;

commit;
