# Global Music Footprint™ — Evidence Audit & Constitutional Refactor

**Module:** Global Music Footprint™
**Initiative:** Evidence Audit & Constitutional Refactor — Phase 1 (Investigation Only)
**Status:** Executive Audit Package — awaiting Board review
**Branch:** `feat/global-music-footprint-evidence-audit`
**Merge status:** DO NOT MERGE — this branch contains documentation only, no code changes
**Date:** 2026-07-21

---

## 1. Executive Findings

**The backend/evidence pipeline is constitutionally clean. The fabrication lives almost entirely in the presentation layer.**

This is the headline finding, and it changes the shape of the remediation work relative to Catalog Intelligence™'s audit (where the fabrication was in the assembler itself). Here:

- The **Territory Intelligence Engine** (`api/_lib/territory-intelligence.js`) is a well-built, already-certified, deliberately-scoped-outside-the-CIO-bypass module: a real five-state model (`AVAILABLE`/`UNAVAILABLE`/`UNKNOWN`/`NOT_EVALUATED`/`ERROR`), evaluates all 167 real Apple storefronts, never fabricates, never throws, deep-frozen. It was never part of the "Known Phase 3 violations" CIO-bypass list — it reads raw PAL evidence directly by deliberate Board design since Phase 5.2.
- **`assembleGlobalMusicFootprint()`** (`api/_lib/global-music-footprint.js`) — the business-logic assembler — was already migrated off the direct-`canonicalForEnrichment` CIO-bypass pattern in the 2026-07-20 Phase 2 Recovery (the same remediation that fixed Catalog/Backend Intelligence). Its coverage-percent math, status thresholds, confidence derivation, and Distribution Gaps™ construction are all real, evidence-derived, and honest (no fabrication found anywhere in this file).
- **The workspace HTML and its map component are a different story.** `public/workspaces/global-music-footprint.html` and `public/js/global-map-viewport.js` contain the most severe fabrication found in any workspace audited so far this program: the entire map — every marker, every provider-per-country association, every marker color, every "First Detected" date, and every popover's "Status: Verified" text — is **100% hardcoded**, sourced from a static JS object with zero connection to the runtime evidence context. This directly contradicts the Board-locked design principle for this workspace ("the map is the product," per prior Board lock) — the product's visual centerpiece currently shows nothing real.
- A second, independently-confirmed fabrication: the "X% of World" statistic under the Countries™ KPI divides the real `territoriesAvailable` count by a hardcoded `195` — a number that exists nowhere in the backend and does not match the real 167-storefront evaluation universe. Real numerator, invented denominator.
- One genuine architectural finding, distinct from fabrication: **`Capability.TERRITORIES`** (the BIG6-only acquisition path) is dead code — declared in the connector, wired into its dispatch table, referenced in tests, but never actually called anywhere in the production acquisition flow (`api/_lib/apple-pal-acquisition.js` only ever requests `Capability.AVAILABILITY`, the full-167 path). A related documentation defect: `apple-capabilities.js`'s inline comments describe the two capabilities' scopes exactly backwards from what the connector's own dispatch logic does.
- One real, load-bearing bug found in local dev tooling: the workspace's dev fixture seeds the wrong field name (`globalMusicFootprint` instead of the contract-required `globalFootprint`), which would make the workspace's own "no scan loaded" overlay fire even in local/preview dev mode — the fixture cannot currently be used to visually QA this page.

**Overall Board recommendation:** proceed to implementation. Scope is narrower and lower-risk than it might appear from the directive's breadth — this is primarily a presentation-layer rewrite (the map component and a handful of KPI-card wiring fixes), not a pipeline rebuild. See §8/§9/§10.

---

## 2. Field-by-Field Audit

Classification: **A** = fully backed by canonical evidence · **B** = evidence exists but wiring is incomplete/wrong · **C** = fabricated or inferred.

### A — Fully backed by canonical evidence

