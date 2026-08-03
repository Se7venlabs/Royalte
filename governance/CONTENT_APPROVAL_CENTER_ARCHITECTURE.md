# Content Approval Center™ — Phase 1: Executive Email Approval Workflow

**Status:** Board-authorized (three directive revisions, v1.1 → v3.0, plus four Final Engineering Change Requests). Implemented on top of the certified Content Publishing Engine™ — see `governance/CONTENT_PUBLISHING_ROOT_CAUSE_REPORT.md`, `governance/CONTENT_PUBLISHING_FINAL_CERTIFICATION.md`, `governance/CONTENT_PUBLISHING_AUTHENTICATION_MODEL.md` for that program's own history.

## 1. What this replaces

Before this phase, an article only ever reached `approvalStatus: 'approved'` via a human hand-editing a registry JSON file in a GitHub PR. Executives needed GitHub knowledge to know what was waiting, what needed approval, or whether publishing had started, succeeded, or failed.

Now: an email arrives at `info@royalte.ai` once an article's publishing window is reached (or found overdue) — not the moment its content merges. The executive clicks Approve or Reject. No GitHub, no login, no dashboard (explicitly ruled out by the Board — replaced by the Weekly Executive Publishing Summary).

## 2. The one real architectural decision

**A live Vercel API endpoint (`api/content/decide.js`, stateless, no git, no `gh`/`git` binaries) cannot safely flip a field in a file that lives in a GitHub branch-protected repo, without duplicating the commit/PR/checks/merge machinery `scheduled-publish.yml` already owns and has been live-verified through five real infrastructure fixes.**

Decision: it never tries to. `api/content/decide.js` only ever writes to a new Supabase table and fires a `workflow_dispatch` at the existing `scheduled-publish.yml`. A new early step in that same workflow (`sync-approvals.mjs`) reconciles any decided-but-unsynced Supabase row into the registry, through the exact same `saveArticle()`/`appendHistory()` calls the Engine already uses. There is exactly one place in the whole system that ever writes to the registry via git — unchanged from before this phase.

## 3. Data flow

```
scheduled-publish.yml (Tue/Thu cron, Monday-adjacent weekly-digest.yml is
separate and read-only, or workflow_dispatch fired by the decide endpoint)
  1. sync-approvals.mjs: Supabase rows with status IN ('approved','rejected')
     AND synced_at IS NULL -> registry approvalStatus flip
     ('approved' / 'needs_revision') -> mark synced_at
  2. publish.mjs's existing due-date loop (publishDate <= today), now two
     branches per article:
       - approvalStatus 'approved'         -> publish (UNCHANGED path)
       - approvalStatus 'pending'          -> issue approval request:
         Supabase insert + two signed links (approve/reject) + rich email
         (ECR-002) -> flip 'pending' -> 'awaiting_approval'
       - approvalStatus 'awaiting_approval' -> no-op, still waiting
     "Publishing Started"/"Success"/"Failure" emails fire at the same
     points publish.mjs already logs the corresponding history.jsonl event.
  3. commit + PR + wait-for-checks + merge (UNCHANGED mechanism)

Executive clicks the emailed link
  -> GET /api/content/decide?token=...  (branded confirm page, does NOT
     mutate anything -- see §4)
  -> clicks the real Approve/Reject button (<form method="POST">)
  -> POST /api/content/decide
       - verify signature + expiry + nonce (§5)
       - atomically consume the Supabase row (single-use guard, §5)
       - audit log row (every attempt, not just successes)
       - fire workflow_dispatch at scheduled-publish.yml (best-effort;
         ECR-001 -- see §6)
       - send Approval/Rejection confirmation email
       - render the result page

weekly-digest.yml (Monday 13:00 UTC) -- read-only, no git writes: reads
the registry + history.jsonl, sends the Weekly Executive Publishing
Summary.
```

## 4. Why GET-then-POST, not one link doing everything

Corporate email gateways and some clients (Outlook Safe Links, Gmail link prescanning) automatically fetch links in emails before a human ever clicks. A single-use GET link would get silently consumed by a scanner, and the executive's real click would then fail as "already used." The GET renders a non-mutating confirm page; only the POST (a real `<form>` submission a scanner never triggers) records the decision. Still reads as "one click" to the executive — click the email button, land on a branded page, click Approve.

## 5. Security model (Objectives 3/4/15 across every directive revision)

