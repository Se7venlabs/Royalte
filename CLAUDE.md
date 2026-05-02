# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Generate an audit PDF**: `python3 generate_audit_pdf.py --payload scan.json --theme {brand|print} --out report.pdf`. The script validates the input against its Pydantic mirror of the canonical schema and refuses to render on any drift.

## Required environment variables

Set in Vercel project settings (and locally in `.env` for `vercel dev`):

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Internal auth: `INTERNAL_API_SECRET` (gates `/api/process-audit`)
- Apple Music JWT: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (full `.p8` contents; literal `\n` accepted)
- Third-party APIs: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `LASTFM_API_KEY`, `TIDAL_CLIENT_ID`, `TIDAL_CLIENT_SECRET`, `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, `DISCOGS_USER_AGENT`

Modules degrade gracefully when keys are missing — see "AUTH_UNAVAILABLE" below.

## Architecture

### Audit request lifecycle (3 endpoints, async)

1. **`POST /api/submit-audit`** — landing page form posts here. Inserts a `pending` row into Supabase `audit_requests`, then **fire-and-forgets** a `POST` to `/api/process-audit` (does not await). Response returns immediately to the user.
2. **`POST /api/process-audit`** — protected by `INTERNAL_API_SECRET` (`x-internal-secret` header, verified via `api/_lib/rate-limit.js#verifyInternalSecret`). Idempotent on `status === 'pending'`. Flips row to `processing`, calls `runAudit()` from `api/audit.js`, then writes a trimmed `result_payload` (see `buildSummary`) and flips to `completed` or `failed`.
3. **`GET /api/audit?url=...`** — synchronous engine endpoint used directly by the live site preview. Same engine code path as step 2.

`api/process-audit.js` imports `runAudit` from `./audit.js`, so any refactor of `api/audit.js` must keep that named export available alongside the default `handler`.

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

`api/_lib/rate-limit.js` provides `extractIp`, `checkBlocked`, `checkRateLimit`, `recordViolation` against Supabase tables `rate_limits` and `blocked_ips`. Three sliding windows: 10-second burst, hour, day. Policy is **fail-open** on DB errors — do not change this without a deliberate decision; the comment in the file explains the reasoning.

### Vercel routing quirks

`vercel.json` routes top-level `/dashboard.html`, `/demo.html`, `/faq.html` etc. to their `public/` paths explicitly, with a catch-all `/(.*)` → `/public/$1`. Adding a new top-level static page generally just works through the catch-all; only add an explicit route if you need a non-default mapping. The `vercel.json#functions.includeFiles` block ensures `apple-token.js` is bundled with `audit.js` and `process-audit.js`.

## Things to know before editing

- `public/index.html` is ~800KB and `public/audit.html` is ~750KB — they are intentionally single-file pages. Prefer surgical edits; do not reformat or reflow.
- The empty `main` file at the repo root and the empty `api/pages` / `api/scripts` files are placeholders/cruft, not real targets.
- Comments throughout the codebase document **why** decisions were made (fail-open rate limiting, AUTH_UNAVAILABLE semantics, idempotency on `pending`). Read them before changing the surrounding logic.