| Item | Source field | Canonical owner | Evidence path | UI renderer |
|---|---|---|---|---|
| Global Presence™ ring number | `gf.coveragePercent` | `assembleGlobalMusicFootprint()` | Engine → `cim.globalFootprint` → `ctx.globalFootprint` | `global-music-footprint.html:617` |
| Global Presence™ status label | `gf.status` → `presLabelMap` | same | same | `global-music-footprint.html:635,637` |
| Global Presence™ description | `gf.status`/`gf.reachNarrative` → `presDescMap` | same | same | `global-music-footprint.html:636,638` |
| Global Presence™ coverage pill | `gf.coveragePercent` | same | same | `global-music-footprint.html:639` |
| Countries™ number | `gf.territoriesAvailable` | same | same | `global-music-footprint.html:618` |
| Coverage™ number | `gf.coveragePercent` | same | same | `global-music-footprint.html:619` |
| Distribution Gaps™ summary (4 stat cards) | `dg.totalRequiringAttention/unavailable/unknown/notEvaluated` | `buildDistributionGaps()` | same → `gf.distributionGaps` | `gmf-distribution-gaps.js:36-59` |
| Distribution Gaps™ list rows | `dg.territories[]` | same | same | `gmf-distribution-gaps.js:187-236` |
| Distribution Gaps™ detail drawer (status/providers/reason/action/lastVerified) | `t.*` per-territory fields | same | same | `gmf-distribution-gaps.js:274-331` |
| Mission Control overview card (separate surface) | `gmf.{territoriesAvailable,territoriesUnavailable,coveragePercent,status,confidence}` | `renderGlobalMusicFootprint()` | same object, narrower pass-through | `mission-control-renderers.js:486-527` |
| Dashboard's BIG6 8-market grid (separate surface) | filtered subset of `distributionGaps.territories` | same Engine output, client-side filter only, no re-derivation | same | `dashboard.js:1058-1108` |

### B — Evidence exists but wiring is incomplete or wrong

| Item | Source field | Gap |
|---|---|---|
| Providers™ KPI count | `ctx.identityIntelligence.providers` | Counts `Object.keys(providers).length` regardless of each provider's `verified` boolean — an unverified provider is counted the same as a verified one. Real per-provider verification state exists and is ignored. |
| `.gf-reach-pill` / `.gf-reach-narrative` (dead selectors) | `gf.status`, `gf.reachNarrative` | JS at `global-music-footprint.html:621-628` reads real, computed fields and writes to `document.querySelector('.gf-reach-pill')` / `.gf-reach-narrative` — but **no element with either class exists anywhere in the current markup**. `reachNarrative`, a genuine backend-computed sentence, is never shown to the user anywhere on the page. |
| Country display names | `getCountryName(code)`, `canonical-territory-vocabulary.js` | `COUNTRY_NAMES` only covers ~94 of the 167 real storefront codes; the other ~73 silently fall back to the raw lowercase code (e.g. a real, evidence-backed territory renders as `"ke"` instead of `"Kenya"` wherever a display name is needed). |
| Dev fixture (`?dev=1` / local) | seeds `globalMusicFootprint` | The workspace contract requires `ctx.globalFootprint` (note: no "Music"). The dev fixture writes the wrong key, so loading this workspace locally/in preview with no real scan currently falls through to the "No Scan Loaded" overlay instead of showing fixture data — the fixture is non-functional for this page today. |

### C — Fabricated or inferred

