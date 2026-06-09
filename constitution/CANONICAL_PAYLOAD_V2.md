# ROYALTÉ CANONICAL PAYLOAD V2

**STATUS:** BOARD-RATIFIED ARCHITECTURE
**Authority:** Final execution brief for the Canonical Payload V2 refactor. Twelve top-level Royaltē Intelligence Objects. Every Royaltē product (Scan Results, Mission Control, Royaltē Review, Dashboard, Monitoring, Revenue Signals, Executive Brief™, future API) consumes this same payload. No duplicate business logic. No UI calculations.
**Constitutional anchor:** Royalté Master Constitution v1.0 · Governance Directive · Identity Graph separation · Canonical Identity Architecture
**Supersedes:** All prior Canonical Payload V2 proposals.

---

## §1 — FINAL CANONICAL PAYLOAD V2 SCHEMA

### Top-level envelope
```ts
RoyaltePayload = {
  // Envelope (transport-level, not intelligence)
  schemaVersion:  string,    // '1.2.0' during dual-shape; '2.0.0' after legacy removal
  scanId:         string,    // request UUID
  scannedAt:      string,    // ISO 8601 (mirror of scanAuthority.generatedAt)
  success:        boolean,
  warnings:       Warning[],

  // The 12 Royaltē Intelligence Objects (Board-ratified)
  identity:        IdentityObject,
  health:          HealthObject,
  globalFootprint: GlobalFootprintObject,
  catalog:         CatalogObject,
  verification:    VerificationObject,
  metadata:        MetadataObject,
  publishing:      PublishingObject,
  opportunities:   OpportunitiesObject,
  actions:         ActionsObject,
  aiInsight:       AIInsightObject,
  revenueSignals:  RevenueSignalsObject,
  scanAuthority:   ScanAuthorityObject,

  // Legacy flat fields preserved during Phase 1-3, removed at v2.0.0
  __legacy?:       LegacyFlatFields,
}
```

> **Board ruling:** No additional top-level objects without explicit Board approval. Distribution is not a standalone object — it is one contributor to `globalFootprint`. Provider-specific data (Apple, Spotify, YouTube, etc.) lives only under `verification.providers.*` — never as a standalone top-level object.

---

### Object 1 — IDENTITY

```ts
identity = {
  displayName:        string,            // canonical artist display name (Apple-canonical when Apple URL)
  legalName:          string | null,     // future — legal/registered name when distinct from display
  artistImage:        string | null,     // canonical image URL
  artistIds: {                           // cross-platform identifiers
    apple:        string | null,
    spotify:      string | null,
    musicbrainz?: string | null,
    deezer?:      string | null,
    discogs?:     string | null,
  },
  artistUrls: {                          // cross-platform deep-links
    apple:        string | null,
    spotify:      string | null,
  },
  genres:             string[],          // Apple-canonical (top of list)
  country:            string | null,     // ISO country code
  canonicalIdentity: {                   // which source the engine took as authoritative
    source:           'apple' | 'spotify',
    appleArtistId:    string | null,
    appleStorefront:  string | null,
  },
  verifiedIdentity: {                    // cross-platform verification booleans
    apple:   boolean,
    spotify: boolean,
    youtube: boolean,
  },
  confidence:         'verified' | 'high' | 'moderate' | 'unknown',
  resolvedFrom:       'apple' | 'spotify',  // which input URL kind
}
```

**Constitutional meaning:** Identity is Royaltē's understanding of WHO the artist is.

---

### Object 2 — HEALTH

```ts
health = {
  score:       number,                   // 0-100, engine-computed
  grade:       'STRONG' | 'GOOD' | 'MODERATE' | 'LIMITED' | 'REVIEW_RECOMMENDED',
  confidence:  'verified' | 'high' | 'moderate',
  modules: {                             // engine module scores
    metadata:    ModuleEntry,
    coverage:    ModuleEntry,
    publishing:  ModuleEntry,
    duplicates:  ModuleEntry,
    youtube:     ModuleEntry,
    sync:        ModuleEntry,
  },
  findings:    Finding[],                // renamed from V1 flags[]
  summary:     string,                   // engine-composed narrative
}

ModuleEntry = {
  name:          string,
  score:         number | null,
  grade:         'A' | 'B' | 'C' | 'D' | 'F' | null,
  availability:  'VERIFIED' | 'UNVERIFIED' | 'AUTH_UNAVAILABLE' | 'ERROR',
  issueCount:    number,
  flags:         string[],
}

Finding = {
  id:          string,
  module:      string,
  moduleName:  string,
  severity:    'high' | 'medium' | 'low',
  title:       string,
  detail:      string,
  source:      'module' | 'catalog' | 'ownership' | 'platform',
}
```

