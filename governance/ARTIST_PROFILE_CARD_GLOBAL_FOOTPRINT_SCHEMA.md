# Royaltē — Artist Profile Card
# Section 5: Global Music Footprint Field Schema

## Purpose

Define how the existing Territory Music Engine's output is represented inside the Artist Profile Card. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit Identity/Publishing/Catalog, modify Mission Control, or activate ATHENA. Scope is field-schema completion only. No production code is changed by this document.

## Architecture context — read before anything else in this document

**The Territory Music Engine already exists.** It was built in a prior session phase (Phase 5.1–5.4: discovery, engine implementation, consolidation/certification, refactoring) and is a real, wired, committed intelligence engine — not something this schema designs or redesigns.

```text
PAL
 │
 ├── Provider Acquisition (Identity, Catalog, Territory evidence)
 │
 ▼
TERRITORY MUSIC ENGINE  (existing — api/_lib/territory-intelligence.js)
 │
 ▼
GLOBAL MUSIC FOOTPRINT  (existing — api/_lib/global-music-footprint.js, consumes Territory Engine output)
 │
 ▼
ARTIST PROFILE CARD  ← this document defines this layer only
 │
 ▼
MISSION CONTROL
```

**This schema answers one question only:** how does Territory Music Engine / Global Music Footprint output get represented inside the Artist Profile Card? It does not redesign, replace, duplicate, or recreate Territory functionality. Where a field is missing, the required change (Section 2) is scoped to extending the *existing* engine's output or the *existing* representation layer — never to building parallel territory logic inside the Artist Profile Card.

## Source of Truth Layers

Three layers, never mixed — same discipline as Sections 2–4:

1. **Approved Artist Profile Card Product Model** — what Global Music Footprint must represent.
2. **Current Implementation Reality** — what exists in code today, with file:line citations.
3. **Implementation Gap** — the work required to align current code with the approved model, scoped to the existing engine/representation layers, not a new one.

## The real pipeline, traced

- **Territory Music Engine**: `assembleTerritoryIntelligence(evidencePackages)` (`api/_lib/territory-intelligence.js:168`) — a pure function over PAL `EvidencePackage[]`, applying a five-state model (`AVAILABLE/UNAVAILABLE/UNKNOWN/NOT_EVALUATED/ERROR`) across 167 Apple storefronts (`lib/territory/canonical-territory-vocabulary.js:28-52`). Output: `{ _version, generatedAt, totalTerritoriesEvaluated, providersContributing, summary, territories:[{code,name,state,confidence,evidence}] }` (`territory-intelligence.js:206-213`).
- **Wiring**: `lib/rie/index.js:414` calls the Territory Engine, then `lib/rie/index.js:418` passes its output into `assembleGlobalMusicFootprint(report, cio, canonicalForEnrichment, territoryIntelligence)` (`api/_lib/global-music-footprint.js:207`). The Territory Engine's raw output is **not** separately exposed as its own CIM key — it is consumed internally and folded into `globalFootprint.distributionGaps`. The Artist Profile Card representation layer is `cim.globalFootprint`, renamed `canonical.globalMusicFootprint` by `lib/rie/CimAdapter.js:123`.
- **Global Music Footprint output shape**: `{ territoriesAvailable, territoriesUnavailable, coveragePercent, status ('Global'|'Strong'|'Regional'|'Limited'), reachNarrative, confidence, distributionGaps }` (`global-music-footprint.js:35-55`).
- **Distribution Gaps™**: `buildDistributionGaps()` (`global-music-footprint.js:163-205`) — `{ totalRequiringAttention, unavailable, unknown, notEvaluated, territories:[{code, name, status, providers[], reason, recommendedAction, lastVerified}] }`. Certified (`tests/certification/suites/20-distribution-gaps.mjs`), consumed by `public/js/gmf-distribution-gaps.js`.
- **PAL territory acquisition**: `Capability.TERRITORIES`/`Capability.AVAILABILITY` are declared by Apple, Spotify, and Deezer connectors — but **only Apple's `apple-pal-acquisition.js:140-148` actually acquires this evidence** (global 167-storefront check). Spotify and Deezer declare the capability without a wired acquisition call. The Territory Engine's own comment confirms this is by design for this phase: "Apple Music is the sole territory-acquisition provider for Phase 5.2" (`territory-intelligence.js:19-20`) — not a defect, a documented current scope.
- **Runtime Context**: `buildWorkspaceRuntimeContext()` passes `globalMusicFootprint` through unchanged (`public/js/runtime-context-mapper.js:139`). No separate `territoryIntelligence` key is passed.
- **`public/workspaces/global-music-footprint.html`**: reads `royalte_workspace_context.globalMusicFootprint` (`global-music-footprint.html:596-607`) — `coveragePercent`, `territoriesAvailable`, `status`, `reachNarrative` (lines 617-645). Map-centric, legend below map (Apple/Spotify/Deezer/TIDAL, lines 328-345) — **the legend is display-only, not data-bound to per-provider evidence**, which matters given only Apple actually supplies verified territory evidence today. The "Additional Territories" South Korea/Japan flag callouts (lines 404, 442, 469) are **static hardcoded HTML**, not bound to `distributionGaps.territories` — same class of finding as the Catalog workspace's fixture-only fields.

