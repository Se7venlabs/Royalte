# Platform Duplicate Code Report — ROYALTĒ v3.0 §2 — Discovery

**Status:** DISCOVERY ONLY, companion to `PLATFORM_REFACTORING_DISCOVERY_REPORT.md`. Every entry cites the actual file:line evidence found during the audit; no fixes were applied.

## 1. Duplicate "Constitutional" Implementations (dormant vs. live)

The platform's largest duplication is architectural, not textual: entire ratified subsystems (see `PLATFORM_DEPENDENCY_MAP.md` §2) sit unused while the live pipeline reimplements equivalent functionality independently:

| Concept | Dormant implementation | Live implementation |
|---|---|---|
| Monitoring Intelligence | `monitoring/intelligence/MonitoringIntelligence.js` (257 lines) | `api/_lib/monitoring-intelligence.js` (128 lines) |
| Executive Brief | `api/executive-brief/` (11 files) | `api/_lib/executive-brief-engine.js` |
| Scan pipeline execution | `api/orchestrator/` (9 files, stub executors) | `api/_lib/run-scan.js` (1,739 lines) |
| MLC publishing acquisition | `lib/publishing/resolver.js` + `lib/publishing/providers/mlc-resolver.js` (reimplements OAuth token exchange: same `MLC_BASE`, same `TOKEN_PATH`, same body shape as the live client, at `mlc-resolver.js:39` `acquireBearer()`) | `lib/publishing/mlc-client.js` (`fetchMlcWorksByArtist`, `TOKEN_PATH='/oauth/token'`) |

## 2. `deepFreeze()` — reimplemented independently in ~20 files

No shared utility exists; every engine wrote its own copy:

`api/_lib/intelligence-engine.js:94`, `api/_lib/health-engine.js:63`, `api/_lib/backend-intelligence.js:89`, `api/_lib/territory-intelligence.js:55`, `api/_lib/cio-assembler.js:67`, `api/_lib/global-music-footprint.js:105`, `api/_lib/royalte-ai-assembler.js:58`, `api/_lib/publishing-intelligence.js:137`, `api/_lib/monitoring-intelligence.js:59`, `api/_lib/catalog-intelligence.js:95`, `api/_lib/identity-intelligence.js:147`, `api/_lib/executive-brief-engine.js:85`, `lib/rie/certify.js:16`, `provider-acquisition/registry/EngineProviderRegistry.js:128`, plus 6 more across `api/rules/`, `api/mission-control-api/`, `api/monitoring/`, `api/athena/`.

This is the same pattern that caused the Board-documented `deepFreeze` array-skipping bug in `backend-intelligence.js` during Phase 3.5 — each copy can drift independently, and evidently already has: `api/normalization/` and `api/resolution/` (Sprint 4/5) use only shallow `Object.freeze()` (`api/resolution/pipeline.js:216`, `api/normalization/normalized-record.js:57`) while every live `api/_lib/*` engine deep-freezes. Two "freeze the output" conventions exist platform-wide with no single owner.

## 3. `assert()` test helper — reimplemented ~18 times with incompatible signatures

Argument order flips between files, a genuine copy-paste hazard beyond simple repetition:

- `assert(condition, label)`: `tests/best-verified-release-test.mjs:18`, `tests/monitoring-engine-test.mjs:10`, `tests/orchestrator-test.mjs:9`, `tests/resolution-engine-test.mjs:10`
- `assert(label, condition, detail)`: `tests/evidence-contracts-test.mjs:41`, `tests/registry-test.mjs:47`, `tests/workspace-contract-validator.test.mjs:20`
- `assert(name, cond)`: `tests/engine-provider-registry-test.mjs:25`, `tests/territory-scan-test.mjs:25`
- `const assert = (cond, msg) =>`: `tests/delta-engine-test.mjs:53`, `tests/pipeline-test.mjs:202`, `tests/v2-health-score-test.mjs:7`

## 4. Supabase client bootstrap — 7 independent copies

`api/claim-scan.js:23-26`, `api/audit.js:52-55`, `api/founding-artist-count.js:48-54`, `api/health.js:24-36`, `api/territory-scan.js:46-49`, `api/submit-audit.js:18-21`, `api/save-music-rights-profile.js:33-36` — each hand-rolls `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, ...)` with inconsistent options (`{auth: {persistSession: false}}` in 3 files, bare in 4). No shared `api/_lib/supabase-client.js` exists. `api/submit-audit.js:8` literally comments *"Mirrors Supabase client setup from api/territory-scan.js"* — confirming the copy-paste lineage, notably from a file (`territory-scan.js`) that is itself dead code (see `PLATFORM_DEAD_CODE_REPORT.md`).

