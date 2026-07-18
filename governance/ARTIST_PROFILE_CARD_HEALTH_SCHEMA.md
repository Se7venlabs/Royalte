# Royaltē — Artist Profile Card
# Section 8: Health Intelligence™ Field Schema

## 1. Purpose

**What Health Intelligence™ is:** an executive summary layer over the six domains already schema'd in this series (Identity, Publishing, Catalog, Global Music Footprint, Backend, Media). It answers "how healthy is this artist's entire digital business," not "what does Royaltē know about domain X."

**What it is not:** it is not a source of truth for any domain fact, and it does not compute domain scores itself. Confirmed directly in the real module's own header comment (`api/_lib/health-intelligence.js:5-6`): *"Interpretation layer over the canonical Royaltē Health Score™. Reads; never calculates a health score. Never fetches."* The overall score is sourced verbatim from `computeHealthScore()` (`api/_lib/health-engine.js`, the Board-locked Health Engine, PR #137) — `health-intelligence.js` does not recompute it, only adds display vocabulary around it.

**Why it exists:** every other workspace in this series answers "what does Royaltē know about Identity / Publishing / Catalog / etc." Health Intelligence™ is the one workspace that answers "how healthy is everything, combined" — the executive dashboard, not another source of truth.

**How it differs from every other workspace:** it consumes constitutional data from the other six domains rather than owning any of it. This is enforced in the real function signature itself — `assembleHealthIntelligence(healthScore, identityIntelligence, publishingIntelligence, catalogIntelligence, globalMusicFootprint, backendIntelligence, monitoringIntelligence, royalteAI)` (`health-intelligence.js:244-253`) takes seven other domains' already-assembled output as read-only input and produces a summary — it never receives raw provider evidence.

---

## 2. Constitutional Relationship

```text
Identity Intelligence™
        ↓
Publishing Intelligence™
        ↓
Catalog Intelligence™
        ↓
Global Music Footprint™
        ↓
Backend Intelligence™
        ↓
Media Intelligence™
        ↓
HEALTH INTELLIGENCE™
   (summarizes all six — does not replace any of them)
```

This is not aspirational — it matches the real call order in `lib/rie/index.js:444-453`, where `assembleHealthIntelligence()` is called with `identityIntelligence`, `publishingIntelligence`, `catalogIntelligence`, `globalMusicFootprint`, `backendIntelligence` already assembled and passed in as arguments. Media Intelligence is a partial exception — per Section 7 of this series (`ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md`), Media Intelligence has no domain assembler and no score field at all yet, so it contributes nothing to Health Intelligence today (see §6 below).

Each domain remains the constitutional owner of its own data. Health Intelligence™ never owns Identity, Publishing, Catalog, Footprint, Backend, or Media fields — it only reads their already-assembled scores.

---

## 3. HTML Inventory (from the live workspace, `public/workspaces/health-intelligence.html`)

### § Executive Header
Eyebrow ("Health Intelligence™"), heading ("Music Business Health Report" + artist name), description, "Last Sync: {time}", Date Range selector ("Jun 27 – Jul 3, 2026" — static text).

### § Historical Scan Banner (hidden by default)
"Historical View" label + date, "Return to Current →" button — appears only when browsing a past scan via the timeline.

### § KPI Row (2 cards)
**Health Score™ card:** score ring (0–100), status pill (Excellent/Strong/Moderate/Needs Review), trend text ("— Trend Updating"), Health Breakdown row (6 columns: Identity, Publishing, Catalog, AI Insights, Footprint, Backend).

**ATHENA Monitoring™ card:** status pill (Monitoring Active / Baseline Established / N Changes Detected / No Changes Detected), 2 brief text lines, Monitoring Coverage checklist (6 items: Apple Music, Spotify, YouTube, Publishing, Metadata, Catalog — each with a check or alert icon).

