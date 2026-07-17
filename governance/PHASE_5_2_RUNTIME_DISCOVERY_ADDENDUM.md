# Phase 5.2 — Runtime Discovery Addendum

**Status:** DOCUMENTATION ONLY — no implementation performed
**Requested by:** Board Directive, "Phase 5.2 – Runtime Discovery Addendum Required"
**Prepared in response to:** the Step-9 checkpoint finding
(`PHASE_5_2_IMPLEMENTATION_CHECKPOINT_DEAD_CODE_FINDING.md`)

Per the Board Directive: no code was deleted, no legacy Apple code was modified, and no
implementation beyond Step 8 was performed while preparing this addendum. Every finding below is
read-only repository and static-analysis evidence.

---

## 1. Original Assumption

The ratified `PHASE_5_2_TERRITORY_INTELLIGENCE_IMPLEMENTATION_DECREE.md` (Discovery Correction
Record) stated:

> "PAL's Apple `AVAILABILITY` evidence path is not dormant — both legacy
> (`api/apple-music.js` → `identity/apple.js`) and PAL paths execute redundantly on every scan
> today, with `_mergeApplePalEvidence()` giving PAL priority."

Implementation Order **Step 9** was written on that assumption: "Remove the legacy storefront-check
call from `api/_lib/identity/apple.js`'s `resolveAppleArtist()` — ONLY after step 8 passes,"
i.e., eliminate a live duplicate runtime execution, once the new Engine had proven it could stand
alone as the authoritative source.

In short, the assumption had three parts:

1. Legacy Apple storefront acquisition was believed to still execute on every scan.
2. PAL storefront acquisition was believed to execute alongside it, in the same scan.
3. Step 9 therefore proposed removing the duplicate (legacy) execution, leaving PAL as sole source.

---

## 2. Runtime Investigation

Two complementary methods were used: static call-graph tracing from every real entrypoint, and a
search for dynamic-dispatch patterns that static analysis could miss.

### 2a. Entrypoint enumeration

All callers of `runScan()` — the sole scan engine function — were enumerated repository-wide:

```
$ grep -rln "runScan(" . --include="*.js" --include="*.mjs" | grep -v node_modules
tests/p0-diagnostic.mjs
tests/publishing-cert.mjs
api/audit.js                    ← the user-facing /api/audit HTTP handler
api/_lib/run-scan.js             ← defines runScan(); self-reference in comments
api/cron/scan-subscription.js    ← pg-cron monitoring path
api/cron/rescan.js               ← monitoring rescan path
```

Every production runtime path — the free-tier audit endpoint and both monitoring cron jobs —
converges on the same single `runScan()` implementation in `api/_lib/run-scan.js`. There is no
second, independent scan engine.

```
$ grep -n "runScan\|from.*run-scan" api/cron/scan-subscription.js api/cron/rescan.js
api/cron/rescan.js:14:import { runScan } from '../_lib/run-scan.js';
api/cron/rescan.js:80:      const { rawResponse, warnings } = await runScan(artistUrl);
api/cron/scan-subscription.js:22:import { runScan } from '../_lib/run-scan.js';
api/cron/scan-subscription.js:80:    runResult = await runScan(artistUrl);
```

### 2b. Import graph at the point of Apple resolution

`api/_lib/run-scan.js`'s own import block for `identity/apple.js` is the ground truth for what
that module can call, since ES module static imports are the only way a caller can obtain a
reference to an exported function — there is no dynamic `require()`, no `import()` expression, no
computed-property access, and no `eval`/`Function()` construction anywhere in the Apple-related
files (checked explicitly, see 2c):

```js
// api/_lib/run-scan.js, lines 33-38
import {
  resolveAppleArtist,
  resolveAppleArtistName,
  // [RETIRED CANDIDATE] getAppleMusic — replaced by PAL acquisition below.
  // Remove after PAL migration verified + Board approval.
} from './identity/apple.js';
```

`getAppleMusic` is not a bound identifier anywhere in `run-scan.js`. In ES module semantics, an
unimported export cannot be invoked by the importing file under any code path — this is a
language-level guarantee, not an inference from absence of a call expression.

Separately, `run-scan.js` imports the PAL path:

```js
// Phase 3.3 (Apple Production Migration) — PAL Apple acquisition
import { acquireAppleEvidence, synthesizeAppleMusicCompat } from './apple-pal-acquisition.js';
```

and calls it at runtime (`run-scan.js:224`, `run-scan.js:291`).

### 2c. Dynamic-dispatch sweep