---

## Approved Global Music Footprint Sections

The approved product model (unchanged from the brief — no approved field is dropped by the findings below):

**Territory Summary** — Total Territories, Active Markets, Territory Coverage, Market Presence

**Market Presence Detail** — Country, Region, Market Status, Platform Presence

**Territory Intelligence Output** — Strong Markets, Emerging Markets, Missing Markets, Territory Opportunities, Territory Risks

**Provider Territory Data** — Provider, Availability, Restrictions, Coverage

---

## Section 1 — Implemented Fields

Only fields traceable to current, committed code. Every field here is Territory Music Engine or Global Music Footprint output being represented — none of it is newly computed by this document.

### Territory Summary

**Active Markets**
- Display Name: Active Markets
- Classification: Canonical Intelligence Field
- Population Source: Royaltē System (Territory Music Engine, via Global Music Footprint)
- Current Implementation Reference: `territoriesAvailable` (`api/_lib/global-music-footprint.js:35-55`) — a count, not named "Active Markets" in code, but the same value.

**Territory Coverage**
- Display Name: Territory Coverage
- Classification: Canonical Intelligence Field
- Population Source: Royaltē System (Territory Music Engine, via Global Music Footprint)
- Current Implementation Reference: `coveragePercent` (`global-music-footprint.js:35-55`), rendered directly in the workspace (`global-music-footprint.html:617-645`).

### Market Presence Detail

Per-territory fields, sourced from `distributionGaps.territories[]` (`global-music-footprint.js:163-205`):

| Field | Current Implementation Reference |
|---|---|
| Country | `code` / `name` per territory (`global-music-footprint.js:183-184`) |
| Market Status | `status` per territory (`global-music-footprint.js:185`) |
| Platform Presence | `providers[]` per territory (`global-music-footprint.js:186`) — a list of contributing providers, not an aggregate score |

Classification: Canonical Intelligence Field. Population Source: Royaltē System (Territory Music Engine, via Global Music Footprint).

### Provider Territory Data

**Provider**
- Classification: Canonical Data Field — with a scope caveat
- Population Source: Scan, via the Territory Music Engine
- Current Implementation Reference: `providers[]` per territory (`global-music-footprint.js:172-174`), evidence-derived. **Caveat, real and current:** only Apple Music actually acquires `Capability.AVAILABILITY` evidence today (`apple-pal-acquisition.js:140-148`); Spotify and Deezer declare the capability but have no wired acquisition call. This is documented current scope for this phase, not a defect to fix here.

**Availability**
- Classification: Canonical Intelligence Field
- Population Source: Royaltē System (Territory Music Engine)
- Current Implementation Reference: `status` (Global Music Footprint) / `state` (Territory Engine, five-state model: AVAILABLE/UNAVAILABLE/UNKNOWN/NOT_EVALUATED/ERROR).

**Coverage**
- Classification: Canonical Intelligence Field — aggregate only, not per-provider
- Population Source: Royaltē System (Territory Music Engine, via Global Music Footprint)
- Current Implementation Reference: `coveragePercent` (`global-music-footprint.js:35-55`) — same underlying field as Territory Summary › Territory Coverage.

---

## Section 2 — Implementation Required