### § Core Health Metrics™ (6 category cards: Identity, Publishing Ecosystem, Catalog, AI Insights, Backend Intelligence, Global Music Footprint)
Each card: score (/100), progress bar, status pill, sparkline (trend graph), movement text ("▲/▼ N% this week" or "— First Scan"). Each card links to its own workspace.

### § Executive Timeline™
7-day scan ruler (Jun 27 – Jul 3), each day a clickable dot (plain / event / active state), "View Full Timeline →" link to `monitoring-timeline.html`.

---

## 4. Current Implementation Trace

**The core score pipeline is real, wired, and two-phase.** This is a materially different finding from every prior section except parts of Identity — most of the primary KPI is genuinely live.

- `assembleHealthIntelligence()` (`health-intelligence.js:244`) is called from `lib/rie/index.js:444-470` during the main scan pipeline, with `monitoringIntelligence` passed as `null` at this stage (comment, `lib/rie/index.js:453`: *"monitoringIntelligence — post-scan, not available here"*).
- **A second, real patch step exists** (`api/audit.js:439-494`): for authenticated scans only, after `persistOSScanSnapshot()` and the delta engine run, `monitoringIntelligence` is assembled from real alerts and `healthIntelligence` is **re-assembled** with real monitoring data, then the persisted `audit_scans.payload` is PATCHed in Supabase. Comment confirms intent: *"Health Intelligence is re-assembled with real monitoring data so the final persisted payload has the complete score."*
- **Real caveat, not a defect:** this two-phase patch is explicitly gated on `authenticatedUserId` (`api/audit.js:430-432`, *"Anonymous callers (no Bearer token) skip this entirely"*). For unauthenticated scans, `monitoringScore` stays at its neutral default (50, per `deriveMonitoringScore()`, `health-intelligence.js:126-133`) permanently — this is documented current scope, not a bug, mirroring the Territory Engine's Apple-only precedent already established in this series.
- `score`, `status`, `confidence`, `identityScore`, `publishingScore`, `catalogScore`, `footprintScore`, `backendScore`, `monitoringScore`, `strengths[]`, `concerns[]` are all real fields, each with an explicit derivation function (`deriveIdentityScore`, `derivePublishingScore`, etc., `health-intelligence.js:66-133`) reading the corresponding already-assembled domain object.
- Reaches the workspace via `CimAdapter.js:98-113` (`healthIntelligence` backward-compat object) → `canonical.healthIntelligence` → `runtime-context-mapper.js:147` passthrough → `royalte_workspace_context.healthIntelligence`. Contract-enforced by `mc-workspace-context.js:78-83`: `required: ['healthIntelligence']`, `requiredFields: ['healthIntelligence.score', 'healthIntelligence.status']`.

**Confirmed gap — data exists but is never rendered:**
- **`grade`** (A+/A/B/C/D/F, the Board-locked Health Engine grade band, `health-engine.js:83-99,209-211`) is a real, computed field — present in `CimAdapter.js:103` (`h.grade`) and in the dev fixture (`health-intelligence.html:27`, `grade: 'B+'`) — but **never referenced anywhere in the render script** (`health-intelligence.html:561-691`). This is a UI-binding gap, same pattern as Backend Intelligence's Last Successful Sync finding.

**Confirmed entirely static/hardcoded, no data binding:**
- **Monitoring Coverage checklist** (Apple Music/Spotify/YouTube/Publishing/Metadata/Catalog, each with a fixed check/alert icon) — no script reference sets these icons from any `ctx` field.
- **Sparkline SVGs and movement percentages** on all 6 category cards — literal hardcoded polyline coordinates and percentage text in the markup; only the movement text's fallback to "— First Scan" is conditionally wired (`health-intelligence.html:638-639`).
- **Executive Timeline™ (the entire 7-day history feature)** — `health-timeline.js` explicitly documents itself as *"presentation layer only. No business logic"* (line 6) and its own header states *"No API calls at selection time. All 7 scans pre-loaded on page init"* (line 4). The `SCANS` array (`health-timeline.js:19-`) is a literal hardcoded 7-entry mock dataset (scan times, scores, breakdowns, category scores, ATHENA text — all fixed values), not fetched from real scan history. This is a significant, high-visibility gap: the entire interactive timeline feature has no real backing data today, only the single current-scan KPI row does.
- **Trend text** ("— Trend Updating") and **Date Range selector** ("Jun 27 – Jul 3, 2026") — static text, no script wiring found.