**Constitutional meaning:** Music Backend Health™ — how healthy your backend is. Engine-computed. Presentation layer renders only.

---

### Object 3 — GLOBAL FOOTPRINT

```ts
globalFootprint = {
  score:               number,           // 0-100, engine-computed
  grade:               'STRONG' | 'GOOD' | 'MODERATE' | 'LIMITED',
  confidence:          'verified' | 'high' | 'moderate',
  countries: {
    available:         string[],         // ISO country codes
    unavailable:       string[],
    count:             number,
  },
  territories:         TerritoryEntry[], // per-storefront detail (Apple Music BIG6+)
  platformCoverage:    CoverageBand,     // DSPs (Spotify, Apple Music, YouTube, Deezer, etc.)
  databaseCoverage:    CoverageBand,     // MusicBrainz, Last.fm, AudioDB, Discogs
  identityCoverage:    CoverageBand,     // Wikidata, social/identity networks
  publishingCoverage:  CoverageBand,     // PRO links, publisher registries (future MLC)
  podcastCoverage:     CoverageBand,     // Podcast Intelligence (future)
  aiCoverage:          CoverageBand,     // AI search-index presence (future)
  coverageSummary:     string,           // engine-composed
  methodology:         string,           // human-readable derivation
}

CoverageBand = {
  verified:   number,
  total:      number,
  ratio:      number,                    // 0.0 - 1.0
  grade:      'STRONG' | 'GOOD' | 'MODERATE' | 'LIMITED' | null,
}

TerritoryEntry = {
  storefront:    string,                 // 'us', 'gb', 'jp', etc.
  region:        string,                 // 'northAmerica', 'europe', etc.
  available:     number,
  unavailable:   number,
}
```

**Constitutional meaning:** Global Music Footprint™ — how far your music travels. Flagship Royaltē product. Distribution is folded in as `territories` + `platformCoverage`; it is NOT a standalone object.

---

### Object 4 — CATALOG

```ts
catalog = {
  primaryArtwork:   string | null,       // primary artwork URL (artist or latest album)
  releases:         Release[],
  tracks:           Track[],             // populated when track-input or future track-level data
  albumCount:       number,
  trackCount:       number,
  earliestYear:     number | null,
  latestYear:       number | null,
  catalogAge:       number,              // years
  recentActivity:   boolean,
  releaseHistory:   { year: number, count: number }[],
}

Release = {
  id:          string,
  name:        string,
  releaseDate: string,                   // ISO date
  year:        number,                   // engine-derived from releaseDate
  trackCount:  number,
  type:        'Album' | 'EP' | 'Single', // engine-derived from trackCount
  artwork:     string | null,
  url:         string | null,
}

Track = {
  id:          string,
  name:        string,
  isrc:        string | null,
  albumId:     string | null,
}
```

**Constitutional meaning:** Catalog is Royaltē's understanding of WHAT the artist has released. Mission Control Release Gallery reads from `releases[]`.

---

### Object 5 — VERIFICATION

```ts
verification = {
  providers: {
    apple:        VerificationEntry,
    spotify:      VerificationEntry,
    youtube:      VerificationEntry,
    musicbrainz:  VerificationEntry,
    deezer:       VerificationEntry,
    discogs:      VerificationEntry,
    lastfm:       VerificationEntry,
    audiodb:      VerificationEntry,
    wikidata:     VerificationEntry,
    future: {                            // forward-compat slot for any new provider
      [providerName: string]: VerificationEntry,
    },
  },
  verifiedCount:  number,
  totalCount:     number,
  confidence:     'verified' | 'high' | 'moderate',
}

VerificationEntry = {
  status:       'VERIFIED' | 'UNVERIFIED' | 'AUTH_UNAVAILABLE' | 'ERROR',
  verifiedVia:  string | null,           // 'royalte_identity_graph' | 'strict_name_match' | 'isrc_bridge' | null
  identifier:   string | null,           // provider-specific ID (channelId for YouTube, artistId for Spotify, etc.)
  url:          string | null,           // canonical provider URL
  scannedAt:    string,                  // per-provider verification timestamp
  // Provider-specific intelligence belongs HERE, never as a top-level object:
  details?:     object | null,           // small structured payload, provider-scoped
}
```

