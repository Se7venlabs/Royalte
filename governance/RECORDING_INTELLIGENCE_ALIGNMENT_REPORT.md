# ROYALTĒ v3.0 — RECORDING INTELLIGENCE ALIGNMENT

**Type:** Constitutional Architecture Alignment
**Status:** Complete
**Branch:** `recovery/recording-intelligence-alignment`
**Prerequisite:** PR #386 (Normalization Layer Completion), PR #387 (Recording Intelligence Constitutional Review) — Board-approved Option B
**Date:** 2026-07-21

---

## 1. Executive Summary

Implements Option B, as recommended in `governance/RECORDING_INTELLIGENCE_ARCHITECTURE_REVIEW.md` and approved by the Board: Recording Intelligence now consumes a dedicated Recording Evidence object (`api/_lib/recording-evidence.js`) instead of reading `canonicalForEnrichment` directly. This closes the 4th and final instance of ADR-002's CIO-bypass finding — every domain assembler in the codebase now reads a sibling evidence object, none read raw canonical data.

No new architecture was introduced. This reuses the identical pattern already proven three times (Catalog, Backend, Global Music Footprint).

---

## 2. Phase 1 — Recording Pipeline Audit (verified before coding)

| Field | Origin | Normalization point (before this change) | Consumer | Owner (before) | Owner (after) |
|---|---|---|---|---|---|
| `subject.artistName` | Identity Resolution | `normalizeAuditResponse.js` (`_normalizeSubject`) | `buildCanonicalRecordings()` artist-matching | `recording-intelligence.js` (inline read) | `recording-evidence.js` |
| `platforms.spotify.details.topTracks` | Spotify PAL (`Capability.TRACKS`) | **Path B only** — `EvidenceBridge.translateSpotifyTopTracks()` (`EvidenceBridge.js:315-333`), merged into Path A's output by `_mergeApplePalEvidence()` because Spotify is merge-authoritative. Path A (`normalizeAuditResponse.js`) never populates this field — `spotify.details` is hardcoded `null` there. | `recording-normalizer.js#normalizeSpotifyTracks()` | `recording-intelligence.js` (inline read) | `recording-evidence.js` |
| `platforms.musicbrainz.details.recordings` | MusicBrainz PAL (`Capability.TRACKS`, confirmed actually requested and fetched — `mb-pal-acquisition.js:99`) | **Path B only** — `EvidenceBridge.translateMusicBrainzRecordings()` (`EvidenceBridge.js:403-421`) computes real data, but MusicBrainz is not merge-authoritative, so it is discarded at the Path A/B merge boundary every scan (N1, `governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md`). Always `[]` in `canonicalForEnrichment`. | `recording-normalizer.js#normalizeMusicBrainzRecordings()` | `recording-intelligence.js` (inline read) | `recording-evidence.js` |

This table matches, field-for-field, the Constitutional Review's Phase 1/Phase 3 findings (PR #387) — no new evidence was needed beyond re-confirming line numbers against current `main`.

---

## 3. Changes