To rule out indirect invocation that a plain identifier grep could miss:

```
$ grep -rn "\['getAppleMusic'\]\|\[\"getAppleMusic\"\]" .        → no results
$ grep -rn "eval(\|new Function(" api/_lib/identity/apple.js \
       api/_lib/run-scan.js api/_lib/apple-pal-acquisition.js api/apple-music.js
                                                                   → no results
```

No computed-property dispatch, no `eval`, no dynamic `Function` construction near any Apple
module. Static reachability is therefore conclusive, not merely suggestive.

### 2d. Full repository reference sweep for `getAppleMusic`

```
$ grep -rn "getAppleMusic" . --include="*.js" --include="*.mjs" | grep -v node_modules
api/_lib/run-scan.js:32:   // Phase 3.3 — getAppleMusic() retired; acquisition now routes through PAL.
api/_lib/run-scan.js:36:   // [RETIRED CANDIDATE] getAppleMusic — replaced by PAL acquisition below.
api/_lib/run-scan.js:856:  // parseAppleMusicUrl, getAppleMusic — byte-identical bodies, same
api/_lib/apple-pal-acquisition.js:4:  // REPLACES: direct calls to getAppleMusic() in api/_lib/run-scan.js
api/_lib/identity/apple.js:28:  //   getAppleMusic(artistName, isrc, spotifyTopTracks = [], options = {})
api/_lib/identity/apple.js:49:  // Separate responsibility from getAppleMusic() which is cross-platform
api/_lib/identity/apple.js:164: export async function getAppleMusic(artistName, isrc, spotifyTopTracks = [], options = {}) {
```

Every non-definition hit is a comment documenting the retirement. No test file (`*.test.js`,
`*.spec.js`) references `getAppleMusic` either — it is not exercised by the test suite, only
defined and exported.

### 2e. Live-scan runtime trace — scope note

A true wall-clock runtime trace (instrumenting a live scan and observing actual HTTP calls) was
considered and deliberately not performed, for two reasons consistent with the Board's
constraints: (1) it would require either modifying legacy Apple code to add instrumentation —
explicitly prohibited by this Directive — or issuing live calls to `api.music.apple.com` outside
any authorized implementation step; (2) it is unnecessary here. Because `getAppleMusic` is not a
bound identifier in `run-scan.js`'s module scope, and no dynamic dispatch mechanism exists
anywhere in the reachable code (2c), it is *structurally impossible* — not merely empirically
unobserved — for any live scan to reach `getAppleMusic()`. Static reachability analysis is
conclusive proof in this case, stronger than a sampled runtime trace would be.

---

## 3. Actual Runtime Behaviour

| Function | Location | Live execution? | Role |
|---|---|---|---|
| `getAppleMusic()` | `api/_lib/identity/apple.js:164` | **No.** Not imported by any caller of `runScan()`. Zero references outside comments and its own definition. | Dead code. Contains the two storefront-check calls (`checkGlobalStorefrontAvailability`, `checkStorefrontAvailability`) that Step 9 targeted for removal. |
| `resolveAppleArtist()` | `api/_lib/identity/apple.js:53` | **Yes.** Imported and called by `run-scan.js:539` and `api/identify.js:144`. | Live. Lightweight Apple Music URL parser — resolves a URL to `{name, artworkUrl, appleArtistId, storefront, [trackTitle, trackIsrc]}`. Contains **no** storefront-availability logic; it is a different function from `getAppleMusic()` despite superficially similar naming in the decree's prose. |
| `acquireAppleEvidence()` | `api/_lib/apple-pal-acquisition.js:65` | **Yes.** Imported and called by `run-scan.js:224`. | Live. Sole path that acquires Apple storefront-availability evidence — via PAL, `Capability.AVAILABILITY`, `AppleMusicConnector#fetchGlobalStorefrontAvailability`. |
| `synthesizeAppleMusicCompat()` | `api/_lib/apple-pal-acquisition.js:156` | **Yes.** Imported and called by `run-scan.js:291`. | Live. Reshapes the PAL evidence acquired above into the legacy-compatible `appleMusicData` shape for V1 module consumers — reads from PAL's own bridged evidence, not from `identity/apple.js`. |

**Clear distinction:** `getAppleMusic()` is dead. `resolveAppleArtist()`,
`acquireAppleEvidence()`, and `synthesizeAppleMusicCompat()` are all live, and none of the three
live functions contains storefront-availability logic except `acquireAppleEvidence()` (via PAL).

---

