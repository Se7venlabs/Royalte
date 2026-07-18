# Royaltē — Artist Profile Card
# Section 4: Catalog Intelligence Field Schema

## Purpose

Define the Catalog Intelligence field contract for the Artist Profile Card: releases, tracks, metadata, identifiers, and catalog completeness. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit Identity or Publishing, modify Mission Control, or activate ATHENA. Scope is field-schema completion only. No production code is changed by this document.

## Source of Truth Layers

Three layers, never mixed — same discipline as Sections 2 (Identity) and 3 (Publishing):

1. **Approved Artist Profile Card Product Model** — what Catalog Intelligence must represent.
2. **Current Implementation Reality** — what exists in code today, with file:line citations.
3. **Implementation Gap** — the work required to align current code with the approved model.

## Structural note, confirmed by direct trace

The approved product model treats "Catalog Intelligence" as one concept (releases + tracks together). Current code implements it as **two separate CIM domain objects**: `catalogIntelligence` (releases — `api/_lib/catalog-intelligence.js`, `assembleCatalogIntelligence()`) and `recording` (tracks/recordings — `lib/recording/recording-intelligence.js`, `assembleRecordingIntelligence()`), assembled independently in `lib/rie/index.js`. This is documented as-is, not merged or renamed here — that would be an architecture decision, out of scope for a field schema.

## Implementation gaps found in the Board-locked workspace itself

Per the "document, don't fix" instruction, these are recorded here and logged separately as engineering tasks — not touched in this PR:

1. **ISRC Coverage™ KPI field-name mismatch:** `public/workspaces/catalog-intelligence.html` reads `isrc.assigned`/`isrc.total`, but the real assembler output is `isrcCoverage.verifiedCount`/`isrcCoverage.assessedCount` (`catalog-intelligence.js:55-61,164-188`). On real scans this KPI renders `—`, not live data.
2. **Two of the four KPI cards have no real backing data.** The locked 4-KPI layout is Total Releases / Metadata Integrity / ISRC Coverage™ / Lyric Sync Coverage (`catalog-intelligence.html:761-812`). `metadataIntegrity`, `lyricSyncCoverage`, `lyricSyncStatus`, `duplicatesDetected`, `metadataFields`, `timeline`, and `recentActivity` exist **only** in the page's own preview-fixture seed (`catalog-intelligence.html:30-83`) — the real assembler never produces them. Metadata Integrity and Lyric Sync Coverage are therefore unbacked on real scans.
3. **Minor citation-precision note on the already-merged Identity schema** (`ARTIST_PROFILE_CARD_IDENTITY_SCHEMA.md`, PR #365): its Latest Release™ Genre and Label fields are correctly classified as Implemented/Scan-sourced, but not from `catalogIntelligence.bestVerifiedRelease` as cited — verified directly (`identity-intelligence.html:638-641`), Label actually binds to `ctx.recordLabel` (`lib/rie/EvidenceBridge.js:192`) and Genre binds to `metrics.genres[0]`, both siblings of `bestVerifiedRelease`, not fields on it. Both render real data; this is a citation-path correction, not a functional bug — noted here rather than silently left inconsistent, no edit made to the locked Identity doc without a new directive.

---

## Approved Catalog Intelligence Sections

The approved product model (unchanged from the brief — no approved field is dropped by the findings below):

**1. Catalog Summary** — Total Releases, Total Tracks, Catalog Size, Latest Release, Earliest Release, Catalog Activity

**2. Release Intelligence** — Release Title, Release Type (Album/EP/Single), Release Date, Artwork, Label, Genre, Artist, Release Identifier

**3. Track Intelligence** — Track Name, ISRC, Duration, Release Association, Track Artist, Contributors

**4. Catalog Metadata** — UPC, ISRC, Explicit Status, Language, Version Information, Original Release Date, Metadata Completeness

**5. Catalog Ownership / Rights Connections** — Label, Master Ownership, Publishing Connection, Rights Registration Connection

**6. Catalog Intelligence (outputs)** — Catalog Coverage, Metadata Issues, Missing Information, Catalog Opportunities, Catalog Risks

---

## Section 1 — Implemented Fields

Only fields traceable to current, committed code. Untracked/uncommitted files were excluded from this trace (confirmed directly: a committed `lib/recording/recording-intelligence.js` and an unrelated untracked `api/_lib/recording-intelligence.js` both exist in this checkout — only the committed file is cited below).

### Catalog Summary

All sourced from `assembleCatalogIntelligence()` (`api/_lib/catalog-intelligence.js`), Population Source: Scan, Provider Source: Apple Music / Spotify catalog data.

| Field | Current Implementation Reference |
|---|---|
| Total Releases | `singles + albums + eps`, computed client-side (`catalog-intelligence.html:1017`), sourced from `catalog-intelligence.js:273-277` |
| Total Tracks | `totalTracks` (`catalog-intelligence.js:110,277`) |
| Catalog Size | `catalogStatus`, `deriveCatalogStatus()` (`catalog-intelligence.js:118-125`) |
| Latest Release | `latestReleaseYear` / `bestVerifiedRelease` (`catalog-intelligence.js:244,281,268-271`) |
| Earliest Release | `firstReleaseYear`, `deriveYearRange()` (`catalog-intelligence.js:143-162`) |

### Release Intelligence

**Release Title** — Classification: Canonical Data Field — Population Source: Scan — Provider Source: Apple Music / Spotify — Current Implementation Reference: `bvr.releaseTitle` (`api/_lib/best-verified-release.js:305`).

**Release Type** — Classification: Canonical Data Field — Population Source: Scan — Provider Source: Apple Music — Current Implementation Reference: `classifyType()` (`best-verified-release.js:77-82`); track-count heuristic `classifyAppleAlbums()` (`catalog-intelligence.js:106-116`: 1 track = single, 2-6 = EP, 7+ = album).

**Release Date** — Classification: Canonical Data Field — Population Source: Scan — Provider Source: Apple Music / Spotify — Current Implementation Reference: `bvr.releaseDate` (`best-verified-release.js:307`).

**Artwork** — Classification: Canonical Data Field — Population Source: Scan — Provider Source: Apple Music / Spotify — Current Implementation Reference: `bvr.artwork` (`best-verified-release.js:303`).

**Artist** — Classification: Canonical Data Field — Population Source: Scan — Provider Source: Apple Music / Spotify — Current Implementation Reference: `bvr.artistName` (`best-verified-release.js:304`).

**Label** — Classification: Canonical Data Field — Population Source: Scan — Current Implementation Reference: **not** present on `bestVerifiedRelease` itself (`best-verified-release.js:302-311`); real data lives as a sibling canonical field, `ctx.recordLabel` (`lib/rie/EvidenceBridge.js:192`), which is what `identity-intelligence.html:638` actually renders. Live and real — just not part of the `catalogIntelligence.bestVerifiedRelease` object specifically.

**Genre** — Classification: Canonical Data Field — Population Source: Scan — Current Implementation Reference: **not** present on `bestVerifiedRelease` (absent from `catalog-intelligence.js` and `best-verified-release.js`); real data lives as `metrics.genres[]`, which `identity-intelligence.html:639-641` renders (`genres[0]`, capitalized). Same pattern as Label — live and real, sourced from a sibling field.

### Track Intelligence

Separate CIM domain (`recording`, not `catalogIntelligence` — see Structural Note above).

**Track Name** — Classification: Canonical Data Field — Population Source: Scan — Current Implementation Reference: `CanonicalRecording.canonicalTitle` (`lib/recording/canonical-recording.js:9`).

**ISRC** — Classification: Canonical Data Field — Population Source: Scan — Current Implementation Reference: track-level `CanonicalRecording.isrcs[]` (`canonical-recording.js:15`); catalog-level aggregate `isrcCoverage` (`catalog-intelligence.js:164-188`).

---

## Section 2 — Implementation Required

Approved Artist Profile Card fields not fully supported by current code. They remain in the schema — not removed.

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Catalog Activity | `timeline`/`recentActivity` exist only in the workspace's own preview fixture (`catalog-intelligence.html:67-80`) — never produced by the real assembler | `catalog-intelligence.js` must compute a real activity/timeline structure |
| Release Identifier | Apple `album.id` is used internally only for scoring (`best-verified-release.js:86`), never exposed in output | Expose a stable release identifier field on `bestVerifiedRelease` |
| Duration | `durationMs` is computed at normalization (`recording-normalizer.js:12,43`) but dropped before reaching `CanonicalRecording` (`canonical-recording.js:9-17` has no duration field) | Carry `durationMs` through into the `CanonicalRecording` shape |
| Release Association | No album/release ID exists on `CanonicalRecording` | Add a release-reference field linking a recording back to its release |
| Track Artist | An `artistName` field exists but the Apple normalizer always sets it to `''` (`recording-normalizer.js:65`) | Fix acquisition/normalization to populate real track-level artist data |
| Contributors | No contributors/credits field anywhere in the recording pipeline | New acquisition + `CanonicalRecording` schema extension |
| UPC | Zero references anywhere in `catalog-intelligence.js`, `best-verified-release.js`, `cio.js`, or `canonical-intelligence-model.js`, despite Apple PAL declaring `Capability.UPC` | Wire UPC from the already-acquired Apple evidence into the catalog domain assembler — acquisition capability exists, consumption does not |
| Explicit Status | Fixture-only (`catalog-intelligence.html:63,1129`) | New acquisition + assembler field |
| Language | No field found anywhere | New acquisition + assembler field |
| Version Information (e.g. Deluxe, Remastered) | No field found anywhere | New acquisition + assembler field |
| Original Release Date | Only a single `releaseDate` exists — no reissue/original distinction | New acquisition + assembler field, requires disambiguating reissues from originals |
| Metadata Completeness | Fixture-only `metadataIntegrity`/`metadataFields` (`catalog-intelligence.html:30-83`) — not real assembler output (see gap #2 above) | `catalog-intelligence.js` must compute a real completeness metric |
| Master Ownership | No such concept anywhere in the catalog or publishing pipelines | New acquisition/data source — likely requires a new provider relationship, not just a mapping change |
| Publishing Connection | `catalogIntelligence` and `publishingIntelligence` are assembled fully independently (`lib/rie/index.js:397-406`), no cross-reference field between a release/track and its publishing record | New linkage field — a genuine cross-domain design decision, not a simple field addition |
| Rights Registration Connection | Same as Publishing Connection — no linkage exists | Depends on Publishing Connection being designed first |
| Catalog Coverage | No such field; only the narrower `isrcCoverage` exists | Compute a catalog-wide coverage metric distinct from ISRC-specific coverage |
| Metadata Issues / Missing Information | Only generic cross-domain narrative text exists (`api/_lib/royalte-ai-assembler.js:85-350`), not itemized per catalog field | Persist catalog-specific issues, not just prose |
| Catalog Opportunities / Catalog Risks | Zero references anywhere (`catalogOpportunit*`/`catalogRisk*` grep repo-wide: no hits); only generic `derivePriority()`/`deriveObservation()` prose referencing `catalog.confidence`/`totalTracks` | New catalog-specific intelligence logic, not a naming/mapping change |

---

## Catalog Intelligence Rules

1. Provider data does not directly populate Mission Control.
2. Scan results map into the Artist Profile Card via two separate CIM domains today (`catalogIntelligence` for releases, `recording` for tracks) — see Structural Note.
3. Mission Control consumes Artist Profile Card data, currently via the existing Runtime Context delivery layer — unchanged and out of scope here.
4. Provider Source and Population Source remain separate concepts.
5. A field belongs in **Section 1 — Implemented Fields** only if traceable to real, committed code today, and rendering real (not fixture) data. Approved-but-not-yet-built or fixture-only fields belong in **Section 2 — Implementation Required**, never blended into the implemented contract. No approved product field is removed for lack of current support.
6. Implementation conflicts discovered during this trace (the ISRC field-name mismatch, the two unbacked KPI cards) are documented as gaps here and logged as separate engineering tasks — not fixed in this PR.

---

## Deliverable Status

Catalog Intelligence field schema — complete:
- ✅ Catalog fields defined across all 6 approved sections
- ✅ Source ownership identified for every field
- ✅ Current implementation mapped, each Implemented Field with a file:line citation
- ✅ Gaps documented, none silently dropped
- ✅ No architecture changes introduced
- ✅ Two real wiring defects in the Board-locked workspace documented, not fixed — logged as separate engineering tasks
- ✅ One citation-precision note on the already-merged Identity schema recorded, not edited without a new directive
- ✅ Ready for review and lock

**Catalog Intelligence ready to lock. Proceeding to Global Music Footprint Field Schema next.**