| File | Change | Why |
|---|---|---|
| `api/_lib/recording-evidence.js` (**new**) | `assembleRecordingEvidence(canonical)` — pure structural relocation of the 3 fields above into `{ artistName, spotifyTopTracks, musicbrainzRecordings }`. Deep-frozen, never-throws (retrofitted try/catch, matching the invariant on all 3 precedents). Header documents the Spotify/EvidenceBridge dependency and the MusicBrainz N1 dead-path explicitly — the review's two most important findings now have a permanent home in code, not just in a governance report. | Constitutional owner of Recording Evidence, mirroring `catalog-evidence.js`/`backend-evidence.js`/`global-footprint-evidence.js` exactly. |
| `lib/recording/recording-intelligence.js` | `assembleRecordingIntelligence()` signature changed from `(canonicalForEnrichment)` to `(recordingEvidence)`. Deleted the two inline extraction functions (`extractSpotifyTracks`, `extractMBRecordings`) — their logic moved, unchanged, into the new evidence file. Added a defensive `safe = ...` guard on the input (matching the other 3 precedents' intelligence-layer signatures) since the function no longer trusts a specific raw shape. Header comment updated to reflect the new evidence source and cross-reference ADR-002/the Constitutional Review. | Recording Intelligence now performs intelligence only — no structural relocation, no provider-shape awareness at the top level (individual-record reshaping still correctly lives in `recording-normalizer.js`, which is business-adjacent normalization, not structural relocation — see Constitutional Review §Phase 3). |
| `lib/rie/index.js` | One new import (`assembleRecordingEvidence`), one new call site (`const recordingEvidence = assembleRecordingEvidence(canonicalForEnrichment)`, immediately before the existing `assembleRecordingIntelligence` try/catch), header violation-list comment updated to record this as RESOLVED (matching the 3 existing RESOLVED blocks' exact format). | Wires the new evidence object into the pipeline, same call-site pattern as the 3 precedents (lines 458/475/484). |
| `tests/certification/suites/06-recording-intelligence.mjs` | Imports `assembleRecordingEvidence`; the 3 direct calls to `assembleRecordingIntelligence(<raw canonical fixture>)` now go through `assembleRecordingIntelligence(assembleRecordingEvidence(<raw canonical fixture>))` first, matching the real production call chain. Fixture data itself is byte-identical — only the call chain changed. The 2 direct `assembleRecordingIntelligence(null/undefined)` never-throws assertions are unchanged, since they test the intelligence assembler's own defensive input handling independent of what feeds it. | The function's input contract changed; the Board Certification Harness must exercise the real chain, not a shape that no longer matches production. |
| `tests/certification/suites/07-musicbrainz-connector.mjs` | Same change, same reasoning, for its 3 direct calls (MB+Spotify fixture, MB-only fixture, empty-MB-recordings fixture). | Same as above — this suite specifically certifies the MusicBrainz-into-Recording-Intelligence path, which still needs to work through the new evidence layer. |
| `governance/adr/ADR-002-CIO-Scope.md` | Final Resolution section updated: Recording Intelligence marked resolved, ADR marked fully closed (4 of 4). | Required governance update, per Board directive. |
| `governance/RECORDING_INTELLIGENCE_ARCHITECTURE_REVIEW.md` | One postscript paragraph appended (implementation completed, pointer to this report). Historical analysis left unedited, per the repo's append-only convention. | "Update... only where necessary. Do not rewrite historical governance." |

**No file outside this list was touched.** Confirmed via `git status` before staging — Catalog Intelligence, Backend Intelligence, Global Music Footprint, CIO, CIM, Runtime Context, and Mission Control files are absent from the diff.

---

## 4. Recording Evidence Contract

| | |
|---|---|
| **Module** | `api/_lib/recording-evidence.js` |
| **Entrypoint** | `assembleRecordingEvidence(canonical)` — sole exported function |
| **Input** | `canonicalForEnrichment` (the normalized `AuditResponse` shape) |
| **Output** | `{ artistName: string, spotifyTopTracks: Array, musicbrainzRecordings: Array }` |
| **Owner** | `api/_lib/recording-evidence.js` — sole assembler, sole call site |
| **Validator** | None dedicated — consistent with all 3 precedents (Catalog/Backend/Global Footprint Evidence also have no dedicated validator; the pure-relocation contract is enforced by convention and by the deep-freeze + defensive-typeof checks inline) |
| **Immutability** | Deep-frozen on return (`deepFreeze()`), including both array fields; never mutates its input |
| **Never-throws** | Explicit try/catch wraps the entire function body, matching the invariant retrofitted into all 3 precedents; malformed/hostile input returns the same empty-shell shape the happy path would return for absent evidence |
| **Version** | Unversioned — consistent with all 3 precedents (none export a version constant; deliberately not introducing one here to avoid inventing a new sub-pattern the other 3 don't share) |
| **Call sites (per scan)** | Exactly one — `lib/rie/index.js`, immediately before `assembleRecordingIntelligence()` runs |
| **Consumers** | `lib/recording/recording-intelligence.js`'s `assembleRecordingIntelligence()` only |
| **Business logic** | None — no classification, no scoring, no cross-provider merging, no provider decisions. All of that remains in `recording-intelligence.js` and its own downstream modules (`recording-normalizer.js`, `canonical-recording.js`, `isrc-certification.js`, `recording-confidence.js`), unchanged. |

### Canonical ownership chain (Phase 7)

```
canonicalForEnrichment
        ↓
api/_lib/recording-evidence.js — assembleRecordingEvidence()   [exactly one assembler, exactly one owner]
        ↓
Canonical Recording Evidence { artistName, spotifyTopTracks, musicbrainzRecordings }
        ↓
lib/recording/recording-intelligence.js — assembleRecordingIntelligence()   [exactly one intelligence consumer]
        ↓
CIM §8.2.13 `recording`
```

No duplicate structural transformation exists — `recording-normalizer.js`'s per-record reshaping is downstream business-adjacent normalization (provider-native shape → `NormalizedTrack`), not a second relocation of the same three raw fields.

---

## 5. Phase 5 — Migration Dependency Elimination (verified, not assumed)

**Does Recording Intelligence still rely on EvidenceBridge merge behavior?** Yes, structurally unavoidable within this alignment's scope — `spotifyTopTracks` is still only non-empty because of the Path B→Path A merge (unchanged; that mechanism lives in `lib/rie/index.js#_mergeApplePalEvidence()`, not in Recording Intelligence). **What changed:** this dependency is no longer *undocumented*. It is now named explicitly in `recording-evidence.js`'s header, in the one place a future engineer would look when asking "where does Spotify top-track data come from." Per the Board's own Phase 5 instruction ("Do NOT remove EvidenceBridge functionality that other production modules still require. Only remove Recording Intelligence's dependency upon it" — the *undocumented* dependency, not the underlying mechanism), this alignment does not and should not touch `EvidenceBridge.js` or `_mergeApplePalEvidence()` itself; that remains ADR-004's decision.

---

## 6. Phase 6 — MusicBrainz Verification

**Confirmed: architectural defect, not intentional.** No comment, ADR, or certification anywhere in the repository states MusicBrainz recording evidence should be excluded from Recording Intelligence. `EvidenceBridge.translateMusicBrainzRecordings()` computes real, correctly-shaped data from a real PAL acquisition every scan; it is discarded purely because MusicBrainz isn't in `_mergeApplePalEvidence()`'s 2-provider merge allowlist (Apple, Spotify only) — the same N1 finding from the Normalization Layer Completion audit, manifesting here.

**Action taken:** `recording-evidence.js` preserves the read (`musicbrainzRecordings` remains part of the contract, structurally ready to receive real data the instant ADR-004 promotes MusicBrainz to merge-authoritative — zero further code changes would be required). No metadata was fabricated; the field remains honestly `[]` today, exactly as before. Fixing N1 itself is explicitly out of scope for this alignment (Board non-goal: "Expand MusicBrainz support") — that decision belongs to ADR-004.

---

## 7. Updated Architecture Diagram

### Before

```
Provider (Spotify, MusicBrainz)
    ↓
PAL Acquisition
    ↓
Normalization (Path A / Path B split — unchanged by this alignment)
    ↓
canonicalForEnrichment
    ↓
Recording Intelligence  ◀── read canonicalForEnrichment directly
    (extractSpotifyTracks / extractMBRecordings inline,
     THEN normalize / merge / certify / score)
    ↓
Consumers (CIM §8.2.13)
```

### After

```
Provider (Spotify, MusicBrainz)
    ↓
PAL Acquisition
    ↓
Normalization (Path A / Path B split — unchanged by this alignment)
    ↓
canonicalForEnrichment
    ↓
Recording Evidence  ◀── api/_lib/recording-evidence.js (NEW)
    (structural relocation only: artistName, spotifyTopTracks, musicbrainzRecordings)
    ↓
Recording Intelligence  ◀── reads Recording Evidence only
    (normalize / merge / certify / score — intelligence only, zero raw-canonical awareness)
    ↓
Consumers (CIM §8.2.13)
```

The Path A/Path B normalization split itself (and its N1 finding) is unchanged — this alignment moves *where* Recording Intelligence's evidence is read from, not *how* it is produced upstream.

---

## 8. Regression Report

### New coverage

Both existing certification suites that directly exercise `assembleRecordingIntelligence()` were updated (not just re-run) to match the new call chain, and both are part of the permanent Board Certification Harness:

- `tests/certification/suites/06-recording-intelligence.mjs` — Groups A-I, 83 assertions
- `tests/certification/suites/07-musicbrainz-connector.mjs` — Groups A-H, 96 assertions

No new standalone test file was created for `recording-evidence.js` itself, consistent with precedent — none of the 3 prior sibling evidence objects (`catalog-evidence.js`, `backend-evidence.js`, `global-footprint-evidence.js`) have a dedicated unit test file either; all are exercised through the certification harness and their downstream domain's own suite, exactly as `recording-evidence.js` now is (both suites 06 and 07 call `assembleRecordingEvidence()` directly, including its null/empty/malformed-input edge cases via existing groupF/groupG/groupH assertions).

### Full battery results

| Suite | Result | Notes |
|---|---|---|
| `tests/pipeline-test.mjs` | ✅ 222 + 8 | Unaffected — no fixture drift (Recording Intelligence output shape unchanged) |
| `tests/canonical-scan-subject-test.mjs` | ✅ 6/6 | Unaffected |
| `tests/release-identity-completion-test.mjs` | ✅ 7/7 | Unaffected |
| `tests/normalization-layer-completion-test.mjs` | ✅ 5/5 | Unaffected |
| `provider-acquisition/.../AppleMusicConnector.test.js` | ✅ 47/47 | Unaffected |
| `tests/territory-scan-test.mjs` | ✅ 31/31 | Unaffected — no regression in Territory Intelligence |
| `tests/cio-assembler-test.mjs` | ✅ 17/17 | Unaffected — no regression in CIO |
| `lib/rie/__tests__/rie-activation.test.js` | ✅ 20/20 | Unaffected |
| **`tests/certification/harness.mjs`** | ✅ **1588/1588, full suite CERTIFIED** | **Includes the 2 modified suites: 06-recording-intelligence (83/83), 07-musicbrainz-connector (96/96) — both fully green with the new call chain.** Suites 01 (Golden Fixture Regression, 8 fixtures), 02 (Determinism, 21 fixtures), 03 (Artist Library, 12 archetypes), 04 (CIM Structural Integrity) all pass — confirms no regression in Catalog Intelligence, Backend Intelligence, Global Music Footprint, CIO, or CIM. |
| `lib/rie/__tests__/scan-migration.test.js` | ⚠ 35/36 | **Pre-existing failure**, confirmed unrelated (Capability vocabulary count 24 vs. 22), present identically before this branch — not introduced or affected by this work. |

**Runtime Context** (`public/js/runtime-context-mapper.js`) and **Mission Control**: not independently re-tested by this session (no dedicated automated suite invoked for either in this battery), but both read `cim.recording`, whose shape is unchanged (§9) — no code path in either was touched.

**New failures introduced by this alignment: zero.**

---

## 9. Contract Verification — CIO / CIM / Runtime Context / Mission Control unchanged

- **CIO** — untouched. Recording Intelligence has never read the CIO; this change doesn't add that dependency.
- **CIM** — `RecordingIntelligence`'s *output* shape (§8.2.13) is byte-identical: same fields (`_version`, `recordingCount`, `certifiedCount`, `singleSourceCount`, `conflictCount`, `unconfirmedCount`, `isrcCoveragePercent`, `overallConfidence`, `recordings[]`, `generatedAt`), same `null`-when-no-evidence behavior. Confirmed by Suite 04 (CIM Structural Integrity) passing unchanged.
- **Runtime Context** — `runtime-context-mapper.js` reads `cim.recording`, which is unaffected.
- **Mission Control** — no workspace-facing shape changes; nothing in `public/` was touched.
- **Persistence** (`audit_scans.payload.cim.recording`) — unaffected.

---

## 10. Risk Assessment

**Risk: Low.** Identical shape of change to three already-successful precedents in this exact codebase, each of which shipped with zero downstream contract changes. The one functional difference from the precedents — `assembleRecordingIntelligence()`'s signature actually changing (the 3 precedent intelligence modules also changed signature, e.g. `assembleCatalogIntelligence(report, cio, catalogEvidence)`) — was handled the same way those were: update the call site, update the certification suites that call the function directly, verify via the full harness.

**What could go wrong, and why it didn't:** the two certification suites (06, 07) that call `assembleRecordingIntelligence()` directly, bypassing `runRIE()`, would have silently broken (received a raw-canonical-shaped fixture the new signature no longer parses, producing `null` results instead of populated ones) if not updated. Caught and fixed as part of this same PR — both suites now pass at their original assertion counts (83 and 96 respectively), confirming their intent was fully preserved, not just made to pass trivially.

## Rollback Plan

Revert the single commit on this branch. All 7 changed files (§3) revert together cleanly — `recording-intelligence.js`'s signature and `lib/rie/index.js`'s call site are interdependent and must move together (consistent with ADR-002's own Migration Strategy note: "any rollback must revert the assembler signature and the call site together, or the pipeline throws"). No persisted-data concern — CIM is rebuilt fresh per scan, so no historical `audit_scans` rows require migration in either direction. No version bump required — this is an internal wiring change, not a shape change to any versioned contract (`AUDIT_RESPONSE_VERSION`, `CIO_VERSION`, `CIM_VERSION` all unaffected).

---

## 11. Success Criteria — verified

- ✓ Recording Intelligence consumes Recording Evidence — `lib/recording/recording-intelligence.js:93`
- ✓ Structural relocation exists in one place — `api/_lib/recording-evidence.js`, sole owner
- ✓ Recording Intelligence performs intelligence only — no raw-canonical reads remain (verified: zero references to `canonicalForEnrichment` in `recording-intelligence.js` post-change)
- ✓ Migration-layer *dependency* is no longer undocumented (the mechanism itself is unchanged, correctly — see §5)
- ✓ MusicBrainz recording evidence is preserved, not fabricated, and the reason it's empty is documented (§6)
- ✓ No duplicate normalization exists — confirmed, one relocation, one intelligence pass
- ✓ CIO / CIM / Runtime Context / Mission Control unchanged (§9)
- ✓ Regression suite passes — 1588/1588 on the full certification harness, zero new failures (§8)
- ✓ Constitutional architecture is now consistent across Catalog, Backend, Global Music Footprint, and Recording Intelligence — ADR-002 fully closed

Not merged — holding for Executive Architecture Board review of implementation, regression evidence, governance updates, certification results, and the architectural comparison, per the Final Board Directive.
