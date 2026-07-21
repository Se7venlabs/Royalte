# ROYALTĒ v3.0 — RECORDING INTELLIGENCE CONSTITUTIONAL REVIEW

**Type:** Architecture Validation (No Implementation Unless Justified)
**Status:** Complete — analysis only, no production code changed
**Branch:** `architecture/recording-intelligence-review`
**Prerequisite:** `governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md` (PR #386, merged)
**Date:** 2026-07-21

---

## Constitutional Question

> Should Recording Intelligence consume a dedicated Recording Evidence object, or is direct consumption of `canonicalForEnrichment` the correct constitutional design?

**Answer: Recording Intelligence should adopt a dedicated Recording Evidence object. This is Option B.** The evidence below shows Recording Intelligence is not intentionally different from Catalog, Backend, or Global Music Footprint — it is the same architectural gap those three had, on a smaller field surface, plus one additional, more serious risk the other three never had: its only currently-live evidence field exists solely as a side effect of the very migration-only mechanism (`EvidenceBridge`) this codebase has repeatedly stated must never become a permanent dependency.

---

## Phase 1 — Current Architecture

### Pipeline trace (as it runs today)

```
Provider (Spotify, MusicBrainz)
    ↓
PAL Acquisition
    spotify-pal-acquisition.js → acquireSpotifyEvidence()
    mb-pal-acquisition.js      → acquireMBEvidence()  (requests Capability.TRACKS — real API call, real data returned)
    ↓
TWO PARALLEL, INDEPENDENT NORMALIZATION PATHS (per governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md §2)
    ↓
Path A (run-scan.js → normalizeAuditResponse.js)          Path B (EvidenceBridge.bridgeToCanonical())
    spotify.details = null, ALWAYS                          translateSpotifyTopTracks() → platforms.spotify.details.topTracks[]
    musicbrainz.details = null, ALWAYS (simple())            translateMusicBrainzRecordings() → platforms.musicbrainz.details.recordings[]
    ↓                                                         ↓
    canonicalForEnrichment (spotify.details: null)      bridged (spotify.details.topTracks: [...], musicbrainz.details.recordings: [...])
    ↓                                                         ↓
    └──────────────────────── _mergeApplePalEvidence() ──────┘
                    ↓
    Spotify: MERGE-AUTHORITATIVE → bridged.platforms.spotify deep-merges OVER
             canonicalForEnrichment.platforms.spotify (details: null → details: {topTracks:[...]})
             ⚠ This is the ONLY way platforms.spotify.details ever becomes non-null anywhere
             in the pipeline. Path A alone never populates it.
    MusicBrainz: NOT merge-authoritative → bridged.platforms.musicbrainz is DISCARDED.
             canonicalForEnrichment.platforms.musicbrainz.details stays null. Permanently.
                    ↓
    canonicalForEnrichment (final, post-merge)
                    ↓
    assembleRecordingIntelligence(canonicalForEnrichment)     ◀── lib/rie/index.js:523
                    ↓
    ┌─────────────────────────────────────────────────────────────────┐
    │  INLINE, in lib/recording/recording-intelligence.js:              │
    │  extractSpotifyTracks(cfe)  → cfe.platforms.spotify.details.topTracks     (LIVE — via Path B merge)
    │  extractMBRecordings(cfe)   → cfe.platforms.musicbrainz.details.recordings (DEAD — always [])
    │  ── this is structural relocation: raw canonicalForEnrichment paths ──
    └─────────────────────────────────────────────────────────────────┘
                    ↓
    recording-normalizer.js   — normalizeSpotifyTracks() / normalizeMusicBrainzRecordings()
                                 provider shape → NormalizedTrack (business-adjacent normalization)
                    ↓
    canonical-recording.js    — buildCanonicalRecordings() — cross-provider title-key merge (business logic)
                    ↓
    isrc-certification.js     — certifyISRCs() — VERIFIED/SINGLE_SOURCE/CONFLICT/UNABLE_TO_CONFIRM (business logic)
                    ↓
    recording-confidence.js   — computeRecordingConfidence() / computeOverallConfidence() (business logic)
                    ↓
    computeStats() (inline)   — aggregation (business logic)
                    ↓
    RecordingIntelligence object → CIM §8.2.13 `recording` slot
                    ↓
    audit_scans.payload.cim.recording → runtime-context-mapper.js → Mission Control (if any workspace reads it)
```

### Every input

- `canonicalForEnrichment.subject.artistName` (string)
- `canonicalForEnrichment.platforms.spotify.details.topTracks` — **live**, but only via the Path B/EvidenceBridge merge side-effect described above
- `canonicalForEnrichment.platforms.musicbrainz.details.recordings` — **dead**, always `[]`, discarded at the Path A/B merge boundary (N1, `governance/NORMALIZATION_LAYER_COMPLETION_REPORT.md` §1.2)
- Apple TRACKS evidence — **not yet wired at all**. `recording-intelligence.js`'s own header names this as "Future evidence... when Apple TRACKS flow through PAL" (line 18-19). Confirmed: `apple-pal-acquisition.js` requests `ARTIST_IDENTITY`, `ALBUMS`, `VIDEOS`, `ISRC`, `AVAILABILITY` — never `TRACKS`. Apple contributes zero evidence to Recording Intelligence today.

### Every transformation

1. Extract 2 raw fields from `canonicalForEnrichment` (structural relocation — 9 lines, `recording-intelligence.js:46-54`)
2. Reshape each provider's native track shape into a common `NormalizedTrack` (`recording-normalizer.js`)
3. Cross-provider merge by title-key into `CanonicalRecording[]` (`canonical-recording.js`)
4. ISRC certification classification (`isrc-certification.js`)
5. Per-recording + overall confidence scoring (`recording-confidence.js`)
6. Stats aggregation (inline `computeStats()`)

### Every output

A single frozen `RecordingIntelligence` object (`_version`, counts by certification status, `isrcCoveragePercent`, `overallConfidence`, `recordings[]`, `generatedAt`) — or `null` when no evidence exists. This becomes CIM §8.2.13's `recording` field. Output shape is fixed regardless of which provider(s) contributed input — confirmed no consumer-visible difference exists between "Spotify only" and "Spotify + MusicBrainz" beyond the resulting `recordings[]` contents.

---

## Phase 2 — Comparison Against Other Domains

| | Catalog Intelligence | Backend Intelligence | Global Music Footprint | **Recording Intelligence** |
|---|---|---|---|---|
| **Input (post-recovery)** | `catalogEvidence` (sibling object) | `backendEvidence` (sibling object) | `globalFootprintEvidence` (sibling object) | **`canonicalForEnrichment` directly** |
| **Relocation logic location** | `api/_lib/catalog-evidence.js` — separate file, sole purpose | `api/_lib/backend-evidence.js` — separate file, sole purpose | `api/_lib/global-footprint-evidence.js` — separate file, sole purpose | **Inline** — `extractSpotifyTracks`/`extractMBRecordings`, top of `recording-intelligence.js` |
| **Relocation surface (field count)** | 6 fields (`appleAlbums`, `appleAvailability`, `isrcComparison`, `discogsReleases`, `discogsTotalReleases`, `fallbackCounts` ×4) | **4 fields** (`musicbrainzAvailability`, `discogsAvailability`, `lastfmAvailability`, `scannedAt`) | Apple availability + legacy storefront fallback shape | **2 fields** — smaller than every precedent, including Backend's 4 |
| **Evidence object business logic** | None — pure relocation, no classification/thresholds | None — pure relocation, no state resolution | None — pure relocation | N/A — no evidence object exists |
| **Validation** | None dedicated (consistent — none of the 3 precedents have one either) | None dedicated | None dedicated | N/A |
| **Consumers** | Catalog Intelligence only | Backend Intelligence only | Global Music Footprint only | N/A |
| **Immutability** | Deep-frozen (`deepFreeze()`) | Deep-frozen | Deep-frozen | The *final* `RecordingIntelligence` output is frozen; the raw extraction step (`extractSpotifyTracks`/`extractMBRecordings`) produces plain, unfrozen arrays — no immutability contract on the intermediate relocated data |
| **Never-throws guarantee** | Explicit try/catch, retrofitted specifically for this invariant | Explicit try/catch, retrofitted specifically for this invariant | Explicit try/catch | `assembleRecordingIntelligence`'s own outer try/catch covers the whole pipeline including extraction — same guarantee, achieved without a dedicated evidence-object layer |
| **Dependency on EvidenceBridge merge side-effect** | **No** — `appleAlbums` (Apple's richest field) is populated by Path A alone (`synthesizeAppleMusicCompat()`), not by the Path B merge. Discogs fields read `.availability`/newly-fixed `.details.totalReleases`, also Path A-sourced. | **No** — reads only `.availability` fields (musicbrainz/discogs/lastfm), which Path A populates directly via `simple()`, independent of any Path B merge. | **No** — same pattern, Apple-sourced via Path A. | **Yes, uniquely.** `platforms.spotify.details` is `null` from Path A alone, unconditionally. The *only* live evidence Recording Intelligence has ever received exists because Spotify happens to be one of the two providers `_mergeApplePalEvidence()` merges from Path B. No other domain in the codebase has this dependency. |
| **Internal modularity beyond the relocation question** | Single file, single function | Single file, single function | Single file, single function | **4 separate files** already exist downstream of extraction (`recording-normalizer.js`, `canonical-recording.js`, `isrc-certification.js`, `recording-confidence.js`) — materially more internal separation of concerns than any of the 3 precedents had even before their own recovery |

### Where Recording differs, precisely

1. **Smaller relocation surface** (2 fields vs. 4-6) — not a disqualifying difference; Backend's precedent already proves field count isn't the deciding factor.
2. **No dedicated evidence-object file** — the one structural difference that matters for the constitutional question.
3. **A materially larger, already-well-factored downstream pipeline** — Recording Intelligence is not "one big function," unlike the pre-recovery state of the other three. This is a genuine point in Recording's favor: it already embodies more separation-of-concerns discipline than its peers did before their own fixes.
4. **A unique, undocumented dependency on EvidenceBridge's Spotify merge** — this is new evidence, not present in any of the three precedent certifications, and it argues *for* extracting a dedicated evidence object (so this dependency has one obvious place to be documented), not against it.

---

## Phase 3 — Functional Analysis (verified from source, not assumed)

What Recording Intelligence actually calculates, per file:

- **Recording metadata / track intelligence** (`recording-normalizer.js`): provider-native track shape → common `NormalizedTrack` (title, ISRC validated + uppercased via regex, duration, artist name, popularity). Provider-specific quirks handled per source (e.g., MusicBrainz's `isrcs[]` array → first valid ISRC).
- **Cross-provider merge / master-recording relationship** (`canonical-recording.js`): `buildCanonicalRecordings()` merges Spotify + MusicBrainz records by title-key into one `CanonicalRecording` per distinct recording, tracking which providers contributed.
- **ISRC analysis / certification** (`isrc-certification.js`): classifies each canonical recording as `VERIFIED` (multiple sources agree), `SINGLE_SOURCE`, `CONFLICT` (sources disagree), or `UNABLE_TO_CONFIRM`.
- **Confidence scoring** (`recording-confidence.js`): per-recording and overall (mean) confidence score, 0.0-1.0.
- **Duplicate recording analysis**: implicit in the title-key merge (`canonical-recording.js`) — this is how duplicates across providers get collapsed into one canonical entry, rather than a separate detection pass.
- **NOT calculated:** version detection (no explicit remaster/live/remix differentiation found), audio identifiers beyond ISRC (no ACRCloud/audio-fingerprint integration found in this module — ACRCloud exists elsewhere in the Engine Provider Registry but is not wired into Recording Intelligence).

**This is real, substantial business analysis** — the bulk of the module's ~300+ combined lines across its 5 files is classification, scoring, and cross-provider reconciliation, not data shuffling. The 9-line extraction step is a small fraction of the total, but it is present, and it is the specific thing the constitutional question asks about.

---

## Phase 4 — Architectural Necessity

**Does Recording Intelligence perform only business analysis?** No.

**Does it still perform structural relocation?** Yes — `extractSpotifyTracks()` and `extractMBRecordings()` (`recording-intelligence.js:46-54`) read raw, provider-namespaced paths directly off `canonicalForEnrichment` (`platforms.spotify.details.topTracks`, `platforms.musicbrainz.details.recordings`). This is definitionally the same operation `catalog-evidence.js`/`backend-evidence.js`/`global-footprint-evidence.js` were built to isolate — relocating fields out of provider-namespaced paths into a domain-scoped shape, before any business logic runs.

**Would a dedicated Recording Evidence object remove that responsibility?** Yes, directly and completely — the two extraction functions would move, verbatim in logic (only their location changes), into a new sibling file; `recording-intelligence.js` would receive an already-relocated `{ spotifyTopTracks, musicbrainzRecordings }` shape instead of raw `canonicalForEnrichment`, exactly mirroring how `catalog-intelligence.js` now receives `catalogEvidence` instead of raw canonical data.

---

## Phase 5 — Risk Assessment

### If Recording remains unchanged

- **The precedent set by Catalog/Backend/GMF becomes inconsistent without a documented reason.** A future engineer (or a future audit, exactly like this one) will re-discover the same gap and re-ask the same question, since nothing distinguishes Recording's case as "intentionally different" — the evidence shows it is not.
- **The hidden EvidenceBridge/Spotify dependency stays undocumented.** If `EvidenceBridge` is ever reduced or retired per its own stated charter (`EvidenceBridge.js:15-34`, "shall be reduced and ultimately removed") without this dependency being surfaced first, Recording Intelligence's only live evidence source silently disappears — `assembleRecordingIntelligence` would then always return `null` (its own designed-in empty-evidence behavior), with no error, no warning, just a permanently-empty CIM field from that point forward. This is a real, if currently dormant, risk specific to Recording Intelligence that none of the other three domains carry.
- **If `normalizeAuditResponse.js`'s shape ever changes** (e.g., a future fix to Spotify's `.details` handling, analogous to this session's Discogs fix), `recording-intelligence.js` has a direct, undocumented dependency on the exact path it reads today — no abstraction boundary catches the break early.

### If Recording adopts the sibling evidence pattern (Option B)

**Benefits:**
- Consistency — closes ADR-002 completely (4 of 4 resolved), producing a clean, exception-free invariant.
- The new file is the natural place to document the EvidenceBridge/Spotify dependency explicitly (mirroring how `backend-evidence.js` already documents its own MLC-exclusion nuance in its header) — turning a silent risk into a visible, commented one, even though it doesn't eliminate the underlying dependency (only ADR-004 can do that).
- Small, proven-pattern change — same shape of diff as three already-successful precedents in this exact codebase.

**Risks:**
- None beyond what the three precedents already demonstrated and resolved cleanly. No new risk class is introduced.
- The MusicBrainz field would move into the new evidence object still permanently empty (N1-caused) — worth an explicit one-line note in the new file so it isn't mistaken for a bug in the new code itself.

**Would any existing contracts change?**
- **CIO** — No. Recording Intelligence has never read the CIO and this change doesn't add that; it only changes the *shape* of what feeds `assembleRecordingIntelligence`, not the CIO's own schema.
- **CIM** — No. `RecordingIntelligence`'s *output* shape (§8.2.13) is entirely unaffected — same fields, same semantics, same `null`-when-no-evidence behavior. Confirmed: none of the three precedent migrations changed their respective CIM slot's output shape either, only their input source.
- **Runtime Context** (`public/js/runtime-context-mapper.js`) — No. It reads `cim.recording`, which doesn't change.
- **Mission Control** — No. Same reasoning; no workspace-facing shape changes.
- **Persistence** (`audit_scans.payload`) — No. `cim.recording`'s persisted shape is unaffected.

This is the same conclusion the three precedent PRs each reached and verified — Option B's risk profile here is not novel.

---

## Phase 6 — Recommendation

# Option B — Introduce a dedicated Recording Evidence object

**Why:** The evidence shows Recording Intelligence is not architecturally different from Catalog, Backend, or Global Music Footprint in the one dimension that matters constitutionally — it performs real structural relocation directly against `canonicalForEnrichment`'s raw, provider-namespaced paths. The smaller field count (2 vs. 4-6) does not distinguish it, since Backend Intelligence already set precedent with an equally small (4-field) surface. The one genuine difference found — Recording's already-substantial internal modularity across 4 downstream files — is a point in favor of how *clean* this migration would be, not a reason to skip it: the new evidence object would slot in as a fifth, upstream-most stage of an already well-factored pipeline. The newly-discovered EvidenceBridge/Spotify dependency is, if anything, the strongest argument for doing this: it is currently undocumented anywhere in the codebase, and a dedicated evidence-object file is the natural, precedented place (matching `backend-evidence.js`'s own header pattern) to make it explicit.

**Expected scope:**
- New file: `api/_lib/recording-evidence.js` — pure relocation, `assembleRecordingEvidence(canonicalForEnrichment)`, returning `{ spotifyTopTracks: Array, musicbrainzRecordings: Array }`. Deep-frozen, never-throws (matching the retrofitted invariant in all 3 precedents), header documents the Spotify/EvidenceBridge dependency and the MusicBrainz dead-path explicitly.
- Modified: `lib/recording/recording-intelligence.js` — `assembleRecordingIntelligence()` signature changes from `(canonicalForEnrichment)` to `(recordingEvidence)`; `extractSpotifyTracks`/`extractMBRecordings` are deleted, replaced by direct field reads off the new parameter.
- Modified: `lib/rie/index.js` — one call site (line 523) updated to assemble and pass the new evidence object, mirroring the other 3 call sites exactly; violation-list comment (lines 52-86) updated to record this as the 4th and final resolution, closing out ADR-002.
- Modified: `governance/adr/ADR-002-CIO-Scope.md` — Final Resolution section updated from "1 of 4 still open" to fully resolved.
- New regression test, matching the pattern of `tests/normalization-layer-completion-test.mjs` and the Catalog/Backend/GMF precedents' own test coverage.

**Estimated files:** 2 new (evidence object + test), 3 modified (recording-intelligence.js, lib/rie/index.js, ADR-002.md). Comparable in size to the Backend Intelligence recovery, the smallest of the three precedents.

**Risk:** Low — identical risk profile to three already-successful precedents in this exact codebase; no CIO/CIM/Runtime-Context/Mission-Control/persistence contract changes (Phase 5).

---

## Explicit statement per this review's own success criteria

**Is Recording Intelligence intentionally different, or is it simply the last remaining architectural inconsistency?**

It is the last remaining architectural inconsistency. No evidence found in this review shows an intentional design decision to treat Recording Intelligence differently from Catalog, Backend, or Global Music Footprint — no comment, ADR, or certification anywhere in the repository states that Recording Intelligence's direct `canonicalForEnrichment` consumption is deliberate. `lib/rie/index.js`'s own violation-list comment describes it in the same terms as the original three ("Known Phase 3 violations... they are existing violations that Phase 3 will resolve"), just added later (Phase 3.7) and consequently missed by the 2026-07-20 recovery program's target list.

---

## No implementation performed

Per this review's explicit non-goals, no production code was created or modified: `api/_lib/recording-evidence.js` does not exist, `lib/recording/recording-intelligence.js` is unchanged, `lib/rie/index.js` is unchanged. This report is submitted for Board review; implementation (Option B, as scoped above) should proceed only after explicit Board approval, following the same branch → commit → regression → PR → Board-approval discipline used for the three precedent migrations.
