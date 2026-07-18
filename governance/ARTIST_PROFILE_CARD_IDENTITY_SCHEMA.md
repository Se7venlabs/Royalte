# Royaltē — Artist Profile Card
# Section 2: Identity Intelligence Field Schema

## Purpose

Define the Identity Intelligence fields contained within the Artist Profile Card — the approved product record — and separately, precisely, what current code actually supports today.

This document works within the currently approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8):

```text
SCAN → ARTIST PROFILE CARD → INTELLIGENCE PROCESSING → ATHENA™ → MISSION CONTROL
```

No architecture decisions are introduced or changed by this document. Scope is field-schema completion only.

## Source of Truth Layers

Three layers, never mixed:

1. **Approved Artist Profile Card Product Model** — what the product requires (§ "Approved Identity Intelligence Sections" below).
2. **Current Implementation Reality** — what exists in code today, with file:line citations (Section 1 — Implemented Fields).
3. **Implementation Gap** — the work required to align current code with the approved model (Section 2 — Implementation Required).

---

## Approved Identity Intelligence Sections

The approved product model for Identity Intelligence:

**Identity Summary** — Artist Profile Image, Artist Name, Last Sync, Identity Description

**Identity Presence** — Identity Coverage, Identity Rating, Identity Services Count. Identity Coverage stays informational-only — never renamed to "Identity Score," never converted into a health score.

**Latest Release** — Artist, Release, Label, Genre, ISRC (plus Artwork). Locked.

**Identity Risks** — Risk Status, Risk Badge, Risk Summary.

**Core Identity Platforms** — five platforms, using their approved **product capability names**:
- Apple Music for Artists
- Spotify for Artists
- YouTube Official Artist Channel
- Deezer
- TIDAL Artist Home

These are product capability names, not UI labels. Where current UI uses different (simplified) labels, that is documented as a gap below — the approved names are not replaced by this document.

---

## Section 1 — Implemented Fields

Only fields traceable to current code. Nothing here is aspirational.

### Identity Summary

**Artist Profile Image**
- Display Name: Artist Profile Image
- Section: Identity Summary
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: Apple Music, Spotify, and other platforms exposing artwork
- Current Implementation Reference: normalized artwork URL, `substituteArtworkDimensions(am.artworkUrl)` → `cio.identity.artwork` (`api/_lib/apple-pal-acquisition.js`). Square container, no circular treatment; placeholder required when unavailable.

**Artist Initials / Avatar**
- Display Name: Artist Initials / Avatar
- Section: Identity Summary
- Classification: UI Fallback
- Population Source: Royaltē System (computed client-side, not stored)
- Provider Source: N/A
- Current Implementation Reference: rendered as `ii-artist-initials`, shown when no verified image exists (`public/workspaces/identity-intelligence.html:244-267`).

**Artist Name**
- Display Name: Artist Name
- Section: Identity Summary
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: Apple Music / Spotify / YouTube
- Current Implementation Reference: primary identity value, rendered as `ii-exec-heading` (`identity-intelligence.html:244-267`).

**Identity Description**
- Display Name: Identity Description
- Section: Identity Summary
- Classification: Static UI String (current implementation only — approved field is per-artist descriptive text)
- Population Source: None (hardcoded today)
- Provider Source: N/A
- Current Implementation Reference: hardcoded tagline "Monitor your verified artist identity..." (`identity-intelligence.html:253`, class `ii-exec-desc`). Does not vary per artist today. Dynamic version tracked in Section 2.

**Last Sync**
- Display Name: Last Sync
- Section: Identity Summary
- Classification: UI Placeholder (current implementation only)
- Population Source: None (unbound today)
- Provider Source: N/A
- Current Implementation Reference: renders as literal `Last Sync: —` (`identity-intelligence.html:257`). Bound version tracked in Section 2.

### Identity Presence

**Identity Coverage**
- Display Name: Identity Coverage
- Section: Identity Presence
- Classification: Canonical Intelligence Field
- Population Source: Scan (via `identity-intelligence.js`)
- Provider Source: N/A (aggregate across the 5 providers)
- Current Implementation Reference: field name in code is `coverage` (`api/_lib/identity-intelligence.js:68,205`). Module comment: "Informational only — not a Health Score" (`identity-intelligence.js:83-98`). Preserved per standing correction — never renamed to "Score."

**Identity Rating**
- Display Name: Identity Rating
- Section: Identity Presence
- Classification: UI-Derived Display Value
- Population Source: Royaltē System (computed client-side from `coverage`; not a stored field)
- Provider Source: N/A
- Current Implementation Reference: 4 buckets — Excellent / Strong / Moderate / Needs Review (`identity-intelligence.html:619`).

**Identity Services Count**
- Display Name: Identity Services Count
- Section: Identity Presence
- Classification: UI-Derived Display Value (current implementation only — not yet a canonical field)
- Population Source: None (hardcoded today)
- Provider Source: N/A
- Current Implementation Reference: hardcoded caption "Across 5 Identity Services" (`identity-intelligence.html:627`). Bound version tracked in Section 2.

### Latest Release (locked)

All sourced from `catalogIntelligence.bestVerifiedRelease` / `subject` (`identity-intelligence.html:296-325`):

| Field | Classification | Population Source | Provider Source |
|---|---|---|---|
| Artwork | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |
| Artist | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |
| Release | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |
| Label | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |
| Genre | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |
| ISRC | Canonical Data Field | Scan | Apple Music / Spotify / other release providers |

