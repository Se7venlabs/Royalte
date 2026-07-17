# Phase 5.2 — Territory Intelligence Engine™ — Implementation Decree

**Status:** BLUEPRINT — awaiting Board approval to begin Phase 5.2 implementation
**Date:** 2026-07-17 (revised)
**Nature of this document:** This decree is a planning document only. No production code or configuration was changed in producing or revising it — this markdown file is the only repository change associated with this document, at either its initial drafting or this revision.

---

## Discovery Correction Record

**What was missed**: the original Phase 5.1 Discovery Report characterized PAL's Apple `AVAILABILITY` evidence path as "built but unused" (labeled Path B, alongside a "live, legacy" Path A). This was incomplete — Discovery did not trace `lib/rie/index.js` (the RIE orchestrator).

**Corrected runtime behavior**: `lib/rie/index.js` contains `_mergeApplePalEvidence()`, explicitly commented **"PAL is authoritative,"** which deep-merges PAL's bridged Apple (and Spotify, where present) evidence over the legacy canonical object on every scan. `api/_lib/apple-pal-acquisition.js` already requests `Capability.AVAILABILITY` (the 167-storefront check) today. The corrected finding, now ratified by the Board:

- The legacy Apple storefront path (`api/apple-music.js` → `identity/apple.js`) and the PAL Apple `AVAILABILITY` path both execute on every scan today.
- PAL evidence is merged authoritatively over the legacy canonical evidence — PAL's numbers win on any overlapping key.
- The duplicate execution is **active production redundancy** (two full 167-storefront sweeps per scan, today), not dormant or unreachable code.

**Impact assessment**: this correction changes the *framing and sequencing* of the legacy-retirement work, not its destination. Specifically:
- The retirement is now understood as removing a currently-running, wasteful duplicate computation (stronger justification, higher urgency) rather than "activating" something inert.
- Because PAL's path is already live and already authoritative in the merge, the Territory Intelligence Engine can be built and proven entirely against the existing PAL evidence flow *before* the legacy call is removed — the legacy call's continued (redundant) execution during that window is wasteful but not harmful to correctness, since its output is already superseded by the merge. This directly informs the resequencing in Section 5 (legacy removal now happens *after* the new Engine path is operational and regression-tested, not before).
- No other part of Discovery's findings (provider capability matrix, canonical vocabulary fragmentation, GMF architecture, evidence contract dormancy, Mission Control dependency map) is affected by this correction.

**Architectural recommendation status: UNCHANGED.** The corrected finding does not alter which components should be reused, extended, replaced, or retired (Discovery Section 1 Disposition table stands as written). It changes *when* retirement safely happens, not *whether* it happens.

---

## Board Decisions — Phase 5.2 Scope Resolution

The Board has resolved the three checkpoints left open in the prior draft of this decree. These are now normative requirements binding the rest of this document — not options, not open questions.

### Decision 1 — Apple-Only Territory Acquisition for Phase 5.2

Apple Music is the **initial and, for this phase, sole** authoritative storefront-level territory acquisition provider. Exhaustive, country-by-country Spotify availability acquisition is explicitly **out of scope for Phase 5.2** — no brute-force, inferred, or synthetic Spotify territory model is to be built.

Spotify continues to serve as a corroborating provider for the evidence it already supports today (identity, releases, tracks, ISRC, and whatever market/platform-presence signal already flows through existing capabilities) — none of that is affected by this decision. Spotify simply does not become a second territory-acquisition input to the Engine in this phase.