## 4. Architectural Impact

**Claim to evaluate:** *"Duplicate storefront acquisition does not occur during production
scans."*

**Confirmed true.**

Only one code path acquires Apple storefront-availability data on any live scan today:
`acquireAppleEvidence()` → PAL → `AppleMusicConnector#fetchGlobalStorefrontAvailability` →
`Capability.AVAILABILITY`. The legacy path (`getAppleMusic()`'s
`checkGlobalStorefrontAvailability` / `checkStorefrontAvailability` calls) has had zero live
callers since the Phase 3.3 PAL migration retired its call site in `run-scan.js` — evidenced by
that file's own retirement comment and confirmed by the absence of the identifier from its import
statement.

This narrows, but does not invalidate, the decree's broader Discovery Correction Record. That
record's core claim — that PAL is made authoritative over legacy canonical data via
`_mergeApplePalEvidence()` in `lib/rie/index.js` — concerns the **artist-identity/enrichment
merge layer**, a different code path that was not re-examined here and is not affected by this
finding. The redundancy is real at that layer; it is not real, and was not real at any point
since Phase 3.3, at the storefront-availability layer specifically.

---

## 5. Effect on Phase 5.2

Re-evaluating Implementation Order Steps 9–11 against the corrected finding:

- **Step 9** ("remove the legacy storefront-check call") — not a runtime optimization. There is
  no live execution to stop. If performed, this step would be **dead-code removal**
  (`getAppleMusic()` in `identity/apple.js`), not the elimination of a duplicate runtime path.
- **Step 10** ("integration certification proving exactly one Apple storefront acquisition path
  executes per scan") — the property this step was designed to prove is **already true today**,
  and has been true since Phase 3.3. It does not depend on Step 9 being performed. If performed,
  this step would produce a certification of existing behavior, not a proof of a behavior change.
- **Step 11** ("remove now-fully-unreferenced legacy functions" — `checkGlobalStorefrontAvailability`,
  `checkStorefrontAvailability` in `api/apple-music.js`) — these two functions are already fully
  unreferenced by production code today (their only caller, `getAppleMusic()`, is itself
  unreferenced). This is **dead-code removal**, not runtime optimization, and is not gated on
  anything Phase 5.2 built.

None of the three steps, if performed, would change any production system's runtime behavior.

---

## Repository Impact Summary

| Code | Status |
|---|---|
| `getAppleMusic()` (`identity/apple.js:164`) | **Dead.** Exported, unreferenced anywhere in production or tests. |
| `checkGlobalStorefrontAvailability()` (`apple-music.js:324`) | **Dead.** Sole caller (`getAppleMusic()`) is itself dead. |
| `checkStorefrontAvailability()` (`apple-music.js`) | **Dead.** Sole caller (`getAppleMusic()`) is itself dead. |
| `resolveAppleArtist()` (`identity/apple.js:53`) | **Live.** URL-resolution only; not implicated in storefront duplication. |
| `acquireAppleEvidence()` / `synthesizeAppleMusicCompat()` (`apple-pal-acquisition.js`) | **Live.** Sole path for storefront-availability evidence today. |
| `_mergeApplePalEvidence()` (`lib/rie/index.js`) | **Live**, and the decree's redundancy claim holds true *for this layer* (artist-identity/enrichment merge) — not re-audited in depth here; out of scope for this addendum. |

No code in this table is "dormant" in the sense of conditionally reachable-but-not-yet-triggered
(e.g., behind a feature flag) — `getAppleMusic()` and its two helpers are unconditionally
unreachable from any current entrypoint.

---

## 6. Recommendation (technical evidence only — no governance decision)

Technically, `getAppleMusic()`, `checkGlobalStorefrontAvailability()`, and
`checkStorefrontAvailability()` are safe to delete with zero production risk, since deleting
unreferenced code cannot change any running behavior by definition — this is a lower-risk
operation than the "retire a live duplicate path" scenario Steps 9–11 were originally scoped for,
not a higher-risk one. Steps 9 and 11 could proceed as a straightforward cleanup with no
regression exposure. Step 10's certification would then document a "single live path" invariant
that already holds, rather than prove a change caused it to start holding — worth keeping as a
regression guard regardless (it would catch, e.g., a future PR that accidentally reintroduces a
call to `getAppleMusic()`), but it is not gating any correctness property Phase 5.2 depends on.

The Board's decision on how to characterize and schedule this work — as in-scope Phase 5.2
cleanup, as a separate housekeeping item, or deferred entirely — is left to the Board.
