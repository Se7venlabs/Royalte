# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Active task list:** See `LAUNCH_CHECKLIST.md` at repo root. Read it at the start of every session — it's the source of truth for what's on deck and what's left before the June 1, 2026 beta launch.

## What this is

Royaltē is a music-royalty audit product. The repo bundles two things:

1. **Marketing/product site** — static HTML/CSS/JS in `public/` (no build step, served by Vercel)
2. **Audit engine** — Vercel serverless functions in `api/` that consume Spotify / Apple Music URLs and produce a canonical audit payload

There is no bundler, no framework, no TypeScript. Edits to `public/*.html` ship as-is.

## Commands

- **Run the pipeline test** (the only automated test): `node tests/pipeline-test.mjs`
  - Exercises `normalizeAuditResponse` → `validateAuditResponse` end-to-end against a realistic raw engine payload, plus negative cases. No test runner / framework — it just throws on failure.
- **Local dev** (serverless functions + static site): `vercel dev`
- **Deploy**: `vercel` (preview) / `vercel --prod`. `package.json` `build` is a no-op (`echo 'Static site'`); Vercel serves `public/` directly per the routes in `vercel.json`.
- **Generate an audit PDF**: `python3 ./generate_audit_pdf.py --payload scan.json --theme {brand|print} --out report.pdf`. The script lives at the repo root. Older notes referencing `/home/claude/generate_royalte_pdf.py` are stale — that path is from a deprecated sandbox setup; the file does not exist there. The script validates the input against its Pydantic mirror of the canonical schema and refuses to render on any drift.

## Required environment variables

Set in Vercel project settings (and locally in `.env` for `vercel dev`):

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Apple Music JWT: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (full `.p8` contents; literal `\n` accepted)
- Third-party APIs: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `LASTFM_API_KEY`, `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, `DISCOGS_USER_AGENT`

Modules degrade gracefully when keys are missing — see "AUTH_UNAVAILABLE" below.

## Architecture

### Audit request lifecycle (2 endpoints)

1. **`GET /api/audit?url=...`** — runs the engine, persists a canonical scan into Supabase `audit_scans` with a handler-generated `scanId`, returns the scan to the frontend (which captures `scanId` for step 2). Synchronous.
2. **`POST /api/submit-audit`** — receives the form submission with the captured `scanId` plus email. Requires `scanId` — returns HTTP 400 if missing/empty (`scan_id required`). Inserts an `audit_requests` row, renders the PDF via `lib/render-audit-pdf.js` from the saved `audit_scans.payload`, sends the audit email via Resend, marks the row `completed`. Synchronous; `vercel.json` sets `maxDuration: 60` on this function to cover PDFShift + Resend latency.

### The canonical AuditResponse contract

`api/schema/auditResponse.js` is **the single source of truth** for the audit payload shape (`AUDIT_RESPONSE_VERSION = '1.0.0'`). Every renderer reads this shape:

- Web preview / dashboard (`public/index.html`, `public/dashboard.html`, `public/js/dashboard.js`)
- Brand + print PDF (`generate_audit_pdf.py` — has a Pydantic model that mirrors the JS schema exactly)

`api/lib/normalizeAuditResponse.js` is the **only** place where raw engine field names are translated into canonical paths. Don't introduce a second normalizer.

Any shape change in `api/schema/auditResponse.js` is a breaking change — bump `AUDIT_RESPONSE_VERSION`, update the Pydantic model in `generate_audit_pdf.py`, update `api/lib/normalizeAuditResponse.js`, and update the pipeline test fixture.

`api/fixtures/canonical-radiohead.json` is a known-good canonical payload. Useful for testing renderers without re-running the engine.

### The frontend is mid-migration

`FRONTEND_MIGRATION.md` is load-bearing. The legacy frontend reads root-level fields like `data.artistName` / `data.followers` / `data.flags`, but the canonical shape moved them under `data.subject.*` / `data.metrics.*` / `data.issues`. Treat that document as the authoritative rename map until the shim is deleted.

### AUTH_UNAVAILABLE is not NOT_FOUND

Critical distinction enforced everywhere:

- `availability: 'VERIFIED'` — confirmed present
- `availability: 'NOT_FOUND'` — looked, genuinely absent (real coverage gap)
- `availability: 'AUTH_UNAVAILABLE'` — API key missing / auth failed (NOT a gap; render as "Unavailable", do not score as zero)
- `availability: 'ERROR'` — upstream API threw

Same applies to module `availability` and ownership confidence. Renderers must dash-out scores for `AUTH_UNAVAILABLE`, never substitute 0.

### Audit always normalizes to the artist

`api/audit.js` accepts artist / track / album / Apple Music URLs but `resolveToArtist()` collapses every input to a single canonical artist before the scan runs. Track and album inputs enrich the payload (e.g., ISRC cross-reference) but never become the audit target.

There is also a **degraded path**: if input is Apple Music and no Spotify match exists, the engine returns a successful 200 response with `followers: -1` and empty platform booleans rather than failing. UI must handle the `-1` sentinel.

### Engine fan-out

`runAudit()` calls ~10 third-party platforms via `Promise.allSettled` (Spotify, Apple Music, MusicBrainz, Deezer, AudioDB, Discogs, SoundCloud, Last.fm, Wikidata, YouTube, Tidal). Failed lookups become `{ found: false }` — the audit never aborts because one source is down.

### Rate limiting & abuse

`api/_lib/rate-limit.js` is wired into both `api/audit.js` and `api/submit-audit.js` — both handlers call `extractIp` → `checkBlocked` → `checkRateLimit` before any external API or DB work. Storage: Supabase tables `rate_limits` and `blocked_ips`. Three sliding windows: 10-second burst, hour, day.

Limits per endpoint:
- `/api/audit` — burst=2/10s, hour=30, day=100
- `/api/submit-audit` — burst=2/10s, hour=10, day=20 (tighter — every call burns PDFShift + Resend quota)

Atomicity: `checkRateLimit` calls the SECURITY DEFINER RPC `public.rate_limit_check_and_increment` (added by `supabase/migrations/20260511163847_rate_limit_rpc.sql`), which performs `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in a single statement. PG's row-level lock on the conflict target serialises parallel callers so concurrent burst requests produce monotonically increasing counts (1, 2, 3, ...) instead of all racing to count=1. The prior read-then-upsert pattern had this race; the RPC closes it.