**Operating consequence for this decree**: because Deezer was not named by the Board and the ratified language specifically identifies Apple as "the initial... provider" (singular), this decree treats Deezer's `AVAILABILITY` acquisition as **also out of scope for Phase 5.2**, on the same conservative principle — not because Deezer carries Spotify's brute-force risk (it does not; Deezer's is a single bulk call), but because expanding acquisition scope to a second provider without explicit Board naming would reintroduce exactly the kind of implementer-made architectural decision this revision was commissioned to eliminate. Including Deezer later is a small, additive, low-risk scope increase available to the Board at any time — it is not assumed here.

This substantially simplifies Phase 5.2: **no new PAL evidence-acquisition wiring is required.** `apple-pal-acquisition.js` already requests `Capability.AVAILABILITY`; the Engine consumes evidence that already flows today.

### Decision 2 — Multi-Provider Reconciliation Semantics

The Engine is built **provider-general** — its reconciliation policy supports any number of contributing providers by design, even though Phase 5.2 feeds it Apple evidence only (Decision 1). This is a deliberate choice: the reconciliation logic should not need re-architecture when a future phase adds Spotify or Deezer.

**Required semantic states** (per territory, per the Engine's output):

| State | Meaning |
|---|---|
| `AVAILABLE` | One or more providers positively confirm availability |
| `UNAVAILABLE` | Every applicable, successfully-evaluated provider positively confirms unavailability, and no provider confirms availability |
| `UNKNOWN` | No provider confirms availability, and one or more applicable providers return unsupported, unknown, incomplete, or unevaluated evidence |
| `NOT_EVALUATED` | No applicable provider was asked to evaluate this territory at all |
| `ERROR` | Evaluation failed and no other valid provider evidence establishes a result |

**The governing invariant, binding on the implementation and explicitly required in certification (Section 8)**: missing evidence, an unsupported capability, provider omission, timeout, or acquisition failure must **never** be converted into `UNAVAILABLE`. `UNAVAILABLE` is a positive claim requiring positive confirmation, not a default or a fallback for absence of information.

Every aggregate per-territory result must preserve, not discard: the underlying provider evidence, that provider's acquisition status, a timestamp, the source, a reason code, and a determinacy/confidence indicator. Provider disagreement is treated as a legitimate reflection of real ecosystem differences (a track can genuinely be licensed differently across platforms) — the Engine does not label differing provider signals as "conflicts" requiring resolution into a single provider's version of the truth; it aggregates per the state table above and preserves the underlying evidence for anyone who needs to see why.

### Decision 3 — `api/territory-scan.js` Shall Be Repaired, Not Sunset

The endpoint is repaired and rewired onto the Territory Intelligence Engine, not retired. It must stop performing independent territory calculation (its current direct Spotify+Apple calls) and become a consumer/entry point of the Engine instead.

Its existing product surface — request shape, response shape, tier gating (free/audit/subscription), Supabase persistence (`territory_scans`/`territory_results`) — is preserved wherever reasonably possible. Where a contract change is genuinely unavoidable (for example: Spotify's exhaustive-market data this endpoint used to attempt to show is no longer being newly acquired, per Decision 1 — see Section 3.8 for how this is handled honestly rather than silently), that change must be explicitly versioned and regression tested, not shipped as a silent behavior change.

---

## 1. Executive Summary

**Scope**: Implement the Territory Intelligence Engine™ as the single authoritative territory/availability assembler (Apple-sourced for Phase 5.2, provider-general by design for future phases), eliminate the currently-running duplicate Apple storefront computation, establish one canonical territory vocabulary, and convert Global Music Footprint™ into a consumer rather than an independent calculator — without changing GMF's public output shape or requiring any Mission Control frontend changes.

**Objectives**:
1. Eliminate the redundant, duplicate 167-storefront computation that runs on every scan today (legacy path + PAL path, both active, per the Discovery Correction Record)
2. Build a provider-general reconciliation engine with the Board-ratified 5-state model (`AVAILABLE`/`UNAVAILABLE`/`UNKNOWN`/`NOT_EVALUATED`/`ERROR`), fed by Apple evidence in Phase 5.2, extensible to additional providers without re-architecture
3. Establish one canonical territory/storefront vocabulary, ending the current 3-way fragmentation (Apple's 167 codes, `territory-scan.js`'s 96 codes, delta-engine's untyped list)
4. Preserve every existing consumer contract unchanged (GMF's output shape, Health Intelligence's input shape, Mission Control's rendering contract)
5. Repair `api/territory-scan.js`'s production degradation (Spotify's removed `available_markets` field) by rewiring it onto the new Engine, with any unavoidable contract change explicitly versioned

**Success Definition**: Territory Intelligence Engine is live, self-certifying, and is the sole source of truth Global Music Footprint reads from. The duplicate Apple storefront execution is eliminated — exactly one 167-storefront sweep occurs per scan, not two. The Engine's reconciliation logic is proven correct and provider-general even though only Apple feeds it in this phase. No unsupported/missing evidence can ever surface as a false `UNAVAILABLE`. Zero regressions in GMF's rendered output, Health Intelligence's footprint score, or any existing certification suite. `api/territory-scan.js` no longer depends on a removed provider field and is Engine-backed.

---

## 2. Board-Ratified Architecture

The following are settled constitutional decisions for this implementation — not open for reconsideration during Phase 5.2:

1. **Territory Intelligence Engine becomes the single authoritative source of all territory intelligence.** No other module computes, derives, or reconciles territory/availability data once this ships.
2. **PAL is the sole acquisition layer.** The Engine consumes PAL evidence contracts only — never calls a provider API directly, never duplicates connector logic.
3. **`AppleMusicConnector` becomes the only Apple storefront implementation.** The legacy `checkGlobalStorefrontAvailability`/`checkStorefrontAvailability`/`ALL_APPLE_STOREFRONTS`/`BIG6_STOREFRONTS` in `api/apple-music.js` are retired once the new path is proven (Discovery Correction Record: this resolves currently-running duplicate execution, not dormant code).
4. **Global Music Footprint becomes a consumer of Territory Intelligence** rather than calculating territory independently. GMF's public output shape (`territoriesAvailable`/`territoriesUnavailable`/`coveragePercent`/`status`/`confidence`/`reachNarrative`) does not change — only its internal data source does.
5. **One canonical territory vocabulary shall exist.** All storefront/country-code lists and normalization logic are consolidated into a single module; every consumer imports from it rather than declaring its own copy.
6. **Distribution Contract is extended, not replaced.** `DISTRIBUTION_CONTRACT` gains fields to represent the Engine's reconciled output; existing fields are not removed or renamed.
7. **Apple Music is the sole territory-acquisition provider for Phase 5.2** (Board Decision 1). The Engine's reconciliation logic is provider-general by design but is fed Apple evidence only in this phase.
8. **The Engine's reconciliation semantics follow the Board-ratified 5-state model and aggregate policy exactly** (Board Decision 2), including the binding invariant that missing/unsupported/omitted/timed-out evidence never becomes `UNAVAILABLE`.
9. **`api/territory-scan.js` is repaired and rewired onto the Engine, not sunset** (Board Decision 3). Its product surface is preserved; any unavoidable contract change is explicitly versioned and regression tested.

---

## 3. Migration Plan

### 3.1 Canonical Territory Vocabulary

- **Current State**: No single vocabulary. `ALL_APPLE_STOREFRONTS`/`BIG6_STOREFRONTS` duplicated in `api/apple-music.js` and `AppleMusicConnector.js`; `EVALUATION_UNIVERSE`/`PRIORITY_MARKETS`/`COUNTRY_NAMES`/`AUDIT_TIER1-3` exist only in `api/territory-scan.js`.
- **Future State**: One module (`lib/territory/canonical-territory-vocabulary.js`) exports the canonical code list, display names, and any Apple-storefront-to-ISO normalization needed. Every other file imports from it.
- **Migration Action**: Create the module seeded from Apple's 167-code list (the broadest existing verified set) plus `territory-scan.js`'s display-name map for any gaps. `AppleMusicConnector.js` and `api/apple-music.js` both import from it instead of declaring locally.
- **Risk**: Apple's storefront codes are "mostly but not entirely ISO-2" (Discovery finding) — a naive merge could silently misalign a code. Mitigation: no code is renamed or reinterpreted during migration, only relocated; a diff-based verification step (old list vs. new list, byte-for-byte) is required before any connector is repointed.
- **Rollback Strategy**: Additive-only at this step (nothing consumes it yet) — revertible by simply not wiring the import.

### 3.2 AppleMusicConnector — Storefront Source of Truth

- **Current State**: `AppleMusicConnector.js` declares its own copy of `ALL_APPLE_STOREFRONTS`/`BIG6_STOREFRONTS`; `#fetchGlobalStorefrontAvailability`/`#fetchStorefrontAvailability` are correct and already invoked in production today (via `apple-pal-acquisition.js`'s `Capability.AVAILABILITY` request, confirmed live-flowing per the Discovery Correction Record).
- **Future State**: Same methods, now importing the storefront lists from the canonical vocabulary module instead of declaring them locally.
- **Migration Action**: Replace the local `const ALL_APPLE_STOREFRONTS = ...` / `const BIG6_STOREFRONTS = ...` declarations with imports.
- **Risk**: Low — acquisition logic itself does not change, only where its constant lists come from. Existing connector certification must be re-run to confirm identical byte output.
- **Rollback Strategy**: Revert the import, restore local declarations — single-file, single-commit revert.

### 3.3 Retire Legacy Apple Storefront Duplication — Sequenced *After* the Engine Is Proven

- **Current State**: `api/apple-music.js`'s `checkGlobalStorefrontAvailability()`/`checkStorefrontAvailability()` are called from `api/_lib/identity/apple.js` → `resolveAppleArtist()`, running on every scan **in addition to and redundant with** the already-live PAL path (Discovery Correction Record).
- **Future State**: `identity/apple.js` no longer calls the legacy storefront functions; `api/apple-music.js` retains its other exports (ISRC lookup, etc.), and the storefront-check functions/lists are removed once nothing references them.
- **Migration Action, explicitly resequenced per Board correction**: this step does **not** happen early. The legacy call is left running (as it does today, redundantly but harmlessly, since PAL already wins the merge) until *after* the Territory Intelligence Engine is built, wired into the RIE, and has passed full regression (see Section 5, Steps 8–9 occur before this step, now Step 10). Only then is the legacy call removed, immediately followed by a dedicated certification proof that exactly one Apple storefront acquisition path now executes per scan (Section 8).
- **Risk**: `resolveAppleArtist()` may have other callers or timing assumptions not fully mapped by Discovery. Deferring this step until after the Engine is proven — rather than removing the legacy call early, as an earlier draft of this decree proposed — directly mitigates this risk by keeping a working fallback in place for as long as possible.
- **Rollback Strategy**: Restore the removed call in `identity/apple.js`. The legacy functions are not physically deleted from `api/apple-music.js` until a subsequent step, specifically to keep this rollback a single-line revert.

### 3.4 Territory Evidence Scope — Apple Only (Phase 5.2)

- **Current State**: `apple-pal-acquisition.js` already requests `Capability.AVAILABILITY`. `spotify-pal-acquisition.js`/`deezer-pal-acquisition.js` do not, and per Board Decision 1, will not gain that request in this phase.
- **Future State**: No change to acquisition wiring beyond what exists today. The Engine consumes the Apple evidence already flowing.
- **Migration Action**: None required — this is the direct, simplifying consequence of Decision 1. No new PAL requests, no new `EvidenceBridge.js` translation work for Spotify/Deezer `AVAILABILITY` in this phase.
- **Risk**: None introduced by this phase. The Engine's reconciliation logic must still be exercised against a mocked multi-provider fixture in certification (Section 8) to prove it generalizes correctly, even though production only feeds it one provider today — this guards against the design silently degrading into an Apple-only special case that would need rework later.
- **Rollback Strategy**: N/A — no acquisition change is made in this step.

### 3.5 Build the Territory Intelligence Engine

- **Current State**: Does not exist. No module reconciles territory evidence anywhere in the codebase.
- **Future State**: `api/_lib/territory-intelligence.js` — pure function `assembleTerritoryIntelligence(evidencePackages, cio, canonical)`, same constitutional shape as every other assembler (never throws, never mutates, deep-frozen output). Implements the Board-ratified 5-state model and aggregate policy (Decision 2) exactly:
  - `AVAILABLE` when ≥1 provider positively confirms
  - `UNAVAILABLE` only when every applicable, successfully-evaluated provider positively confirms unavailability and none confirm availability
  - `UNKNOWN` when no provider confirms availability and ≥1 applicable provider's evidence is unsupported/incomplete/unevaluated
  - `NOT_EVALUATED` when no applicable provider was asked
  - `ERROR` when evaluation failed with no other valid evidence
  - Every per-territory result preserves underlying provider evidence, acquisition status, timestamp, source, reason code, and confidence/determinacy — never collapsed away
- **Migration Action**: New file, new certification suite, wired into `lib/rie/index.js` alongside the other assemblers — same call pattern, same per-assembler error isolation already established in that file.
- **Risk**: None remaining on reconciliation *policy* (resolved by Decision 2) — residual risk is purely in correct *implementation* of that policy, covered by the certification checklist (Section 8) including the specific proof that no unsupported/missing-evidence path can produce a false `UNAVAILABLE`.
- **Rollback Strategy**: New, additive file and RIE wiring — removable by deleting the new `assembleTerritoryIntelligence` call in `lib/rie/index.js` (one line) and the file itself.

### 3.6 Convert Global Music Footprint to a Consumer

- **Current State**: `assembleGlobalMusicFootprint(intelligenceReport, cio, canonical)` derives directly from `canonical.platforms.appleMusic.details.globalStorefrontAvailability` (Apple-only, via the currently-duplicated legacy+PAL computation).
- **Future State**: `assembleGlobalMusicFootprint` accepts the Territory Intelligence Engine's reconciled output as its data source, but **returns the exact same output shape it does today**. GMF's existing status-threshold/confidence-derivation logic maps from the Engine's richer per-territory state model down to GMF's existing summary shape — the mapping logic changes, the public contract does not. No Mission Control or Health Intelligence changes required.
- **Migration Action**: Modify `global-music-footprint.js`'s internal data source; modify `lib/rie/index.js`'s call site to pass the Engine's output through; leave the function's *external contract* untouched.
- **Risk**: Because Phase 5.2's Engine is Apple-only (Decision 1), and the legacy Apple computation is not yet removed at this point in the sequence (3.3 happens later), GMF's *numeric output* should be very close to unchanged in this phase — this is a lower-risk step than an earlier draft assumed, since there is no new provider data changing the answer yet. The visible-change risk noted in the prior draft becomes real only in a future phase that adds Spotify/Deezer, not in Phase 5.2.
- **Rollback Strategy**: Revert `global-music-footprint.js`'s internal source back to direct `canonical.platforms.appleMusic` reads — the function signature never changed, so this is a clean, isolated revert.

### 3.7 Distribution Contract + Registry Extension

- **Current State**: `DISTRIBUTION_CONTRACT` (6 fields) and `DISTRIBUTION_FIELDS` (6 fields, one stale — `spotify_market_count` assumes a bulk list that no longer exists) are both declared, neither populated at runtime.
- **Future State**: `DISTRIBUTION_CONTRACT` gains fields representing the Engine's reconciled, evidence-preserving output (per-territory state, provider evidence trail, confidence). `DISTRIBUTION_FIELDS`'s `spotify_market_count` is corrected to reflect that Spotify does not contribute territory evidence in this phase (Decision 1) rather than left silently wrong.
- **Migration Action**: Additive edits to both files; the Engine becomes the first real producer/consumer relationship this schema has ever had.
- **Risk**: Low — nothing currently depends on either file's exact shape, so there is no live consumer to break.
- **Rollback Strategy**: Revert the additive field changes — no runtime dependency exists yet, so this is zero-risk to revert.

### 3.8 Rewire `api/territory-scan.js`

- **Current State**: Standalone endpoint, direct Spotify+Apple calls, degraded (Spotify `available_markets` removed), own Supabase persistence (`territory_scans`/`territory_results`), own tier-gating product contract (free/audit/subscription), currently displaying Spotify+Apple cross-validated results.
- **Future State (per Board Decision 3 — normative, not optional)**: The HTTP endpoint and its product surface (request/response shape, tier gating, Supabase tables) are preserved wherever reasonably possible. Internal acquisition is replaced with a call into the Territory Intelligence Engine.
- **Migration Action**: Replace `fetchSpotifyData`/`validateAppleMarkets`/`buildTerritoryDataset` internals with a call to `assembleTerritoryIntelligence`, then map the Engine's Apple-sourced output into the existing response/persistence shape.
- **Unavoidable contract change, to be explicitly versioned per Decision 3**: this endpoint previously attempted (and, since Spotify's field removal, has been failing at) Spotify cross-validation. Per Decision 1, Spotify territory acquisition is out of scope this phase — the endpoint's response will honestly reflect Apple-only evaluation (`confidence` values no longer include a "both sources agree" tier, since there is only one source). This is a real, user-visible behavior change from the endpoint's original design intent, though an improvement over its current broken state. It must ship as an explicitly versioned response-contract change (e.g., a `dataSourceVersion` or equivalent field marking the shift to Apple-only evaluation) with regression tests covering both the request/response shape and the tier-gating behavior.
- **Rollback Strategy**: Revert the internal implementation swap — the endpoint's core external contract (URL, method, top-level response fields) never changes, so this is isolated to the file's internals plus the one new versioning field.

---

## 4. File-by-File Execution Plan

| File | Action | Reason |
|---|---|---|
| `lib/territory/canonical-territory-vocabulary.js` | **CREATE** | Single source of truth for territory/storefront codes (Board decision 5) |
| `api/_lib/territory-intelligence.js` | **CREATE** | The Territory Intelligence Engine, implementing the Board-ratified 5-state model (Board decisions 1, 8) |
| `tests/certification/suites/19-territory-intelligence.mjs` | **CREATE** | Self-certification, including the two Board-required proofs (single Apple path; no false `UNAVAILABLE`) |
| `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` | **MODIFY** | Import storefront lists from canonical vocabulary instead of local declaration (3.2) |
| `api/apple-music.js` | **MODIFY** (partial retirement, sequenced late — 3.3) | Remove `checkGlobalStorefrontAvailability`/`checkStorefrontAvailability`/`ALL_APPLE_STOREFRONTS`/`BIG6_STOREFRONTS` only after the Engine path is proven; other exports (ISRC lookup, etc.) unaffected |
| `api/_lib/identity/apple.js` | **MODIFY** (sequenced late — 3.3) | Remove the legacy storefront-check call from `resolveAppleArtist()`, only after Engine regression passes |
| `api/_lib/apple-pal-acquisition.js` | **LEAVE UNCHANGED** | Already requests `Capability.AVAILABILITY` correctly — confirmed live-flowing per the Discovery Correction Record |
| `api/_lib/spotify-pal-acquisition.js` | **LEAVE UNCHANGED (this phase)** | Spotify territory acquisition explicitly out of scope (Board Decision 1); no wiring change needed |
| `api/_lib/deezer-pal-acquisition.js` | **LEAVE UNCHANGED (this phase)** | Same conservative scoping — Deezer not named by the Board, not assumed in scope |
| `provider-acquisition/connectors/spotify/SpotifyConnector.js` | **LEAVE UNCHANGED** | Not touched this phase |
| `provider-acquisition/connectors/deezer/DeezerConnector.js` | **LEAVE UNCHANGED** | Not touched this phase |
| `lib/rie/index.js` | **MODIFY** | Wire `assembleTerritoryIntelligence` call alongside existing assemblers; pass its output into the modified `assembleGlobalMusicFootprint` call (3.5, 3.6) |
| `lib/rie/EvidenceBridge.js` | **LEAVE UNCHANGED (this phase)** | Apple `AVAILABILITY` translation already exists and is exercised today; no Spotify/Deezer translation needed since they are out of scope this phase |
| `api/_lib/global-music-footprint.js` | **MODIFY** | Source from Territory Intelligence Engine output instead of raw Apple canonical data; **output shape unchanged** (3.6) |
| `api/_lib/health-intelligence.js` | **LEAVE UNCHANGED** | Consumes GMF's output, which does not change shape — no downstream impact |
| `public/js/mission-control.js` / `mission-control-renderers.js` / `mc-workspace-context.js` / `runtime-context-mapper.js` | **LEAVE UNCHANGED** | GMF's output contract is explicitly preserved — zero frontend impact by design |
| `api/evidence/contracts/distribution.js` | **MODIFY** | Extend `DISTRIBUTION_CONTRACT` with the Engine's reconciled, evidence-preserving fields (3.7, Board decision 6) |
| `api/registry/fields/distribution.js` | **MODIFY** | Correct stale `spotify_market_count`; add fields for the Engine's real (Apple-sourced) output (3.7) |
| `api/territory-scan.js` | **MODIFY** | Internal acquisition swapped for Territory Intelligence Engine call; product surface preserved; one explicitly-versioned contract change for the Spotify-cross-validation removal (3.8, Board decision 9) |
| `tests/certification/harness.mjs` | **MODIFY** | Register suite 19 |
| `provider-acquisition/capability/capabilityVocabulary.js` | **LEAVE UNCHANGED** | `AVAILABILITY`/`TERRITORIES` capabilities already exist; no new capability needed |
| `api/_lib/delta-engine.js` | **LEAVE UNCHANGED (this phase)** | Territory change-detection integration deferred, not part of the ratified architecture |
| `monitoring/intelligence/MonitoringIntelligence.js` | **LEAVE UNCHANGED (this phase)** | Same — deferred |
| `api/athena/*.js` | **LEAVE UNCHANGED (this phase)** | ATHENA integration deferred |
| All other PAL connectors (TIDAL, YouTube, MusicBrainz, Discogs, MLC, Last.fm, AudioDB, both ACRCloud connectors) | **LEAVE UNCHANGED** | No territory capability, no relevance to this phase |

---

## 5. Implementation Order

1. Create canonical territory vocabulary module (3.1) — foundation
2. Repoint `AppleMusicConnector.js` to import from it (3.2) — verify byte-identical storefront list via diff
3. Repoint `api/apple-music.js`'s own storefront-list declaration to also import from the canonical vocabulary (data unification only — this does **not** yet touch which code path executes; the legacy function still runs, just reading the same list as PAL)
4. Build `api/_lib/territory-intelligence.js` implementing the 5-state model and aggregate policy (3.5), consuming the Apple `AVAILABILITY`/`TERRITORIES` evidence already flowing today
5. Build certification suite 19 (unit-level: mocked evidence, state-model correctness, the no-false-`UNAVAILABLE` proof, and a mocked multi-provider fixture proving the reconciliation policy generalizes even though only Apple feeds it in production) — must reach 100% before proceeding
6. Wire the Engine into `lib/rie/index.js` (3.5)
7. Modify `global-music-footprint.js` to consume the Engine's output, preserving its output shape exactly (3.6)
8. Full RIE regression pass — confirm GMF's rendered output is unchanged for existing test fixtures (expected, since Phase 5.2 is still Apple-only) and every other assembler in the pipeline is unaffected
9. **Only now**: remove the legacy storefront-check call from `identity/apple.js` (3.3)
10. Run the dedicated integration certification proving exactly one Apple storefront acquisition path executes per scan (Section 8) — this proof is only meaningful, and only run, after Step 9
11. Remove the now-fully-unreferenced legacy functions from `api/apple-music.js`
12. Extend `DISTRIBUTION_CONTRACT`/`DISTRIBUTION_FIELDS` (3.7)
13. Rewire `api/territory-scan.js` onto the Engine, including the explicitly-versioned contract change for Spotify-cross-validation removal (3.8)
14. Full certification harness + pipeline test — zero regressions required
15. Completion report + PR + CI + Board review + merge

No Board checkpoints remain in this sequence — all three prior open questions are resolved by the Board Decisions section above and are reflected as normative steps here.

---

## 6. Dependency Graph

```
canonical-territory-vocabulary.js (3.1)
        │
        ├──▶ AppleMusicConnector.js repoint (3.2)
        │
        └──▶ api/apple-music.js repoint (data unification only, legacy path still executes) (3.3 prep)
                    │
                    ▼
             territory-intelligence.js built — Apple evidence only,
             provider-general design (3.4, 3.5)
                    │
                    ▼
             certification suite 19 (must pass, incl. multi-provider-
             fixture policy proof + no-false-UNAVAILABLE proof)
                    │
                    ▼
             wired into lib/rie/index.js
                    │
                    ▼
             global-music-footprint.js converted to consumer (3.6)
                    │
                    ▼
             full RIE regression pass
                    │
                    ▼
             legacy Apple storefront call removed from identity/apple.js (3.3)
                    │
                    ▼
             integration certification: exactly one Apple storefront
             path executes per scan (Section 8)
                    │
                    ▼
             legacy api/apple-music.js functions removed
                    │
                    ▼
             DISTRIBUTION_CONTRACT / DISTRIBUTION_FIELDS extended (3.7)
                    │
                    ▼
             territory-scan.js rewired, versioned contract change
             applied (3.8)
                    │
                    ▼
             full harness + pipeline test + completion report + PR
```

The legacy Apple execution path is deliberately kept alive through the middle of this sequence (it is redundant but harmless, per the Discovery Correction Record) and is only removed after the replacement is built, wired, and regression-tested — never before.

---

## 7. Regression Protection

- Every existing PAL connector certification suite (07 through 18) — **zero regressions permitted**
- `global-music-footprint.js`'s **output shape** — consumers (Mission Control, Health Intelligence) require zero changes
- `health-intelligence.js`'s `deriveFootprintScore()` — must continue functioning against the (shape-unchanged) GMF output
- Mission Control's Global Music Footprint workspace rendering — zero frontend code changes required or expected
- The full RIE pipeline — every other assembler must be unaffected by the new assembler being added alongside them
- `api/territory-scan.js`'s core external HTTP contract (URL, method, tier gating, Supabase table schema) — preserved except for the one explicitly-versioned field documenting the Spotify-cross-validation removal
- `node tests/pipeline-test.mjs` — full pass required at every implementation checkpoint, not just at the end
- Apple identity resolution's non-storefront responsibilities — only the storefront-probe call is removed from `resolveAppleArtist()`; everything else must be unaffected

---

## 8. Certification Checklist

**Functional**
- [ ] Territory Intelligence Engine correctly applies the 5-state model against real Apple evidence for a known test artist
- [ ] A mocked multi-provider fixture (simulating a future Spotify/Deezer contribution) proves the reconciliation *policy* generalizes correctly, even though Phase 5.2 production only feeds Apple evidence
- [ ] **Missing, unsupported, omitted, or timed-out provider evidence never produces `UNAVAILABLE`** — dedicated test cases for each of these conditions, each asserting the result is `UNKNOWN`, `NOT_EVALUATED`, or `ERROR` as appropriate, never `UNAVAILABLE` (Board-mandated proof)
- [ ] Every aggregate result preserves provider evidence, acquisition status, timestamp, source, reason code, and confidence/determinacy — verified structurally, not just spot-checked
- [ ] Canonical vocabulary correctly represents all 167 Apple storefronts with no code lost or corrupted in migration

**Architectural**
- [ ] Territory Intelligence Engine never calls a provider API directly (PAL evidence only)
- [ ] Territory Intelligence Engine is a pure function (no mutation, deep-frozen output, never throws)
- [ ] No connector was modified beyond the storefront-list import change (3.2) — no connector logic altered
- [ ] `AppleMusicConnector` is the only place Apple storefront acquisition logic exists (legacy fully removed)
- [ ] One canonical territory vocabulary — verified via repo-wide search that no second copy exists after migration

**Integration**
- [ ] `lib/rie/index.js` full pipeline run produces a complete CIM with `globalMusicFootprint` populated from the Engine
- [ ] `global-music-footprint.js`'s output shape verified byte-identical in structure (field names/types) to pre-migration, for a fixed test fixture
- [ ] `health-intelligence.js`'s footprint score computed correctly against the new GMF output
- [ ] Mission Control renders the Global Music Footprint workspace correctly with zero frontend changes
- [ ] **Exactly one Apple storefront acquisition path executes per scan** — proven only after the legacy call is removed (Step 9/10), via a direct call-count assertion (e.g., mocked fetch call counting) showing a single 167-storefront sweep, not two (Board-mandated proof)
- [ ] `api/territory-scan.js` returns correctly-shaped, correctly-versioned, tier-gated responses using the Engine internally

**Performance**
- [ ] Legacy/PAL duplicate Apple storefront computation is confirmed eliminated (one 167-sweep per scan, not two) — same proof as above, viewed from a performance angle
- [ ] Territory Intelligence Engine's reconciliation logic completes within the existing RIE pipeline's timing budget (per the `05-performance` certification suite's existing baseline)
- [ ] No performance regression from this phase's scope, since no new provider acquisition is added (Decision 1 keeps this phase acquisition-neutral)

---

## 9. Risks

1. **`identity/apple.js` migration risk (3.3).** The highest-risk step — removing the legacy storefront call could have timing or other dependencies not fully mapped by Discovery. Mitigated by sequencing (Section 5, Steps 9–10 occur only after the Engine is built and regression-tested) and by keeping the legacy functions physically present until proven safe to delete.
2. **Canonical vocabulary migration correctness.** Apple's storefront codes are not uniformly ISO-2; a careless consolidation could silently corrupt a code. Mitigated by a required diff-based verification step before any connector is repointed (3.1).
3. **`api/territory-scan.js`'s contract change is user-visible.** Removing the (currently broken) Spotify cross-validation is an improvement, but it is still a real behavior change for anyone depending on the endpoint's current response shape. Mitigated by explicit versioning and regression testing, per Board Decision 3 — not shipped silently.
4. **Distribution Contract/Registry fields have zero current consumers.** Low risk of breaking anything, but also means there's no existing usage to validate the extension against — the Engine becomes the first real test of whether this schema design was sound.
5. **Future provider expansion (Spotify/Deezer) is deferred, not solved.** This phase deliberately does not resolve Spotify's brute-force-acquisition problem or decide Deezer's inclusion — it only ensures the Engine's design doesn't need rework when that decision is made later. A future phase must still make that call.
6. **RIE merge-layer coupling.** `_mergeApplePalEvidence()`'s deep-merge behavior is depended upon implicitly by this plan (Step 4 consumes evidence assuming PAL's data is already correctly flowing) — any change to that merge function outside this initiative's scope could silently affect the Engine's input without this plan's authors being aware. Worth a brief sanity check at Step 4's start, not a blocking risk.

---

## 10. Merge Readiness Checklist

Before Board approval for merge, all of the following must be true:

- [ ] Every item in Section 8's Certification Checklist is checked and verified, not assumed
- [ ] Full certification harness (`node tests/certification/harness.mjs`) passes with zero regressions across all suites (07–19)
- [ ] `node tests/pipeline-test.mjs` passes in full
- [ ] Legacy Apple storefront duplication is confirmed eliminated — one 167-sweep per scan, not two — via direct call-count proof, not inference
- [ ] No unsupported/missing provider evidence path can produce `UNAVAILABLE` — verified via the dedicated test cases in Section 8, not assumed from code review alone
- [ ] `global-music-footprint.js`'s output shape is verified unchanged for existing consumers
- [ ] Mission Control requires zero code changes and has been manually verified to still render correctly
- [ ] `api/territory-scan.js`'s versioned contract change is documented, tested, and the version marker is present in its response
- [ ] A completion report exists, following the same governance format as every prior Phase in this program (constitutional audit, certification results, production findings, merge recommendation)
- [ ] The PR is scoped to exactly this work — no unrelated connector, ATHENA, or Monitoring Engine changes bundled in
- [ ] Rollback path is documented and confirmed viable at each major step (per Section 3's per-component rollback strategies), not just at the end
