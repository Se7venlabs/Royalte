# Royaltē — Artist Profile Lifecycle Architecture

## Status note

This document answers "how does an artist move through the platform?" Every stage below is checked against real, committed code. Two of the Board's named stages (Stage 5 "DML," Stage 6 "Analysis Engine") do not correspond to any named module, file, or identifier anywhere in the codebase — confirmed by direct search, zero results for either term. Where that's the case, this document names the real system that performs the described function, and states plainly that the Board's label is forward-looking product vocabulary, not an existing code identifier. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8), does not modify production code, and does not modify Mission Control.

---

## Complete Architectural Flow

```text
STAGE 1: Artist Profile Template     (real — Supabase trigger)
        │  write: handle_new_user()
        ▼
STAGE 2: Scan                        (real — api/audit.js, PAL connectors)
        │  write: canonical scan payload
        ▼
STAGE 3: Onboarding                  (real — onboarding.html, 3 questions)
        │  write: profiles.music_rights_profile
        ▼
STAGE 4: PAL (Provider Acquisition)  (real — provider-acquisition/*)
        │  write: EvidencePackage[]
        ▼
STAGE 5: Rule Library / Intelligence Engine   (real — "DML" is not a code name)
        │  write: strengths[], issues[], recommendations[]
        ▼
STAGE 6: RIE Domain Assemblers + Health Engine (real — "Analysis Engine" is not a code name)
        │  write: cim.* (identity, publishing, catalog, globalFootprint, verification, health)
        ▼
STAGE 7: Artist Profile (CIM)        (real — the constitutional source of truth)
        │  read: every Mission Control workspace, via Runtime Context
        ▼
STAGE 8: Runtime Context             (real — runtime-context-mapper.js)
        │  write: royalte_workspace_context (sessionStorage)
        ▼
STAGE 9: Mission Control™            (real — public/workspaces/*.html)
        │  read only — never writes upstream
        ▼
       Artist
```

**Direction of data movement is one-way, top to bottom.** No stage below Stage 7 writes back upstream — confirmed throughout this entire schema series (Mission Control workspaces are read-only presentation, `ARTIST_PROFILE_CARD_ARCHITECTURE.md` §6 non-goals; Runtime Context is a pure mapper, never a writer to CIM).

---

## Stage 1 — Artist Profile Template

**Real, not aspirational.** `supabase/migrations/20260515184037_auth_schema_foundation.sql` defines a `handle_new_user()` trigger (`SECURITY DEFINER`, lines 81-97) that fires `AFTER INSERT ON auth.users` and auto-creates a `public.profiles` row: `{ id, email, display_name, founding_artist (default false), tier, created_at, updated_at }`. This is the pre-onboarding "empty constitutional structure" the Board's brief describes — it exists before any scan, before onboarding, before any intelligence is generated. `display_name` is seeded from `raw_user_meta_data->>'display_name'` or the email prefix; `music_rights_profile` does not yet exist on this row (added by Stage 3).

**Identifier:** `profiles.id`, a UUID, `REFERENCES auth.users(id) ON DELETE CASCADE` — this is the artist's durable identifier from signup onward, and the row-level security key (`auth.uid() = id`) gating every subsequent read/write to this artist's own data.

---

## Stage 2 — Scan

**Purpose:** discovery — the artist's actual digital presence, pulled from external providers.

**Inputs:** artist name, or a platform URL (Apple Music/Spotify), submitted via `GET /api/audit?url=...` (`api/audit.js`).

**Providers:** up to 12 PAL connectors (`provider-acquisition/connectors/*` — Apple Music, Spotify, YouTube, Deezer, TIDAL, MusicBrainz, Discogs, AudioDB, Last.fm, MLC, ACRCloud, and others confirmed across this series and prior session phases), each acquiring only within its declared `Capability` vocabulary.

