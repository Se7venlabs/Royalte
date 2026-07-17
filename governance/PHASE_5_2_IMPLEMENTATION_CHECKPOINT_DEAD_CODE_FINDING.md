# Phase 5.2 — Implementation Checkpoint: Dead Code Finding

**Status:** IMPLEMENTATION PAUSED — awaiting Board review
**Raised:** during execution of Implementation Order Step 9
**Raised by:** Engineering Agent, per the constitutional rule in the Phase 5.2 Implementation
Authorization: *"If a new architectural issue is discovered: Stop implementation. Document
the finding. Return it to the Board as a Discovery item. Do not solve it during implementation."*

---

## 1. What Step 9 assumed

The ratified Implementation Decree's Discovery Correction Record states that both the legacy
Apple storefront-check path and the PAL Apple storefront-check path "execute redundantly on
every scan today," with PAL made authoritative via `_mergeApplePalEvidence()` in
`lib/rie/index.js`. Implementation Order Step 9 was to remove the legacy call once the new
Territory Intelligence Engine was built, wired, and regression-proven (Steps 1–8, all complete
and green — see §3).

## 2. What was found

Before touching any file, the call graph was traced end-to-end. The legacy storefront-check
code does **not** execute on any live scan:

- The storefront checks (`checkGlobalStorefrontAvailability`, `checkStorefrontAvailability`,
  both in `api/apple-music.js`) are called from exactly one place: `getAppleMusic()` in
  `api/_lib/identity/apple.js:164`.
- `getAppleMusic()` has **zero callers anywhere in the repository** — production or test.
  `api/_lib/run-scan.js` documents it explicitly as retired: `// Phase 3.3 — getAppleMusic()
  retired; acquisition now routes through PAL`, and its import is commented out (lines 36–37).
- `runScan()` — the sole engine entrypoint behind `/api/audit` — calls only two Apple paths:
  1. `resolveAppleArtist(url)` from the same file (`identity/apple.js:53`) — a **different,
     lightweight function** that only parses an Apple Music URL into `{name, artworkUrl,
     appleArtistId, storefront, ...}`. It contains no storefront-availability logic at all.
  2. `acquireAppleEvidence()` / `synthesizeAppleMusicCompat()` from
     `api/_lib/apple-pal-acquisition.js` — the PAL path, which acquires
     `Capability.AVAILABILITY` independently via `AppleMusicConnector`.

Confirmed via repo-wide grep (production code, tests, and comments) — `getAppleMusic` is
referenced only in retirement comments and its own file; never imported or invoked.

## 3. What this does — and does not — affect

**Does not affect:** the Territory Intelligence Engine build itself. Steps 1–8 of the
Implementation Order are complete and independently verified:

- `lib/territory/canonical-territory-vocabulary.js` created, verified byte-identical to prior
  duplicated lists.
- `AppleMusicConnector.js` and `api/apple-music.js` repointed to the canonical vocabulary
  (data-unification only — connector test suite 46/46 green).
- `api/_lib/territory-intelligence.js` (the Engine) built, consuming raw `evidencePackages`
  only, implementing the Board-ratified five-state model and reconciliation policy.
- Certification suite `19-territory-intelligence.mjs` — 49/49 assertions passing, including the
  binding "never false UNAVAILABLE" invariant across every failure mode.
- Engine wired into `lib/rie/index.js`; `api/_lib/global-music-footprint.js` converted to a
  consumer of the Engine's output, output shape unchanged, legacy fallback path preserved for
  any caller not yet passing `territoryIntelligence`.
- Full certification harness re-run after wiring: **1542/1542 assertions passing, zero
  regressions** (all 19 suites, including determinism and all golden fixtures).

**Does affect:** the premise behind Implementation Order Steps 9–11, which assumed a live
redundant fetch to eliminate:

- **Step 9** ("remove the legacy storefront-check call") — there is no live call to remove.
  `getAppleMusic()`'s storefront-check code is already unreachable.
- **Step 10** ("run dedicated integration certification proving exactly one Apple storefront
  acquisition path executes per scan") — this is already true today, and was already true
  before Phase 5.2 began. The redundancy documented in the decree's Discovery Correction Record
  exists at the artist-identity/enrichment merge layer (`_mergeApplePalEvidence()`), not at the
  storefront-availability layer specifically.
- **Step 11** ("remove now-fully-unreferenced legacy functions") — `checkGlobalStorefrontAvailability`
  and `checkStorefrontAvailability` in `api/apple-music.js` are already fully unreferenced by
  production code (their only caller, `getAppleMusic()`, is itself uncalled). Removing them
  would be dead-code deletion, not live-path retirement.

Steps 12–15 (Distribution Contract extension, `territory-scan.js` rewire, full harness re-run,
completion report) do not depend on this finding and are unaffected in scope.

## 4. Correction to the ratified decree

The Discovery Correction Record in `PHASE_5_2_TERRITORY_INTELLIGENCE_IMPLEMENTATION_DECREE.md`
should be read as accurate for the **artist-identity/enrichment merge path** (PAL is authoritative
over legacy canonical data via `_mergeApplePalEvidence()`) but **not accurate** for the
**storefront-availability path** specifically — no legacy storefront fetch has executed on a live
scan since the Phase 3.3 PAL migration retired `getAppleMusic()`'s call site.

## 5. Current state

No files were modified as part of this investigation — read-only tracing only. No further
implementation steps (9 through 15) have been taken. Implementation is paused at this checkpoint
pending Board direction on how Steps 9–11 should be reinterpreted.

## 6. Question returned to the Board

How should Steps 9–11 proceed given the corrected finding — delete the confirmed-dead code as
in-scope cleanup, leave it untouched as out-of-scope, or something else? Steps 12–15 (Distribution
Contract, `territory-scan.js` rewire, full regression, completion report) are ready to resume
once this is resolved.