**Token**: HMAC-SHA256 over `{requestId, action, expiresAt, nonce}`, `scripts/content-publishing/approval-tokens.mjs`. Hand-rolled on Node's built-in `crypto` (no dependency), matching `api/apple-token.js`'s existing JWT-signing convention. HMAC, not asymmetric — the only verifier is this same codebase. `timingSafeEqual` for signature comparison. `signToken`/`verifyToken` never read the clock internally (`now` is always caller-supplied), matching `isEligibleForPublishing`'s determinism convention.

**One Supabase row backs two tokens** (Approve and Reject), sharing one `requestId` + server-stored `nonce`. Whichever is used first atomically consumes the row (`status` flips away from `'pending'`, `used_at` set), which naturally invalidates the other — clicking either link makes the other dead, not just "the wrong choice."

**Single-use, atomically**: `UPDATE content_approval_requests SET status=..., used_at=now() WHERE id=$requestId AND status='pending' AND used_at IS NULL` — the same no-read-then-write-race guard pattern as the existing rate-limit RPC and `sync-approvals.mjs`'s own `synced_at` flip. Zero rows affected means "already decided" or "never existed," indistinguishable to the caller (no information leak about which).

**Defense in depth beyond the signature**: the token's `nonce` is cross-checked against the value stored on the Supabase row (not just the HMAC signature) — a second factor that also gives a path to server-side-revoke a specific outstanding request without waiting for natural expiry.

**Every attempt is audited**, not just successes: `content_approval_audit_log` (append-only) records `issued`, `viewed` (the GET), `approved`, `rejected`, `expired_attempt`, `replay_attempt`, `invalid_signature` — this is the direct, queryable evidence for "expired/tampered/replayed/wrong-recipient links fail," not just an assertion.

**Expiration**: 7 days from issue (`APPROVAL_TOKEN_TTL_MS`, `publish.mjs`) — long enough an executive checking email a few days late isn't locked out, short enough a stale link isn't usable indefinitely.

**RLS**: both new tables (`content_approval_requests`, `content_approval_audit_log`) have RLS enabled with zero client policies — a leaked anon/publishable key can never read or write either. All access is via the service-role key, used only in `api/content/decide.js`, `sync-approvals.mjs`, and `weekly-digest.mjs` (well, the digest only reads git+registry, not this table).

## 6. ECR-001 — why overdue articles publish immediately after approval, with no new scheduler

Approval requests are only ever issued once an article's `publishDate <= today` (§3, step 2) — meaning every article a human ever approves is, by construction, already due or overdue. `POST /api/content/decide` fires a `workflow_dispatch` at `scheduled-publish.yml` immediately after recording the decision; that same run's `sync-approvals.mjs` step flips the registry to `'approved'`, and `publish.mjs`'s existing due-date loop finds it already eligible and publishes it in that run. No second scheduler, no new publishing path — the existing Engine's own cadence, triggered on-demand instead of waited-for. If the dispatch call fails (logged, never blocks the response), the next Tue/Thu cron picks it up regardless — delayed, never lost.

## 7. ECR-002 — where the rich email content actually comes from

Featured Image, Executive Summary, Category, Read Time, and Scheduled Publish Date are all existing registry fields (`heroImagePath`, `excerpt`, `category`, `readTime`, `publishDate`) — no schema change needed. SEO Title, Meta Description, and Focus Keyword are **not** registry fields, and the 4 backlog articles' entries predate this requirement — adding them as new required fields would force exactly the "manual registry edits" every directive revision forbade. Instead, `approval-mailer.mjs`'s `extractSeoMetadata()`/`readSeoMetadata()` read them straight out of the article's own merged HTML `<head>` (`<title>`, `<meta name="description">`, `<meta name="keywords">`) — the real source of truth for what search engines see, so there's no second, driftable copy. A tag genuinely absent renders as "Not specified," never fabricated.

## 8. Executive Visibility Rule™ (ECR-004)

Every automated publishing lifecycle event gets an email to `info@royalte.ai` — a standing engineering requirement for this and future publishing-related work, not just this phase:

| Event | Email |
|---|---|
| Article's publishing window reached, still `pending` | Approval Required |
| Executive clicks Approve | ✅ Article Approved |
| Executive clicks Reject | Article Returned For Revision |
| Approved article's publish attempt begins | 🚀 Publishing Started |
| Publish succeeds | ✅ Article Published (includes total published count, ECR-003) |
| Publish fails | 🚨 Publishing Failed |
| Every Monday, 13:00 UTC | 📊 Weekly Publishing Summary |

Executives should never need GitHub, GitHub Actions, registry files, or Vercel deployments to know publishing status.

## 9. Registry schema extension