> **Board ruling — provider architecture stays in `verification.providers.*`.** Do NOT create standalone `apple`, `spotify`, or `youtube` top-level objects. Providers are sources; Royaltē Objects are products.

---

### Object 6 — METADATA

```ts
metadata = {
  score:           number,               // mirror of health.modules.metadata.score
  credits: {
    songwriters:   string[],
    producers:     string[],
    composers:     string[],
  },
  isrc: {
    coverage:      'Complete' | 'Partial' | 'Limited' | 'Unknown',
    matched:       number,
    total:         number,
  },
  iswc: {
    coverage:      'Complete' | 'Partial' | 'Limited' | 'Unknown',
  },
  upc: {
    coverage:      'Complete' | 'Partial' | 'Limited' | 'Unknown',
  },
  producers:       string[],
  writers:         string[],
  missingFields:   string[],
  issues:          Finding[],            // filtered from health.findings, module='metadata'
  summary:         string,
}
```

---

### Object 7 — PUBLISHING

```ts
publishing = {
  score:           number,               // mirror of health.modules.publishing.score
  pro: {
    name:          string,
    url:           string,
    note:          string,
    steps:         string[],
    country:       string | null,
  },
  publisher:       string | null,        // future enrichment
  administrator:   string | null,        // future enrichment
  collection: {
    confidence:    'high' | 'medium' | 'low' | 'unknown',
  },
  issues:          Finding[],            // filtered from health.findings, module='publishing'
  summary:         string,
  recommendations: Action[],             // publishing-scoped Actions subset
}
```

---

### Object 8 — OPPORTUNITIES

```ts
opportunities = {
  items:              Opportunity[],     // renamed from gapBasedExposure.indicators
  aggregateLow:       number | null,
  aggregateHigh:      number | null,
  confidence:         'high' | 'medium' | 'low',
  pendingValidation:  number,
  methodology:        string,
}

Opportunity = {
  id:           string,
  severity:     'HIGH' | 'MED' | 'LOW',
  title:        string,
  description:  string,
  exposureLow:  number | null,
  exposureHigh: number | null,
  methodology:  string,
}
```

---

### Object 9 — ACTIONS

```ts
actions = {
  priorityActions:     Action[],         // severity-ordered top N
  recommendedActions:  Action[],
  quickActions:        Action[],         // one-click items (deep-links)
  links: {                               // named deep-link map for known UI buttons
    fixMetadata:             string | null,
    registerWithPro:         string | null,
    requestExecutiveBrief:   string | null,
    [name: string]:          string | null,
  },
  documentation:       KnowledgeLink[],  // Knowledge Library
  steps:               string[],         // step-by-step playbook (PRO etc.)
}

Action = {
  id:            string,
  title:         string,
  detail:        string,
  priority:      'high' | 'medium' | 'low',
  module:        string,
  callToAction:  string,
  url:           string | null,
}

KnowledgeLink = {
  title:     string,
  url:       string,
  category:  string,
}
```

> Every Royaltē surface (Scan Results, Mission Control, Royaltē Review, Executive Brief™) renders from the same `actions` object.

---

### Object 10 — AI INSIGHT

```ts
aiInsight = {
  summary:         string,               // 2-3 sentence narrative
  reasoning:       string[],             // bullet array of derivation reasons
  recommendation:  string,               // single highest-priority next step
  confidence:      'high' | 'medium' | 'low',
  generatedAt:     string,               // ISO timestamp (cacheable)
  generatedBy:     'engine_template' | 'llm',
  generatedFrom:   string[],             // which Royaltē objects contributed
                                         // e.g. ['health','globalFootprint','catalog','metadata','publishing','verification']
}
```

> **Constitutional rule — AI Insight is generated ONCE inside the engine and consumed by every surface.** UI never composes the summary. Never generated client-side.

---

### Object 11 — REVENUE SIGNALS

```ts
revenueSignals = {
  summary:     string,
  signals:     RevenueSignal[],
  confidence:  'high' | 'medium' | 'low',
  risks: {                               // nested for future scalability
    collection:  RiskScore,
    publishing:  RiskScore,
    identity:    RiskScore,
    metadata:    RiskScore,
  },
}

RevenueSignal = {
  id:            string,
  category:      'collection' | 'publishing' | 'metadata' | 'identity',
  title:         string,
  description:   string,
  severity:      'high' | 'medium' | 'low',
  exposureRange?: { low: number, high: number },
  methodology:   string,
}

RiskScore = {
  level:  'low' | 'medium' | 'high',
  score:  number,                        // 0-100
  basis:  string[],                      // signal IDs that fed this risk
}
```

