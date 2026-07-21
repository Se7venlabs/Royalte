# Royaltē Changelog

**Status:** append-only architectural history of every merge into `main`.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.

Format follows the spirit of [Keep a Changelog](https://keepachangelog.com), adapted for the Board's required fields:

- **Date** — date of merge into `main`
- **PR Number** — GitHub pull request
- **Commit SHA** — short merge SHA on `main`
- **Added** — files / capabilities introduced
- **Changed** — files / behaviour modified
- **Removed** — files / capabilities retired
- **Constitution Version** — Constitution at the moment of merge

Entries are listed **newest first** for ease of catching up. Older entries are never edited; corrections are appended.

The Phase 1 probe iterations (PRs #123, #124, #125) are listed individually because each landed a distinct architectural improvement.

---

## 2026-07-21 — Catalog Intelligence™ — ISRC Intelligence™ v1 (PR #393)

| | |
|---|---|
| **Date** | 2026-07-21 |
| **PR Number** | #393 |
| **Commit SHA** | `fd70bcd` |
| **Tag** | `isrc-intelligence-v1.0` |
| **Added** | `api/_lib/isrc-intelligence.js` (new domain assembler — `assembleIsrcIntelligence()`, sole owner of ISRC Intelligence™ v1 business logic). `EvidenceBridge.js`: `translateAppleTracks()`. `catalog-evidence.js`: `appleTracks[]` / `appleTracksAssessed`. ISRC Intelligence™, ATHENA Executive Insight™, and Catalog Timeline™ cards on `catalog-intelligence.html`. `governance/ISRC_INTELLIGENCE_V1_EXECUTIVE_REVIEW.md` (Executive Review Package). |
| **Changed** | `apple-pal-acquisition.js`: `Capability.TRACKS` added to the existing parallel evidence batch. `AppleMusicConnector.js`: `#fetchArtistTracks()` limit corrected `25 → 20` (production defect found and fixed via live validation — see review package §14). `catalog-intelligence.js`: `isrcIntelligence` replaces `isrcCoverage` in the output shape (`v1.2.0 → v1.3.0`). `mission-control-renderers.js`, `mc-workspace-context.js`, `public/index.html`: updated to the new field name/shape. |
| **Removed** | `assembleIsrcCoverage()`, `deriveIsrcStatus()`, `ISRC_THRESHOLDS`, `ISRC_UNKNOWN` from `catalog-intelligence.js` — the permanent-null `catalogComparison` stub path this initiative replaces. |
| **Constitution Version** | v1.3 (Board Amendment) |

Version 1 scope: single authoritative evidence source (Apple Music
`Capability.TRACKS`, the artist's own official catalog). No cross-provider
reconciliation, no conflict detection (`conflictState` is a typed
placeholder, always `NOT_APPLICABLE`), no inferred relationships. Live
production-validated post-merge (Michael Jackson, Adele — real scans on
`royalte.ai`, `ASSESSED_COMPLETE` 20/20 both, zero console errors, no
regressions in Identity Intelligence™, Publishing Intelligence™, or Global
Music Footprint™). Version 2 roadmap (multi-provider reconciliation, real
conflict detection, recording equivalency/version classification) is
documented only — not implemented.

---

## 2026-07-12 — Mission Control™ v2.0 Sprint 9 — Mission Control Data API™ (PR #318)

| | |
|---|---|
| **Date** | 2026-07-12 |
| **PR Number** | #318 |
| **Commit SHA** | `4047311` |
| **Tag** | `mission-control-api-v1.0` |
| **Added** | `api/mission-control-api/` (10 source files + `MISSION_CONTROL_API.md`): `version.js`, `types.js`, `schemas.js`, `registry.js`, `responses.js`, `serialization.js`, `validation.js`, `routes.js`, `index.js`. `tests/mission-control-api-test.mjs` (136 assertions / 20 sections / 0 failures). |
| **Changed** | Nothing. Sprint 9 is additive only. |
| **Removed** | Nothing. |
| **Constitution Version** | v1.3 |

---

## 2026-07-12 — Governance Reconciliation — Sprint 6 Canonical Intelligence Domains™

| | |
|---|---|
| **Date** | 2026-07-12 |
| **Type** | Governance Reconciliation — historical clarification of Sprint 6 implementation and constitutional ratification |
| **PR Number** | — (governance reconciliation; no code changes) |
| **Commit SHA** | — |
| **Tag** | — |
| **Added** | Sprint 6 governance entries in ROADMAP.md, BOARD_DECISIONS.md, CHANGELOG.md, AGENT_MEMORY.md. |
| **Changed** | ROADMAP.md: Sprint 6 row inserted between Sprint 5 and Sprint 7, marked ✅ Complete. AGENT_MEMORY.md: Sprint 6 lock point added to phase ledger. BOARD_DECISIONS.md: Governance reconciliation entry added. |
| **Removed** | Nothing. |
| **Constitution Version** | v1.3 |
| **Note** | The Canonical Intelligence Domains™ were implemented during the expanded Canonical Registry Foundation™ (Sprint 1, PR #303, `a902da7`). Sprint 6 constitutionally ratifies that architecture. No separate engineering implementation was required. No source code was modified by this reconciliation. |

---

## 2026-07-12 — Mission Control™ v2.0 Sprint 8 — Monitoring & Change Detection™ (PR #315)

| | |
|---|---|
| **Date** | 2026-07-12 |
| **PR Number** | #315 |
| **Commit SHA** | `1317f07` |
| **Tag** | `monitoring-engine-v1.0` |
| **Added** | `api/monitoring/` (12 source files + `MONITORING_ENGINE.md`): `version.js`, `types.js`, `severity.js`, `snapshots.js`, `change-engine.js`, `events.js`, `timeline.js`, `alerts.js`, `history.js`, `validate.js`, `index.js`. `tests/monitoring-engine-test.mjs` (182 assertions / 25 sections / 0 failures). |
| **Changed** | Nothing. Sprint 8 is additive only. |
| **Removed** | Nothing. |
| **Constitution Version** | v1.3 |

---

## 2026-07-12 — Mission Control™ v2.0 Sprint 7 — Scan Orchestrator™ (PR #313)

| | |
|---|---|
| **PR** | #313 |
| **Commit SHA** | `8a4aa19` |
| **Tag** | `scan-orchestrator-sprint7-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `api/orchestrator/version.js` — `ORCHESTRATOR_VERSION`. `api/orchestrator/types.js` — `LIFECYCLE_STAGES` (11 states), `SCAN_STATUSES`, `ORCHESTRATOR_EVENTS` (17 events), `ORCHESTRATOR_ERROR_CODES`, `LIFECYCLE_STAGE_ORDER`, `TERMINAL_STAGES`, `STAGE_EXECUTOR_MAP`, `EXECUTOR_KEYS`. `api/orchestrator/lifecycle.js` — Scan Lifecycle™: `VALID_TRANSITIONS`, `isValidTransition`, `isTerminalStage`, `deriveStatus`. `api/orchestrator/state.js` — Scan State™: `createScanState`, `transitionState`, `markCancelRequested`; every transition produces a new deep-frozen state. `api/orchestrator/events.js` — Event System™: `createEventEmitter` (specific + wildcard `*` subscriptions); `createScanEvent` frozen event factory. `api/orchestrator/queue.js` — Scan Queue™: scanId-indexed state store; `pending()` / `running()` / `completed()` / `failed()` filters; cancel flag. `api/orchestrator/scheduler.js` — Scan Scheduler™: configurable `maxConcurrentScans`; `markStarted` / `markCompleted`; throws at capacity. `api/orchestrator/pipeline.js` — Pipeline Coordinator™: 5-stage `executePipeline` with per-stage timeout (`withTimeout`), cancellation checkpoint before each stage, distinct error codes per failure type. `api/orchestrator/validate.js` — `validateScanRequest` / `validateStageExecutors` / `validatePipelineOrder` / `validateLifecycleTransition` / `validateScanState`. `api/orchestrator/index.js` — `SCAN_ORCHESTRATOR` singleton + `createScanOrchestrator` factory; `DEFAULT_STAGE_EXECUTORS` stubs defining interfaces for Sprint 3/4/5/6 wiring. `api/orchestrator/ORCHESTRATOR.md` — full architectural documentation. `tests/orchestrator-test.mjs` — 194 assertions / 25 sections / 0 failures. |
| **Changed** | Nothing. Sprint 7 is additive only. |
| **Removed** | Nothing. |

---

## 2026-07-12 — Mission Control™ v2.0 Sprint 5 — Evidence Resolution Engine™ (PR #311)

| | |
|---|---|
| **PR** | #311 |
| **Commit SHA** | `8c7fb5f` |
| **Tag** | `resolution-engine-sprint5-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `api/resolution/version.js` — `RESOLUTION_ENGINE_VERSION`. `api/resolution/types.js` — `CONFLICT_TYPES`, `CONFIDENCE_LEVELS`, `RESOLUTION_RULES`, `POLICY_STATUSES`, `RESOLUTION_ERROR_CODES`. `api/resolution/registry.js` — `createResolutionRegistry` + `assertPolicyInterface` (startup integrity check; broken registry = startup failure). `api/resolution/policies.js` — 10 default Sprint 5 policies (artistName, artistId, recordLabel, genre, releaseDate, trackCount, isrc, upc, sourceUrl, DEFAULT). `api/resolution/confidence.js` — Confidence Engine™: deterministic `providerPriorityScore × agreementMultiplier` formula; Board-locked scores per rank and conflict type. `api/resolution/conflicts.js` — Conflict Detection™: `ALL_AGREE / PARTIAL_AGREEMENT / CONFLICT / SINGLE_SOURCE / NO_DATA` classification with full conflicting-pair registry. `api/resolution/provenance.js` — `createFieldProvenance` — permanent audit record of every canonical selection (selectedProvider, supportingProviders, conflictingProviders, resolutionRule, confidence, conflictType). `api/resolution/resolution-record.js` — `createResolutionRecord` — immutable constitutional output artifact. `api/resolution/manifest.js` — `createResolutionManifest` — immutable audit companion; cross-linked to Resolution Record and Field Provenance. `api/resolution/pipeline.js` — `resolveField` / `resolveManyFields` / `resolveAllFields`; stateless; deterministic; never throws; never mutates inputs. `api/resolution/validate.js` — `validatePolicy` / `validateResolutionRecord` / `validateResolutionManifest` / `validateNormalizedRecords`. `api/resolution/index.js` — `RESOLUTION_ENGINE` singleton + `createResolutionEngine` factory; full public API. `api/resolution/RESOLUTION_ENGINE.md` — full architectural documentation. `tests/resolution-engine-test.mjs` — 131 assertions / 25 sections / 0 failures. |
| **Changed** | Nothing. Sprint 5 is additive only. |
| **Removed** | Nothing. |

---

## 2026-07-11 — Identity Intelligence™ Workspace 2 — Data Integrity Program™ Validation + Single Source of Truth Architecture (PR #299)

| | |
|---|---|
| **PR** | #299 |
| **Commit SHA** | `500a3b4` (source fixes) · `0680561` (single source of truth architecture) |
| **Constitution Version** | v1.3 |
| **Added** | `public/fixtures/canonical-black-alternative.json` — sole fetchable canonical fixture for Black Alternative; served at `/fixtures/canonical-black-alternative.json` via Vercel catch-all. |
| **Changed** | `public/workspaces/identity-intelligence.html` — (1) dev loader refactored from inline JS object to `fetch('/fixtures/canonical-black-alternative.json')`; (2) platform cards: PROV_NAMES extended to cover Deezer + TIDAL; providers outside `identityIntelligence.providers` v1.0 scope default to `UNABLE_TO_CONFIRM` (muted badge, `—` confidence); `ALERT_STATES` drives `ii-platform-card--alert` class; (3) snapshot: null-guards for `subject.trackTitle`, `subject.trackIsrc`, `subject.albumName`; Primary Release wired to `catalogIntelligence.bestVerifiedRelease.releaseTitle`; Genres falls through to `—` when `metrics.genres` is empty; (4) artist name fallback order corrected. `governance/AGENT_MEMORY.md`, `governance/CANONICAL_VALIDATION_REPORT.md`, `governance/BOARD_DECISIONS.md` — fixture path references updated from `api/fixtures/` to `public/fixtures/`. |
| **Removed** | `api/fixtures/canonical-black-alternative.json` — file relocated to `public/fixtures/`; zero backend/test consumers confirmed by dependency audit. Inline Black Alternative JavaScript object removed from workspace dev loader. |

---

## 2026-07-11 — Mission Control™ Canonical Validation Report™ v1.0 (PR #297)

| | |
|---|---|
| **PR** | #297 |
| **Commit SHA** | `6c52407` |
| **Constitution Version** | v1.3 |
| **Added** | `governance/CANONICAL_VALIDATION_REPORT.md` — required engineering artifact per Board directive. 9-workspace validation against Black Alternative's live scan (Health Score 90, grade B). Sections: Executive Summary, Canonical Artist Profile, Data Lineage, per-workspace validation tables with sign-offs, Variance Register (3 resolved), Board Decision Register (2 open). Living document. |
| **Changed** | `governance/AGENT_MEMORY.md` — Data Integrity Program™ noted as active initiative; phase pointer updated; AGENT_MEMORY now references the CVR and canonical fixture. |
| **Removed** | Nothing. |

---

## 2026-07-11 — Data Integrity Program™ Phase 1 — Executive Brief Engine™ Source Fixes + BA Fixture (PR #295)

| | |
|---|---|
| **PR** | #295 |
| **Commit SHA** | `8989e88` |
| **Constitution Version** | v1.3 |
| **Added** | `public/fixtures/canonical-black-alternative.json` — Canonical Development Artist™ reference fixture (live scan: Health Score 90, grade B, 1 strength, 0 risks, 156 Apple Music territories, 4 singles). |
| **Changed** | `api/_lib/executive-brief-engine.js` — three text-quality bugs fixed at source: (1) subject-verb agreement for singular strength count (`reinforce` → `reinforces`); (2) zero-recommendation guard in `buildLongTermClause` for grade B — no longer produces "executing the 0 priority recommendations"; (3) no-risk sentence in `buildAiExecutiveInsight` — grammatically broken "The primary area requiring executive attention is no material risks at this time" replaced with clean "No material risks have been identified in the current assessment." |
| **Removed** | Nothing. |

---

## 2026-07-10 — Royaltē AI™ Intelligence Wiring Phase 1B.3 — Demo Placeholder Removal + CWA™ Wiring (PR #293)

| | |
|---|---|
| **PR** | #293 |
| **Commit SHA** | `9b5e648` |
| **Constitution Version** | v1.3 |
| **Added** | Three-state rendering lifecycle for `#ai-rec-grid` and `#ai-priorities-list`: loading (animated dot pulse) → live intelligence (§4 Render writes innerHTML) or truthful empty state. Cleanup IIFE for no-session-context path ("Navigate to Mission Control™ to run a scan"). Inline loading/empty-state CSS in `<head>`. Validation harness `/tmp/validate-ai-wiring.mjs` rebuilt to production-equivalent using `new Function('window', 'sessionStorage', utilsSrc)` pattern — harness failures ([H]) separated from production failures ([P]). |
| **Changed** | `public/workspaces/ai-insights.html` — full Canonical Workspace Architecture™ rewrite (§1 Context → §2 Intelligence → §3 Presentation → §4 Render). Cross-module synthesis across 8 intelligence sources (`royalteAI`, `healthIntelligence`, `healthReport`, `executiveBrief`, `identityIntelligence`, `publishingIntelligence`, `globalMusicFootprint`, `monitoringIntelligence`). `presentationModel` bakes empty-state HTML so §4 always has valid content. |
| **Removed** | 4 hardcoded rec cards: "Publishing Administrator Missing", "Expand into Germany & Brazil", "Claim YouTube Official Artist Channel", "Register Missing MusicBrainz ID". 5 hardcoded priority rows: "Assign Publishing Administrator", "Register PRO & SoundExchange", "Claim YouTube Official Artist Channel", "Initiate Germany & Brazil Market Expansion", "Register MusicBrainz Identity Record". |

---

## 2026-07-03 — Executive Image Service™ — Platform-Agnostic Image Selection (PR #228)

| | |
|---|---|
| **PR** | #228 |
| **Commit SHA** | `7127bc0` |
| **Constitution Version** | v1.3 |
| **Added** | `api/_lib/image-service.js` — sole backend owner of image source selection. `getBestVerifiedArtistImage(resolved, artistData, appleMusicData)`: Apple-first per Canonical Identity Architecture; Spotify as verified fallback; extensible to future providers. `getBestVerifiedReleaseArtwork(trackData, resolved)`: album images first; Apple fallback. `public/js/royalte-image-service.js` — sole frontend owner. Reads canonical payload fields only (`cio.identity.artwork`, `albumImageUrl`, `subject.artistImageUrl`). `.royalte-exec-img` CSS standard class (80×80 px, `border-radius: 8px`, `object-fit: cover`) + `--artist` (circular) and `--artwork` (6px) variants. |
| **Changed** | `api/_lib/run-scan.js` — `imageUrl`, `artistImageUrl`, `albumImageUrl` inline platform-specific chains replaced with `getBestVerifiedArtistImage` / `getBestVerifiedReleaseArtwork` calls. Apple-path `artistImage` in `resolveToArtist()` return replaced with image service call. `appleArtworkUrl` preserved as passthrough field. |
| **Removed** | Inline platform-specific image selection logic from `run-scan.js` (three inline chains referencing `artistData.images`, `resolved.appleArtworkUrl`, `trackData.album.images` directly). |

---

## 2026-07-03 — Reporting Time Zone™ — MC System Status™ + Dynamic tz Detection (PR #226)

| | |
|---|---|
| **PR** | #226 |
| **Commit SHA** | `6efd9e2` |
| **Constitution Version** | v1.3 |
| **Added** | `public/js/royalte-tz.js` — sole owner of RTZ detection, storage, and DOM rendering. Resolution: `profiles.reporting_timezone` → `localStorage` → browser `Intl.DateTimeFormat` auto-detect. IANA zone persisted on first detection; abbreviation derived live (DST-aware). `supabase/migrations/20260703000000_reporting_timezone.sql` — `profiles.reporting_timezone text DEFAULT NULL`. MC `mc-es-rtz-*` CSS block (Ice Blue™ `#7dd3fc`) in inline style. RTZ HTML row (`data-mc-rtz-abbr`) in `mc-es-cell--status`. |
| **Changed** | `public/mission-control.html` — Section 6 renamed from "Monitoring Status" to **System Status™**; RTZ divider + clock + abbreviation + "Reporting Time Zone™" + "System Time Synced ✓" appended. `public/js/mission-control.js` — imports `initRtz`; called on DOMContentLoaded independent of scan payload. |
| **Removed** | Orphaned `hi-panel-section--system` + `hi-sys-*` + `rtz-*` CSS from `royalte-workspace.css`. System Status™ HTML block from `health-intelligence.html`, `identity-intelligence.html`, `publishing-intelligence.html` (Amendment #004 correction). |

---

## 2026-07-03 — Publishing Intelligence™ Workspace — Phase 1 + Amendments #001/#002 (PR #224)

| | |
|---|---|
| **PR** | #224 |
| **Commit SHA** | `cdd4fda` |
| **Constitution Version** | v1.3 |
| **Added** | `public/workspaces/publishing-intelligence.html` — full Publishing Intelligence™ Executive Workspace: Royal Violet (`#7c3aed`), system-focused header (no artist avatar), Potential Royalty Impact™ Executive Signature™ (three-state amber-pulse risk indicator), 4 KPI cards, 6 Core Publishing System cards (The MLC / Songtrust / Music Reports / Publisher / ISWC Coverage™ / Rights Ownership™). `public/css/royalte-workspace.css` — `pi-*` CSS namespace (5 blocks, ~237 lines) + `ws-dept--publishing` ambient glow. |
| **Changed** | `public/workspaces/publishing-intelligence.html` — Board Amendment #001: PRO + Harry Fox replaced with ISWC Coverage™ + Songwriter Splits™. Board Amendment #002: Songwriter Splits™ replaced by Rights Ownership™; canonical 6-card order locked. |
| **Removed** | PRO and Harry Fox Agency cards (replaced by ISWC Coverage™ and Rights Ownership™ per Amendments #001/#002). |

---

## 2026-07-03 — Ambient Module Elevation™ + Identity Intelligence™ Workspace (PR #222)

| | |
|---|---|
| **PR** | #222 |
| **Commit SHA** | `c43f431` (Identity workspace) · `96a8dc5` (Ambient Module Elevation™) |
| **Constitution Version** | v1.3 |
| **Added** | `public/css/royalte-workspace.css` — `ii-*` CSS namespace in 5 blocks: exec header, coverage ring + KPI numbers, platform cards, Identity Snapshot™ + Activity™, responsive rules (~270 lines). Ambient Module Elevation™ system: `.ws-dept--health` (emerald, ~30 lines) + `.ws-dept--identity` (purple, ~30 lines) scoped glow rules. `public/workspaces/identity-intelligence.html` — full Executive Workspace: artist avatar header, Identity Coverage™ ring (one-time fill animation), 4 KPI cards, 6 platform navigation cards, Identity Snapshot™, Identity Activity™, right exec panel (AI Identity Summary™ + Top Priority™ + Identity Status™), count-up JS. |
| **Changed** | `public/workspaces/health-intelligence.html` — `ws-dept--health` added to `ws-shell`. `public/workspaces/identity-intelligence.html` — `ws-dept--identity` added to `ws-shell`. |
| **Removed** | Legacy MC card stub content in `identity-intelligence.html` (mc-card / mc-id-body / mc-id-* structure). |

---

## 2026-07-03 — Sprint 3.4 Amendment 2 — Publishing Intelligence™ Executive Layout Refinement (PR #216)

| | |
|---|---|
| **PR** | #216 |
| **Commit SHA** | `8400134` |
| **Constitution Version** | v1.3 |
| **Changed** | `public/mission-control.html` CSS only: `.mc-pi-impact` padding 8px → 10px/12px; `.mc-pi-impact-body` 11px → 12.5px weight-500 `var(--mc-text)` (explanation is dominant); royalty/resolution labels 8.5px → 8px fully muted; badge 10px → 9px with reduced padding; `.mc-pi-risk` / `.mc-pi-win` padding 8px → 6px/8px, icon 13px → 11px, title 11.5px → 11px, resolution 10px → 9.5px. |

---

## 2026-07-03 — Sprint 3.4 — Publishing Intelligence™ Executive Passport + Amendment (PR #215)

| | |
|---|---|
| **PR** | #215 |
| **Commit SHA** | `7f52f4f` (Sprint 3.4) · `2bb1af2` (Amendment) |
| **Constitution Version** | v1.3 |
| **Added** | `public/mission-control.html` — `mc-pi-*` CSS (~175 lines); 7-section `mc-pi-body` HTML with `data-mc-pi-*` attributes; `mc-pi-impact-royalty-label` / `mc-pi-impact-resolution-label` / `mc-pi-impact-resolution-val` label styles (Amendment). `public/js/mission-control.js` — `_PI_COVERAGE_GRADE`, `_PI_STATE_PILL`, `_PI_RESOLUTION_TIME`, `_piFinancialImpact` helpers; `buildPublishingIntelligencePlan(payload)` and `applyPublishingIntelligencePlan(plan)`. |
| **Changed** | `public/js/mission-control.js` — `__mcPopulate` stores `_vaultPlans.piPlan`; `__mcRevealModule 'publishing-intelligence'` calls `applyPublishingIntelligencePlan` + 1200ms count-up; ring code retired. `_piFinancialImpact` updated (Amendment) to return fuller body copy and `resolution` time. `applyPublishingIntelligencePlan` writes `data-mc-pi-impact-resolution`. `public/js/vault-auth.js` — `_blankSentinelData` updated to blank `data-mc-pi-*` + `data-mc-pi-impact-resolution` targets. |
| **Removed** | Legacy `mc-pub-body` (ring + coverage summary), `mc-pub-checks` (flat metric list), `mc-card-foot` empty div, and associated JS ring-fill code in `__mcRevealModule`. |

---

## 2026-07-03 — Sprint 3.3 — Identity Intelligence™ Executive Passport (PR #213)

| | |
|---|---|
| **PR** | #213 |
| **Commit SHA** | `654eb52` |
| **Constitution Version** | v1.3 |
| **Added** | `public/mission-control.html` — `mc-id-*` CSS (~140 lines); 6-section `mc-id-body` HTML with `data-mc-id-*` attributes covering all 6 sections. `public/js/mission-control.js` — `_ID_COVERAGE_GRADE`, `_ID_STATE_PILL`, `_idPlatformPill`, `_idSeverityLabel` helpers; `buildIdentityIntelligencePlan(payload)` and `applyIdentityIntelligencePlan(plan)`. |
| **Changed** | `public/js/mission-control.js` — `__mcPopulate` stores `_vaultPlans.idPlan`; `__mcRevealModule 'identity-intelligence'` calls `applyIdentityIntelligencePlan` + 1200ms count-up; fingerprint ring code retired. Legacy `identityCoverage`/`identityProviders` plans preserved for ai-insights. `public/js/vault-auth.js` — `_blankSentinelData` updated to blank `data-mc-id-*` targets; old `data-mc-identity-*` sentinel code retired. |
| **Removed** | Legacy `mc-identity-body` (fingerprint ring), `mc-identity-checks` (provider checklist), `mc-card-foot` empty div, and associated JS calls (`applyCoveragePlan`, `applyProvidersPlan`, `applyDeezerStatus`, `applyTidalStatus`, `applyDeezerTopTrack` for the identity module reveal). |

---

## 2026-07-03 — Sprint 3.2 + Executive Layout Optimization™ v1.0 (PR #211)

| | |
|---|---|
| **PR** | #211 |
| **Commit SHA** | `83c8804` (Executive Layout Optimization™) · `346a2d0` (Sprint 3.2) |
| **Constitution Version** | v1.3 |
| **Added** | `public/mission-control.html` — `mc-hi-*` CSS (~160 lines); 6-section Health Intelligence™ HTML with `data-mc-hi-*` attributes; `_HI_DOT_THRESHOLDS`, `_hiDotClass`, `_hiTrendDir`, `_hiTrendLabel`, `_hiBestImprovement`, `_hiBiggestRisk`, `_hiRecentChanges` helpers. `public/js/mission-control.js` — `buildHealthIntelligencePlan(payload, plans)` and `applyHealthIntelligencePlan(plan)`. |
| **Changed** | `public/js/mission-control.js` — `__mcPopulate` stores `_vaultPlans.hiPlan`; `__mcRevealModule 'health-intelligence'` calls `applyHealthIntelligencePlan` + 1500ms count-up. `public/js/vault-auth.js` — `_blankSentinelData` updated to blank `data-mc-hi-*` targets. `public/mission-control.html` — Executive Layout Optimization™: title 36→24px, radar 130→90px, hero cell/health padding compressed, Health card body gap 14→8px, breakdown 2-col grid, sparkline inline flex, section padding-bottoms 14→8px, score num 40→32px. |
| **Removed** | Old `applyHealthPlan` legacy (no-op comment). Old `data-mc-health-*` blank targets in vault-auth.js. |

---

## 2026-07-03 — Phase 3.6 Deezer — Streaming Verification Authority™ PAL Production Migration™

| | |
|---|---|
| **PR** | #201 |
| **Commit SHA** | `ba66b26` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/deezer/DeezerConnector.js` — 6 capabilities; no credentials; `authenticate()` returns AVAILABLE after `initialize()` with no network call. `provider-acquisition/connectors/deezer/deezer-http.js` — GET-only HTTP client; Deezer-specific 200-with-body-error detection; 429/5xx retry/backoff. `provider-acquisition/connectors/deezer/deezer-capabilities.js` — frozen capability declaration (ARTIST_IDENTITY, ALBUMS, TRACKS, ISRC, ARTWORK, GENRES). `api/_lib/deezer-pal-acquisition.js` — sequential A→B acquisition; `synthesizeDeezerCompat` reproduces the exact legacy `getDeezer()` output shape. `tests/certification/suites/11-deezer-connector.mjs` — 67-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateDeezerArtistIdentity`, `translateDeezerAlbums`, `translateDeezerTopTracks`; `platforms.deezer.isrcs[]` is the constitutional bridge for future Verification Intelligence™; genres aggregated at `platforms.deezer.genres[]`; raw genre objects preserved in `albums[].genres.data`. `api/_lib/run-scan.js` — Deezer added as 7th PAL provider; legacy `getDeezer()` direct-call retired. `tests/certification/harness.mjs` — Suite 11 wired. |
| **Removed** | `getDeezer()` direct-call acquisition path from `run-scan.js` (lines ~1207–1277). All Deezer acquisition now flows through PAL. |
| **Impact** | Deezer is Royaltē's Streaming Verification Authority™ (provider trust: 80). Independent streaming evidence preserved for future Verification Intelligence™ — cross-provider agreement, disagreement, and confidence detection against Apple Music and Spotify. All seven constitutional providers now acquire via PAL. The original streaming provider group (Apple, Spotify, Deezer) is now 100% migrated to PAL. |
| **Tests** | 740 / 740 CERTIFIED (67 new assertions in Suite 11). |

---

## 2026-07-02 — Phase 3.6 MLC — The MLC Publishing Authority PAL Production Migration™

| | |
|---|---|
| **PR** | #199 |
| **Commit SHA** | `67d7fe8` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/mlc/MLCConnector.js` — ISRC + PUBLISHING capabilities; `authenticate()` calls `POST /oauth/token` to obtain JWT Bearer token (network call, distinct from other connectors). `provider-acquisition/connectors/mlc/mlc-http.js` — POST-only HTTP client; JWT Bearer auth; 401/429/5xx retry/backoff. `provider-acquisition/connectors/mlc/mlc-capabilities.js` — frozen capability declaration (ISRC + PUBLISHING). `api/_lib/mlc-pal-acquisition.js` — sequential A→B acquisition: recordings → extract mlcSongCodes → works; no compat synthesis (MLC is new to the fan-out). `tests/certification/suites/10-mlc-connector.mjs` — 63-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateMLCRecordings` and `translateMLCWorks` added; recordings at `platforms.mlc.recordings[]`, works at `platforms.mlc.details.works[]`, `mlcSongCodes[]` bridge array; Board Amendment applied — no flattening of publishers/ISWCs into aggregate arrays. `api/_lib/run-scan.js` — MLC added as 6th PAL provider in fan-out. `tests/certification/harness.mjs` — Suite 10 wired. |
| **Removed** | none |
| **Impact** | The MLC is Royaltē's first constitutional Publishing Authority. Provider trust: 95 (statutory US mechanical licensing authority under the Music Modernization Act). Recording → Song Code → Musical Work → Publishers / Songwriters / ISWC hierarchy preserved for future Publishing Intelligence™, Rights Intelligence™, and Revenue Intelligence™. MLC API field-casing inconsistency documented and preserved raw: `/search/recordings` uses `mlcsongCode` (lowercase s); `/works` uses `mlcSongCode` (uppercase S). Six constitutional provider ecosystem complete. |
| **Tests** | 673 / 673 CERTIFIED (63 new assertions in Suite 10). |

---

## 2026-07-02 — Phase 3.6 YouTube — Official Artist Channel PAL Production Migration™

| | |
|---|---|
| **PR** | #198 |
| **Commit SHA** | `fb44ef5` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/youtube/YouTubeConnector.js` — ARTIST_IDENTITY + COLLECTION_DATA capabilities. `provider-acquisition/connectors/youtube/youtube-http.js` — GET-only HTTP client; appends API key as query param; 403/quotaExceeded → RATE_LIMITED. `provider-acquisition/connectors/youtube/youtube-capabilities.js` — frozen capability declaration. `api/_lib/youtube-pal-acquisition.js` — identity-lock on channelTitle (no partial matches); `acquireYouTubeEvidence` + `synthesizeYouTubeCompat`. `tests/certification/suites/09-youtube-connector.mjs` — 66-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — `translateYouTubeChannelIdentity` and `translateYouTubeChannelData` added. `api/_lib/run-scan.js` — YouTube added as 5th PAL provider in fan-out; legacy `getYouTubeData` retired from run-scan. `tests/certification/harness.mjs` — Suite 09 wired. |
| **Removed** | Legacy `getYouTubeData` direct-call path from `run-scan.js`. |
| **Impact** | YouTube Official Artist Channel is Royaltē's Digital Presence Authority (provider trust: 85). Identity-lock ensures only official artist channels are captured. |
| **Tests** | 610 / 610 CERTIFIED (66 new assertions in Suite 09). |

---

## 2026-07-02 — Phase 3.6 — Discogs PAL Production Migration™ + Amendment 1

| | |
|---|---|
| **PR** | #197 |
| **Commit SHA** | `aea8095` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/discogs/DiscogsConnector.js` — CATALOG_DATA + ARTIST_IDENTITY capabilities. `provider-acquisition/connectors/discogs/discogs-http.js` — GET HTTP client with Discogs user-agent header. `provider-acquisition/connectors/discogs/discogs-capabilities.js` — frozen capability declaration. `api/_lib/discogs-pal-acquisition.js` — identity-lock on artist name; `acquireDiscogsEvidence` + `synthesizeDiscogsCompat`. `tests/certification/suites/08-discogs-connector.mjs` — 79-assertion certification suite (6 groups A–F2). |
| **Changed** | `lib/rie/EvidenceBridge.js` — Discogs catalog translations added. `api/_lib/run-scan.js` — Discogs added as 4th PAL provider; legacy `getDiscogsData` retired from run-scan. `tests/certification/harness.mjs` — Suite 08 wired. Amendment 1 (Catalog Evidence Policy): EvidenceBridge reads `catalog.releases` array from Discogs evidence; no flattening of catalog data into summary fields at bridge layer. |
| **Removed** | Legacy `getDiscogsData` direct-call path from `run-scan.js`. |
| **Impact** | Discogs is Royaltē's Catalog Authority (provider trust: 75). Catalog evidence — releases, formats, labels — preserved as structured array. |
| **Tests** | 544 / 544 CERTIFIED (79 new assertions in Suite 08). |

---

## 2026-07-02 — Phase 3.8 — MusicBrainz PAL Production Migration™ + Amendment 1

| | |
|---|---|
| **PR** | #196 |
| **Commit SHA** | `b966881` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js` — ARTIST_IDENTITY + CATALOG_DATA + ISRC capabilities. `provider-acquisition/connectors/musicbrainz/musicbrainz-http.js` — GET HTTP client; rate-limit compliant (1 req/s per MB policy); MusicBrainz User-Agent header. `provider-acquisition/connectors/musicbrainz/musicbrainz-capabilities.js` — frozen capability declaration. `api/_lib/musicbrainz-pal-acquisition.js` — identity-lock on artist name; `acquireMusicBrainzEvidence` + `synthesizeMusicBrainzCompat`. `tests/certification/suites/07-musicbrainz-connector.mjs` — 73-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/EvidenceBridge.js` — MusicBrainz translations added. `api/_lib/run-scan.js` — MusicBrainz added as 3rd PAL provider; legacy `getMusicBrainzData` retired from run-scan. `tests/certification/harness.mjs` — Suite 07 wired. Amendment 1 (provider normalization boundary): all MusicBrainz-specific field parsing terminates at the connector/bridge boundary; EvidenceBridge never maps internal MB tags to provider-specific business concepts. |
| **Removed** | Legacy `getMusicBrainzData` direct-call path from `run-scan.js`. |
| **Impact** | MusicBrainz is Royaltē's Canonical Metadata Authority (provider trust: 80). MBID-based identity confirmed; Recording ISRC cross-reference preserved. |
| **Tests** | 478 / 478 CERTIFIED (73 new assertions in Suite 07). |

---

## 2026-07-02 — Phase 3.7 — Recording Intelligence Foundation™ + Amendment

| | |
|---|---|
| **PR** | #195 |
| **Commit SHA** | `2057db6` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `api/_lib/recording-intelligence.js` — `assembleRecordingIntelligence(cio)` sole entrypoint; pure, deterministic; Board-locked RECORDING_CONFIDENCE_WEIGHTS and CONFIDENCE_THRESHOLDS (High ≥ 80 / Moderate ≥ 50 / Low ≥ 0). `tests/certification/suites/06-recording-intelligence.mjs` — 83-assertion certification suite (7 groups A–G). |
| **Changed** | `lib/rie/RIE.js` — Recording Intelligence wired into the RIE pipeline. `tests/certification/harness.mjs` — Suite 06 wired. Amendment (Recording Confidence Policy): Board-locked weights ratified — ISRC 40, MusicBrainz 30, Apple 20, Spotify 10 (sum to 100). Confidence is normalized [0, 100]; weights are advisory signals, not hard gates. |
| **Removed** | none |
| **Impact** | Recording confidence is a first-class constitutional intelligence field. Every CIM now includes recording confidence with explicit rationale. Suite 06 enforces the confidence contract and prevents score regression. |
| **Tests** | 405 / 405 CERTIFIED (83 new assertions in Suite 06). |

---

## 2026-07-02 — Phase 3.6 — Spotify PAL Production Migration

| | |
|---|---|
| **PR** | #194 |
| **Commit SHA** | `ba4054d` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `provider-acquisition/connectors/spotify/SpotifyConnector.js` — ARTIST_IDENTITY + CATALOG_DATA capabilities; client-credentials OAuth flow. `provider-acquisition/connectors/spotify/spotify-http.js` — GET HTTP client; Bearer token; 429 retry. `provider-acquisition/connectors/spotify/spotify-capabilities.js` — frozen capability declaration. `api/_lib/spotify-pal-acquisition.js` — `acquireSpotifyEvidence` + `synthesizeSpotifyCompat`. |
| **Changed** | `lib/rie/EvidenceBridge.js` — Spotify translations added. `api/_lib/run-scan.js` — Spotify added as 2nd PAL provider; legacy `getSpotifyData` retired from run-scan. |
| **Removed** | Legacy `getSpotifyData` direct-call path from `run-scan.js`. |
| **Impact** | Spotify is the second constitutional PAL provider (provider trust: 90). Verification authority. Legacy Spotify direct path retired. |
| **Tests** | 322 / 322 CERTIFIED. |

---

## 2026-07-02 — Phase 3.5 Governance Backfill — Royaltē OS v1.0 Certification

| | |
|---|---|
| **PR** | #193 |
| **Commit SHA** | (pending merge) |
| **Tag** | — (documentation only) |
| **Constitution Version** | v1.3 |
| **Added** | `ARCHITECTURE.md` — four-layer OS architecture diagram, constitutional ownership map, certified provider status, determinism contract, performance baseline, key invariants. `CERTIFICATION.md` — permanent record of the Board Certification Harness™: suite architecture, artist library, determinism policy, performance baseline policy, certification gates, certified baseline record (`royalte-os-v1.0` at `65c5c16`, 308/308 assertions). `GOVERNANCE.md` — permanent engineering governance: constitutional priority chain, session init, pre-implementation checklist, certification gates, phase PR protocol, ownership rules, migration rules, intelligence integrity rules. `TESTING.md` — permanent testing reference: all 7 test suites with commands and assertion counts, full test file map, CI configuration, test governance rules. |
| **Changed** | `governance/AGENT_MEMORY.md` § 2 — current build phase updated to Phase 3.5 complete, `royalte-os-v1.0` at `65c5c16` recorded. `governance/ROADMAP.md` — Phase 3.5 row updated to ✅; OS v1.0 milestone and certification framework added to What's Live. `governance/BOARD_DECISIONS.md` — Phase 3.5 ratification entry prepended. |
| **Removed** | none |
| **Impact** | Royaltē OS v1.0 certification is formally documented as permanent institutional record. Four root-level documents serve as the canonical orientation surface for all future engineering and AI sessions. |

---

## 2026-07-02 — Phase 3.5 — Royaltē OS v1.0 Board Certification Harness

| | |
|---|---|
| **PR** | #192 |
| **Commit SHA** | `65c5c16` |
| **Tag** | `royalte-os-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `tests/certification/harness.mjs` — permanent Board Certification Harness orchestrator; 5 suites; exit 0 = CERTIFIED. `tests/certification/suites/01-regression.mjs` — 8 golden fixtures through IE + Health; 73 assertions. `tests/certification/suites/02-determinism.mjs` — 20 fixtures × 10 IE runs + canonical-radiohead × 5 RIE runs with fixed clock; 21 assertions. `tests/certification/suites/03-artist-library.mjs` — 12 artist archetypes through IE, Health, Identity Intelligence, Publishing Intelligence; 177 assertions. `tests/certification/suites/04-cim-integrity.mjs` — full RIE → §8.2 CIM structure + deep-freeze verification; 36 assertions. `tests/certification/suites/05-performance.mjs` — stage timing baselines (20 samples); 500ms full-RIE p95 budget gate; 1 assertion. `tests/certification/reporters/board-report.mjs` — Board Certification Report formatter. `tests/certification/artist-library/*.json` — 12 certification archetypes: major, independent, single-only, album-heavy, no-publisher, legacy-catalog, duplicate-identity, international, classical, sparse-metadata, null-fields, multi-publisher. |
| **Changed** | `api/_lib/backend-intelligence.js` line 93 — removed `!Array.isArray(v)` guard from `deepFreeze`; arrays now properly frozen. Production bug fix: `verification.services[]` was unfrozen in the CIM. |
| **Removed** | none |
| **Tests** | 308 assertions / 5 suites / 0 failures. BOARD VERDICT: CERTIFIED. |

---

## 2026-07-02 — Product Consumption Cleanup (Phase 3.4)

| | |
|---|---|
| **PR** | #190 |
| **Commit SHA** | `8a71df7` (pending merge) |
| **Tag** | `phase-3-4-product-consumption-cleanup-v1.0` (pending) |
| **Constitution Version** | v1.3 |
| **Added** | `isrcCoverage` field in `api/_lib/catalog-intelligence.js` — constitutional ISRC Coverage intelligence (status/assessed/assessedCount/verifiedCount/coveragePercent). Board-pending `ISRC_THRESHOLDS` named constants (Complete ≥ 75 / Partial ≥ 25 / Limited ≥ 1 / Unknown). `renderCatalog` in `public/js/mission-control-renderers.js` extended with `isrcCoverage` in plan. |
| **Changed** | `public/index.html` `_renderV2Found()` rewritten as a pure presentation layer — zero business logic. All six displayed fields now read from the Certified CIM (`data.canonical.catalogIntelligence` and `data.canonical.globalMusicFootprint`). Album classification loop, provider-count catalogAvail formula, and `trackIsrc` ISRC proxy removed. |
| **Removed** | Renderer business logic: album classification (loop over `appleMusic.albums[]`), catalog availability provider-count formula (`verifAM + verifSP >= 2`), ISRC coverage proxy (`trackIsrc ? 'Complete' : 'Unknown'`). |
| **Impact** | Website Scan is now a constitutional presentation layer. ISRC Coverage and Catalog Availability are certified by the RIE and produce identical results regardless of entry point. Vocabulary: Catalog Availability is now Global/Strong/Regional/Limited (from `globalMusicFootprint.status`); ISRC Coverage is Unknown/Limited/Partial/Complete (from `catalogIntelligence.isrcCoverage.status`). |

---

## 2026-07-02 — Apple Production Migration (Phase 3.3)

| | |
|---|---|
| **PR** | #189 |
| **Commit SHA** | `584770d` |
| **Tag** | `apple-pal-production-migration-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | `api/_lib/apple-pal-acquisition.js` — PAL orchestration module; `acquireAppleEvidence()` (sequential ARTIST_IDENTITY → ALBUMS+ISRC → AVAILABILITY) + `synthesizeAppleMusicCompat()` (V1 module compat shim, TRANSITIONAL). `governance/MIGRATION_RETIREMENT_REGISTER.md` — Board's master legacy retirement checklist. |
| **Changed** | `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` — `AVAILABILITY` capability upgraded from BIG6 (8 storefronts) to global 167-storefront wave-based fan-out; `TERRITORIES` stays BIG6; `ALL_APPLE_STOREFRONTS` constant embedded. `lib/rie/index.js` — hybrid merge path added (`_mergeApplePalEvidence`, `_deepMerge`): when both `evidencePackages` and `canonicalForEnrichment` provided, PAL Apple evidence deep-merges into legacy canonical with PAL authoritative for `platforms.appleMusic.*`, `subject.*`, `source.*`. `api/_lib/run-scan.js` — Apple acquisition replaced by `acquireAppleEvidence()` running in parallel with all other providers via `Promise.allSettled`; `getAppleMusic()` removed from fan-out; legacy Apple imports marked `[RETIRED CANDIDATE]`; `evidencePackages` added to return value; `appleArtworkUrl` populated from PAL evidence for Spotify-URL inputs. `api/audit.js` — `evidencePackages: result.evidencePackages` threaded into `runRIE()`. |
| **Removed** | Direct `getAppleMusic()` call from production scan path. |
| **Tests** | pipeline-test 226/226, golden-fixture 31/31, rie-phase1 25/25, identity-wiring 19/19, publishing-intelligence 26/26, health-engine 36/36. |

---

## 2026-07-02 — One Health Engine (Phase 3.2)

| | |
|---|---|
| **PR** | #188 |
| **Commit SHA** | `aca5571` |
| **Tag** | — |
| **Constitution Version** | v1.3 |
| **Added** | `lib/rie/CimAdapter.js` — `buildCimEnrichment(cim, baseCanonical)` migration bridge; maps CIM → legacy canonical fields for backward-compat consumers. `lib/rie/__tests__/scan-migration.test.js` — 36-criterion test suite enforcing CimAdapter boundaries and One Health Engine invariants. |
| **Changed** | `api/_lib/persist-os-scan.js` — health score sourced from `cim.health.score` (via CimAdapter output) instead of `computeV2HealthScore`. `api/audit.js` — OS enrichment path migrated to `buildCimEnrichment(cim, canonical)` pattern; `canonical.cim` carries full certified CIM for Phase 3.2+ consumers. `api/lib/normalizeAuditResponse.js`, `api/schema/auditResponse.js`, `generate_audit_pdf.py` — schema alignment updates. `lib/rie/index.js` — `runRIE()` updated to return certified CIM (Phase 2.4 PAL path activated). |
| **Removed** | `computeV2HealthScore()` removed from production paths (zero consumers; V2 function body retired). |

---

## 2026-06-20 — Phase 8: Scan Pipeline Wiring — Health & Executive Brief

| | |
|---|---|
| **PR** | #155 |
| **Commit SHA** | `17f462f` |
| **Tag** | `phase-8-scan-pipeline-wiring-v1.0` |
| **Constitution Version** | v1.3 |
| **Added** | nothing new — integration only |
| **Changed** | `api/audit.js` — step 5 added to `assembleIntelligenceForScan()`: `computeHealthScore(report)` [once] → `generateHealthReport(cio, report)` → `generateExecutiveBrief(cio, report, healthReport, healthScore)`; `healthScore`, `healthReport`, `executiveBrief` persisted in enriched payload. `api/_lib/executive-brief-engine.js` — signature updated from `generateExecutiveBrief(healthReport)` to `generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth)`; strict layer ownership enforced; fail-closed on absent `canonicalHealth` or `intelligenceReport`. `tests/executive-brief-engine-test.mjs` — migrated to 4-arg signature (40 → 40 assertions, zero coverage lost). |
| **Removed** | none |

---

## 2026-06-12 — Phase 8: Royaltē Executive Brief Engine™

| | |
|---|---|
| **PR** | #141 |
| **Commit SHA** | `8f00014` |
| **Constitution Version** | v1.3 |
| **Added** | `api/schema/executive-brief.js` (constants + `emptyBrief()` factory; `BRIEF_VERSION='1.0.0'`, `HEALTH_HEADLINES`, `RECOMMENDED_NEXT_STEPS`). `api/_lib/executive-brief-engine.js` (sole export: `generateExecutiveBrief(healthReport)`; pure, deterministic, never throws, deep-freezes output; reads upstream `strengths/risks/opportunities/recommendations/observations` arrays defensively). `tests/executive-brief-engine-test.mjs` (40 deterministic assertions: input tolerance, grade-derived headlines, summary/narrative word caps, top-N capped at 5, severity-ordered risks, never-invent invariant for priorityActions, confidence-statement templates, determinism, immutability, no-mutation, schema invariants). |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-12 — Phase 7.5: Se7ven Labs Intellectual Property Vault™

| | |
|---|---|
| **PR** | #139 |
| **Commit SHA** | `38ec3be` (Vault establishment at `7a72e77`; Permanence Amendment at `38ec3be`) |
| **Constitution Version** | v1.3 |
| **Added** | `/ip/` directory with 24 markdown files (2,547 lines): `README.md` (Vault index, Purpose, Permanence, Legal disclaimer, Ownership Block), `TRADEMARKS.md`, `TRADEMARK_USAGE.md`, `FIRST_USE_LOG.md`, `PATENTS.md`, `PRIOR_ART.md`, `DEFENSIVE_PUBLICATIONS.md`, `COPYRIGHTS.md`, `TRADE_SECRETS.md` (CONFIDENTIAL), `PRODUCT_REGISTRY.md`, `INVENTION_LOG.md`, `FOUNDER_NOTES.md`, `IP_ROADMAP.md`, `LICENSING.md`, `AI_MODELS.md`, `ARCHITECTURE_DECISIONS.md`, `DOMAIN_REGISTRY.md`, `BRAND_GUIDELINES.md`, `PRESS.md`, `VALUATION.md` (PRIVATE), `COMPETITOR_ANALYSIS.md`, `INVESTOR_DUE_DILIGENCE.md`, `ACQUISITION_DATA_ROOM.md`, `OPEN_SOURCE.md`. Documentation-only; no runtime / governance / constitutional impact. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 7: Royaltē Health Engine™

| | |
|---|---|
| **PR** | #137 |
| **Commit SHA** | `ec57481` (Phase 7 code at `0c10fb4`; roadmap amendment at `ec57481`) |
| **Constitution Version** | v1.3 |
| **Added** | `api/schema/health.js` (constants + `emptyHealthReport()` factory; `HEALTH_VERSION='1.0.0'`, `CATEGORY_WEIGHTS`, `GRADE_THRESHOLDS`). `api/_lib/health-engine.js` (sole export: `computeHealthScore(intelligenceReport)`; pure, deterministic, never throws, deep-freezes output). `tests/health-engine-test.mjs` (35 deterministic assertions: input tolerance, fixture-driven category scores, all six grade bands, determinism, immutability, no-mutation, invariants). |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 6.5: Golden Fixture Library™ + Phase 5 polarity amendment

| | |
|---|---|
| **PR** | #135 |
| **Commit SHA** | `52b1750` |
| **Constitution Version** | v1.3 |
| **Added** | `tests/fixtures/artist-empty.json`, `tests/fixtures/artist-perfect.json`, `tests/fixtures/artist-duplicate-profiles.json`, `tests/fixtures/artist-missing-publishing.json`, `tests/fixtures/artist-orphan-recordings.json`, `tests/fixtures/artist-fragmented-catalog.json`, `tests/fixtures/artist-metadata-conflicts.json` — each carrying `_fixtureVersion`, `_fixtureName`, `_description`, `_expectedBehavior`. Plus `tests/fixtures/fixture-loader.mjs` (exports `loadFixture`, `listFixtures` only) and `tests/golden-fixture-test.mjs` (30 deterministic assertions). |
| **Changed** | `api/rules/publishing-rules.js` — added `polarity: 'positive'` to `publishing.strong-coverage` (1 line). `api/rules/catalog-rules.js` — added `polarity: 'positive'` to `catalog.complete-delivery-verified` (1 line). Additive Phase 5 amendment; existing rule-library tests stay 29/29 green. |
| **Removed** | none |

---

## 2026-06-11 — Repository Governance Layer™ established

| | |
|---|---|
| **PR** | #133 |
| **Commit SHA** | `60e76ef` |
| **Constitution Version** | v1.3 |
| **Added** | `governance/AGENT_MEMORY.md`, `governance/BOARD_DECISIONS.md`, `governance/ROADMAP.md`, `governance/CHANGELOG.md` (this file), `governance/EXECUTIVE_BOARD.md`. New constitutional rule recorded in `AGENT_MEMORY.md` § 9 binding every future architectural Phase merge to governance updates. AI Startup Order documented. Executive Board roster captured with first-draft titles pending Board confirmation. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Constitution v1.3 + Engineering Stack documentation

| | |
|---|---|
| **PR** | #132 |
| **Commit SHA** | `33edba6` |
| **Constitution Version** | **v1.3** |
| **Added** | `docs/ROYALTE_ENGINEERING_STACK.md` (long-form companion to Constitution § 8B) |
| **Changed** | `constitution/ROYALTE_MASTER_CONSTITUTION.md` — version 1.2 → 1.3; revision-history entry; **new Section 8B — Royaltē Engineering Stack™** (sub-sections 8B.0–8B.9) |
| **Removed** | none |

---

## 2026-06-11 — Phase 6: Royaltē Intelligence Engine™ (generic rule executor)

| | |
|---|---|
| **PR** | #131 |
| **Commit SHA** | `a23788b` |
| **Tag** | `intelligence-engine-v1.0` |
| **Constitution Version** | v1.2 (at merge) → v1.3 (post-Section-8B) |
| **Added** | `api/_lib/intelligence-engine.js`, `api/schema/intelligence.js`, `tests/intelligence-engine-test.mjs` (30 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Phase 5: Royaltē Rule Library™

| | |
|---|---|
| **PR** | #130 |
| **Commit SHA** | `8907bd6` |
| **Constitution Version** | v1.2 (at merge) → v1.3 (post-Section-8B) |
| **Added** | `api/rules/identity-rules.js`, `api/rules/publishing-rules.js`, `api/rules/catalog-rules.js`, `api/rules/metadata-rules.js`, `api/rules/index.js`, `tests/rule-library-test.mjs` (29 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-11 — Close PR #129 (architecturally superseded Intelligence Engine v1)

| | |
|---|---|
| **PR** | #129 (closed without merge) |
| **Commit SHA** | — |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | none |
| **Removed** | none. PR was the first proposed Phase-5 Intelligence Engine; it hardcoded rules inside engine logic, violating the constitutional separation. Work has been redone as PR #130 (Rule Library) + PR #131 (generic engine). `main` was never affected by this branch. |

---

## 2026-06-10 — Phase 4: Canonical Intelligence Assembly Engine™

| | |
|---|---|
| **PR** | #128 |
| **Commit SHA** | `a3c78d7` |
| **Constitution Version** | v1.2 |
| **Added** | `api/_lib/cio-assembler.js`, `api/schema/cio.js`, `tests/cio-assembler-test.mjs` (17 deterministic assertions) |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-10 — Phase 3: Royaltē Identity Graph™ (Publishing Layer)

| | |
|---|---|
| **PR** | #127 |
| **Commit SHA** | `bf12b5a` |
| **Constitution Version** | v1.2 |
| **Added** | `tests/identity-graph-publishing-test.mjs` (23 deterministic assertions). New public API on `api/_lib/identity-graph.js`: `addPublishingWork`, `getPublishingWorks`, `getCompositionByISWC`, `getCompositionByProviderId`, `getWriterByIPI`, `linkRecordingToComposition`, `getCompositionsForRecording`, `getRecordingsForComposition`. New schema: `CompositionNode` with `royalteId` + `externalIds{mlc, socan, ascap, bmi, cisac, musicbrainz}`. |
| **Changed** | `api/_lib/identity-graph.js` extended (additive; original YouTube exports byte-identical). |
| **Removed** | none |

---

## 2026-06-10 — Phase 2: Royaltē Publishing Intelligence Adapter™

| | |
|---|---|
| **PR** | #126 |
| **Commit SHA** | `bca9e68` |
| **Tag** | `mlc-publishing-adapter-v1.0` |
| **Constitution Version** | v1.2 |
| **Added** | `lib/publishing/mlc-adapter.js`, `tests/publishing-adapter-test.mjs` (20 deterministic assertions). Public API: `normalizeMlcWork`, `normalizeMlcWorks`, `validatePublishingWork`. |
| **Changed** | none |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 3): `/api/mlc-test` body-shape probe — `writers[]` required

| | |
|---|---|
| **PR** | #125 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | `api/mlc-test.js` — sends `{ title, writers: [] }` by default; `?writers=ed` populates a synthetic writer for Ed Sheeran. Empirically discovered: MLC's API Gateway validator rejects body without `writers` populated; sending populated `writers` returns 200 with real publishing data (`mlcSongCode`, `workTitle`, `iswc`, `writers[]` including `writerIPI`). Phase 1 connectivity proven end-to-end. |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 2): `/api/mlc-test` Bearer source — idToken vs accessToken

| | |
|---|---|
| **PR** | #124 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | none |
| **Changed** | `api/mlc-test.js` — default Bearer JWT switched from `accessToken` to `idToken` (Cognito + API Gateway authorizer validates `idToken`). `?bearer=access` retained for completeness. |
| **Removed** | none |

---

## 2026-06-10 — Phase 1 (Step 1): `/api/mlc-test` OAuth two-step flow

| | |
|---|---|
| **PR** | #123 |
| **Commit SHA** | (merged to main) |
| **Constitution Version** | v1.2 |
| **Added** | `api/mlc-test.js` — probe endpoint implementing the documented OAuth flow: `POST /oauth/token` with `{ username, password }` → `accessToken` + `idToken`; subsequent `POST /search/songcode` with `Authorization: Bearer <token>`. Reads `MLC_USERNAME` / `MLC_PASSWORD` (Production-scoped) from Vercel env vars. |
| **Changed** | none |
| **Removed** | `MLC_API_KEY` (CEO action — Vercel reported as duplicate of `MLC_PASSWORD`) |

---

## How to add a new entry (template)

Copy this stub to the **top** of the changelog on every merge into `main`:

```markdown
## YYYY-MM-DD — <merge title>

| | |
|---|---|
| **PR** | #<number> |
| **Commit SHA** | `<short sha>` |
| **Constitution Version** | v1.<x> |
| **Added** | <files / capabilities> |
| **Changed** | <files / behaviour> |
| **Removed** | <files / capabilities> |
```

Never overwrite an existing entry. Per governance rule (see `AGENT_MEMORY.md` § 9), every merge must include this entry.
