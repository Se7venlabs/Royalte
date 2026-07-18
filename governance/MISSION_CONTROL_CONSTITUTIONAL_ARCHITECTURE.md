# Mission Control™ — Constitutional Architecture

## Status note

Every workspace entry below synthesizes findings already established, traced, and Board-approved in Sections 2–9 of the Artist Profile Card series (`governance/ARTIST_PROFILE_CARD_*_SCHEMA.md`) plus the Settings and Lifecycle documents produced alongside this one — nothing here is re-derived from scratch or newly speculated. Where this document adds a new claim not already documented elsewhere in the series, it is marked as such. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8), does not modify production code, and does not modify Mission Control.

---

## Mission Statement

Mission Control is the executive operating environment for the Artist Profile — not a dashboard. It presents constitutional information. It does not own constitutional information. This is enforced structurally, not just by convention: every workspace traced in this series reads exclusively through `readWorkspaceContext({ contract })` (`public/js/mc-workspace-context.js`) against the frozen `royalte_workspace_context` object — none call `fetch()` or query Supabase directly (confirmed in the original Mission Control Handoff discovery, PR #359, and re-verified independently across every subsequent section).

---

## Per-Workspace Constitutional Record

### Identity Intelligence™

- **Purpose:** verified artist identity across the music ecosystem.
- **Owner:** `api/_lib/identity-intelligence.js` (`assembleIdentityIntelligence()`).
- **Inputs:** Scan evidence from 5 providers (Apple, Spotify, YouTube, Deezer, TIDAL).
- **Outputs:** `providers`, `coverage` (explicitly not a Health Score), `strengths[]`, `issues[]`, `recommendations[]`.
- **Reads:** `royalte_workspace_context.identityIntelligence` / `.identity`.
- **Writes:** nothing upstream.
- **Dependencies:** PAL (5-provider acquisition), EvidenceBridge translators.
- **Future Expansion:** per-provider Confidence, dynamic Identity Description, per-provider Last Sync, stored Risk Status/Badge/Summary — all documented as Implementation Required in `ARTIST_PROFILE_CARD_IDENTITY_SCHEMA.md`.

### Publishing Intelligence™

- **Purpose:** rights ownership, publishing relationships, registration ecosystem.
- **Owner:** `api/_lib/publishing-intelligence.js` (`assemblePublishingIntelligence()`), `lib/publishing/mlc-adapter.js`, `api/_lib/identity-graph.js`.
- **Inputs:** Onboarding (`profiles.music_rights_profile` — PRO, publishing relationship, MLC self-report) + Scan (MLC writer/registration data).
- **Outputs:** `coverage`/`coverageStatus`, `registrations.mlcRegistration`, `issues[]`, `recommendations[]`.
- **Reads:** `royalte_workspace_context.publishingIntelligence`.
- **Writes:** nothing upstream.
- **Dependencies:** Onboarding (Settings-owned MRP data, merged at Runtime Context per the Lifecycle document's Stage 7 finding), MLC provider.
- **Future Expansion:** Mechanical/Sound Recording Rights Org fields, Record Label as a Scan-sourced field, Ownership Percentage, Writer CAE, Rights Conflicts — Implementation Required per `ARTIST_PROFILE_CARD_PUBLISHING_SCHEMA.md`. Known live issue: the separate "Publishing Health™" score still weights the dead SoundExchange field (task #44).

### Catalog Intelligence™

- **Purpose:** trusted view of releases, tracks, metadata, identifiers.
- **Owner:** `api/_lib/catalog-intelligence.js`, `api/_lib/best-verified-release.js`, `lib/recording/recording-intelligence.js` (a **separate** CIM domain, `recording`, for tracks — not the same object as `catalogIntelligence`, for releases).
- **Inputs:** Scan (Apple Music, Spotify catalog data).
- **Outputs:** `singles/eps/albums`, `totalTracks`, `isrcCoverage`, `bestVerifiedRelease`.
- **Reads:** `royalte_workspace_context.catalogIntelligence`.
- **Writes:** nothing upstream.
- **Dependencies:** PAL catalog acquisition.
- **Future Expansion:** UPC (acquired but not consumed), Duration/Contributors/Track Artist on recordings, Master Ownership, Publishing Connection linkage — Implementation Required per `ARTIST_PROFILE_CARD_CATALOG_SCHEMA.md`. Known live issues: ISRC Coverage™ KPI field-name mismatch (task #45), 2 of 4 KPI cards fixture-only (task #46).

### Global Music Footprint™

- **Purpose:** where the artist's music is available worldwide.
- **Owner:** `api/_lib/global-music-footprint.js` (`assembleGlobalMusicFootprint()`), consuming the **Territory Music Engine** (`api/_lib/territory-intelligence.js`, `assembleTerritoryIntelligence()`) as an existing upstream engine — not rebuilt by this workspace.
- **Inputs:** Territory Engine output (Apple Music is the sole territory-acquisition provider today, by documented design).
- **Outputs:** `territoriesAvailable/Unavailable`, `coveragePercent`, `status`, `distributionGaps`.
- **Reads:** `royalte_workspace_context.globalMusicFootprint`.
- **Writes:** nothing upstream.
- **Dependencies:** Territory Music Engine, Apple Music PAL `AVAILABILITY` acquisition.
- **Future Expansion:** Spotify/Deezer territory acquisition (declared capability, never wired). Known live issues: provider legend is display-only, not evidence-bound (task #48); hardcoded South Korea/Japan territory callouts (task #49).

### Backend Intelligence™

- **Purpose:** verification/registration infrastructure status.
- **Owner:** `api/_lib/backend-intelligence.js` (`assembleBackendIntelligence()`).
- **Inputs:** MusicBrainz + MLC verification services only (2 of a possible larger provider set, by Board directive).
- **Outputs:** `services[]`, `connectedCount/totalCount`, `apisResponding`, `lastSync`, `summaryLabel`.
- **Reads:** `royalte_workspace_context.backendIntelligence`.
- **Writes:** nothing upstream.
- **Dependencies:** MusicBrainz/MLC provider connections.
- **Future Expansion:** the entire Digital Twin™ hero (7 nodes, connections, ATHENA drill-down) is largely static, not data-bound (task #50); Infrastructure Risk KPI hardcoded, existing `lastSync` never rendered (task #51).

### Media Intelligence™

- **Purpose:** official video ecosystem across connected platforms.
- **Owner:** **none — no domain assembler exists.** The only real workspace in this series confirmed to have zero backend, by its own in-code comment ("UI shell phase," citing "Board Implementation Brief v1.0").
- **Inputs:** dev-fixture only in production; real YouTube channel statistics exist elsewhere in canonical (`canonical.platforms.youtube.details`) but are not assembled into this domain.
- **Outputs:** none in production.
- **Reads:** `royalte_workspace_context.mediaIntelligence` — always absent outside the dev fixture, correctly showing "No Scan Loaded."
- **Writes:** nothing upstream.
- **Dependencies:** would depend on YouTube/Apple Music VIDEOS evidence, already acquired by PAL (Media PAL Expansion™) but discarded — no `EvidenceBridge` translator exists for it.
- **Future Expansion:** the entire domain — assembler, translators, and real UI wiring — per `ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md`.

### Health Intelligence™

- **Purpose:** executive summary of the other domains — "how healthy is the artist's entire digital business," never a source of truth itself.
- **Owner:** `api/_lib/health-intelligence.js` (`assembleHealthIntelligence()`), reading `computeHealthScore()`'s output verbatim (the Health Engine, sole scoring authority).
- **Inputs:** already-assembled Identity, Publishing, Catalog, Global Music Footprint, Backend, Monitoring Intelligence output — never raw evidence.
- **Outputs:** `score`, `status`, `grade`, `confidence`, six per-domain contributor scores, `strengths[]`, `concerns[]`.
- **Reads:** `royalte_workspace_context.healthIntelligence`.
- **Writes:** nothing upstream — confirmed structurally, since it only accepts other domains' output as read-only arguments.
- **Dependencies:** all six summarized domains (Media contributes nothing — no assembler exists to summarize).
- **Future Expansion:** `grade` exists but is never rendered (task #52); the entire Executive Timeline™ (7-day history) runs on a hardcoded mock dataset (task #53); Readiness Score, Completion %, Missing Items, Priority Issues, Recommended Actions all confirmed unimplemented.

### Monitoring Timeline™

- **Purpose:** designed to become the permanent audit history of Artist Profile changes; today, a single-scan "what changed since last time" view.
- **Owner:** `api/_lib/monitoring-intelligence.js` (`assembleMonitoringIntelligence()`), fed by the real delta engine (`api/_lib/delta-engine.js`).
- **Inputs:** `computeDelta()` alerts, gated to authenticated scans with a prior snapshot.
- **Outputs:** `status`, `scanNumber`, `newThisScan`, `events[]` (`{changeType, title, severity}` — narrower than what the renderer expects, per `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md`'s four-layer trace).
- **Reads:** `royalte_workspace_context.monitoringIntelligence`.
- **Writes:** nothing upstream.
- **Dependencies:** the delta engine, which today covers only 3 of 9 constitutionally-envisioned domains (Territory, Catalog, an unrelated raw YouTube-match signal).
- **Future Expansion:** the full Phase 1 Constitutional Architecture blueprint already documented in `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §4 — canonical event model, 13-category taxonomy, Monitoring Event Engine, Timeline Store, filtering, future search. Not built; no Build Pass opened.

### Settings™

- **Purpose:** the one constitutional domain whose responsibility is user-controlled data, not discovery.
- **Owner:** no dedicated assembler — real data lives directly in `profiles` (Supabase table), written by `api/save-music-rights-profile.js` and the `handle_new_user()` signup trigger.
- **Inputs:** artist-supplied at onboarding (MRP) and at signup (email/display_name, auto-populated).
- **Outputs:** `profiles.music_rights_profile`, `profiles.display_name`/`.email` (data-model-real, no UI to edit).
- **Reads:** merged into Runtime Context via `__mcPopulate()`, not read by any workspace as its own contract.
- **Writes:** the source for Publishing Intelligence's Onboarding-classified fields.
- **Dependencies:** Supabase Auth.
- **Future Expansion:** per `ARTIST_PROFILE_CARD_SETTINGS_SCHEMA.md` — no dedicated Settings page exists at all today; every workspace's Settings nav item links to `/mission-control.html`. Profile Information UI, Account (2FA/tokens/billing/export/delete), and all Platform Preferences are entirely unbuilt.

---

## Workspace Relationships — Constitutional Dependency Map

```text
Identity ──────────┐
Publishing ─────────┤
Catalog ────────────┤
Global Music Footprint ┼──▶ Health Intelligence ──▶ Mission Control
Backend ────────────┤
Media (no assembler — contributes nothing today)
        │
Backend ──▶ Monitoring Timeline (3 of 9 domains covered) ──▶ Mission Control

Settings ──▶ Publishing (real, Onboarding-classified fields)
Settings ─ ─▶ Identity, Health, Monitoring Timeline (not confirmed real — see Settings schema)
```

Solid arrows are confirmed real dependencies, cited above. The dashed arrow (Settings → Identity/Health/Monitoring) reflects the Board's stated model but was checked and **not confirmed** in `ARTIST_PROFILE_CARD_SETTINGS_SCHEMA.md` — included here for completeness of the requested map, not as a verified fact.

---

## Ownership Matrix

| Domain | Owner | Readers | Writers | Consumers | Future Owner |
|---|---|---|---|---|---|
| Identity | `identity-intelligence.js` | Mission Control, Health | PAL (5 providers) | Artist, Health | unchanged |
| Publishing | `publishing-intelligence.js` | Mission Control, Health | MLC, Settings (Onboarding) | Artist, Health | unchanged |
| Catalog | `catalog-intelligence.js` + `recording-intelligence.js` | Mission Control, Health | PAL (Apple/Spotify) | Artist, Health | unchanged |
| Global Music Footprint | `global-music-footprint.js` | Mission Control, Health | Territory Music Engine | Artist, Health | unchanged |
| Backend | `backend-intelligence.js` | Mission Control, Health | MusicBrainz, MLC | Artist, Health | unchanged |
| Media | **none** | Mission Control (dev fixture only) | **none** | — | to be built, per `ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md` |
| Health | `health-intelligence.js` + `health-engine.js` | Mission Control | 6 domains (read-only inputs) | Artist | unchanged |
| Monitoring Timeline | `monitoring-intelligence.js` + `delta-engine.js` | Mission Control, (future) Health | delta engine (3 of 9 domains) | Artist | expanding to 9 domains, per blueprint |
| Settings | none (raw `profiles` table) | Publishing (Onboarding fields) | Artist (at onboarding), signup trigger | Publishing | to be built, per `ARTIST_PROFILE_CARD_SETTINGS_SCHEMA.md` |

---

## Data Flow

```text
Artist Profile (CIM)
        ↓
Runtime Context
        ↓
Workspace
        ↓
User
```

Ownership never reverses — confirmed structurally throughout this series: no workspace HTML/JS was found writing back to Runtime Context, CIM, or any domain assembler. The one architectural nuance already established (`ARTIST_PROFILE_LIFECYCLE_ARCHITECTURE.md` Stage 7): Settings data reaches the Workspace layer via Runtime Context directly, bypassing the Artist Profile (CIM) box in this diagram entirely — not a reversal of ownership, but a real deviation from the clean four-box flow shown above, worth remembering rather than smoothing away.

---

## ATHENA — Constitutional Position

ATHENA owns nothing. ATHENA reasons over constitutional data; it never becomes a source of truth. This is not aspirational framing — it is the confirmed state of the actual code: `api/athena/` (`createAthenaEngine()`) has zero production callers, verified independently at least three times across this series (Repository Review PR #368, Media Intelligence trace, Health Intelligence trace). Where workspace UI already uses "ATHENA" branding (Backend Intelligence's drill-down panel, Media Intelligence's "ATHENA Media Insights™" card, Health Intelligence's "ATHENA Monitoring™" card), that branding is a forward-reference to this constitutional position, not evidence the real engine is wired — documented precisely as such in each respective schema.

---

## Mission Control Rules

1. Mission Control never owns data — confirmed structurally; every workspace reads through one contract function, none write upstream.
2. Mission Control never performs provider synchronization — that is PAL's exclusive responsibility (Stage 4, Lifecycle document).
3. Mission Control never replaces PAL.
4. Mission Control never replaces the Rule Library / Intelligence Engine (the Board's "DML," Stage 5).
5. Mission Control is a presentation and orchestration environment — every workspace traced in this series confirms this: rendering logic reads and formats; it does not compute domain scores, coverage percentages, or intelligence.

---

## Future Expansion

The Board names six future modules: Territory Intelligence™, Royalty Intelligence™, Financial Intelligence™, Sync Intelligence™, AI Rights Intelligence™, Contract Intelligence™. None exist today. One clarification already established elsewhere in this series: "Territory Intelligence" is not fully future — the **Territory Music Engine** (`api/_lib/territory-intelligence.js`) already exists and is real, consumed by Global Music Footprint™ (see that workspace's entry above and `ARTIST_PROFILE_CARD_GLOBAL_FOOTPRINT_SCHEMA.md`). A future "Territory Intelligence™" workspace, if built, would be a new presentation layer over an engine that already exists, not new intelligence from nothing — a materially different starting point than the other five, fully-unbuilt future modules.

Future modules are expected to plug into the same constitutional architecture documented in this series: PAL acquisition → domain assembler → CIM → Runtime Context → Mission Control presentation, with Health Intelligence summarizing and Monitoring Timeline recording change history, per the patterns already established.

---

## Rules

1. Every workspace entry synthesizes, and does not contradict, its own already-Board-approved schema document elsewhere in this series.
2. Where the Board's stated dependency model (Settings → Identity/Health/Monitoring) was not confirmed by direct trace, it is marked as unconfirmed, not silently included as fact.
3. ATHENA's zero-production-caller status is restated as confirmed fact, not future architecture — it has been independently verified enough times in this series to be treated as settled.
4. This document does not authorize any code change.

---

## Deliverable Status

- ✅ Mission Control defined as an operating system, not a dashboard — grounded in the structural read-only contract pattern confirmed across all 9 workspaces
- ✅ All 9 workspaces documented (Purpose/Owner/Inputs/Outputs/Reads/Writes/Dependencies/Future Expansion), synthesized from already-approved schemas, not re-derived
- ✅ Constitutional dependency map produced, with one claim (Settings → Identity/Health/Monitoring) explicitly marked unconfirmed rather than assumed
- ✅ Ownership matrix produced for all 9 domains
- ✅ Data flow diagram produced, with the real Settings-bypasses-CIM exception preserved
- ✅ ATHENA's constitutional position restated as confirmed fact (zero production callers, verified 3+ times in this series)
- ✅ Future expansion documented, with Territory Intelligence correctly distinguished as partially-real (engine exists) vs. the other five fully-unbuilt future modules
- ✅ No production code changed; no Mission Control changes

**Mission Control™ Constitutional Architecture ready for Board review.**