## 5. CORS headers — hand-rolled per-handler, inconsistently applied

Identical 3-line `res.setHeader('Access-Control-Allow-*', ...)` block duplicated with varying allowed-methods lists in `api/audit.js:204-206`, `api/founding-artist-count.js:21-23`, `api/identify.js:192-194`, `api/submit-audit.js:131-133`, `api/territory-scan.js:107-109`. Meanwhile `apple-music.js`, `apple-token.js`, `claim-scan.js`, `discogs.js`, `health.js`, `mlc-test.js`, `resolve-artist.js`, `save-music-rights-profile.js`, `tidal-token.js` set no CORS headers at all — an unexplained split across otherwise-similar handlers, not obviously intentional.

## 6. PAL connectors — 12 independent HTTP retry/backoff implementations

No shared base module. Each `provider-acquisition/connectors/*/​*-http.js` reimplements `AbortController` timeout + exponential-backoff-with-jitter + `Retry-After` handling from scratch: `spotify-http.js:12-15`, `deezer-http.js:18-21`, `apple-http.js:13-16`, `audiodb-http.js:19-22`, `lastfm-http.js:22-25`, `tidal-http.js:19-22`, `discogs-http.js:17-20`, `mb-http.js:18-21`, `mlc-http.js:23-26`, `youtube-http.js:17-20`, `acr-http.js:32-35`, `acr-ai-http.js:20-23`.

Constants (`DEFAULT_TIMEOUT_MS`, `MAX_RETRIES`, `INITIAL_BACKOFF_MS`, `MAX_BACKOFF_MS`) drift independently between connectors — e.g. MusicBrainz backoff `1_100`ms vs. Spotify `500`ms — with no shared config surface, meaning a platform-wide policy change (e.g. a global retry cap) currently requires editing all 12 files individually. `acrcloud/acr-http.js:145-165` and `acrcloud-ai-detection/acr-ai-http.js:156-165` additionally duplicate `jitteredBackoff()`, `safeText()`, and `sleep()` helpers verbatim between two files in the same connector family.

## 7. KPI card UI component — reimplemented instead of shared

`public/css/royalte-workspace.css:1349` defines the shared `.hi-kpi-card` base, used consistently by `identity-intelligence.html:264`, `publishing-intelligence.html:625/647/661`, `backend-intelligence.html`, and `health-intelligence.html`. But `catalog-intelligence.html:87-612` embeds its own `<style>` block that fully reimplements the same visual component under a `ci-*` prefix — `.ci-kpi-card` (161), `.ci-kpi-icon-wrap` (170), `.ci-kpi-label` (182), `.ci-kpi-value-row` (190), `.ci-kpi-big` (195), `.ci-kpi-badge` (212), `.ci-kpi-caption` (226) — never referencing `.hi-kpi-card` at all (`grep -c "hi-kpi-card" catalog-intelligence.html` → 0).

Separately, `.hi-kpi-card` and `.hi-kpi-card--score` are each declared twice in the *same* shared file, at non-adjacent lines: base card at `:1349` and `:2235`; `--score` variant at `:1361` and `:2229`. Not a functional bug (CSS rules merge), but signals the 228 KB stylesheet has grown by append rather than in-place edit.

## 8. Env var fallback drift

`RESEND_API_KEY` is read bare in production code (`api/health.js:45`, `api/resolve-artist.js:78`, `api/submit-audit.js:88`), but two `scripts/` files fall back to a second, undocumented name: `process.env.RESEND_API_KEY || process.env.RESEND_KEY` (`scripts/auth-platform-fix.js:35`, `scripts/check-smtp-prereqs.js:47`), while `scripts/smtp-full-test.js:27` reads only `RESEND_API_KEY`. `RESEND_KEY` is not documented anywhere in CLAUDE.md.

## 9. Two unrelated systems both called "the registry"

Not a code duplication, but a naming collision risk flagged for the Refactoring Summary: `provider-acquisition/registry/` (PAL) vs. `api/registry/` (Canonical Field Registry). See `PLATFORM_DEPENDENCY_MAP.md` §4.