---

### Object 12 — SCAN AUTHORITY

```ts
scanAuthority = {
  ecosystemsAnalyzed:  number,
  ecosystemsVerified:  number,
  providerCount:       number,
  providerNames:       string[],         // explicit list of providers the engine queried
  engineVersion:       string,           // semver of the scan engine
  generatedAt:         string,           // ISO 8601
  confidence:          'verified' | 'high' | 'moderate',
}
```

> The UI prints this object verbatim. The UI never counts providers or computes coverage ratios.

---

## §2 — CURRENT → V2 MAPPING TABLE

### Directly mapped (rename / nest only — no transform)

| V1 (current) | V2 path | Notes |
|---|---|---|
| `artistName` | `identity.displayName` | renamed (displayName + future legalName) |
| `artistImageUrl` | `identity.artistImage` | rename |
| `imageUrl` | (legacy mirror) | preserved during dual-shape |
| `albumImageUrl` | `catalog.primaryArtwork` (fallback when album scan) | re-scoped |
| `appleArtworkUrl` | `identity.artistImage` (canonical) + `verification.providers.apple.url` | unified |
| `artistId` | `identity.artistIds.spotify` | platform clarified |
| `artistUrl` | `identity.artistUrls.spotify` | platform clarified |
| `appleMusic.artistId` | `identity.artistIds.apple` | promoted to canonical |
| `appleMusic.artistUrl` | `identity.artistUrls.apple` | promoted to canonical |
| `appleMusic.genres` | `identity.genres` | canonical (over top-level `genres`) |
| `appleMusic.found` | `verification.providers.apple.status === 'VERIFIED'` | enum vs boolean |
| `appleMusic.albumCount` | `catalog.albumCount` | mirror |
| `appleMusic.albums[]` | `catalog.releases[]` | year + type derived in engine |
| `appleMusic.storefrontAvailability.*` | `globalFootprint.territories[]` | structured |
| `appleMusic.catalogComparison.matchRate` | `metadata.isrc.coverage` (mapped to enum) | normalized |
| `appleMusic.isrcLookup` | `metadata.isrc.matched` increment | structured |
| `appleMusic.storefrontAvailability` (derived) | `globalFootprint.countries.{available,unavailable,count}` | aggregated |
| `country` | `identity.country` | unchanged |
| `genres` | `identity.genres` (when Apple-canonical empty) | unified |
| `spotifyMatched` | `verification.providers.spotify.status` | enum |
| `overallScore` | `health.score` | promoted |
| `modules.*` | `health.modules.*` | nested |
| `flags[]` | `health.findings[]` | renamed for clarity |
| `gapBasedExposure.indicators[]` | `opportunities.items[]` | renamed |
| `gapBasedExposure.aggregateLow/High` | `opportunities.aggregateLow/High` | nested |
| `gapBasedExposure.pendingValidationCount` | `opportunities.pendingValidation` | renamed |
| `proGuide.{pro,url,note,steps,country}` | `publishing.pro.{name,url,note,steps,country}` | nested |
| `platform` | `identity.resolvedFrom` | unified |
| `resolvedFrom` | `identity.resolvedFrom` | dedup |
| `resolvedFromType` | `identity.canonicalIdentity.source` | restructured |
| `platforms.<key>` | `verification.providers.<key>.status === 'VERIFIED'` | enum |
| `youtube.found` | `verification.providers.youtube.status === 'VERIFIED'` | enum vs boolean |
| `youtube.availability` | `verification.providers.youtube.status` | unified enum |
| `youtube.officialChannel.channelId` | `verification.providers.youtube.identifier` | unified |
| `youtube.officialChannel.url` (derived) | `verification.providers.youtube.url` | unified |
| `youtube.officialChannel.verifiedVia` | `verification.providers.youtube.verifiedVia` | preserved |
| `youtube.officialChannel.{title,subscribers,videos,views,contentIdVerified}` | `verification.providers.youtube.details.{title,subscribers,videos,views,contentIdVerified}` | scoped to details |
| `wikipediaUrl` | `verification.providers.wikidata.url` | renamed |
| `lastfmListeners`, `lastfmPlays` | `verification.providers.lastfm.details.{listeners,plays}` | scoped |
| `deezerFans` | `verification.providers.deezer.details.fans` | scoped |
| `discogsReleases` | `verification.providers.discogs.details.releases` | scoped |
| `catalog.{totalReleases→albumCount, totalTracks→trackCount, catalogAgeYears→catalogAge}` | `catalog.{albumCount, trackCount, catalogAge}` | renames |
| `catalog.{earliestYear,latestYear,recentActivity}` | `catalog.{earliestYear,latestYear,recentActivity}` | unchanged |
| `scanId`, `scannedAt`, `success` | top-level envelope + `scanAuthority.generatedAt` | preserved + mirror |
| `score.overall`, `score.riskLevel`, `score.riskSummary` | `health.score`, `health.grade`, `health.summary` | unified |
| `ownership` | `identity.canonicalIdentity` + `verification.confidence` | restructured |

