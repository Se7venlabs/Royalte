# Royaltē — Artist Profile Card
# Section 6: Backend Intelligence Field Schema

## Purpose

Define the Backend Intelligence field contract for the Artist Profile Card: Royaltē system-generated operational intelligence — the health, state, processing, and availability of an artist record. Explicitly distinct from raw provider data (Apple/Spotify/etc.) and from AI Insights (interpretation/recommendations): Backend Intelligence answers "what does the system know about this record's condition," never "what should the artist do about it." This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit Identity/Publishing/Catalog/Global Music Footprint, modify Mission Control, or activate ATHENA. Scope is field-schema completion only. No production code is changed by this document.

## Source of Truth Layers

Three layers, never mixed — same discipline as Sections 2–5:

1. **Approved Artist Profile Card Product Model** — what Backend Intelligence must represent.
2. **Current Implementation Reality** — what exists in code today, with file:line citations.
3. **Implementation Gap** — the work required to align current code with the approved model.

## The real domain module, traced

**File**: `api/_lib/backend-intelligence.js` (v2.0.0, "Build Pass 3"). Entrypoint: `assembleBackendIntelligence(canonical, publishingIntelligence)` (line 183) — cited here by its real, committed name; this document does not rename actual code identifiers. Wired into `lib/rie/index.js:75,421-423`; produced internally as `cim.verification` (`lib/rie/index.js:166`) — the code itself carries a comment flagging this as a "Phase 3 violation," since this module still reads `canonicalForEnrichment.platforms.*` directly rather than through the intended layering. Exposed downstream as `canonical.backendIntelligence` / `royalte_workspace_context.backendIntelligence` (confirmed at `runtime-context-mapper.js:138`), consistent with the rename pattern already seen for Global Music Footprint (`cim.globalFootprint` → `canonical.globalMusicFootprint`).

**Real output shape** (`backend-intelligence.js:213-219`): `{ services: ServiceEntry[], connectedCount, totalCount, apisResponding:{responded,total}, lastSync, summaryLabel }`.