| Item | What's shown | Reality |
|---|---|---|
| Global Presence™ ring `aria-label` | Static `"Global Presence score: 94 out of 100"` | Hardcoded in markup, never updated by JS regardless of the real score shown visually next to it — a screen-reader-only fabrication. |
| Countries™ KPI `/ 195` fraction + `"X% of World"` caption | `territoriesAvailable / 195 * 100` | `195` exists nowhere in the backend. The real evaluation universe is 167 storefronts (`ALL_APPLE_STOREFRONTS.length`). Confirmed independently via full repo-wide grep — `195` appears only in this one HTML file. Produces a mathematically incoherent stat against an unrelated, invented denominator. |
| Providers™ KPI status text + caption | Static `"Active"` / `"Apple · Spotify · Deezer · TIDAL"` | Never updated by any JS in the file; doesn't reflect the real provider list or verification state (e.g. the fixture's real providers include YouTube, uncounted in the caption). |
| Executive header "Last Sweep" | Static `"Global Scan™ Active — Last Sweep: 2 Minutes Ago"` | 100% hardcoded. Real `scannedAt`/`generatedAt` timestamps exist in the runtime context and are never read anywhere in this file. |
| Date range selector | Static `"Jun 27 – Jul 4, 2026"` | Hardcoded text, decorative calendar icon, no click handler wired — presents as a functional filter control but does nothing. |
| **Entire map component** — every marker, provider-per-country association, marker color, "First Detected" date | `DESKTOP_ANCHORS`/`TABLET_ANCHORS`/`MOBILE_ANCHORS` in `global-map-viewport.js` | 100% hardcoded static objects (24 countries desktop/tablet, 10 mobile), keyed by country name, each with a fixed provider list and a fixed fake "detected" date (`'Jan 2024'`, `'Feb 2024'`, `'Mar 2024'` — literal placeholder strings). `initGlobalMapViewport()` is called with **no evidence data passed in at all** — only a DOM host element and a URL-derived calibration flag. |
| Map popover "Status" field | Literal string `'Verified'` | `global-map-viewport.js:285` — `hostEl.querySelector('.gmv-pop-status').textContent = 'Verified';` — unconditional. Every popover, for every country, always says "Verified," regardless of any real verification state. |
| "Territories Verified™" badge | `"142"` | Hardcoded string literal baked into `buildInnerHTML()` in the map component (`global-map-viewport.js:198`), never wired to any live value. The same literal `142` also appears as the count-up animation's fallback default and in the (self-described "retired") Mobile Executive Briefing summary — three independent hardcodings of the identical fake number. |
| Streaming Platforms legend panel | 4 static provider entries | Entirely static markup, no dynamic provider list, no JS wiring found anywhere. |
| Additional Territories grid (§4) | 14 hardcoded country entries | Pure static markup, no `.gf-addl-item` reference anywhere in JS. |
| Mobile Executive Briefing (§5) | 24 hardcoded country entries across two lists, plus another `"142"` summary | The section's own code comment marks it **"retired — superseded by §3+§4"**, yet it still ships live in the DOM and is CSS-toggled visible on mobile. |
| Count-up animation fallback defaults (94/94/142) | Numbers shown before real data loads, or when `dataset.liveTarget` was never set | Hardcoded demo-looking numbers baked into the animation code itself, independent of the static pre-render markup defaults noted above. In the real "no scan" production state these render behind the no-scan overlay, but the populated DOM nodes exist underneath it. |

### Not present on this page (gap, not fabrication)

- No "ATHENA Executive Insight™" narrative block exists anywhere on this workspace (grepped exhaustively — zero matches for "ATHENA"/"Insight"/"insight" outside an unrelated nav link to a different workspace). This is an absence, not an invented claim — flagged for the Board to decide whether it's in scope for this initiative or deferred.
- No page-level timeline element exists.
- No page-level "recommendation" text exists outside the real, per-territory `recommendedAction` field inside the Distribution Gaps™ detail drawer (Category A, §2 above).

---

## 3. Architecture Diagram