### Deprecated / removed at v2.0.0

| V1 field | Disposition | Why |
|---|---|---|
| `royaltyGap.*` (entire object) | Removed | Deprecated since v1.1.0 (audience-estimation model) |
| `catalog.estimatedAnnualStreams` | Removed | Mirror of deprecated estimate |
| `royaltyGap.ugc*` | Removed | BUG 2 fix: always 0 post-merge |
| `youtube.ugc.*` | Removed | BUG 2 fix: absent post-merge |
| `youtube.subscriberCount`, `youtube.totalOfficialViews` | Removed | Legacy mirrors of `officialChannel` fields |
| `youtube.contentIdVerified` (top-level) | Re-scoped to `verification.providers.youtube.details.contentIdVerified` | structural |
| `auditCoverage`, `auditCoverageRaw` | Removed | Already deprecated per schema |
| `previewFlags[]` | Removed | Always mirrored `flags[]` |
| `flagCount` | Removed | Derive from `health.findings.length` (presentation only) |
| `canonicalTarget` | Removed | Was always `'artist'` |
| `resolvedFromTitle` | Removed | Mirror of `displayName` |
| `popularity` | Removed | Development-mode zeroed |
| `followers` | Removed | Sentinel `-1` for absent; never displayed |
| `gapBasedExposure.hasAnyGaps` | Removed | Derive from `opportunities.items.length > 0` |
| `trackIsrc`, `trackTitle` (top-level) | Migrated → `catalog.tracks[0].{isrc,name}` when track-input | restructured |
| `territoryCoverage` (reserved-nullable) | Populated → `globalFootprint.countries.*` / `globalFootprint.territories[]` | activated |
| `isrcValidation` (reserved-nullable) | Populated → `metadata.isrc.*` | activated |
| `gapBasedExposure` | `opportunities` | renamed |
| Standalone `youtube` top-level object | Removed | Folded into `verification.providers.youtube` per Board ruling |

### NEW fields requiring engine population (one brief each)

| New field | Owner brief |
|---|---|
| `globalFootprint.{score,grade,confidence,*Coverage,coverageSummary,methodology}` | "Global Music Footprint™ Score" |
| `globalFootprint.aiCoverage` | "AI Search Coverage" (later) |
| `globalFootprint.podcastCoverage` | "Podcast Intelligence" (existing, surfaces here) |
| `health.grade`, `health.confidence`, `health.summary` | "Health Score grade + summary" |
| `aiInsight.*` (entire object) | "AI Insight composer" |
| `scanAuthority.*` (entire object) | "Scan Authority counts + provenance" |
| `revenueSignals.*` (entire object) | "Revenue Signals model" (multiple sub-briefs) |
| `identity.confidence`, `identity.legalName`, `identity.canonicalIdentity`, `identity.verifiedIdentity` | "Identity confidence taxonomy" |
| `verification.confidence`, `verification.verifiedCount`, `verification.totalCount` | "Verification confidence rollup" |
| `metadata.credits.*`, `metadata.iswc/upc.coverage`, `metadata.summary` | "Metadata enrichment Phase 2" |
| `publishing.{publisher,administrator,collection,summary,recommendations}` | "Publishing enrichment Phase 2" |
| `actions.{priorityActions,recommendedActions,quickActions,links,documentation}` | "Actions composer + Knowledge Library links" |
| `catalog.releaseHistory` | ships with Phase 1 (pure aggregation of releaseDate years) |
| `catalog.tracks[]`, `Release.year`, `Release.type` | ships with Phase 1 (pure string slice + count classification) |

---

## §3 — MIGRATION STRATEGY

### Schema-version semantics
| Version | Meaning | Engine emits | Consumers see |
|---|---|---|---|
| `1.0.0` (today) | V1 flat-only | flat fields | flat fields |
| `1.2.0` | Dual-shape (Phase 1) | V1 flat **+** V2 objects | both available |
| `1.3.0 – 1.x.0` | Surface migration (Phase 3) | dual-shape | each surface migrates one at a time |
| `2.0.0` | Legacy removal (Phase 4) | V2 objects only | V2 only |

