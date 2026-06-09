# Mission Control V2 — Stage 1 Plan

**Generated:** 2026-06-07
**Source of truth:** [`docs/mc-stage0-audit.md`](./mc-stage0-audit.md)
**Scope:** Information architecture + layout plan. **No UI code, no PRs.** This document is the brief for Stage 2 (build).

---

## Locked premises (from Stage 0 + Canonical Identity Architecture)

1. **Mission Control is presentation only.** Zero calculations, zero independent scoring, zero API calls beyond Supabase loaders, zero platform-specific logic.
2. **The normalized Royaltē Scan Payload is the source of truth.** If the payload knows it, MC can show it. If the payload does not know it, MC must not invent it.
3. **Rule #7 (intelligence-network):** Royaltē never surfaces source-platform names in user-facing copy. Every label is Royaltē Intelligence language.
4. **One Royaltē Score, one canonical artist, one payload** — regardless of input URL.
5. **Stage 0's finding stands:** ~150 canonical fields exist; ~12 are currently surfaced. MC V2 corrects that asymmetry by elevating hidden intelligence into the artist's view.

---

## Section 1 — Recommended Mission Control V2 layout

V2 follows the required product story. Twelve sections, sequenced top-to-bottom, grouped into four visual zones.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOP STRIP (replaces V1 Topbar — thin status only)                  │
│  Monitoring Active • Last Scan {ts} • {N} Sources Analyzed •        │
│  Confidence {High/Moderate/Limited}                                  │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────── ZONE A — IDENTITY ──────────────────────────┐
│                                                                     │
│   ① ARTIST IDENTITY HERO                                            │
│      [large artist image] [name large] [Identity Confidence pill]   │
│                                                                     │
│   ② CATALOG OVERVIEW                                                │
│      Releases · Tracks · Earliest Year · Catalog Age                │
│      (single horizontal row, four values)                           │
│                                                                     │
│   ③ RELEASE ARTWORK                                                 │
│      grid of release covers (artwork from payload),                 │
│      title + classification (Single/EP/Album) + release date        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────── ZONE B — INTELLIGENCE ──────────────────────┐
│                                                                     │
│   ④ GLOBAL MUSIC FOOTPRINT™                                         │
│      [world map / region grid] [region detail] [coverage summary]   │
│                                                                     │
│   ⑤ ROYALTĒ HEALTH SCORE                                            │
│      [large score number] [band label] [delta vs baseline if exists]│
│      [module breakdown row: 6 scores with Royaltē Intelligence      │
│       labels — Metadata Integrity / Platform Coverage /             │
│       Publishing Risk / Duplicate Detection / Video Ecosystem /     │
│       Sync Readiness]                                               │
│                                                                     │
│   ⑥ AI INSIGHT (HERO)                                               │
│      [narrative card] What does this scan mean? What should you do  │
│      next? Confidence level. Generated from payload signals only.   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────── ZONE C — DETAIL ────────────────────────────┐
│                                                                     │
│   ⑦ DISTRIBUTION COVERAGE                                           │
│      Sources verified (categorical labels) · per-source state       │
│                                                                     │
│   ⑧ METADATA INTELLIGENCE                                           │
│      ISRC status · Composer · Genre tags · Per-release metadata     │
│      completeness                                                   │
│                                                                     │
│   ⑨ PUBLISHING INTELLIGENCE                                         │
│      Composer credits · PRO guidance · Catalog tenure exposure      │
│                                                                     │
│   ⑩ REVENUE SIGNALS                                                 │
│      Gap-based exposure indicators with low–high ranges,            │
│      methodology disclosed; UGC unmonetised reach;                  │
│      pending validation count                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────── ZONE D — STATE ─────────────────────────────┐
│                                                                     │
│   ⑪ MONITORING                                                      │
│      Thin strip: days protected · changes detected ·                │
│      last change · next scheduled scan                              │
│      (link out to monitoring timeline, not a full card)             │
│                                                                     │
│   ⑫ ACTION CENTER                                                   │
│      Issues from payload.issues[] grouped by severity               │
│      (CRITICAL / HIGH / WARNING / INFO)                             │
│      Each item: title · detail · source · suggested next step       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Layout principles:**