```
Apple Music Connector (#fetchGlobalStorefrontAvailability)
    │  GET /catalog/{sf}/albums?ids={albumId}  ×167 storefronts, waved
    ▼
apple-pal-acquisition.js
    │  Capability.AVAILABILITY only (Capability.TERRITORIES declared,
    │  never called — dead code, see §7)
    ▼
EvidencePackage[] (evidenceType: Capability.AVAILABILITY, provider: 'apple_music')
    ├──────────────────────────────────────────────────────────┐
    ▼ (raw evidencePackages, direct — deliberate exception)      ▼ (bridged)
api/_lib/territory-intelligence.js                    lib/rie/EvidenceBridge.js
    assembleTerritoryIntelligence(evidencePackages)        translateTerritories()
    │  5-state model, all 167 storefronts                  │  internally calls the Engine,
    │  NEVER a CIO-bypass — reads raw evidence               │  down-maps to legacy 3-bucket
    │  by deliberate Board design (Phase 5.2)                │  shape (lossy — only used as
    ▼                                                         │  a fallback, see §4)
    territoryIntelligence                                     ▼
    │                                    canonical.platforms.appleMusic.details
    │                                      .globalStorefrontAvailability
    │                                                         │
    │                                                         ▼
    │                                    api/_lib/global-footprint-evidence.js
    │                                      assembleGlobalFootprintEvidence()
    │                                      { appleAvailability, globalStorefrontAvailability }
    │                                      (RESOLVED CIO-bypass, Phase 2 Recovery 2026-07-20)
    │                                                         │
    └─────────────────────────┬───────────────────────────────┘
                               ▼
              api/_lib/global-music-footprint.js
                assembleGlobalMusicFootprint(report, cio,
                  globalFootprintEvidence, territoryIntelligence)
                │  Real coverage%, status, confidence, distributionGaps.
                │  territoryIntelligence is the primary path when present;
                │  globalFootprintEvidence's legacy shape is fallback-only.
                ▼
              lib/rie/index.js — runRIE()
                cim.globalFootprint = globalMusicFootprint
                ▼
              lib/rie/CimAdapter.js
                canonical.globalMusicFootprint = cim.globalFootprint
                ▼
              api/audit.js → audit_scans.payload (Supabase)
                ▼
              public/js/runtime-context-mapper.js
                royalte_workspace_context.globalFootprint      (CIM-native, primary)
                royalte_workspace_context.globalMusicFootprint (legacy, ai-insights.html only)
                ▼
        ┌──────────────────────────────┬───────────────────────────────┐
        ▼                               ▼                               ▼
public/workspaces/          public/js/mission-control-       public/js/dashboard.js
global-music-footprint.html  renderers.js::renderGlobal-      (BIG6 8-market subset,
  │  Inline <script>,         MusicFootprint()                real filter of Engine
  │  reads ctx.globalFootprint (MC overview only, narrower     output, Category A)
  │  directly. NOT the same    shape, real pass-through)
  │  code path as the renderer
  │  above — two independent,
  │  non-identical renderers.
  ▼
KPI cards (mostly real, 2 fabricated: aria-label, /195)
Distribution Gaps™ section (real, Category A)
Map component — global-map-viewport.js
  100% hardcoded, zero evidence input (Category C)
```

---

## 4. Territory Pipeline Diagram

```
                    ┌─────────────────────────────────────────┐
                    │  Apple Music API                          │
                    │  /catalog/{storefront}/albums?ids={id}    │
                    │  called once per storefront, waved        │
                    └───────────────────┬────────────────────────┘
                                        │ ×167 (ALL_APPLE_STOREFRONTS)
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  raw: { albumId, storefronts: {           │
                    │    [code]: {data:[...]} | {error} } }     │
                    └───────────────────┬────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  classifyAppleStorefrontResult(raw)       │
                    │    {error}        → ERROR                 │
                    │    data.length>0  → AVAILABLE              │
                    │    data.length=0  → UNAVAILABLE            │
                    │    unrecognized   → UNKNOWN                │
                    └───────────────────┬────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  reconcileTerritoryState() per code       │
                    │    any AVAILABLE wins                     │
                    │    else any UNKNOWN wins                  │
                    │    else all-evaluated-UNAVAILABLE wins    │
                    │    else ERROR                              │
                    │    else NOT_EVALUATED (no evidence)       │
                    └───────────────────┬────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  territories[]: 167 rows, one per          │
                    │  ALL_APPLE_STOREFRONTS code, always,       │
                    │  regardless of evidence presence           │
                    │  { code, name, state, confidence, evidence }│
                    └───────────────────┬────────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  summary: { available, unavailable,        │
                    │    unknown, notEvaluated, error }          │
                    └───────────────────┬────────────────────────┘
                                        ▼
              coveragePercent = round(available / (available+unavailable) * 100)
              — denominator EXCLUDES unknown/notEvaluated/error
                                        ▼
              status = Global≥100% / Strong≥75% / Regional≥50% / else Limited
                                        ▼
              distributionGaps = ALL 167 territories mapped to
                { code, name, status, providers[], reason, recommendedAction, lastVerified }
                (not just gaps — full evaluated set, per code comment)
```

