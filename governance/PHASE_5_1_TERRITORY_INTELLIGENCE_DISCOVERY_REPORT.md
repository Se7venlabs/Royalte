# Phase 5.1 — Royaltē Territory Intelligence Engine™ — Discovery Report

**Status:** DISCOVERY COMPLETE — awaiting Board review and Phase 2 authorization
**Date:** 2026-07-17
**Scope:** Read-only architectural audit. No production code written, no files modified except this report.

---

## Executive Summary

Royaltē currently has **three independent, non-integrated systems** that each compute or model territory/availability data, plus a fourth **declared-but-unimplemented** canonical schema layer:

1. **`api/territory-scan.js`** — a standalone, legacy, PAL-bypassing endpoint (`/api/territory-scan`) with its own Spotify+Apple direct-call logic, its own 96-country evaluation universe, its own confidence/scoring model, and its own Supabase tables (`territory_scans`/`territory_results`). **Currently degraded in production**: it depends on Spotify's `available_markets` field, which Spotify removed from Development Mode API responses (live-confirmed during the Spotify PAL modernization, PR #344) — this endpoint has been silently returning empty/near-empty Spotify market data since that change, while still reporting Apple Music cross-validation results.
2. **`api/_lib/global-music-footprint.js`** — the actual engine powering Mission Control's Global Music Footprint™ workspace. Sources exclusively from Apple Music's 167-storefront global check, itself computed by a **legacy, non-PAL function** (`checkGlobalStorefrontAvailability` in `api/apple-music.js`) that a fully-built PAL equivalent (`AppleMusicConnector#fetchGlobalStorefrontAvailability`) already duplicates but does not yet replace in production.
3. **`api/_lib/delta-engine.js`** — a separate, older change-detection system (Brief 002) with its own `territories: string[]` change-detection logic (`emitTerritoryDeltas`), operating on a third, simpler canonical shape unrelated to both of the above.
4. **`api/registry/fields/distribution.js`** — a "Distribution Availability™" canonical field registry (6 fields: country_count, platform_count, global_availability_status, big6_availability, primary_markets, apple_storefront_count, spotify_market_count) that is **purely declarative** — confirmed via repo-wide search that nothing reads or populates these fields at runtime. One of its fields (`spotify_market_count`) is already stale relative to live Spotify behavior.

**No existing system reconciles evidence across more than 2 providers** (Apple + Spotify, and only in the degraded legacy endpoint). The PAL now has real, working `AVAILABILITY` capabilities on Apple Music, Spotify, and Deezer (three independent per-provider signals, three different shapes), none of which currently feed into any of the three active territory systems above.