---

## 5. Field Contract

| Field Name | Description | Data Type | Source | Owner | Editable |
|---|---|---|---|---|---|
| Overall Health Score | 0–100 score | number | `computeHealthScore().overallScore`, read verbatim | Health Engine (`health-engine.js`) — not Health Intelligence | No |
| Status | Excellent/Strong/Moderate/Needs Review | string | Derived from score via `STATUS_BANDS` | Health Intelligence™ (display vocabulary only) | No |
| Grade | A+/A/B/C/D/F | string | `computeHealthScore().overallGrade`, read verbatim | Health Engine — not Health Intelligence | No |
| Confidence | Verified/Partial/Limited | string | `deriveConfidence()` — counts domains with meaningful (non-neutral) data | Health Intelligence™ | No |
| Identity Score | 0–100, display only | number | `deriveIdentityScore(identityIntelligence)` | Identity Intelligence™ (source data); Health Intelligence™ (derivation) | No |
| Publishing Score | 0–100, display only | number | `derivePublishingScore(publishingIntelligence)` | Publishing Intelligence™ (source data); Health Intelligence™ (derivation) | No |
| Catalog Score | 0–100, display only | number | `deriveCatalogScore(catalogIntelligence)` | Catalog Intelligence™ (source data); Health Intelligence™ (derivation) | No |
| Footprint Score | 0–100, display only | number | `deriveFootprintScore(globalMusicFootprint)` | Global Music Footprint™ (source data); Health Intelligence™ (derivation) | No |
| Backend Score | 0–100, display only | number | `deriveBackendScore(backendIntelligence)` | Backend Intelligence™ (source data); Health Intelligence™ (derivation) | No |
| Monitoring Score | 0–100, display only | number | `deriveMonitoringScore(monitoringIntelligence)` — neutral default (50) for unauthenticated scans | Monitoring Intelligence™ (source data); Health Intelligence™ (derivation) | No |
| Strengths[] | up to 5 rule-based strings | array\<string\> | `extractStrengths()` — threshold rules per domain, falls back to `royalteAI.strengths[0]` | Health Intelligence™ | No |
| Concerns[] | up to 5 rule-based strings | array\<string\> | `extractConcerns()` — threshold rules per domain, falls back to `royalteAI.issues[0]` | Health Intelligence™ | No |
| Domain Statuses | per-domain Excellent/Strong/Moderate/Needs Review | object | `statusForScore()` applied to each domain score, incl. `metadata`/`coverage` from Health Engine category scores | Health Intelligence™ | No |
| Monitoring Coverage checklist | 6 static items | — | **Not a field** — hardcoded markup | N/A | N/A |
| Sparklines / movement % (category cards) | trend visuals | — | **Not a field** — hardcoded markup | N/A | N/A |
| Executive Timeline™ (7-day history) | historical scan browsing | — | **Not a field** — hardcoded mock dataset (`health-timeline.js`) | N/A | N/A |

None of these fields are user-editable — Health Intelligence™ is a read-only summary surface, consistent with its stated purpose.

---

## 6. Domain Summary Rules