`1.2.0` is additive (semver-safe). `2.0.0` is the breaking removal.

### Single normalizer principle preserved
`api/lib/normalizeAuditResponse.js` remains the only place where engine field names translate to canonical paths. V2 objects are emitted from the same function via a new `buildIntelligenceObjects(legacy)` helper. No second normalizer.

### Engine writes V2 objects from EXISTING signals (Phase 1)
For Phase 1, V2 objects are **populated from V1 fields** with zero new computation:
- `health.score` = `overallScore`
- `catalog.releases[]` = transform of `appleMusic.albums[]` (year via string slice, type via trackCount classification)
- `verification.providers.spotify.status` = `spotifyMatched ? 'VERIFIED' : 'UNVERIFIED'`
- `globalFootprint.territories[]` = transform of `appleMusic.storefrontAvailability.*`
- `globalFootprint.countries.*` = aggregate of territory availability
- `opportunities.items[]` = rename of `gapBasedExposure.indicators[]`
- `publishing.pro.*` = rename of `proGuide.*`

Fields requiring **NEW engine computation** (per §2 NEW table — `globalFootprint.score`, `aiInsight.*`, `scanAuthority.*`, `revenueSignals.*`, etc.) ship as `null` in v1.2.0 with `confidence: 'unknown'` and a `// TODO: populated by brief X` marker. Each gets its own Phase 2 brief.

### Surface migration order (Phase 3)
1. **Royaltē Review PDF** (`lib/render-audit-pdf.js`) — internal template, lowest fragility. Validates schema + Pydantic alignment.
2. **Scan Results page V2** (the Board Vision Scan Results brief).
3. **Mission Control** (`public/dashboard.html` + `dashboard.js`) — highest-traffic.
4. **Executive Brief™ email** (when implemented).
5. **Monitoring delta engine** (`api/_lib/persist-os-scan.js`).

---

## §4 — BACKWARD COMPATIBILITY PLAN

### During Phase 1 (v1.2.0)
- Engine writes BOTH flat fields AND nested objects.
- Schema validator accepts payloads with EITHER shape, prefers both.
- Snapshots in `scan_snapshots` Supabase table written with both shapes.
- Old snapshots remain flat-only — readers must handle both:
  ```js
  const score = snapshot?.health?.score ?? snapshot?.overallScore;
  ```
- No existing consumer breaks.

### During Phase 3 (v1.3.0+)
- Each migrating surface stops reading flat fields; reads only from objects.
- A snapshot-backfill cron (separate non-blocking brief) can derive V2 objects for historical snapshots from their flat fields — useful for Health Score History™.

### At v2.0.0 (legacy removal)
- All surfaces must have migrated.
- Schema validator drops legacy field tolerance.
- Snapshots are V2-only going forward.
- Pipeline test asserts ONLY V2 shape.
- Pre-condition gate: convergence test that runs every Royaltē surface against a fixture payload and confirms zero legacy-field reads remain.

### Schema-version gate at the API boundary
- `/api/audit` returns `schemaVersion: '1.2.0'` during dual-shape.
- Clients pin a min-version: `if (data.schemaVersion < '1.2.0') reject`.
- Forward-compat flag `__legacy: true` on payload when legacy fields are still being emitted; removed at v2.0.0.

---

## §5 — ROLLOUT RECOMMENDATION

### Phase 0 — Board ratification ✓
This document.

### Phase 1 — Schema dual-shape extension (single PR)
- Extend `api/schema/auditResponse.js` with optional V2 object shapes.
- Extend `api/lib/normalizeAuditResponse.js` with `buildIntelligenceObjects(legacy)`.
- Extend Pydantic mirror in `generate_audit_pdf.py`.
- Extend pipeline test fixture `api/fixtures/canonical-radiohead.json`.
- Pipeline test assertions cover both shapes.
- Bump `AUDIT_RESPONSE_VERSION = '1.2.0'`.
- Existing consumers untouched; new objects populated from existing data.
- **Sizing:** ~600 lines added across 4 files. One PR.