**Recommendation (detailed in full below): Hybrid approach** — build the new Territory Intelligence Engine™ as a genuine PAL-evidence consumer (reusing Apple's storefront lists, the PAL AVAILABILITY capabilities already built for Apple/Spotify/Deezer, and the GMF status/confidence derivation pattern), while retiring or explicitly quarantining `api/territory-scan.js` and the legacy `checkGlobalStorefrontAvailability` path rather than extending either.

---

## 1. Repository Audit — Existing Territory Logic

| File | Purpose | Responsibility | Status | Reusable? |
|---|---|---|---|---|
| `api/territory-scan.js` | Standalone `/api/territory-scan` endpoint | Direct Spotify+Apple calls (bypasses PAL entirely), 96-country evaluation universe, tiered gating (free/audit/subscription), Supabase persistence | **Active but degraded** — depends on removed Spotify `available_markets` field | Scoring/confidence model and tier-gating pattern are conceptually reusable; the acquisition code is not (duplicates what PAL connectors now do properly) |
| `api/apple-music.js` | Legacy direct Apple Music API handler | Owns `ALL_APPLE_STOREFRONTS` (167 codes), `BIG6_STOREFRONTS`, `checkStorefrontAvailability()`, `checkGlobalStorefrontAvailability()` | **Active** — still the actual data source for Global Music Footprint via `identity/apple.js` | The storefront lists themselves are reusable/canonical; the fetch logic duplicates `AppleMusicConnector` |
| `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` | PAL connector | Own copy of `ALL_APPLE_STOREFRONTS`/`BIG6_STOREFRONTS`, `#fetchStorefrontAvailability`, `#fetchGlobalStorefrontAvailability` — explicitly commented "Mirror of ALL_APPLE_STOREFRONTS in api/apple-music.js" | **Active, built, but not the production data source for GMF** | Yes — this is the constitutionally correct PAL-native implementation; not yet wired to replace the legacy path |
| `api/_lib/identity/apple.js` | Identity resolution adapter | Calls the **legacy** `checkGlobalStorefrontAvailability` from `api/apple-music.js`, not PAL | **Active, in the live scan pipeline** | N/A — migration target, not itself reusable long-term |
| `api/_lib/global-music-footprint.js` | GMF v1.0 assembler | Pure function: derives `status`/`confidence`/`coveragePercent` from `canonical.platforms.appleMusic.details.globalStorefrontAvailability` | **Active** — the actual engine behind the Mission Control GMF card | Yes — status-threshold and confidence-derivation logic is clean, reusable, provider-agnostic in spirit |
| `api/_lib/delta-engine.js` | Change detection (Brief 002) | `emitTerritoryDeltas()` diffs `territories: string[]` between snapshots, emits `territory_gain`/`territory_loss` alerts | **Active**, older V2 scan-snapshot system, separate from PAL/CIO and from the Sprint 8 Monitoring Engine | The diff pattern (set difference between two scans) is reusable; the data shape is not canonical |
| `monitoring/intelligence/MonitoringIntelligence.js` | Sprint 8 constitutional Monitoring Engine | **No territory-change logic at all** — confirmed via search | Active for other change types | N/A — territory-change support does not exist here yet |
| `api/evidence/contracts/distribution.js` | Canonical Intelligence Platform™ evidence contract schema | Declares `DistributionEvidence` contract shape (marketCount, markets, availabilityMap, unavailableMarkets, primaryMarket, globalAvailabilityStatus) | **Declared, never populated** — no connector or assembler produces a payload matching this contract | Shape is a reasonable design reference; currently unused |
| `api/registry/fields/distribution.js` | Canonical field registry | Declares 6 `Distribution Availability` domain fields with `sourcePriority`/`consumers` metadata | **Declared, never read at runtime** — confirmed via repo-wide search, only imported by the registry loader itself | Metadata schema is a reasonable design reference; currently unused; one field (`spotify_market_count`) is already stale |
| `public/js/global-map-viewport.js` | Frontend map rendering | Not inspected in depth this pass (out of scope for backend/data-flow discovery) — referenced by the earlier repo grep as touching "region"/"country" | Presumed active (GMF card renders a map) | Deferred to Phase 2 detailed frontend audit if needed |

### Disposition — Reuse / Extend / Replace / Retire

One unambiguous classification per component, for direct Board decision:

| Component | Disposition | Why |
|---|---|---|
| `ALL_APPLE_STOREFRONTS` / `BIG6_STOREFRONTS` (both copies) | **REUSE** (after de-duplication) | Correct, live-verified data; the *list* is sound — only its duplication is a problem |
| `AppleMusicConnector#fetchGlobalStorefrontAvailability` / `#fetchStorefrontAvailability` (PAL) | **REUSE** | Already built, constitutionally correct, currently idle — this should become the one and only implementation |
| `api/apple-music.js` `checkGlobalStorefrontAvailability()` / `checkStorefrontAvailability()` (legacy) | **RETIRE** | Superseded by the PAL equivalent above once `identity/apple.js` is repointed |
| `api/_lib/identity/apple.js`'s call into the legacy check | **REPLACE** | Repoint to the PAL connector's method — this is the actual migration step that resolves the Path A/B duplication |
| `api/_lib/global-music-footprint.js` (`assembleGlobalMusicFootprint`, status/confidence derivation) | **EXTEND** | Sound pattern, single-provider today — extend to accept multi-provider evidence rather than rewriting its derivation logic |
| `api/territory-scan.js` (acquisition + Supabase persistence code) | **RETIRE** | Duplicates PAL acquisition, broken on Spotify's removed field; not architecturally salvageable |
| `api/territory-scan.js` (scoring transparency / tier-gating *concepts* — coverage-basis honesty, free/audit/subscription framing) | **REUSE** (as a design pattern, not the code) | Genuinely good product/UX thinking worth carrying into the new engine's response shape |
| `api/_lib/delta-engine.js` `emitTerritoryDeltas()` | **EXTEND** (or port) | Working set-difference logic; needs a canonical snapshot shape to operate against once one exists |
| `monitoring/intelligence/MonitoringIntelligence.js` | **EXTEND** | No territory logic exists yet — this is where new territory-change-type support should be added, in step with wherever the canonical snapshot ends up living |
| `api/evidence/contracts/distribution.js` (`DISTRIBUTION_CONTRACT`) | **EXTEND** (validate, don't rewrite) | Reasonable draft shape; treat as a starting point to revise against real multi-provider evidence, not a finished spec |
| `api/registry/fields/distribution.js` (`DISTRIBUTION_FIELDS`) | **REPLACE** (`spotify_market_count` specifically) or **EXTEND** (the rest) | Five of six fields are sound as declarations; `spotify_market_count` assumes a bulk list that no longer exists and must be redefined against the per-market reality |
| `EVALUATION_UNIVERSE` / `PRIORITY_MARKETS` / `COUNTRY_NAMES` / `AUDIT_TIER1-3` (territory-scan.js-only lists) | **RETIRE** (fold into the new canonical vocabulary) | Not shared with anything else today; superseded once one real canonical territory vocabulary exists |

---

## 2. Provider Capability Matrix

Verified directly from each connector's capability declaration file and (for Apple/Spotify/Deezer) live-verified behavior from this session's connector modernization work.

| Provider | Territory Data | Availability | Market List | Storefront IDs | Country Codes | Notes |
|---|---|---|---|---|---|---|
| **Apple Music** | ✅ Yes | ✅ `AVAILABILITY` (BIG6, 8 markets) + `TERRITORIES` (full 167 storefronts) | ✅ Full 167-storefront list, hardcoded, duplicated in 2 places | ✅ Lowercase ISO-ish storefront codes (`us`, `gb`, `jp`, ...) | Storefront codes double as country codes | Only provider with two distinct territory capabilities; two independent code paths compute the same 167-check |
| **Spotify** | ✅ Yes (redesigned) | ✅ `AVAILABILITY` — **per-market only**, live-verified 2026-07-17: bulk `available_markets` field removed by Spotify (Development Mode restriction, Feb 2026); `?market={code}` still works, returns `is_playable` boolean, one country per call | ❌ No bulk list obtainable | N/A | ISO 2-letter, one at a time | `api/territory-scan.js` still assumes the old bulk field and is degraded as a result |
| **Deezer** | ✅ Yes | ✅ `AVAILABILITY` — `available_countries` array on full track resource (`GET /track/{id}`) | ✅ Bulk list, live-verified (205 codes on a real track) | N/A | ISO 2-letter | Only bulk-list provider besides Apple; not yet consumed by any territory system |
| **TIDAL** | ❌ No dedicated capability | ❌ None | ❌ | ❌ | `countryCode` is a **required param on every call** (catalog scoping), not an availability signal | Live-verified during TIDAL modernization: no per-market or bulk availability field exists in TIDAL's artist/album/track responses |
| **YouTube** | Partial, unexploited | ❌ Not declared as a capability | ❌ | ❌ | `regionRestriction` exists on `/videos` responses (confirmed earlier this session) but is not surfaced through any declared capability | Real signal exists in raw evidence but isn't semantically exposed as availability |
| **TheAudioDB** | ❌ | ❌ | ❌ | ❌ | Artist object has `strCountry` (artist's home country, not distribution) | Not availability data — confirmed during AudioDB modernization audit |
| **Last.fm** | ❌ | ❌ | ❌ | ❌ | ❌ | No territory-relevant fields in `lastfm-capabilities.js` |
| **MusicBrainz** | ❌ (single field only) | ❌ | ❌ | ❌ | Release objects carry a single `country` (release country, not distribution) | Not availability — a metadata fact about one release |
| **MLC** | ❌ | ❌ | ❌ | ❌ | ❌ | Publishing/rights data only, no distribution concept |
| **Discogs** | ❌ (single field only) | ❌ | ❌ | ❌ | Release objects carry a single `country` (pressing/release country) | Same category as MusicBrainz — not availability |
| **ACRCloud (both connectors)** | ❌ | ❌ | ❌ | ❌ | ❌ | Recognition/AI-detection evidence only, no territory relevance |

**Net: 3 of 10 providers expose real availability/territory evidence** (Apple, Spotify, Deezer) — each with a **different shape** (bulk 167-list, per-market single check, bulk-but-only-on-full-resource). No existing system reconciles all three.

---

## 3. Evidence Contract Review — Current Territory Data Flow

```
                              ┌─────────────────────────────────────────┐
   PATH A (live, legacy)      │  api/apple-music.js                     │
   ───────────────────────    │   checkGlobalStorefrontAvailability()   │
                              │   (167-storefront probe, waves of 50)   │
                              └───────────────────┬───────────────────────┘
                                                  │ called by
                              ┌───────────────────▼───────────────────────┐
                              │  api/_lib/identity/apple.js                │
                              │   resolveAppleArtist()                     │
                              └───────────────────┬───────────────────────┘
                                                  │ feeds
                              ┌───────────────────▼───────────────────────┐
                              │  canonical.platforms.appleMusic.details    │
                              │    .globalStorefrontAvailability           │
                              └───────────────────┬───────────────────────┘
                                                  │ consumed by
                              ┌───────────────────▼───────────────────────┐
                              │  api/_lib/global-music-footprint.js        │
                              │   assembleGlobalMusicFootprint()           │
                              │   → { territoriesAvailable, coveragePercent,│
                              │       status, confidence, reachNarrative } │
                              └───────────┬─────────────────┬─────────────┘
                                          │                 │
                              ┌───────────▼──────┐  ┌───────▼──────────────┐
                              │ health-intelligence│  │ Mission Control      │
                              │  .deriveFootprintScore│  │ Global Music Footprint│
                              │  (consumes, does not │  │ workspace (renders,  │
                              │   recompute)          │  │  never recomputes)   │
                              └────────────────────┘  └──────────────────────┘

   PATH B (built, unused)      provider-acquisition/connectors/apple-music/
   ───────────────────────      AppleMusicConnector.js
                                 #fetchGlobalStorefrontAvailability()
                                 — duplicates Path A's logic exactly,
                                   not currently wired to feed GMF

   PATH C (separate, legacy)   api/territory-scan.js
   ───────────────────────      direct Spotify + Apple calls
                                 → territory_scans / territory_results
                                   (Supabase tables, standalone product
                                    surface, not consumed by GMF, CIO,
                                    ATHENA, or Mission Control)
                                 — degraded: relies on Spotify's removed
                                   available_markets field

   PATH D (separate, legacy)   api/_lib/delta-engine.js
   ───────────────────────      emitTerritoryDeltas()
                                 diffs canonical_data.territories[] between
                                 scan_snapshots rows (V2 Supabase system,
                                 unrelated to PAL/CIO or Path A/B)

   PATH E (declared, dormant)  api/evidence/contracts/distribution.js
   ───────────────────────      api/registry/fields/distribution.js
                                 DistributionEvidence contract + 6 canonical
                                 fields — schema exists, nothing produces or
                                 consumes it at runtime
```

Every one of these five paths is real, present-tense code — none is hypothetical. Paths A/B/C/D/E do not share data structures, do not call into each other except where noted, and (except A→GMF) are not currently reconciled by anything.

---

## 4. Global Music Footprint™ — Current Architecture

- **Data source**: exclusively Apple Music, via the legacy `checkGlobalStorefrontAvailability()` (Path A above) — a single probe album ID checked across all 167 storefronts in waves of 50 via `Promise.allSettled`.
- **Calculations that already exist**: coverage percent (`available / total × 100`), a 4-tier status derivation (`Global` ≥100%, `Strong` ≥75%, `Regional` ≥50%, else `Limited` — Board-locked named constants), and a confidence derivation from Apple's `availability` state (`AUTH_UNAVAILABLE` → "Unable to Confirm", `NOT_FOUND` → "Not Found", `VERIFIED` + detail → "Verified", `VERIFIED` alone → "Partial").
- **Territory calculations**: yes, fully built — but single-provider (Apple only). No cross-provider comparison exists anywhere in this pipeline.
- **Provider comparisons**: none. The only place any cross-provider comparison exists at all is the degraded `api/territory-scan.js` (Spotify + Apple), which is architecturally disconnected from GMF entirely.
- **Map rendering**: data-driven from the assembled `globalMusicFootprint` object (`territoriesAvailable`/`territoriesUnavailable`/`coveragePercent`/`status`), not static — Mission Control explicitly "never recomputes territory counts or coverage" per its own code comments, strictly a renderer.
- **Documentation discrepancy found**: `mission-control-renderers.js`'s own header comment claims "v1.0 scope: territoriesAvailable reflects the 8 BIG6 markets checked per scan. Full global territory expansion is Phase 2" — but the actual backend (`global-music-footprint.js`) already sources from the **full 167-storefront** check, not BIG6. This comment is stale relative to the shipped implementation and should be corrected or the discrepancy explained by the Board before Phase 2 design proceeds, since it affects whether "expand to full territory" is already-done or still-pending in anyone's mental model.

---

## 5. Existing Availability Logic — Location Map

| Concept | Where it lives | Layer |
|---|---|---|
| `AUTH_UNAVAILABLE` / `NOT_FOUND` / `VERIFIED` availability states | Constitutional, repo-wide (`CLAUDE.md`-documented), produced by legacy provider modules and consumed by GMF's confidence derivation | Legacy acquisition + compat layer |
| `available` / `not_confirmed` / `unknown` status | `api/territory-scan.js`'s `buildTerritoryDataset()` | Standalone endpoint (not PAL, not compat layer) |
| `Global`/`Strong`/`Regional`/`Limited` | `api/_lib/global-music-footprint.js` | PAL-adjacent assembler (constitutional CIO-consumption layer) |
| PAL `HealthState` (`AVAILABLE`/`PARTIAL_RESPONSE`/etc.) | Every connector — a **transport/acquisition** health signal, not a business "is this artist available here" judgment | PAL (constitutional, correctly scoped) |
| `is_playable` (Spotify), `available_countries` (Deezer) | Raw connector payload — unprocessed provider evidence | PAL, raw evidence only, no interpretation |

**None of this logic currently lives in ATHENA or the frontend** — availability determination is entirely a backend/assembler concern today, consistent with constitutional intent, but split across three architecturally separate assemblers (Path A/C/D above) rather than one.

---

## 6. Canonical Territory Model

**No single canonical territory/market/storefront vocabulary exists.** Confirmed multiple, non-unified systems:

1. `ALL_APPLE_STOREFRONTS` (167 lowercase Apple storefront codes) — duplicated verbatim in `api/apple-music.js` and `provider-acquisition/connectors/apple-music/AppleMusicConnector.js`, with an explicit comment in the PAL copy acknowledging it's a manual mirror.
2. `EVALUATION_UNIVERSE` / `PRIORITY_MARKETS` / `COUNTRY_NAMES` (96 uppercase ISO country codes with display names) — defined only in `api/territory-scan.js`, not shared with Apple's list, not shared with anything else.
3. `AUDIT_TIER1`/`AUDIT_TIER2`/`AUDIT_TIER3` — a third, tier-based country grouping, also only in `api/territory-scan.js`.
4. The `distribution.js` registry field schema references "167" and "BIG6" conceptually but declares no actual code list.

No ISO-3166 normalization utility, no shared storefront↔country-code mapping (Apple's codes are lowercase and mostly but not entirely ISO-2; several are non-standard groupings), and no single source of truth exists today. **This is one of the clearest, most concrete findings of this discovery phase** — any new Territory Intelligence Engine™ needs to establish this canonical model itself; nothing to fully inherit exists.

---

## 7. Change Detection Compatibility

- **`api/_lib/delta-engine.js`** (older, Brief 002, V2 scan-snapshot system) **already has working territory change detection**: `emitTerritoryDeltas()` does a set-difference between the current and previous scan's `territories: string[]`, emitting `territory_gain`/`territory_loss` monitoring alerts with human-readable detail text. This is real, shipped functionality.
- **`monitoring/intelligence/MonitoringIntelligence.js`** (newer, Sprint 8, constitutional Monitoring Engine — the one built during this session's earlier PAL work) has **no territory-change logic at all** — confirmed via search. The newer engine does not yet support the capability the older one already has.
- These two systems do not share a canonical snapshot shape. A new Territory Intelligence Engine™ would need to decide whether it feeds the old delta-engine's `territories: string[]` shape, the new Monitoring Engine (which would need new territory-change-type support built), or both during a transition.

---

## 8. ATHENA Compatibility

**ATHENA currently consumes no territory information whatsoever** — confirmed via search across every file in `api/athena/`: zero references to territory, market, storefront, footprint, or country-availability concepts. This is a clean slate, not a migration concern — whatever the new Territory Intelligence Engine™ produces will be ATHENA's first exposure to this domain.

---

## 9. Mission Control Dependencies

| Workspace | Territory dependency? | Detail |
|---|---|---|
| **Global Music Footprint** | ✅ Yes — dedicated, sole consumer | Reads `payload.globalMusicFootprint` (pre-assembled), never recomputes |
| **Identity** | ❌ No | No territory references found |
| **Backend Intelligence** | ❌ No | No territory references found |
| **Publishing Intelligence** | ❌ No | No territory references found |
| **Catalog Intelligence** | ❌ No | No territory references found |
| **AI Insights** | ❌ No | No territory references found |
| **Health Intelligence** (not explicitly listed by the Board but discovered) | ✅ Indirect | `deriveFootprintScore()` consumes GMF's already-assembled output as one input to the overall health score — a clean downstream relationship, not a duplicate calculation |

Territory data is architecturally isolated to exactly one Mission Control workspace today, plus one indirect health-scoring input. This is a favorable finding — a new Territory Intelligence Engine™ has a narrow, well-defined blast radius on the frontend side.

---

## 10. Technical Risks

1. **Duplicate logic, migration incomplete**: the 167-storefront Apple check exists in two places (`api/apple-music.js` legacy function, `AppleMusicConnector` PAL method) doing the identical thing; production uses the legacy one. Building a new engine on top of the legacy path deepens this debt; building on the PAL path requires first verifying it actually gets exercised.
2. **Conflicting territory models**: three incompatible country/storefront list systems (Apple's 167 lowercase storefronts, territory-scan's 96 uppercase ISO codes + display names, delta-engine's untyped `territories: string[]`). No canonical mapping between them exists.
3. **Provider inconsistencies**: three different availability shapes (bulk 167-list, per-market single check, bulk-on-full-resource-only) with no existing reconciliation logic anywhere in the codebase.
4. **Spotify availability change (already known)**: `api/territory-scan.js` is currently degraded in production due to Spotify's `available_markets` removal — this is the original motivating issue for this whole initiative (task #18) and remains unresolved.
5. **Deprecated/unused schema layer**: the `DISTRIBUTION_CONTRACT`/`DISTRIBUTION_FIELDS` registry declares a reasonable-looking canonical shape that nothing implements — risk of the new engine being designed against this schema without realizing it was never load-bearing, or conversely of the Board assuming this schema is closer to "done" than it is.
6. **Stale documentation**: the Mission Control renderer's own comment claims BIG6-only scope for GMF when the backend already does full-167 — a discrepancy that should be resolved (which is actually true?) before Phase 2 design locks in assumptions.
7. **Two disconnected change-detection systems**: territory-change alerting exists in the older delta-engine but not the newer Monitoring Engine — a new Territory Intelligence Engine™ needs an explicit decision about which (or both) it feeds.
8. **Coupling concern**: `api/_lib/identity/apple.js` (identity resolution) and `api/_lib/global-music-footprint.js` (footprint intelligence) are currently coupled through the legacy Apple storefront check — untangling that coupling is a prerequisite to cleanly sourcing GMF from PAL evidence instead.

---

## Reuse Opportunities

- **`ALL_APPLE_STOREFRONTS`** (167-code list) — legitimate canonical seed for Apple's portion of a unified territory vocabulary, once de-duplicated to one location.
- **GMF's status-threshold and confidence-derivation pattern** (`deriveStatus`/`deriveConfidence` in `global-music-footprint.js`) — clean, Board-locked, pure-function design; the *pattern* generalizes well to a multi-provider engine even though the current implementation is single-provider.
- **`api/territory-scan.js`'s scoring/tier-gating concepts** (fixed evaluation universe, coverage-basis transparency, free/audit/subscription gating) — the *product framing* (not the broken acquisition code) is a reasonable model for how a subscription-tier territory product should communicate confidence and completeness honestly.
- **`delta-engine.js`'s set-difference change-detection pattern** — directly reusable logic for territory-gain/loss, just needs a canonical snapshot shape to operate on.
- **PAL's existing `AVAILABILITY` capability on Apple, Spotify, and Deezer** — three real, live, already-certified raw-evidence sources ready to be consumed by a real multi-provider reconciliation engine, which does not yet exist anywhere.
- **`DISTRIBUTION_CONTRACT`/`DISTRIBUTION_FIELDS`** — a reasonable starting schema reference, provided the Board treats it as a draft to validate against reality (e.g., correct the stale `spotify_market_count` assumption) rather than an already-implemented contract.

---

## Recommendation

**Hybrid approach.**

Neither "build entirely new" nor "extend existing architecture" cleanly fits, because there is no single existing architecture to extend — there are three parallel ones, only one of which (GMF) is architecturally sound but single-provider, and one of which (`territory-scan.js`) is a product-shaped feature actively degraded in production.

Recommended shape for Phase 2 design consideration:
1. **Establish one canonical territory/storefront vocabulary** (Section 6 finding) as the true first deliverable — nothing else can be built cleanly without it.
2. **Build the new Territory Intelligence Engine™ as a genuine multi-provider PAL evidence consumer**, reconciling Apple's `AVAILABILITY`/`TERRITORIES`, Spotify's per-market `AVAILABILITY`, and Deezer's `AVAILABILITY` — something that has never existed in this codebase — following GMF's existing status/confidence derivation *pattern*, not its single-provider implementation.
3. **Retire, not extend, `api/territory-scan.js`'s acquisition code** — its product-tier framing is worth preserving, but its Spotify dependency is already broken and its Apple validation logic duplicates what PAL connectors now do correctly.
4. **Resolve the legacy-vs-PAL Apple storefront duplication** (Path A vs. Path B) as part of this work, since the new engine needs a single source of truth for Apple's 167-storefront data regardless.
5. **Decide, explicitly, what happens to `DISTRIBUTION_CONTRACT`/`DISTRIBUTION_FIELDS`** — adopt as the real schema, revise, or deprecate — rather than leaving it as an unreferenced third model.
6. **Defer ATHENA and Change Detection integration to a later phase** — both are clean-slate or low-risk (ATHENA has zero coupling; the old delta-engine's pattern is directly reusable once a canonical snapshot shape exists), so neither should block the core engine's design.

### Direct answers to the Board's five architecture questions

**Where does the engine belong?**
Constitutionally alongside the other intelligence assemblers — a new `api/_lib/territory-intelligence.js` (or equivalent), sitting at the same layer as `global-music-footprint.js`, `health-intelligence.js`, and `identity-intelligence.js`: downstream of PAL evidence acquisition, upstream of Mission Control and ATHENA. Not inside PAL (it must not acquire evidence itself), not inside Mission Control (it must not render), not inside ATHENA (it produces evidence-grade intelligence, not judgment/recommendations).

**What should it own?**
The canonical territory/storefront vocabulary (new — nothing today owns this); multi-provider reconciliation logic (new — nothing today does this); the status/confidence derivation for the *reconciled* result (evolved from GMF's existing single-provider pattern). It should be the one place that knows how to compare Apple's 167-list, Spotify's per-market checks, and Deezer's bulk list against each other.

**What should it consume?**
Raw PAL evidence contracts only — `AVAILABILITY`/`TERRITORIES` from Apple, `AVAILABILITY` from Spotify, `AVAILABILITY` from Deezer — exactly as those connectors already produce them, untouched. Not the legacy `api/apple-music.js` functions. Not `api/territory-scan.js`'s output.

**What should it not duplicate?**
The 167-storefront Apple check (use the existing `AppleMusicConnector` method, retire the legacy duplicate — see Disposition table); the scoring/tier-gating *concept* from `territory-scan.js` (reuse the idea, not the code); the set-difference change-detection pattern already proven in `delta-engine.js` (port/extend, don't reinvent).

**What existing infrastructure should evolve instead of being rewritten?**
`api/_lib/global-music-footprint.js`'s derivation pattern (extend from single- to multi-provider, don't replace); `DISTRIBUTION_CONTRACT`/`DISTRIBUTION_FIELDS` (validate and correct against real evidence rather than discarding the schema work already done); `monitoring/intelligence/MonitoringIntelligence.js` (extend with a new territory-change type once the canonical snapshot shape exists, rather than building a parallel monitoring path).

This is presented as a recommendation for Board decision, not a proposal to begin work — no implementation should proceed without explicit Phase 2 authorization per this directive's constraints.