| Summarized Domain | Source Workspace | Health Calculation | Dependencies | Current Implementation | Future Expansion |
|---|---|---|---|---|---|
| Identity Health | Identity Intelligence™ | `deriveIdentityScore()` — uses `coverage` if present, else `verified/total` ratio | `identityIntelligence.coverage` | Real, wired | None identified |
| Publishing Health | Publishing Intelligence™ | `derivePublishingScore()` — uses `coverage` if present, else neutral 50 with an MLC-auth-unavailable special case | `publishingIntelligence.coverage`, `.registrations.mlcRegistration` | Real, wired | Publishing Health™ itself has a separate, undocumented scoring inconsistency already logged as task #44 (SoundExchange dead-weight) — out of scope here, cross-referenced only |
| Catalog Health | Catalog Intelligence™ | `deriveCatalogScore()` — maps `confidence` enum (Verified/Partial/Unable to Confirm) to fixed scores, falls back to track-count heuristic | `catalogIntelligence.confidence`, `.totalTracks` | Real, wired | None identified |
| Footprint Health | Global Music Footprint™ | `deriveFootprintScore()` — uses `coveragePercent` directly | `globalMusicFootprint.coveragePercent` | Real, wired | None identified |
| Backend Health | Backend Intelligence™ | `deriveBackendScore()` — VERIFIED/non-AUTH_UNAVAILABLE ratio across `services[]` | `backendIntelligence.services[]` | Real, wired | Per `ARTIST_PROFILE_CARD_BACKEND_SCHEMA.md`, `backendIntelligence` itself covers only 2 services (MusicBrainz, MLC) by current scope — Backend Health inherits that narrow scope |
| Monitoring Health | Monitoring Intelligence™ | `deriveMonitoringScore()` — status-based (active=100, no_changes=90, baseline=80, else neutral 50) | `monitoringIntelligence.status` | Real, wired, but **only for authenticated scans** — unauthenticated scans never receive real `monitoringIntelligence`, permanently neutral | None identified beyond the authentication gate itself |
| Media Health | Media Intelligence™ | **Does not exist** | — | Per `ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md` §Deliverable Status, Media Intelligence has no domain assembler at all — there is nothing for Health Intelligence to summarize from this domain today | A `deriveMediaScore()` function would need to be added once a Media Intelligence assembler exists — genuinely new work, not a Health Intelligence gap |

**On the Board's example names "Territory Health™," "Rights Health™," "Distribution Health™":** these are not distinct scores in the current implementation. Territory is folded into Footprint Health (`globalMusicFootprint.coveragePercent`, which is itself Territory Music Engine output per `ARTIST_PROFILE_CARD_GLOBAL_FOOTPRINT_SCHEMA.md`). Rights and Distribution are not separately scored anywhere — Rights-adjacent signal lives inside Publishing Health, Distribution-adjacent signal lives inside Footprint Health. Documented here rather than inventing three new score fields that don't exist.

---

## 7. Overall Artist Health™

| Concept | Status |
|---|---|
| Overall Health Score | **Implemented** — `score`, sourced verbatim from `computeHealthScore().overallScore` |
| Readiness Score | **Not implemented.** Zero references anywhere in `health-engine.js` or `health-intelligence.js`. Future constitutional field — no implementation exists to describe |
| Completion % | **Not implemented** as a named concept. `confidence` (Verified/Partial/Limited, based on how many domains have meaningful data) is the closest existing analog, but it is a 3-tier label, not a percentage |
| Missing Items | **Not implemented** as a distinct structure. `concerns[]` is the closest analog — rule-based diagnostic strings, not itemized "missing items" |
| Priority Issues | **Not implemented** as a distinct structure. Same `concerns[]` analog as above — concerns are not ranked or prioritized beyond insertion order (max 5) |
| Recommended Actions | **Not implemented.** `concerns[]` strings are diagnostic ("Publishing registration requires review"), not actionable recommendations. Per Section 8 below, actionable interpretation is explicitly ATHENA's job, not Health Intelligence's |

Per Board instruction, none of the unimplemented items above are described as if built — they are documented as future constitutional fields only.

---

## 8. Relationship to ATHENA