Approved Artist Profile Card fields not fully supported by current code. Every required change below is scoped to extending the *existing* Territory Music Engine or Global Music Footprint representation layer — none proposes new territory computation logic, duplicate PAL territory acquisition, or moving engine responsibilities into the Artist Profile Card.

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Total Territories | No single "total" field is exposed at the Global Music Footprint level. The Territory Engine computes `totalTerritoriesEvaluated` internally (`territory-intelligence.js:206-213`) but it is not surfaced downstream — only `territoriesAvailable`/`territoriesUnavailable` are | Expose the Territory Engine's existing `totalTerritoriesEvaluated` value through `assembleGlobalMusicFootprint()`'s output — the value already exists upstream, this is a pass-through, not new computation |
| Market Presence (as a distinct summary field) | No aggregate "presence" concept exists; the closest real field is `status` (Global/Strong/Regional/Limited), which is a coarser tier label, not the same concept | Clarify whether the approved "Market Presence" field is intended to be `status` under a different name, or a genuinely new aggregate — a naming/mapping decision, not necessarily new engine work |
| Region | No region grouping exists in Territory Engine or Global Music Footprint output — territories are flat, keyed by country code only | Requires the Territory Music Engine to add region grouping to its existing territory vocabulary (`lib/territory/canonical-territory-vocabulary.js`) — engine-owned work, not Artist Profile Card work |
| Strong Markets / Emerging Markets | No such classification exists. Closest real data is the flat `territories[]` list with a `state`/`status` per territory, with no tiering beyond available/unavailable/unknown | New tiering logic belongs in the Territory Music Engine (it already owns per-territory state classification) — the Artist Profile Card would only represent the result, not compute it |
| Missing Markets | No dedicated field; closest is `distributionGaps.territories` filtered to `status: 'Unavailable'`, which already exists | Likely just a representation/filtering decision at the Artist Profile Card layer over data the engine already produces — not new engine work |
| Territory Opportunities | No such concept anywhere in the Territory Engine or Global Music Footprint | New intelligence logic — if approved, this is Territory Music Engine work (it owns territory-domain intelligence), not something to build inside the Artist Profile Card |
| Territory Risks | No dedicated field; closest real concepts are `distributionGaps.totalRequiringAttention` (aggregate count) and per-territory `recommendedAction` (a diagnostic string, not a structured risk object) | Same as Territory Opportunities — if a structured risk object is wanted beyond the existing diagnostic string, that's Territory Music Engine work |
| Restrictions (per provider/territory) | No such field; closest is `reason` on a Distribution Gaps territory entry — a diagnostic string, not a structured restrictions list | Territory Music Engine would need to capture structured restriction reasons from evidence, not just a free-text `reason` — engine-owned work |
| Coverage (per-provider, not just aggregate) | Only aggregate `coveragePercent` exists; there is no per-provider coverage breakdown | Requires per-provider territory acquisition beyond Apple (Spotify/Deezer currently declare but don't acquire `Capability.AVAILABILITY`) — this is a PAL acquisition gap, not an Artist Profile Card representation gap |

### Workspace representation gaps (documented, not fixed here)

1. **Legend panel is display-only, not evidence-bound.** `global-music-footprint.html`'s legend lists Apple/Spotify/Deezer/TIDAL as if all four contribute territory data, but only Apple's evidence is real today. This could visually overstate verified coverage.
2. **"Additional Territories" South Korea/Japan callouts are static hardcoded HTML** (`global-music-footprint.html:404,442,469`), not bound to `distributionGaps.territories` — same fixture-not-live pattern already found and logged in the Catalog Intelligence workspace (tasks #45, #46).

---

## Global Music Footprint Rules

1. The Territory Music Engine is the sole owner of territory-domain intelligence computation. This document never proposes duplicating that logic.
2. Global Music Footprint (`api/_lib/global-music-footprint.js`) is the sole existing consumer/representation layer between the Territory Engine and the Artist Profile Card. Any new field either passes through existing engine output, or requires new engine work — never a parallel computation path.
3. Provider data does not directly populate Mission Control.
4. Mission Control consumes Artist Profile Card data, currently via the existing Runtime Context delivery layer — unchanged and out of scope here.
5. A field belongs in **Section 1 — Implemented Fields** only if traceable to real, committed code today, and rendering real (not fixture) data. Approved-but-not-yet-built fields belong in **Section 2 — Implementation Required**, never blended into the implemented contract. No approved product field is removed for lack of current support.
6. Implementation conflicts discovered during this trace (the display-only legend, the hardcoded territory callouts) are documented as gaps here, not fixed in this PR.

---

## Deliverable Status

Global Music Footprint field schema — complete:
- ✅ Territory Music Engine confirmed as existing, wired, real (not redesigned or recreated by this document)
- ✅ Global Music Footprint fields defined across all 4 approved sections
- ✅ Source ownership identified for every field, routed through the Territory Engine where applicable
- ✅ Current implementation mapped, each Implemented Field with a file:line citation
- ✅ Gaps documented, all scoped to extending the existing engine/representation layers — no proposal duplicates PAL territory logic or moves engine responsibility into the Artist Profile Card
- ✅ Two workspace representation gaps documented, not fixed — to be logged as separate engineering tasks
- ✅ Ready for review and lock

**Global Music Footprint ready to lock.**