**Real total: 167.** The UI's `/195` denominator (§2, Category C) has no relationship to any number in this pipeline.

---

## 5. Runtime Context Mapping

| Canonical field | Runtime context key | Consumer(s) |
|---|---|---|
| `cim.globalFootprint` | `ctx.globalFootprint` (CIM-native, primary) | `global-music-footprint.html` (workspace), `gmf-distribution-gaps.js` |
| `canonical.globalMusicFootprint` (= `cim.globalFootprint` via CimAdapter) | `ctx.globalMusicFootprint` (legacy) | `ai-insights.html` only (documented as "not yet recovered") |
| — (separate CIM section) | `ctx.identityIntelligence.providers` | Providers™ KPI card (Category B — verification state ignored) |

**Workspace contract** (`mc-workspace-context.js`, `'global-music-footprint'` key):
```
required:       ['globalFootprint']
requiredFields: ['globalFootprint.status', 'globalFootprint.territoriesAvailable']
requiredTypes:  { 'globalFootprint.status': 'non-empty-string',
                   'globalFootprint.territoriesAvailable': 'number' }
optional:       ['globalMusicFootprint', 'globalFootprint.reachNarrative']
```

Note `globalFootprint.reachNarrative` is listed as `optional` in the contract — correctly reflecting that it's a real, sometimes-present field — but as documented in §2 (Category B), it is never actually rendered anywhere due to the dead `.gf-reach-narrative` selector.

---

## 6. Constitutional Compliance Report