Health Intelligence™ provides facts. ATHENA provides interpretation. Example, using this domain's real fields:

**Health Intelligence™ (fact):** `identityScore: 67`

**ATHENA (interpretation, not implemented):** "Connecting your Record Label and Publishing Administrator will increase your Identity Health."

This separation is enforced structurally, not just by convention: `health-intelligence.js`'s own header states it *"Reads; never calculates,"* and its `strengths[]`/`concerns[]` extraction is rule-threshold-based (fixed score cutoffs), not generative. As established in prior sections of this series (`ARTIST_PROFILE_CARD_ARCHITECTURE.md` §5, `ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md`), real ATHENA (`api/athena/`) has zero production callers. The "ATHENA Monitoring™" card name on this workspace is a naming/branding choice made ahead of real ATHENA wiring — consistent with the same pattern already found on Media Intelligence's "ATHENA Media Insights™" card. Health never performs AI reasoning; it only reads pre-computed scores and applies fixed threshold rules.

---

## 9. Constitutional Rules

1. Health Intelligence™ never owns Identity, Publishing, Catalog, Footprint, Backend, or Media fields — confirmed structurally, since `assembleHealthIntelligence()` only accepts already-assembled domain objects as read-only arguments, never raw evidence.
2. Health Intelligence™ never independently calculates the overall score — it reads `computeHealthScore().overallScore` verbatim (enforced invariant, `health-intelligence.js:21-22`: `payload.healthIntelligence.score === payload.healthScore.overallScore`).
3. Per-domain contributor scores (`identityScore`, `publishingScore`, etc.) are informational display values only — they do not feed the overall score (`health-intelligence.js:61-64`).
4. Mission Control presents Health Intelligence™ data; it does not compute any of it (confirmed — the render script in `health-intelligence.html` only reads and formats `ctx.healthIntelligence`/`ctx.monitoringIntelligence`, never derives a score).
5. Runtime Context formats/passes through Health Intelligence™ data (`runtime-context-mapper.js:147-149`) — it does not compute it either.
6. The Health Engine (`health-engine.js`, `computeHealthScore()`) is the sole constitutional authority for the Royaltē Health Score™ and grade. Health Intelligence™ is strictly a reader of that output.
7. A field belongs in the **Field Contract** (§5) as "Real, wired" only if traceable to committed code **and** actually rendered — per precedent from every prior section in this series. `grade` is real but unrendered, so it is flagged as a gap, not counted as delivered.

---

## 10. Future Constitutional Architecture (documentation only — no implementation implied)

```text
Health Intelligence™
        ↓
Artist Profile Card
        ↓
Runtime Context
        ↓
Mission Control™
```

Consistent with the target architecture already approved in `ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8 and restated in `ARTIST_PROFILE_CARD_BACKEND_SCHEMA.md`. This section states direction only; it does not change what exists today (§4 above) and does not authorize any code change.

---

## Deliverable Status

Health Intelligence™ field schema — complete:
- ✅ All six prior constitutional schemas reviewed before drafting; no field duplicated — Health Intelligence™ is documented as reading, not owning, each domain's data
- ✅ Complete HTML inventory produced from the live workspace
- ✅ Every visible field traced to real code or confirmed static, with file:line citations
- ✅ Core score pipeline confirmed real and wired, including the two-phase authenticated-only monitoring patch — a materially different finding from most prior sections
- ✅ One data-exists-but-unrendered gap found (`grade`) and one large hardcoded-mock-data gap found (the entire Executive Timeline™ feature), both documented, neither fixed
- ✅ "Readiness Score," "Completion %," "Missing Items," "Priority Issues," and "Recommended Actions" confirmed unimplemented and documented as future constitutional fields only — no implementation invented
- ✅ ATHENA relationship documented per Board's fact-vs-interpretation framing
- ✅ No production code changed; no Mission Control changes
- ✅ Ready for review and lock

**Health Intelligence™ ready to lock.**