Auto-escalation: `recordViolation` runs on every 429. After **5+ violations from the same IP in a 1-hour window**, the IP is auto-blocked for 24 hours via `blocked_ips`. `checkBlocked` short-circuits to 429 with `reason: 'blocked'` before rate-limit work, so blocked IPs don't consume rate-limit slots.

Policy: **fail-open** on any DB error (RPC failure, SELECT failure, exception) — do not change this without a deliberate decision; the comment in `api/_lib/rate-limit.js` explains the reasoning.

### Vercel routing quirks

`vercel.json` routes top-level `/dashboard.html`, `/demo.html`, `/faq.html` etc. to their `public/` paths explicitly, with a catch-all `/(.*)` → `/public/$1`. Adding a new top-level static page generally just works through the catch-all; only add an explicit route if you need a non-default mapping. The `vercel.json#functions.includeFiles` block ensures `apple-token.js` is bundled with `audit.js`. `api/submit-audit.js` has `maxDuration: 60` to cover the synchronous PDF render + email.

## Things to know before editing

- `public/index.html` is ~800KB and `public/audit.html` is ~750KB — they are intentionally single-file pages. Prefer surgical edits; do not reformat or reflow.
- The empty `main` file at the repo root and the empty `api/pages` / `api/scripts` files are placeholders/cruft, not real targets.
- Comments throughout the codebase document **why** decisions were made (fail-open rate limiting, AUTH_UNAVAILABLE semantics, idempotency on `pending`). Read them before changing the surrounding logic.
- **Verify long-form text written to disk via the Read tool, not terminal output.** When generating commit messages, PR bodies, or other multi-line files via the Write tool, terminal display can wrap or reorder long lines in confusing ways — what looks like on-disk corruption is almost always a display artifact in the rendering pipeline between tool output and your terminal. The Read tool returns line-numbered, exact file content directly from disk and is the source of truth. Confirmed twice on 2026-05-13: a PR body and a commit-message file both appeared scrambled in terminal output but were byte-clean on disk.

## Commit & merge conventions

- **No `Co-Authored-By:` trailer on commits.** This includes merge commits. The commit body documents what changed and why — that's the engineering record. Skip the AI-attribution trailer (`Co-Authored-By: Claude …`) entirely. Repo-wide convention as of 2026-05-13.
- **Merge style: `gh pr merge <N> --rebase --delete-branch`.** Rebase preserves linear history; `--delete-branch` keeps the remote tidy and triggers auto-cleanup of the local feature branch on the next fast-forward pull. Do NOT default to local `git merge --no-ff` from main when a PR is open — that creates a merge commit and diverges from the established pattern. If a brief is ambiguous about merge style on an open PR, ASK before merging. Established 2026-05-13 after PR #7 was accidentally merged with `--no-ff` based on extrapolation from earlier non-PR work.
- **Branch protection enforces the gate.** Ruleset id `16344395` on `main` requires the `Run pipeline test` check (from `.github/workflows/pipeline-test.yml`) to pass before merge. Failing PRs cannot be merged through the API or UI without ruleset bypass. Added 2026-05-13.

## Deploy Discipline

NEVER push directly to main for changes that touch Vercel functions.
Always:
1. Branch: git checkout -b feature/<name>
2. Push: git push -u origin <branch>
3. Test against Vercel preview URL with curl (use -L to follow apex 307 redirect, or hit www.royalte.ai directly)
4. Merge to main only after preview returns HTTP 200 and expected JSON

Lesson learned 2026-05-08 — direct push of 9beccad caused 3 min
production outage. Preview deploy would have caught it (apple-music.js
was CJS under "type": "module", failed at module-load time).
Fixed and re-shipped as 5812d14 via preview-tested feature branch.