### Identity Risks

**Risk Display (current behavior)**
- Display Name: Identity Risks
- Section: Identity Risks
- Classification: UI-Derived Display Value — not stored fields
- Population Source: Royaltē System (derived live at render time)
- Provider Source: N/A
- Current Implementation Reference: derived from `identity.issues[0]` (`identity-intelligence.js:70` — `issues: Array<{provider, label, ruleId, title, severity}>`); badge text is a hardcoded literal, `'Action Required'` or `'All Clear'` (`identity-intelligence.html:704-723`). No stored `riskStatus`/`riskBadge`/`riskSummary` field exists — the approved discrete fields are tracked in Section 2.

### Core Identity Platforms

Approved product capability names vs. current UI labels (`IDENTITY_PROVIDER_LABELS`, `identity-intelligence.js:139-145`):

| Approved Product Name | Current UI Label |
|---|---|
| Apple Music for Artists | Apple Music |
| Spotify for Artists | Spotify |
| YouTube Official Artist Channel | YouTube |
| Deezer | Deezer |
| TIDAL Artist Home | TIDAL |

Per-provider fields, from `IDENTITY_PROVIDERS = ['apple','spotify','youtube','deezer','tidal']` (`identity-intelligence.js:137`):

**Platform Status**
- Section: Core Identity Platforms
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: Apple Music / Spotify / YouTube / Deezer / TIDAL
- Current Implementation Reference: 4-state model `VERIFIED / ACTION_REQUIRED / NOT_FOUND / UNABLE_TO_CONFIRM` (`identity-intelligence.js:130-135`), per provider, in `providers.{apple|spotify|youtube|deezer|tidal}`.

**Confidence**
- Section: Core Identity Platforms
- Classification: Unavailable — placeholder by design
- Population Source: None
- Provider Source: N/A
- Current Implementation Reference: hardcoded to `—` on every provider card, with the code comment "no per-provider score available — truthful display is '—'" (`identity-intelligence.html:666-668`). Deliberate, not an oversight.

**Last Sync (per platform)**
- Section: Core Identity Platforms
- Classification: System Metadata (Global, not per-provider)
- Population Source: Royaltē System
- Provider Source: N/A
- Current Implementation Reference: all 5 provider cards reuse the same single global `scannedAt` value (`identity-intelligence.html:669-677`). No distinct per-provider sync timestamp today.

---

## Section 2 — Implementation Required

Approved Artist Profile Card fields not fully supported by current code. They remain in the schema — not removed.

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Bound Identity Services Count | Hardcoded caption string, not derived from data | Bind the caption to `supportedProviders.length` |
| Dynamic Identity Description | Static, non-per-artist tagline (`identity-intelligence.html:253`) | New acquisition + storage for an artist bio/description field — no such field exists in Scan or CIO/CIM today |
| Bound Last Sync (Identity Summary) | Unbound `—` literal (`identity-intelligence.html:257`) | Wire the exec header to a real timestamp (e.g. `scannedAt`) |
| Platform Display Names (Apple Music for Artists / Spotify for Artists / YouTube Official Artist Channel / TIDAL Artist Home) | Current UI shows simplified labels via `IDENTITY_PROVIDER_LABELS` ("Apple Music", "Spotify", "YouTube", "TIDAL") | Align UI labels to the approved product capability names, or formally reconcile the two naming sets — decision and implementation both pending |
| Per-Provider Confidence Score | Deliberately absent (`—`), by explicit design decision (`identity-intelligence.html:666-668`) | `identity-intelligence.js` must compute and persist a real per-provider confidence value — a new intelligence field, not a display change |
| Per-Provider Last Sync | One global timestamp reused across all 5 provider cards | PAL/EvidenceBridge acquisition must capture and persist a per-provider timestamp; `identity-intelligence.js` must expose it |
| Risk Status / Risk Badge / Risk Summary (stored) | Fully UI-derived from `issues[0]` on every render, nothing stored | Persist a computed risk classification (e.g. in `identity-intelligence.js` output) instead of deriving badge text client-side |

---

## Identity Intelligence Rules

1. Provider data does not directly populate Mission Control.
2. Scan results map into the Artist Profile Card.
3. Mission Control consumes Artist Profile Card data, currently via the existing Runtime Context delivery layer — Runtime Context's own role is assessed separately in `ARTIST_PROFILE_CARD_ARCHITECTURE.md` §9, out of scope here.
4. Provider Source and Population Source remain separate concepts.
5. A field belongs in **Section 1 — Implemented Fields** only if traceable to real code today. Approved-but-not-yet-built fields belong in **Section 2 — Implementation Required**, never blended into the implemented contract as if they already exist. No approved product field is ever removed for lack of current support.

---

## Deliverable Status

Identity Intelligence field schema — complete:
- ✅ All approved Identity fields documented (Summary, Presence, Latest Release, Risks, Core Platforms)
- ✅ Current implementation gaps visible, each with file:line citation
- ✅ No approved product fields removed
- ✅ No unsupported field represented as already implemented
- ✅ Approved product capability platform names (Apple Music for Artists, etc.) preserved; current UI labels documented as a gap, not substituted in

**Identity section ready to lock. Proceeding to Publishing Intelligence Field Schema next.**