**Current Scope note:** despite the module name, this object is narrowly a **verification/registration infrastructure signal** — only two services are displayed today, **MusicBrainz and MLC** (`backend-intelligence.js:74-77`); Discogs/Last.fm feed only the `apisResponding` count, not the `services` list. This reflects the currently implemented provider scope only, per existing Board directive — it is not a statement about the long-term PAL provider roadmap, which is expected to expand beyond these two as later phases wire additional providers (see Global Music Footprint's own Provider precedent, `ARTIST_PROFILE_CARD_GLOBAL_FOOTPRINT_SCHEMA.md`, where Apple is similarly the sole currently-acquiring provider without that being a roadmap ceiling). This module has no concept of scan pipeline state, processing errors, or a general data-quality signal. The approved product model's broader scope (system status, data health, processing history, full provider connection rollup, system alerts) is largely **not yet represented** here — documented honestly in Section 2, not assumed to exist.

## Major finding: most of the Digital Twin™ hero is not yet data-bound

`public/workspaces/backend-intelligence.html`'s centerpiece — 7 nodes (RELEASE / METADATA / DISTRIBUTION / RIGHTS OWNERSHIP / IDENTITY / REGISTRATIONS / CANONICAL RECORD), their verified/review states, all connection lines, and the full ATHENA drill-down panel content (`backend-intelligence.html:438-642`) — is markup and JS with hardcoded values rather than computed ones; none of it reads `ctx.backendIntelligence`. Only four things on the entire page are live-bound:
1. Ring score, from `hi.backendScore` (line 736)
2. `bi-systems-num`, from `bi.connectedCount`/`totalCount` (lines 752-757)
3. `bi-records-num`, from `bi.apisResponding` (lines 759-768)
4. The summary sub-label (lines 771-774)

The "Infrastructure Risk" KPI card ("MEDIUM", "2 Issues Detected," lines 392-402) and the per-node "review" states (`bi-node--review` on Rights/Registrations, lines 469, 492) are hardcoded, not computed. This is the same not-yet-data-bound pattern already found and logged for Catalog Intelligence and Global Music Footprint, larger in scope here — most of this workspace's visual surface has no real data behind it today.

*Note on framing:* unlike the Territory Engine's Apple-only acquisition scope (explicitly documented in-code as intentional Phase 5.2 scope, `territory-intelligence.js:19-20`), no code comment, TODO, or design note anywhere in `backend-intelligence.html` or `backend-intelligence.js` indicates this hardcoding is a deliberate placeholder for a specific future architecture — it is reported here strictly as the current implementation state. See the Future Constitutional Architecture note below for where this is headed; that section is prospective, not a claim about why today's state is what it is.

## Future Constitutional Architecture (documentation only — no implementation implied)

```text
Backend Intelligence
        ↓
Artist Profile Card
        ↓
Runtime Context
        ↓
Mission Control™
```

Consistent with the already-approved target architecture (`ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8): Mission Control's constitutional direction is to become a presentation layer driven by the Artist Profile Card, not an assembly layer in its own right. This section states that direction; it does not change what exists today, and does not authorize any code change.

---

## Approved Backend Intelligence Sections

The approved product model (unchanged from the brief — no approved field is dropped by the findings below):

**System Status** — Profile Status, Processing Status, Data Availability Status, Last Successful Sync, Last Update, Current System State

**Data Health** — Data Completeness, Data Quality Status, Validation Status, Missing Data Indicators, Data Integrity Issues

**Processing Intelligence** — Last Scan Date, Processing Events, Processing History, Pipeline Status, Processing Errors

**Provider Connection Intelligence** — Connected Providers, Provider Availability, Provider Connection Status, Provider Data Status

**System Alerts** — Active Issues, Warnings, Required Actions, Resolution Status

---

## Section 1 — Implemented Fields

Only fields traceable to real, committed code **and actually rendered to the user** — per precedent from prior sections (e.g. Identity's "Last Sync: —"), a field that exists in a backend object but is never displayed does not count as implemented at the Artist Profile Card layer.

### System Status

**Current System State**
- Display Name: Current System State
- Classification: Canonical Intelligence Field — coarse label, not a structured state machine
- Population Source: Royaltē System
- Current Implementation Reference: `summaryLabel` (e.g. "All Verified", "2 of N Connected") — `backend-intelligence.js:139-143,219`, rendered `backend-intelligence.html:771-774`.

### Provider Connection Intelligence

**Connected Providers**
- Display Name: Connected Providers
- Classification: Canonical Data Field — **narrow scope caveat**
- Population Source: Royaltē System
- Current Implementation Reference: `connectedCount`/`totalCount` (`backend-intelligence.js:196-197,213`), rendered `backend-intelligence.html:751-757`. **Covers only MusicBrainz and MLC** (the 2 Board-directed display services) — not Apple/Spotify/YouTube/Deezer/TIDAL, which the approved model's own examples list.

**Provider Availability**
- Display Name: Provider Availability
- Classification: Canonical Data Field — per-service, same narrow scope as above
- Population Source: Royaltē System
- Current Implementation Reference: per-service `state` (`VERIFIED`/`NOT_FOUND`/`AUTH_UNAVAILABLE`/`ERROR`), `backend-intelligence.js:66-71,190-194`.

**Provider Connection Status**
- Display Name: Provider Connection Status
- Classification: Canonical Data Field — per-service only, no unified rollup
- Population Source: Royaltē System
- Current Implementation Reference: `subLabel`/`statusLabel` per service (`backend-intelligence.js:118-131`). **No consolidated cross-domain "Provider Connection Intelligence" rollup exists anywhere** (confirmed: zero matches for "Connected Providers"/"Provider Connection"/"Provider Status" across `public/`) — each domain (Identity, Catalog, Global Footprint) tracks its own provider coverage independently. The approved unified view is a gap, tracked in Section 2.

---

## Section 2 — Implementation Required

Approved Artist Profile Card fields not fully supported by current code. They remain in the schema — not removed.

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Profile Status | No such field anywhere in this module | New field — genuinely undefined concept today, needs product definition before engineering scope |
| Processing Status | Nearest analog is scan-write status (`audit_scans`/`scan_snapshots.status`, `api/_lib/persist-os-scan.js:284`) — never exposed through `backendIntelligence` | Surface existing scan status into the Backend Intelligence output — largely a pass-through, not new computation |
| Data Availability Status | Only per-service `state`/`subLabel` exists (service-level, not system-wide) | Requires a new system-wide aggregation over existing per-service states |
| Last Successful Sync | Backend Intelligence already computes `lastSync` from `canonical.scannedAt` (`backend-intelligence.js:209-211,218`) — but it is **never rendered** in the workspace | UI-binding gap only — the data exists; render it |
| Last Update | No field found | New field |
| Data Completeness | Exists only in the ATHENA (AI Insights) confidence engine (`api/athena/confidence.js:14-50`) — a different domain per this document's own Backend-vs-AI-Insights distinction | Would need a Backend-Intelligence-scoped completeness computation, distinct from ATHENA's — not a rename of the ATHENA field, which belongs to a different domain |
| Data Quality Status | Only exists as a raw pass-through of Discogs' own field (`lib/rie/EvidenceBridge.js:481`, `dc.dataQuality = p.data_quality ?? null`) — provider-sourced, not Royaltē-computed | New Royaltē-computed data quality signal, not a provider passthrough |
| Validation Status | No field found | New field |
| Missing Data Indicators | No field found | New field |
| Data Integrity Issues | "Data Integrity Confirmed" is static markup text (`backend-intelligence.html:363`), not bound to any field | Compute and bind a real integrity-issues field |
| Last Scan Date | Exists in the database (`scanned_at`, `persist-os-scan.js:280`) but not surfaced through `backendIntelligence` | Pass-through from existing DB field into the Backend Intelligence output — same pattern as Last Successful Sync above (likely the same underlying timestamp) |
| Processing Events / Processing History | Closest analog is the delta engine's `alerts`/`alertCount` (`persist-os-scan.js:320-325,361-366`), which belongs to Monitoring Intelligence, a different domain | New Backend-Intelligence-scoped event/history tracking, not a repurposing of Monitoring's alerts |
| Pipeline Status | No field found | New field |
| Processing Errors | No field found anywhere in this module | New field |
| Provider Data Status (as distinct from Availability/Connection Status) | No distinct field | Define what distinguishes this from the two fields already implemented above, then implement |
| Active Issues / Warnings | The "Infrastructure Risk" KPI card and Digital Twin node review-states are **entirely hardcoded** (`backend-intelligence.html:392-402,469,492`) — not bound to any data | Compute real issues/warnings and bind the KPI card and node states to them — this is the highest-visibility gap in this schema |
| Required Actions | The ATHENA drill-down panel's "Recommended Action" text per node is hardcoded prose (`backend-intelligence.html:557-642`), not computed | Compute real recommended actions per node, or clarify this belongs to AI Insights (interpretation) rather than Backend Intelligence (system condition) per this document's own distinction |
| Resolution Status | No field found | New field |

---

## Backend Intelligence Rules

1. Backend Intelligence represents system condition — never interpretation. "Spotify data was unavailable during last scan" is Backend Intelligence; "Artist may have incomplete Spotify market presence" is AI Insight. This document documents fields for the former only.
2. PAL owns provider acquisition and raw availability; CIO/CIM owns normalization; Royaltē System (this Backend Intelligence module) owns status calculations, data health, and processing state; the Artist Profile Card represents the result — it does not compute it. Constitutional direction (see Future Constitutional Architecture note above): Mission Control is a presentation layer driven by the Artist Profile Card, not an assembly layer.
3. Mission Control consumes Artist Profile Card data, currently via the existing Runtime Context delivery layer — unchanged and out of scope here.
4. A field belongs in **Section 1 — Implemented Fields** only if traceable to real, committed code today **and actually rendered to the user** — a field that exists in a backend object but isn't displayed is a UI-binding gap, tracked in Section 2, not counted as implemented.
5. Approved-but-not-yet-built fields belong in **Section 2 — Implementation Required**, never blended into the implemented contract. No approved product field is removed for lack of current support.
6. Implementation conflicts discovered during this trace (the largely-static Digital Twin hero, the hardcoded Infrastructure Risk KPI) are documented as gaps here and logged as separate engineering tasks — not fixed in this PR.

---

## Deliverable Status

Backend Intelligence field schema — complete:
- ✅ Backend fields defined across all 5 approved sections
- ✅ Ownership identified (PAL / CIO-CIM / Royaltē System / Artist Profile Card) for every field
- ✅ Current implementation mapped, each Implemented Field with a file:line citation
- ✅ Gaps documented, none silently dropped — including the field-exists-but-unrendered cases (Last Successful Sync, Last Scan Date)
- ✅ No architecture changes introduced
- ✅ Major finding documented, not fixed: most of the Digital Twin™ hero and the Infrastructure Risk KPI are not yet data-bound — to be logged as separate engineering tasks
- ✅ Ready for review and lock

**Backend Intelligence ready to lock. Proceeding to AI Insights Field Schema next.**