| Principle | Status | Notes |
|---|---|---|
| Single Source of Truth | **Partial violation** | Two independent, non-identical renderers exist for the same domain (`mission-control-renderers.js::renderGlobalMusicFootprint()` for the MC overview vs. the workspace page's own inline script) — not a data-integrity violation today (they read different, individually-correct subsets), but a duplication risk: a future field rename or bug fix could easily be applied to one and missed in the other. |
| Runtime Context transports canonical evidence only | **Compliant**, with one caveat | `ctx.globalFootprint` and `ctx.identityIntelligence.providers` are both real. The dev fixture violates this in spirit by seeding a non-canonical key name (`globalMusicFootprint` instead of `globalFootprint`) — a tooling bug, not a runtime violation, since it never reaches production users. |
| Evidence Registry / Territory Intelligence Engine | **Compliant** | Never a CIO-bypass; reads raw `evidencePackages` by deliberate, documented Board exception since Phase 5.2. Five-state model correctly refuses to convert missing evidence into a false negative. |
| Canonical Intelligence Engine — intelligence assembled exactly once | **Compliant in the backend; violated in the UI** | `assembleGlobalMusicFootprint()` computes coverage/status/confidence exactly once. The UI's `/195` "% of World" stat is a second, independent, client-side computation layered on top of already-final evidence — the exact pattern this principle exists to prevent. |
| Providers are evidence sources, not intelligence engines | **Compliant** | No provider-side classification found; all state reconciliation happens in `territory-intelligence.js`. |
| Mission Control renders canonical data only | **Violated — map component** | `global-map-viewport.js` renders entirely from a static local data structure with zero connection to `royalte_workspace_context`. This is the most serious single compliance finding in this audit. |
| ATHENA explains evidence, never invents it | **N/A** | No ATHENA Executive Insight™ block exists on this page to evaluate against this principle (see §2, "Not present on this page"). |
| Missing evidence must be removed or clearly marked as future work, never fabricated | **Violated** — multiple items | The map, the `/195` stat, the hardcoded "Last Sweep" text, and the non-functional date-range selector all present themselves as real, live data when none of the underlying evidence connection exists. |

---

## 7. Technical Debt Register

| Item | File | Severity | Notes |
|---|---|---|---|
| `Capability.TERRITORIES` dead in production | `apple-pal-acquisition.js` (absence), `AppleMusicConnector.js:177-179` | Medium | Declared, dispatch-wired, exercised only by mocked unit tests — never called in the real acquisition flow. `Capability.AVAILABILITY` (167-storefront) is the only path actually used. |
| Inverted capability comments | `provider-acquisition/connectors/apple-music/apple-capabilities.js:16-17` | Medium | Comments say `AVAILABILITY` = BIG6 and `TERRITORIES` = global — exactly backwards from the connector's own dispatch logic (verified directly). A reader trusting this file draws the opposite conclusion from reality. |
| Stale scope comment | `mission-control-renderers.js:509` | Low | Claims `territoriesAvailable` reflects "the 8 BIG6 markets" — false since Phase 5.2; has reflected the full 167-storefront Engine output since then. Code is correct; comment is drift. |
| Dual, non-identical GMF renderers | `mission-control-renderers.js` vs. `global-music-footprint.html` inline script | Medium | Not a bug today, but a duplication-of-logic risk — see §6. |
| `COUNTRY_NAMES` incomplete | `lib/territory/canonical-territory-vocabulary.js:65-84` | Low | ~94 of 167 codes have display names; the rest silently fall back to raw code. Self-documented as a known gap in the file's own comments. |
| Dead selectors / orphaned wiring | `global-music-footprint.html:621-628` | Low-Medium | `.gf-reach-pill`/`.gf-reach-narrative` JS exists, matching markup does not — `reachNarrative` is computed and then never shown anywhere. |
| Explicitly "retired" section still shipping | `global-music-footprint.html:411-533` (Mobile Executive Briefing) | Low | Self-commented "retired — superseded by §3+§4," still present in the DOM and CSS-toggled visible on mobile. |
| Dev fixture field-name bug | `global-music-footprint.html:65-95` | Medium | Seeds `globalMusicFootprint`, contract requires `globalFootprint` — breaks local/preview dev-mode visual QA for this workspace entirely. |

---

## 8. Executive Recommendation

Per-area disposition:

- **`api/_lib/territory-intelligence.js`** — **KEEP.** Already constitutionally correct, already exempted from the CIO-bypass finding by deliberate Board design, no changes needed.
- **`api/_lib/global-music-footprint.js`** — **KEEP.** Already migrated off the CIO-bypass pattern (Phase 2 Recovery 2026-07-20), coverage/status/confidence/distributionGaps logic is real and honest. No changes needed.
- **`api/_lib/global-footprint-evidence.js`** — **KEEP.** Correctly scoped, legacy-fallback-only, already resolved.
- **`global-map-viewport.js`** — **REPLACE.** The entire hardcoded anchor/marker/popover/badge system needs to be rebuilt to consume real `ctx.globalFootprint.distributionGaps.territories` (or equivalent) data instead of the static `DESKTOP_ANCHORS`/`TABLET_ANCHORS`/`MOBILE_ANCHORS` objects. This is the single largest piece of work in this initiative.
- **KPI card wiring in `global-music-footprint.html`** — **REWIRE.** Fix the `/195` denominator (either remove the "% of World" stat entirely — most defensible if no real 195-country denominator can be constitutionally sourced — or replace it with a real ratio against the 167-storefront universe), fix the Providers™ count to respect `verified`, fix the static aria-label, "Last Sweep" text, and date-range selector (either wire them to real data or remove them), and fix the dead `.gf-reach-pill`/`.gf-reach-narrative` selectors (either add the matching markup so `reachNarrative` is actually shown, or remove the dead JS).
- **Additional Territories grid (§4) and Mobile Executive Briefing (§5)** — **REMOVE.** Both are fully static, redundant with the real Distribution Gaps™ section, and §5 is already self-marked retired.
- **Streaming Platforms legend panel (§3.5)** — **DEFER.** Low-severity static content; not misleading in the same way the map/KPI issues are (it's a generic legend, not presented as live data). Candidate for a future pass, not blocking.
- **Dev fixture field-name fix** — **REWIRE.** One-line fix (`globalMusicFootprint` → `globalFootprint` in the fixture's seeded object), needed to make local/preview QA of this workspace possible again.
- **`Capability.TERRITORIES` dead code + inverted doc comments** — **DEFER** to a small, separate hygiene pass (out of scope for the UI rewrite, low risk, no user-facing impact) — or bundle as a 1-line/1-comment fix if convenient during this initiative's implementation PR.
- **Dual-renderer duplication** — **DEFER.** Document as a known architectural risk; not blocking, no evidence of active drift between the two today. A future consolidation (e.g. the workspace page calling the same `renderGlobalMusicFootprint()` used by the MC overview, extended with the additional fields it needs) could close this, but is a larger refactor than this initiative's scope.
- **ATHENA Executive Insight™ card** — **DEFER.** Does not exist today; the Board's audit template assumed one, but building it is new-feature work, not audit-and-fix work. Recommend a separate future initiative, mirroring the pattern already established for Catalog Intelligence™'s ATHENA Executive Insight™ card.

---

## 9. Proposed Implementation Plan (for a future authorized PR — not begun)

1. **Map rebuild** — `global-map-viewport.js` accepts a real data parameter (e.g. `distributionGaps.territories`) instead of rendering from static anchors; marker presence/color/status derived from real per-territory `state`/`providers`; popover text reads real `status/reason/lastVerified` instead of the hardcoded `'Verified'` literal; "Territories Verified™" badge reads the real available count instead of `142`.
2. **KPI card fixes** — Providers™ count respects `verified`; remove or correctly re-source the `/195` "% of World" stat; wire or remove the aria-label, "Last Sweep" text, and date-range selector; wire `reachNarrative` to real markup or remove the dead selectors.
3. **Dead-weight removal** — delete the Additional Territories grid (§4) and the self-marked-retired Mobile Executive Briefing (§5).
4. **Dev fixture fix** — correct the seeded field name.
5. **Hygiene (optional, low-risk bundle)** — fix the inverted `apple-capabilities.js` comments; fix the stale `mission-control-renderers.js:509` comment; consider retiring the unused `Capability.TERRITORIES` dispatch case or leaving it as documented-dead-but-harmless (Board's call).
6. **Validation** — live Chrome validation on at least 2 real artists with genuinely different coverage profiles (if obtainable — this workspace's 167-storefront evaluation makes a `Global`/`Strong`/`Regional`/`Limited` spread more achievable than ISRC Intelligence™'s two-state reality was), desktop/tablet/mobile, regression check on Identity/Publishing/Catalog Intelligence™ and the Mission Control overview's own GMF card (since `mission-control-renderers.js` is untouched but worth confirming).

Each step above should get its own Board evidence-audit-style sign-off before merge, per this program's established process — this document does not request or imply authorization to begin any of it.

---

## 10. Estimated Scope

| | |
|---|---|
| **Files touched** | ~4-6: `global-map-viewport.js` (major rewrite), `global-music-footprint.html` (KPI wiring fixes + §4/§5 removal + dev fixture fix), optionally `apple-capabilities.js` + `mission-control-renderers.js` (comment-only hygiene) |
| **New files** | 0 expected — no new domain assembler needed; the backend is already correct |
| **PR count** | 1 primary implementation PR (map rebuild + KPI fixes + dead-weight removal + fixture fix), optionally split into 2 if the Board prefers map rebuild and KPI fixes reviewed separately given the map's size |
| **Relative effort vs. ISRC Intelligence™ v1** | Smaller backend scope (no new engine needed — Territory Intelligence Engine already exists and is correct), comparable-to-larger frontend scope (the map rebuild is a genuinely substantial visual component, larger than any single card built for Catalog Intelligence™) |
| **Risk profile** | Low backend risk (no assembler changes). Moderate frontend risk (map is the page's visual centerpiece, per existing Board lock — a rebuild needs careful live validation before Board visual sign-off, matching this program's established multi-artist / multi-breakpoint validation standard) |

---

## Merge Authority

This directive authorized investigation only. No implementation has occurred, no files outside this document were modified, no branch merge has been requested or performed.

Returning the complete Executive Audit Package to the Executive Board for review before any development begins.