- **Vertical scroll, not 3-column grid.** V1's 3-column tile grid optimized for "command center" density. V2 optimizes for narrative + drill-in depth. A premium intelligence product reads top-to-bottom like a briefing.
- **One thing per zone has prominence.** Zone A: identity. Zone B: score + AI Insight. Zone C: detail intelligence. Zone D: state + actions.
- **No Backend Status card.** Status compresses to the top strip + sidebar (per non-negotiable #3).
- **AI Insight is the hero of Zone B**, sitting visually above per-section detail in Zone C. Reads the entire payload, produces narrative.

---

## Section 2 — Section-by-section mapping to canonical payload fields

For each MC V2 section, the table below maps every value to its canonical payload field path. **No derived calculations.** Where MC V2 needs to compose multiple fields (e.g., a per-release row joining `appleMusic.details.albums[i]` with `appleMusic.details.storefrontAvailability` keyed by album ID), this is composition, not calculation — no scoring, no inference.

### ① Artist Identity

| Display | Payload field | Type | Notes |
|---|---|---|---|
| Artist name | `subject.artistName` | str | Apple-canonical post PR #103 |
| Artist image | `subject.artistImageUrl` _(needs payload work — see §5)_ | str | Today MC composes `imageUrl` from `appleArtworkUrl \|\| artistImageUrl \|\| trackData.album.images[0]`; this should move into the canonical payload as a single canonical field |
| Apple ID | `appleMusic.details.artistId` | str | Surface as small detail, not in hero |
| Spotify ID | `subject.artistId` when `spotifyMatched` | str | Same |
| Identity Confidence | `ownership.confidence` (HIGH / MEDIUM / LOW / AUTH_UNAVAILABLE) | str | Hero pill — currently hidden by V1 |
| Source provenance | `source.{platform, resolvedFrom, originalUrl}` | obj | Quiet sub-line — "Scanned via Apple Music artist page" (rule #7 abstract: "Scanned via streaming source") |

### ② Catalog Overview

| Display | Payload field | Notes |
|---|---|---|
| Releases | `catalog.totalReleases` | |
| Tracks | sum of `appleMusic.details.albums[].trackCount` | Composition, not calculation |
| Earliest Year | `catalog.earliestYear` | |
| Latest Year | `catalog.latestYear` | |
| Catalog Age (years) | `catalog.catalogAgeYears` | |
| Recent activity badge | `catalog.recentActivity` | Boolean → "Active" / "Quiet" badge |

### ③ Release Artwork

| Display | Payload field | Notes |
|---|---|---|
| Grid: one tile per release | iterate `appleMusic.details.albums[]` | |
| Cover image | `albums[i].artwork` (300×300 CDN URL) | Already in payload |
| Release title | `albums[i].name` | |
| Release type (Single / EP / Album) | derived from `albums[i].trackCount` via `classifyRelease()` | This derivation lives in `persist-os-scan.js:106-111` today; MC V2 should consume it from payload. **§5 future payload work:** add `albums[i].type` to canonical |
| Release date | `albums[i].releaseDate` | |
| Link out | `albums[i].url` | Opens Apple Music page in new tab (the URL is Apple, but the surface label is "Listen") |

### ④ Global Music Footprint™

| Display | Payload field | Notes |
|---|---|---|
| Regions verified count | derived from `appleMusic.details.storefrontAvailability` (8 BIG-6 keys) | Already computed in MC V1 |
| Per-region badge (verified / partial / unavailable) | `storefrontAvailability[code].{available[], unavailable[]}` | |
| Per-region per-release availability (drill-in) | `storefrontAvailability[code].available[]` (album IDs) cross-referenced with `albums[]` | Composition not calculation; surfaces which specific releases are in which markets |
| Distribution Coverage Score™ | _(needs payload work — see §5)_ | Locked name; no field exists. Stage 1 surfaces only the regions-verified ratio (`N / 8`) and per-region detail. |
| BIG 6 region list (US / CA / GB / DE / FR / JP / AU / BR) | hardcoded `BIG6` constant (matches storefront keys) | OK to stay hardcoded — names + flag emoji are presentation, not data |

### ⑤ Royaltē Health Score

| Display | Payload field | Notes |
|---|---|---|
| Score number | `score.overall` (canonical) — was `overallScore` in raw | One field, one source. **Must match the scan result the artist saw post-scan.** No silent fallback computation. |
| Risk level / band label | `score.riskLevel` (LOW / MODERATE / HIGH / CRITICAL) | From canonical |
| Risk summary text | `score.riskSummary` | Hidden today; surface as score subtitle |
| Module breakdown row | iterate `modules[key]` for 6 keys | Each shows `{name, score, grade}`. Names already Royaltē-Intelligence-aligned: "Metadata Integrity" / "Platform Coverage" / "Publishing Risk" / "Duplicate Detection" / "YouTube / UGC" / "Sync Readiness". **§5 future payload work:** rename `modules.youtube.name` from "YouTube / UGC" to "Video Ecosystem" to honor rule #7 |
| Score delta vs baseline | `score.overall - history[0].health_score` from `loadScanHistory(userId, artistId)` | Explicitly labeled: "vs Previous Baseline" / "Latest Scan {N}" per non-negotiable #2. **Both labels required** when historical data shown. |
| Module flags drill-in | `modules[key].flags[]` | Lift into the module breakdown row |

### ⑥ AI Insight

| Display | Payload field / source | Notes |
|---|---|---|
| Headline insight | _(needs payload work — see §5)_ | Requires a new `payload.aiInsight.{headline, narrative, recommendations[], confidence}` block emitted by the engine. Today no such field exists. |
| Narrative paragraph | same | Generated from payload signals; never hallucinate; never invent; never name source platforms. |
| Recommendations list | same | Each recommendation must trace back to a specific payload signal. |
| Confidence indicator | derived from `ownership.confidence` × count of VERIFIED platforms × module coverage | Computed by the engine, not MC. |
| "View signals" link | back to the §4/§7/§8/§9/§10 sections | UI affordance only |

**Stage 1 stub strategy:** until the engine emits `payload.aiInsight`, MC V2 can render a deterministic placeholder section that summarizes the score band + top 2 issues from `payload.issues[]`. This validates the layout slot. Hero treatment ships when the engine field lands.

### ⑦ Distribution Coverage

| Display | Payload field | Notes |
|---|---|---|
| Sources verified count | count of `payload.platforms[k].availability === 'VERIFIED'` across 10 keys | Already computed in V1's `_confidenceLabelForScan` but as "N of 6"; V2 should count across all 10 with categorical labels |
| Per-source rows (Royaltē Intelligence labels per rule #7) | each row: `payload.platforms[k].availability` | Labels: Streaming Presence (appleMusic + spotify combined OR shown separately as "Primary Streaming Source" / "Audience Verification Source"), Reference Metadata (musicbrainz), Authority Signals (discogs / lastfm), Video Ecosystem (youtube), Catalog History (discogs again — split), Audience Signals (deezer / soundcloud / wikipedia consolidated). **§5: the label taxonomy for V2 needs to be locked.** |
| Verification status per row | VERIFIED / NOT_FOUND / AUTH_UNAVAILABLE / ERROR | From `payload.platforms[k].availability` directly |
| Last-verified timestamp per row | _(needs payload work — see §5)_ | Today the payload has only one scan timestamp — per-source verification time is not stored |

### ⑧ Metadata Intelligence

| Display | Payload field | Notes |
|---|---|---|
| ISRC status | `appleMusic.details.isrcLookup.isrc` truthy | "Verified" if present; "Unavailable" otherwise (rule #7 compliant — never "Pending verification") |
| Composer credits | `appleMusic.details.isrcLookup.composerName` | Currently hidden. **Direct publishing intel.** |
| Track-level genres | `appleMusic.details.isrcLookup.genreNames[]` | Hidden today |
| Artist-level genres | `appleMusic.details.genres[]` + `metrics.genres[]` | Hidden today |
| Track preview | `appleMusic.details.isrcLookup.previewUrl` | Optional player |
| Track duration | `appleMusic.details.isrcLookup.durationMs` | |
| Per-release metadata completeness | composed: `albums[i]` field presence | Composition, not calculation |
| Metadata Integrity score | `modules.metadata.score` (100 for BA) | Mirror from §5 module row |

### ⑨ Publishing Intelligence

| Display | Payload field | Notes |
|---|---|---|
| Composer credits | `appleMusic.details.isrcLookup.composerName` | Same field surfaced in §8; recontextualized here for publishing focus |
| PRO guidance | `proGuide.{pro, url, steps[], note, country}` | Currently hidden in MC; PDF surfaces it |
| Publishing Risk score | `modules.publishing.score` | Mirror |
| Catalog tenure exposure | `gapBasedExposure.indicators[]` filtered to `id === 'catalog-age'` | Currently hidden |
| Publishing flags | `modules.publishing.flags[]` | Currently hidden |

### ⑩ Revenue Signals

| Display | Payload field | Notes |
|---|---|---|
| Per-indicator card | iterate `gapBasedExposure.indicators[]` | Each shows `{title, description, exposureLow, exposureHigh, methodology, severity}` |
| Aggregate exposure range | `gapBasedExposure.{aggregateLow, aggregateHigh}` | Composed as `"$ {low} – ${high}"` |
| Pending validation count | `gapBasedExposure.pendingValidationCount` | "1 signal awaiting verification" |
| UGC unmonetised reach | `royaltyGap.ugcUnmonetisedViews` | Hidden today; this is one of the strongest signals (18.5M views for BA) |
| UGC potential revenue range | `royaltyGap.ugcPotentialRevenue` | |
| Methodology disclosure | `gapBasedExposure.indicators[i].methodology` + `royaltyGap.disclaimer` | Always visible — establishes trust |
| Last.fm playcount → "Streaming Activity Signal" | `metrics.lastfmPlays` (rule #7 abstracted) | Hidden today |
| Deezer fans → "Audience Reach Signal" | `metrics.deezerFans` (rule #7 abstracted) | Hidden today |

### ⑪ Monitoring

| Display | Payload field | Notes |
|---|---|---|
| Monitoring Active pill | `loadMonitoringActive(userId, artistId)` | Not in payload — from `monitoring_subscriptions` table; OK because this is monitoring state, not scan data |
| Days Protected | `(now - history[0].scanned_at) / 86400000 + 1` | From `loadScanHistory(userId, artistId)` |
| Changes Detected | `loadAlertOverview(userId, artistId).total` | From `monitoring_alerts` table |
| Last Change | `_lastGenuineChangeAt(feedAlerts, baselineTimes)` | Derived; lives in MC today |
| Next Scheduled Scan | `monitoring_subscriptions.next_scan_at` | Surface explicitly so artist sees the cadence |
| Link → Monitoring Timeline | full alert history | Drill-in destination, not on the MC main page |

**Note:** Monitoring is the ONE section that legitimately reads from sources other than the scan payload (subscriptions + alerts + history). This is fine — it's monitoring state, not scan data. Stage 0 affirms the architectural split.

### ⑫ Action Center

| Display | Payload field | Notes |
|---|---|---|
| Issue cards grouped by severity | iterate `payload.issues[]` grouped by `severity` (CRITICAL / HIGH / WARNING / INFO) | **THIS IS THE V1→V2 ARCHITECTURAL CHANGE.** V1 reads `monitoring_alerts`; V2 reads canonical `payload.issues[]`. The scan IS the source of truth for what's wrong. |
| Issue title | `issues[i].title` | Pre-derived in normalize |
| Issue detail | `issues[i].detail` | |
| Module attribution (label per rule #7) | `issues[i].moduleName` → mapped through Royaltē Intelligence label table | E.g. "Sync Readiness" stays as-is; "YouTube / UGC" maps to "Video Ecosystem" |
| Source type | `issues[i].source` (module / platform / ownership / catalog) | Filter chip |
| Empty state | when `issues.length === 0` | "All clear — no issues detected in your last scan." |

**Resolved-state question (open):** `payload.issues[]` does not carry `resolved/unresolved` lifecycle state. `monitoring_alerts` does. Stage 1 decision needed: either (a) introduce `payload.issues[i].resolvedAt` via the engine + cross-scan reconciliation, or (b) keep monitoring_alerts as the lifecycle layer and use payload.issues only for "this scan's issues." See §7 (Risks).

---

## Section 3 — Hidden payload fields that V2 should surface

Per Stage 0 finding: ~90% of canonical intelligence is unsurfaced in V1. Stage 1's mandate is to elevate these. Prioritized list, with destination section:

| Field | Section | Priority |
|---|---|---|
| `appleMusic.details.albums[].artwork` | ③ Release Artwork | **P0 — non-negotiable #1** |
| `appleMusic.details.albums[].{name, releaseDate, trackCount, url}` | ③ Release Artwork | **P0** |
| `appleMusic.details.isrcLookup.composerName` | ⑧ Metadata + ⑨ Publishing | **P0** |
| `appleMusic.details.isrcLookup.{name, genreNames, durationMs, previewUrl}` | ⑧ Metadata | **P1** |
| `appleMusic.details.storefrontAvailability[code].available[]` (per-album) | ④ Global Music Footprint (drill-in) | **P1** |
| `modules.{metadata,coverage,publishing,duplicates,youtube,sync}.{score, grade, flags}` | ⑤ Health Score breakdown row | **P0** |
| `score.{riskLevel, riskSummary, moduleAverage}` | ⑤ Health Score subtitle | **P0** |
| `issues[]` (full canonical issues array) | ⑫ Action Center | **P0 — architectural change** |
| `royaltyGap.{ugcUnmonetisedViews, ugcPotentialRevenue, estLifetimeStreams, disclaimer}` | ⑩ Revenue Signals | **P0** |
| `gapBasedExposure.{indicators[], aggregateLow, aggregateHigh, pendingValidationCount, hasAnyGaps}` | ⑩ Revenue Signals | **P0** |
| `proGuide.{pro, url, steps, note}` | ⑨ Publishing Intelligence | **P1** |
| `ownership.{confidence, status, scoreImpact}` | ① Artist Identity (confidence pill) | **P1** |
| `metrics.{lastfmPlays, lastfmListeners, deezerFans, popularity, followers}` (rule #7 abstracted labels) | ⑩ Revenue Signals + ⑦ Distribution Coverage | **P2** |
| `metrics.{country, wikipediaUrl, genres}` | ① Artist Identity (sub-line) | **P2** |
| `platforms.youtube.details.{officialChannel, ugc, contentIdVerified}` | ⑦ Distribution Coverage (Video Ecosystem row) | **P1** |
| `auditCoverage.{spotify, appleMusic, publishing, soundExchange}.{status, tier}` | ⑦ Distribution Coverage | **P1** |
| `catalog.{recentActivity, estimatedAnnualStreams}` | ② Catalog Overview + ⑩ Revenue Signals | **P2** |
| `source.{platform, resolvedFrom, originalUrl, storefront}` | ① Artist Identity (sub-line; abstracted) | **P2** |

---

## Section 4 — V1 cards: remove / merge / rename

| V1 element | V2 disposition | Rationale |
|---|---|---|
| Topbar artist name (`tb-artist-name`) | **Keep**, move into ① Artist Identity hero | Hero treatment, not topbar chrome |
| Topbar status strip (`tb-status-dot` + `tb-status-label`) | **Keep**, compressed into top strip | Thin status indicator only (per non-negotiable #3) |
| Topbar stats (`tb-stat-health`, `-monitoring`, `-changes`, `-confidence`, `-revenue`, `-last-scan`) | **Merge** into top strip (4 values: Monitoring · Last Scan · Sources · Confidence) and § ⑤ Health Score for the score number | "Revenue" stat moves into ⑩ Revenue Signals |
| Sidebar (logo, nav, founding-artist banner, footer) | **Keep** structurally; nav items will likely be: Mission Control / Catalog / Footprint / Revenue / Action Center / Settings | Settings page TBD; Reviews page held under PR #100 |
| Card 1 Health Score (Signal Meter) | **Move** to § ⑤ Royaltē Health Score. **Signal Meter visual stays** (locked design per [[project-royalte-signal-meter-locked]] memory) but joined by the module breakdown row and risk summary text | |
| Card 2 Backend Status | **REMOVE** per non-negotiable #3 | Status compresses to top strip |
| Card 3 Intelligence Feed | **Move** into § ⑪ Monitoring as drill-in destination "Monitoring Timeline" | Stops competing with scan data for prominence |
| Card 4 Catalog Intelligence | **Split**: counts → ② Catalog Overview; sources → ⑦ Distribution Coverage; ISRC → ⑧ Metadata; last change → ⑪ Monitoring | One V1 card was carrying four concerns |
| Card 5 Action Center | **Move** to § ⑫ Action Center BUT **change data source** to `payload.issues[]` from `monitoring_alerts` | Lifecycle question open (see §7) |
| Card 6 Intelligence Confidence (donut + 6 rows) | **Split**: confidence donut → ⑦ Distribution Coverage hero; per-outcome rows redistributed across ⑦, ⑧, ⑨, ⑪ as relevant | The "6 outcomes" framing was a V1 simplification; V2 surfaces the underlying source state more truthfully across multiple sections |
| Card 7 Global Presence (8 flag tiles) | **Expand** to § ④ Global Music Footprint™ (major section with per-region drill-in) | V1 surface was an 8-tile grid; V2 elevates to a Zone B section with map / per-region detail / per-album-per-region availability |
| Card 8 Monitoring Overview | **Compress** to § ⑪ Monitoring thin strip | Removed as a full card |
| Card 9 Your Royaltē Review | **Keep** as a quiet link-out card — surfaces baseline + current score + PDF link + "View Review →" (target = PR #100 page when that ships) | De-emphasized but retained |
| Below-grid pricing / founding-artist banner / trial banner | **Keep** below the main flow | No change to these |

---

## Section 5 — Fields that require future payload / engine work

Stage 1 cannot surface these without engine changes:

| Field needed | Section that needs it | Engine work |
|---|---|---|
| `subject.artistImageUrl` (canonical single hero image) | ① Artist Identity | Today MC composes from 4 fields. Move composition into `normalizeAuditResponse._normalizeSubject` so the canonical contract owns it |
| `albums[i].type` (single/ep/album) | ③ Release Artwork | Move `classifyRelease(trackCount)` into normalize. Today the classification lives in `persist-os-scan.js` and is invoked by the delta engine; MC would need to reproduce the rule. Lift it. |
| `modules.youtube.name` rename to "Video Ecosystem" | ⑤ Health Score breakdown + ⑫ Action Center attribution | One-line change in `_defaultModuleName()` at `normalizeAuditResponse.js:269`. Honors rule #7. Same for any other module names that name platforms. |
| `payload.aiInsight.{headline, narrative, recommendations[], confidence}` | ⑥ AI Insight | **NEW engine module.** Reads the payload, emits structured insight. Requires LLM hookup OR rule-based generator. Anti-hallucination guardrails mandatory. Big lift. |
| `payload.distributionCoverageScore` (canonical "Distribution Coverage Score™") | ④ Global Music Footprint | Locked product name; needs a definition + scoring algorithm. Not in payload today. |
| Per-source `verifiedAt` timestamp | ⑦ Distribution Coverage | Today only `scannedAt` exists. Per-source timestamps would let MC surface "Reference Metadata last verified 2 days ago" |
| `payload.issues[i].resolvedAt` and `payload.issues[i].resolvable` | ⑫ Action Center | If V2 drops `monitoring_alerts` as the lifecycle layer, the canonical issues array needs lifecycle state. Alternative: keep both layers (see §7 risks). |
| `payload.distribution.{distributors[], deliveryTimestamps}` | ⑦ Distribution Coverage | "Distribution Intelligence" the founder mentioned. No engine source today for distributor identity. |
| `metrics.followers` for Apple-only artists | ① / ⑩ | Today Spotify dev-mode returns -1. Either an alternate source or upgrade to Spotify production tier. |
| Royaltē Intelligence label taxonomy (locked) | ⑦ Distribution Coverage | Final naming for the per-source rows: today the engine knows 10 sources; rule #7 requires categorical Royaltē labels. Stage 1 needs the founder to lock the mapping. PR #109 established four labels (Streaming Presence / Audience Verification / Video Ecosystem / Reference Metadata); V2 needs the complete 10-source mapping. |

---

## Section 6 — Build order for Stage 2 (engineering sequence)

Stage 2 (build) should follow this order. Each step is a self-contained PR. Earlier steps validate the architecture; later steps add intelligence depth.

| # | Component | Scope | Depends on |
|---|---|---|---|
| **S2-01** | **Foundation: payload-only loader contract** | New `loadScanForMissionControl(supabase, userId)` that returns the canonical payload + monitoring state in one bundle. Refactors V1's scattered loaders. No UI change yet. | none |
| **S2-02** | **Top strip + Artist Identity hero (§①)** | Remove V1 topbar; ship Zone A top strip + ① section. Simplest data; validates the new loader contract. | S2-01 |
| **S2-03** | **Catalog Overview + Release Artwork (§②③)** | Highest-value visible change. Surfaces 4 P0 fields (albums + artwork). Validates the per-release drill-in pattern. | S2-02 |
| **S2-04** | **Royaltē Health Score with module breakdown (§⑤)** | Score number + risk summary text + 6-module row with names+scores+grades. Reuses the Signal Meter visual. | S2-03 |
| **S2-05** | **Global Music Footprint™ (§④)** | Expanded region surface, per-album-per-region drill-in. | S2-03 |
| **S2-06** | **Action Center on `payload.issues[]` (§⑫)** | Architectural switch. Requires deciding the lifecycle question (see §7). | S2-04 (because Action Center references modules) |
| **S2-07** | **Metadata + Publishing Intelligence (§⑧⑨)** | Surfaces composer, ISRC details, genres, PRO guide, catalog-tenure exposure. | S2-04 |
| **S2-08** | **Revenue Signals (§⑩)** | Gap-based exposure + royalty-gap + UGC reach. The most "wow" section after Release Artwork. | S2-07 |
| **S2-09** | **Distribution Coverage (§⑦)** | Per-source verification with rule #7 categorical labels. Requires the locked label taxonomy from §5. | S2-04 |
| **S2-10** | **Monitoring thin strip + timeline drill-in (§⑪)** | Compresses V1's Card 3 + Card 8 into a strip plus a drill-in destination. | S2-06 |
| **S2-11** | **AI Insight stub (§⑥)** | Ships the layout slot with a deterministic placeholder summarizing score + top issues. Hero treatment lands when `payload.aiInsight` arrives. | S2-04 + S2-06 |
| **S2-12** | **AI Insight engine module + hero treatment** | Engine PR adds `payload.aiInsight`; MC PR upgrades the placeholder to hero narrative. | All prior |

Suggested cadence: S2-01 through S2-04 in week 1 (validates architecture + ships the highest-leverage user-visible changes). S2-05 through S2-09 in week 2 (depth + intelligence). S2-10 through S2-12 in week 3 (state + AI).

---

## Section 7 — Risks and blockers

### R1 — Action Center data-source migration is non-trivial

**Risk:** V1 Action Center reads `monitoring_alerts` which carries lifecycle state (`resolved` / `resolved_at`). `payload.issues[]` is regenerated every scan and has no lifecycle. Switching the source breaks the resolve/dismiss UX.

**Two paths:**
- **Path A:** Add lifecycle to `payload.issues[]` via cross-scan reconciliation in the engine (issue X seen in scan N matches issue X seen in scan N-1 if `id` matches, carrying resolved state forward). Bigger engine lift.
- **Path B:** Keep `monitoring_alerts` as the lifecycle layer; use `payload.issues[]` only for "this scan's issues" surfaced fresh. MC V2 Action Center reads both: live issues from payload + historical lifecycle from monitoring_alerts joined by `issue.id`.

**Recommendation:** Path B for V2 Stage 1. Path A is the eventual purity but Path B is the smaller migration. Founder decision needed before S2-06.

### R2 — AI Insight requires new engine infrastructure

**Risk:** AI Insight is a non-negotiable hero feature, but no `payload.aiInsight` field exists today and there's no LLM hookup in the engine. Stage 1 plans the layout slot; Stage 2 step S2-11 ships a deterministic stub; full hero treatment (S2-12) requires:
- LLM provider integration (Anthropic / OpenAI / self-hosted)
- Prompt engineering with anti-hallucination guardrails ("only reference payload fields", "confidence must reflect verified source count", "never name source platforms")
- Response caching (LLM calls per scan would explode cost)
- Schema for `payload.aiInsight.{headline, narrative, recommendations[], confidence}`

Estimated 1-2 sprints of engine work, separate from MC work.

### R3 — Royaltē Intelligence label taxonomy is not fully locked

**Risk:** Distribution Coverage (§⑦) needs categorical Royaltē Intelligence labels for all 10 sources. PR #109 locked four (Streaming Presence / Audience Verification / Video Ecosystem / Reference Metadata). The remaining 6 (deezer / soundcloud / discogs / lastfm / wikipedia / audiodb / tidal) need similar treatment. Without a complete taxonomy, MC V2 §⑦ either name-leaks or under-categorizes.

**Recommendation:** Founder briefs the complete 10-source taxonomy before S2-09. Stage 1 surfaces the gap; doesn't try to invent labels.

### R4 — Module name "YouTube / UGC" violates rule #7

**Risk:** `modules.youtube.name = "YouTube / UGC"` would surface in the Health Score breakdown row (§⑤) and as Action Center attribution (§⑫). This breaks rule #7.

**Recommendation:** One-line change at `normalizeAuditResponse.js:269` to rename `modules.youtube.name` to `"Video Ecosystem"`. Trivial.

### R5 — Per-release `type` (Single/EP/Album) classification lives in the wrong layer

**Risk:** `classifyRelease(trackCount)` is in `persist-os-scan.js:106-111`. The delta engine uses it. MC V2 §③ wants to surface the type label per release. Today MC would need to import the helper or reproduce the rule.

**Recommendation:** Move `classifyRelease` into `normalizeAuditResponse._normalizeAppleMusic()` so canonical `albums[i].type` is set. Sub-15-line engine change.

### R6 — Backwards compatibility with V1 stored scans

**Risk:** `scan_snapshots` rows from before various recent migrations may have missing fields (no `appleMusic.details.storefrontAvailability`, no `gapBasedExposure`, etc.). MC V2 must handle these gracefully — empty state per section, not crashes.

**Recommendation:** Every V2 section renderer checks for field presence and shows a tasteful "Not available for this scan" empty state if absent. This is presentation-layer hygiene, not new logic.

### R7 — Apple-only artists have sparse data

**Risk:** For artists where ISRC bridge to Spotify fails (rare post-PR #108), `metrics.followers === -1`, `metrics.popularity === 0`, `metrics.genres === []`. § ⑩ Revenue Signals would render mostly empty.

**Recommendation:** Each Revenue Signals card surfaces its own empty state ("Audience reach signal not available from reviewed sources"). Don't synthesize fake numbers.

### R8 — `payload.score.overall` vs MC V1 `_resolveHealthScoreFromSnapshot` divergence

**Risk:** V1 has a resolver that computes `100 - payload.overallScore` as a fallback. V2 reads `payload.score.overall` directly. For scans persisted under the old shape, `payload.score` may not exist.

**Recommendation:** V2's score read prefers `payload.score.overall`, falls back to `payload.overallScore`, falls back to "—". No silent inversion. Documented as a one-time migration concern.

### R9 — `loadMonitoringActive`, `loadBaselinePdf` etc. were just artist-scoped in PR #106

**Risk:** V2's loader contract (S2-01) should not regress those PR #106 fixes. Every per-card loader must remain artist-scoped or the contamination class returns.

**Recommendation:** S2-01's `loadScanForMissionControl()` adopts artist-scoped filtering for every Supabase query.

### R10 — Phase 4 Apple-as-canonical-identity is still open

**Risk:** `_normalizeSubject` at `normalizeAuditResponse.js:91` prefers Spotify ID over Apple ID. Monitoring records are keyed by whichever wins. Switching the preference to Apple-first is a separate brief with persistence migration implications. **Stage 1 does not depend on this being resolved**, but MC V2 will reflect whichever identity policy the engine uses.

---

## Closing

This document maps every section of Mission Control V2 back to a canonical payload field. **Nothing in the V2 plan requires new MC logic — only surfacing what the engine already produces, plus a small number of engine improvements documented in §5.**

Stage 2 (build) begins when the founder approves this plan and answers the four open decisions:

1. Action Center lifecycle path (Risk R1)
2. Royaltē Intelligence label taxonomy for the remaining 6 sources (Risk R3)
3. AI Insight scope and timing (Risk R2)
4. Phase 4 canonical-identity preference (Risk R10) — answerable separately

Standing by.