`APPROVAL_STATUSES` (`scripts/content-publishing/schema.mjs`): `'pending'` (never reviewed) → `'awaiting_approval'` (a signed link is outstanding) → `'approved'` (publishes on the existing Engine's normal cadence) or `'needs_revision'` (rejected; publishing stops). Re-approval after revision reuses the existing Content Merge Gate: a human resets `approvalStatus` back to `'pending'` as part of landing a content revision, the same way any other registry change lands — no new mechanism.

`isDueForApprovalRequest(entry, today)` (new, alongside the existing `isEligibleForPublishing`): `approvalStatus === 'pending' && publishStatus === 'scheduled' && publishDate <= today`. The registry flip to `'awaiting_approval'` itself is what prevents a second request being issued on the next run — no separate "already has an outstanding request" query needed.

## 10. Supabase schema

`supabase/migrations/20260806000000_content_approval_requests.sql` (+ two same-day corrective migrations, `..._nonce.sql` and `..._article_snapshot.sql`, applied before anything depended on the original shape — zero rows existed at the time):

- **`content_approval_requests`** — one row per signed-link pair issued. `id`, `article_slug`, `article_title`/`article_publish_date` (denormalized snapshot — `api/content/decide.js` has no git access to read the real registry), `action_requested`, `nonce`, `recipient_email`, `status`, `requested_at`, `expires_at`, `used_at`, `decided_at`, `decided_ip`, `decided_user_agent`, `synced_at`.
- **`content_approval_audit_log`** — append-only, one row per event, never updated or deleted.

Both RLS-enabled, zero client policies (§5).

## 11. Required configuration — nothing here was previously needed

**GitHub Actions repo secrets** (`Settings → Secrets and variables → Actions`), verified absent before this phase — **all four must be added**:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — used by `sync-approvals.mjs` and `publish.mjs`'s new approval-request path. (Already used inside Vercel functions; never previously needed by a GitHub Actions workflow.)
- `CONTENT_APPROVAL_TOKEN_SECRET` — new, high-entropy random string, HMAC signing key. Must be **identical** to the Vercel environment variable of the same name (both sides sign/verify with the same secret).
- `RESEND_API_KEY` — used by `approval-mailer.mjs` from both `scheduled-publish.yml` and `weekly-digest.yml`. (Already used inside Vercel functions; never previously needed by a GitHub Actions workflow.)

`scheduled-publish.yml` also gained an `npm ci` step — `publish.mjs` now transitively depends on `resend` and `@supabase/supabase-js`, which it did not before this phase (the workflow never ran `npm ci` because it never needed `node_modules`).

**Vercel environment variables** (`api/content/decide.js`), also new:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — already set for other Vercel functions; confirm present in this project.
- `CONTENT_APPROVAL_TOKEN_SECRET` — same value as the GitHub secret above.
- `CONTENT_PUBLISHING_PAT` — same bot token already used as the GitHub Actions secret, added to Vercel too, so `api/content/decide.js` can fire `workflow_dispatch` (`repo` scope already covers Actions dispatch for a classic PAT).
- `RESEND_API_KEY` — already set for other Vercel functions.

## 12. Recovery behaviour

- **Supabase insert fails during approval-request issuance**: article stays `'pending'`, retried next run. Logged as `approval_request_failed` in `history.jsonl`.
- **Approval email fails to send**: same as above — status never advances without a real, delivered request.
- **`workflow_dispatch` fails after a decision**: decision is still recorded in Supabase; the next Tue/Thu cron (or any manual trigger) picks it up via `sync-approvals.mjs` regardless. Delayed, never lost.
- **A decision arrives for a slug with no matching registry entry** (shouldn't happen under normal operation): `sync-approvals.mjs` skips it, reports it, leaves it unsynced for manual investigation — never throws and blocks every other pending sync.
- **Replay / already-used / expired / tampered link**: every case renders "Link No Longer Valid" or "Already Decided," logs the specific reason to the audit table, never partially applies a decision.

## 13. Testing

`tests/content-publishing-test.mjs` §6: token sign/verify round-trip, expired/tampered/wrong-secret/malformed rejection, `isDueForApprovalRequest` eligibility, `extractSeoMetadata` (present and absent tags), `syncDecidedApprovals` (both outcomes, plus the no-matching-registry-entry case). §5 extended with the new due-date branches (approval-request issuance, missing-config no-op, Supabase-failure recovery) via an injected no-op test mailer and a minimal in-memory Supabase stub — never a real Resend or Supabase call. Manual/live verification for the actual email round-trip and the GET→POST decide flow (can't unit-test Resend delivery or a real inbox) — this is what the Objective 13 live walkthrough with the 4 real backlog articles is for.