**Validation:** `AUTH_UNAVAILABLE` vs `NOT_FOUND` vs `VERIFIED` vs `ERROR` — the four-state model enforced throughout the pipeline (documented repeatedly across Sections 2–9 of this series; e.g. Identity's `IDENTITY_STATE`).

**Outputs:** raw `EvidencePackage[]` per provider, plus the legacy V1 canonical shape via `normalizeAuditResponse.js`.

**Relationship to PAL:** Scan is the caller; PAL (Stage 4 below) is the acquisition mechanism Scan invokes. They are not the same stage, though closely coupled — `api/_lib/*-pal-acquisition.js` modules (e.g. `apple-pal-acquisition.js`, `youtube-pal-acquisition.js`) are the real glue between them, confirmed extensively in this series' Identity, Catalog, and Global Music Footprint traces.

---

## Stage 3 — Onboarding

**Purpose:** artist review, confirmation, and correction of what Scan found, plus artist-supplied data Scan cannot discover.

**Real implementation:** `public/onboarding.html` — a 3-question flow (`pro`, `publishing_management` + `organization_name`, `mlc`), confirmed and corrected in `ARTIST_PROFILE_CARD_PUBLISHING_SCHEMA.md` (superseding an earlier "2-question" description on record). Written via `api/save-music-rights-profile.js` to `profiles.music_rights_profile`.

**Relationship to template:** Onboarding does not create the `profiles` row (Stage 1 already did, at signup) — it fills in the one real field group the template didn't have: `music_rights_profile`.

**Artist review/correction of Scan results specifically:** no evidence found of a UI step where the artist reviews/corrects Scan-discovered facts (e.g. confirming their Apple Music identity match) — Onboarding as it exists today is narrowly the Music Rights Profile questionnaire, not a general review-and-correct step over Scan output.

---

## Stage 4 — PAL (Provider Acquisition Layer)

**Purpose:** provider normalization, canonical model construction, conflict resolution, provider ownership boundaries.

**Real, extensively documented across this series:** `provider-acquisition/pal/ProviderAcquisitionLayer.js` is the acquisition orchestrator; `lib/rie/EvidenceBridge.js`'s `translate*()` functions (confirmed by name in the Identity, Publishing, Catalog, and Monitoring Timeline traces) are the normalization layer, converting raw provider evidence into `canonical.platforms.*` fields. Capability vocabulary (`provider-acquisition/capability/capabilityVocabulary.js`) is the Board-ratified shared contract every connector declares against, confirmed in the Apple Music Phase 2.2 connector lock (memory) and reused throughout this series (e.g. `Capability.VIDEOS`, `Capability.AVAILABILITY`).

**Conflict resolution:** not deeply re-traced in this document — the Resolution Engine (`api/resolution/`, per prior session governance) is the named constitutional layer for this per repo history, though its current wiring status was not verified as part of this specific document and should not be assumed live without a dedicated trace.

---

## Stage 5 — "DML" (Board naming) — real system is the Rule Library + Intelligence Engine

**"DML" does not exist as a term anywhere in this codebase** — confirmed by direct search. The Board brief's description of this stage (business logic, decision engine, rule execution, confidence scoring) matches a real, already-built, already-governed system from earlier in this session's history: the **Rule Library** (`api/rules/`, declarative `(cio) → boolean` condition rules, polarity-routed to `strengths[]`) and the **Intelligence Engine** (`runIntelligenceEngine(cio, ruleLibrary)`, generic iteration, deep-frozen output, per the Intelligence Engine lock). This is the real "decision engine / rule execution" layer. Confidence scoring specifically is real and distributed per-domain (e.g. Publishing's `derivePublishingScore()`, Health's `deriveConfidence()` — both documented in this series), not centralized in one module.

---

## Stage 6 — "Analysis Engine" (Board naming) — real system is RIE domain assembly + the Health Engine

**"Analysis Engine" does not exist as a term anywhere in this codebase** — confirmed by direct search. The described function (cross-domain reasoning, health/identity/publishing/catalog/backend/territory scoring) matches `lib/rie/index.js`'s `runRIE()` orchestration, which calls every domain assembler already documented in this series: `assembleIdentityIntelligence()`, `assemblePublishingIntelligence()`, `assembleCatalogIntelligence()`, `assembleGlobalMusicFootprint()`, `assembleBackendIntelligence()`, plus `computeHealthScore()` (the Health Engine, the sole constitutional authority for the Royaltē Health Score™) and `assembleHealthIntelligence()` (the interpretation layer over it, per `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md`).

**Media scoring does not exist** — confirmed repeatedly in this series (`ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md`): Media Intelligence has no domain assembler at all. **Territory scoring exists**, but as `deriveFootprintScore()` reading `globalMusicFootprint.coveragePercent` — Territory itself is not a separately-scored domain (already documented in `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §6).

**Future ATHENA integration:** real ATHENA (`api/athena/`) has zero production callers, confirmed independently multiple times across this series. Its constitutional position — reasons over data, never owns it — is documented in `ARTIST_PROFILE_CARD_ARCHITECTURE.md` §5 and reaffirmed in Document 3 below.

---

## Stage 7 — Artist Profile (CIM)

**Purpose, and the real constitutional source of truth:** `assembleCIM()` / `certifyCIM()` (`lib/rie/index.js`, `lib/rie/certify.js`) — a 13-object model (`CIM_OBJECTS`, `api/schema/canonical-intelligence-model.js`), deep-frozen once assembled, confirmed repeatedly across this series as the thing every domain assembler writes into and every workspace ultimately reads from (via Runtime Context).

**Every intelligence domain writes here** — confirmed: Identity, Publishing, Catalog, Global Music Footprint, Backend, Health all write their assembled output into `cim.*`, per `lib/rie/index.js`'s orchestration.

**Monitoring Timeline records changes here:** **not fully real.** Per `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §3, real change-detection exists only for Territory, Catalog, and a raw YouTube-match signal — three of nine domains, not "every intelligence domain."

**Settings contributes user-owned data:** **partially real, with an important boundary already established in this series.** Settings' one real field group (`music_rights_profile`) does **not** merge into CIM/`cim.*` at all — it is merged downstream, client-side, at the Runtime Context layer only (`__mcPopulate()` → `buildWorkspaceRuntimeContext()`, confirmed in `ARTIST_PROFILE_CARD_ARCHITECTURE.md` §4.2 and reaffirmed in the Publishing and Settings schemas). This is a real, load-bearing distinction: the Board's Stage 7 description implies Settings writes into the same constitutional object as the intelligence domains; today it does not.

---

## Stage 8 — Runtime Context

**Purpose:** Mission Control hydration, workspace context generation, session model, client payload.

**Real, extensively traced across this entire series:** `buildWorkspaceRuntimeContext()` (`public/js/runtime-context-mapper.js`), Board-locked Runtime Context Contract v1.2/1.3, confirmed in the original PR #360 Field-Level Trace Report and re-verified independently in every subsequent section of this series. Takes `canonical` (from Stage 7) + `musicRightsProfile` (from Stage 3, read independently) + caller-computed `derivedState`, produces the frozen `royalte_workspace_context` object written to `sessionStorage`.

**Performance optimization:** not separately verified in this document — no caching/optimization layer beyond the single mapper call was found or claimed.

---

## Stage 9 — Mission Control™

**Purpose:** presentation layer, never owns business logic. Confirmed as the standing rule throughout this series (`ARTIST_PROFILE_CARD_ARCHITECTURE.md` §6 non-goals: "Rebuild Mission Control's data flow" explicitly out of scope for every section).

**Displays constitutional data:** real, via `readWorkspaceContext({ contract })` (`public/js/mc-workspace-context.js`), confirmed against every one of the 8 workspaces already documented in this series.

**Displays Monitoring Timeline:** real for the single-scan "what changed" view (`monitoring-timeline.html`); the separate Executive Timeline™ feature on Health Intelligence is hardcoded mock data (task #53), not real Monitoring Timeline data — documented precisely, not conflated.

**Displays Health:** real, `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md`.

**Displays Intelligence:** real for Identity, Publishing, Catalog, Global Music Footprint, Backend, Health; not real for Media (no assembler) or full multi-domain Monitoring (3 of 9 domains only).

---

## Ownership Summary (write responsibilities)

| Stage | Writes | Owner |
|---|---|---|
| 1 — Template | `profiles` row | Supabase Auth trigger (`handle_new_user()`) |
| 2 — Scan | Raw evidence, legacy canonical shape | `api/audit.js`, PAL connectors |
| 3 — Onboarding | `profiles.music_rights_profile` | `api/save-music-rights-profile.js` |
| 4 — PAL | `EvidencePackage[]`, `canonical.platforms.*` | PAL + EvidenceBridge translators |
| 5 — Rule Library / Intelligence Engine | `strengths[]`, `issues[]`, `recommendations[]` | `api/rules/`, Intelligence Engine |
| 6 — RIE assemblers / Health Engine | `cim.identity`, `.publishing`, `.catalog`, `.globalFootprint`, `.verification`, `.health` | Domain assemblers, `health-engine.js` |
| 7 — Artist Profile (CIM) | Certified, frozen `cim` | `assembleCIM()` / `certifyCIM()` |
| 8 — Runtime Context | `royalte_workspace_context` | `runtime-context-mapper.js` |
| 9 — Mission Control | Nothing upstream — read-only | Workspace HTML/JS |

No stage below Stage 7 writes back into an earlier stage. Settings (Stage 3) is the one documented exception to a clean top-to-bottom flow — its data reaches the artist via Stage 8 directly, bypassing Stage 7 entirely, a real architectural fact carried forward from this series rather than smoothed into the Board's cleaner nine-stage narrative.

---

## Rules

1. Every stage is checked against real code before being described as real; two stage names (DML, Analysis Engine) were confirmed absent from the codebase and are labeled as such, with the real underlying systems named instead.
2. Direction of data movement is one-way; no exception was found or invented.
3. The Settings-bypasses-CIM finding, already established elsewhere in this series, is preserved here rather than smoothed into a cleaner narrative where Settings writes into the same object as everything else.
4. This document does not authorize any code change, including renaming any real system to match the Board's Stage 5/6 vocabulary.

---

## Deliverable Status

- ✅ Complete nine-stage flow diagram produced, direction of movement shown
- ✅ Every stage checked against real code; two Board-named stages (DML, Analysis Engine) confirmed to have zero code presence, real underlying systems named instead
- ✅ Ownership/write-responsibility table produced for all nine stages
- ✅ Settings' real architectural exception (bypasses CIM, merges only at Runtime Context) preserved, not smoothed over
- ✅ Media's absence from Stage 6 scoring, and Monitoring's 3-of-9 domain coverage at Stage 7, both carried forward accurately from prior sections
- ✅ No production code changed; no Mission Control changes

**Artist Profile Lifecycle Architecture ready for Board review.**