### Phase 2 — Engine composition of new server-side computations
Recommended bundling:
- **2A — "Foundations"** (Scan Authority + Identity confidence + Verification confidence rollup): `scanAuthority.*`, `identity.confidence`, `identity.canonicalIdentity`, `identity.verifiedIdentity`, `verification.confidence`, `verification.verifiedCount`, `verification.totalCount`. Tightly coupled; ship together.
- **2B — Global Music Footprint™ Score**: `globalFootprint.score`, `grade`, `confidence`, all `*Coverage` bands, `coverageSummary`, `methodology`.
- **2C — Health grade + summary**: `health.grade`, `health.confidence`, `health.summary`.
- **2D — AI Insight composer**: `aiInsight.*` (template-first; LLM deferred).
- **2E — Actions composer**: `actions.*`.
- **2F — Revenue Signals model**: `revenueSignals.*` (multi-PR series as model matures).
- **2G — Metadata Phase 2 enrichment**: `metadata.credits.*`, `metadata.iswc/upc.coverage`, `metadata.summary`.
- **2H — Publishing Phase 2 enrichment**: `publishing.{publisher,administrator,collection,summary,recommendations}`.
- **2I — Podcast Intelligence surfacing**: `globalFootprint.podcastCoverage` from existing Podcast Intelligence (`api/_lib/podcast-intelligence.js`).
- **2J — AI Search Coverage**: `globalFootprint.aiCoverage` (new provider integrations required).

Each brief follows the Governance Directive: named-constant gates, source-of-truth comments, payload convergence tests.

### Phase 3 — Surface migration
1. Royaltē Review PDF
2. Scan Results page V2 (greenfield)
3. Mission Control
4. Executive Brief™ email
5. Monitoring delta engine

### Phase 4 — Legacy removal (v2.0.0)
Convergence test gates the cutover. Bump version, drop legacy fields, drop tolerance from validator.

### Timeline estimate
- Phase 0: this proposal — ratified by this brief.
- Phase 1: 1-2 days, 1 PR.
- Phase 2: ~3-4 weeks calendar across 10 sub-briefs (parallelizable).
- Phase 3: ~5 weeks calendar (1 surface per week).
- Phase 4: 2026 Q4 / 2027 Q1, gated on Phase 3 completion.

---

## §6 — CONSTITUTIONAL COMPLIANCE REVIEW

| Constitutional rule | V2 compliance |
|---|---|
| **One Truth · One Engine · One Platform** (Constitution §7) | ✓ Every surface consumes the same 12-object shape. No computation duplicated. |
| **Mission Control = presentation layer only** (Constitution §3) | ✓ Every computed field (`globalFootprint.score`, `aiInsight.summary`, `scanAuthority.*`, etc.) lives in the engine. UI never composes. |
| **No speculative metrics** (Constitution principle 5) | ✓ Deprecated `royaltyGap.*` and `youtube.ugc.*` paths removed at v2.0.0. `revenueSignals` is signal-based, not estimate-based. |
| **Apple = canonical, Spotify = verification** (Canonical Identity Architecture) | ✓ `identity.canonicalIdentity.source` makes this explicit at the schema level. |
| **Identity Graph separation** (Board Directive 2026-06-09) | ✓ Schema stores only engine-derived intelligence — no curated artist records. `verification.providers.youtube.verifiedVia` references the Graph's output without embedding it. |
| **Engine verifies, does not estimate** (Engineering Principle) | ✓ Every confidence enum is engine-set; UI never derives confidence. |
| **Royaltē Verifies Intelligence** (engine principle) | ✓ Every value carries `confidence` and `verifiedVia` provenance. |
| **Provider isolation** (Board ruling, this brief) | ✓ All provider data lives in `verification.providers.*`. No standalone `apple`, `spotify`, or `youtube` top-level objects. |
| **Source-of-truth comments** (Governance Directive Rule 1) | ✓ Each Phase 2 brief introduces source-of-truth header above the object's compute function. |
| **Named-constant gates** (Governance Directive Rule 2) | ✓ Each Phase 2 brief introduces a named constant for its verification/computation gate. |
| **Convergence tests** (Governance Directive Rule 3) | ✓ Convergence test extended to assert object-shape equivalence between Apple URL and Spotify URL inputs. |
| **Intelligence Maps** (Governance Directive Rule 4) | ✓ Each Phase 2 brief produces a per-field Intelligence Map for its object. |
| **File-level principle headers** (Governance Directive Rule 5) | ✓ V2 schema file gets the engineering-principle header. |
| **Music Backend Intelligence™ category** (Constitution principle 1) | ✓ Object names use canonical category language (Music Backend Health™, Global Music Footprint™, Royaltē Intelligence Object). |

---

## §7 — RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 1 PR is large (~600 lines) | Medium | Low | All additive; existing tests pass unchanged; founder review focuses on object shape only |
| Pydantic mirror drift | Low | High | CI gate runs `generate_audit_pdf.py --payload fixture.json` against V2 fixture; mismatch fails CI |
| Snapshot back-compat in monitoring | Medium | Medium | Dual-read pattern + optional snapshot-backfill cron (separate brief) |
| Phase 2 brief explosion (10 sub-briefs) | High | Medium | Bundle into "Foundations" (2A) + four others; parallelize independent ones |
| Founder bandwidth for 10+ briefs | Medium | Medium | "Foundations" bundle ships 4 dependent objects together |
| Surface migration regressions | Medium | High | Each surface has its own convergence test (Rule 3); Mission Control already has snapshot-baseline tests |
| v2.0.0 timing pressure | Low | Low | Phase 4 is gated, not date-driven; Board sets cutover |
| AI Insight LLM cost / latency | Medium | Medium | Template-first (2D ships engine_template); LLM is a separate later brief |
| Identity Graph drift in `verification.providers.youtube.identifier` | Low | Medium | `verifiedVia: 'royalte_identity_graph'` provenance traceable per scan |
| Provider data leaks into UI logic during Phase 3 migration | Medium | High | Surface PRs reviewed against the rule "no `youtube.officialChannel.*` reads in UI; only `verification.providers.youtube.*`" |
| Schema rename collisions (e.g. `flags` → `findings`) breaking V1 consumers mid-migration | Low | Medium | Dual-shape preserves both names until v2.0.0 |

---

## §8 — PHASE IMPLEMENTATION ORDER

```
Phase 0 ─────────────────────────────────────────────────
  Board ratification (this doc)
       ✓ DONE

Phase 1 ─────────────────────────────────────────────────
  v1.2.0 — Schema dual-shape extension (1 PR, ~1-2 days)
  ├── api/schema/auditResponse.js          (extend)
  ├── api/lib/normalizeAuditResponse.js    (extend)
  ├── generate_audit_pdf.py                (Pydantic mirror)
  ├── api/fixtures/canonical-radiohead.json (extend fixture)
  └── tests/pipeline-test.mjs              (dual-shape assertions)

Phase 2 ─────────────────────────────────────────────────
  Engine composition (parallelizable bundles)

  2A — "Foundations" bundle
    ├── scanAuthority.*
    ├── identity.confidence + canonicalIdentity + verifiedIdentity
    ├── verification.confidence + verifiedCount + totalCount
    └── identity.legalName (deferred to data source availability)

  2B — Global Music Footprint™ Score
    └── globalFootprint.{score,grade,confidence,*Coverage,coverageSummary,methodology}

  2C — Health grade + summary
    └── health.{grade,confidence,summary}

  2D — AI Insight composer
    └── aiInsight.* (template-first)

  2E — Actions composer
    └── actions.*

  2F — Revenue Signals model (multi-PR)
    └── revenueSignals.* (collection/publishing/identity/metadata risks first)

  2G — Metadata Phase 2 enrichment
    └── metadata.{credits,iswc,upc,summary}

  2H — Publishing Phase 2 enrichment
    └── publishing.{publisher,administrator,collection,summary,recommendations}

  2I — Podcast Intelligence surfacing
    └── globalFootprint.podcastCoverage

  2J — AI Search Coverage
    └── globalFootprint.aiCoverage

Phase 3 ─────────────────────────────────────────────────
  Surface migration (1 PR per surface)
  1. Royaltē Review PDF
  2. Scan Results V2 page (greenfield)
  3. Mission Control
  4. Executive Brief™ email
  5. Monitoring delta engine

Phase 4 ─────────────────────────────────────────────────
  v2.0.0 — Legacy removal
  └── Drop flat fields, bump version, drop validator tolerance
```

---

## DELIVERABLE STATUS

| # | Deliverable | Status |
|---|---|---|
| 1 | Final Canonical Payload V2 schema | ✓ §1 |
| 2 | Current → V2 mapping table | ✓ §2 |
| 3 | Migration strategy | ✓ §3 |
| 4 | Backward compatibility plan | ✓ §4 |
| 5 | Rollout recommendation | ✓ §5 |
| 6 | Constitutional compliance review | ✓ §6 |
| 7 | Risk register | ✓ §7 |
| 8 | Phase implementation order | ✓ §8 |

**No UI work touched. No Mission Control work touched. No Scan Engine feature work touched.**

This document is the canonical architectural reference for the Royaltē Intelligence Object Model. It will govern engineering decisions for the next 5-10 years until the Board ratifies a successor.
