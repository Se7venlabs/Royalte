# Frontend Migration — `index.html` → Canonical AuditResponse v1.0.0

The `/api/audit` response is now the canonical shape defined by
`api/schema/auditResponse.js`. Every consumer (web preview, brand PDF,
print PDF) reads from this shape and only this shape.

This document maps every deprecated root-level field in the current
`index.html` audit handler to its new canonical path.

---

## Field rename map

### Source / identity

| Old (root-level)                          | New                                |
|-------------------------------------------|------------------------------------|
| `data.platform` ("spotify" / "apple")     | `data.source.platform` ("spotify" / "apple_music") |
| `data.sourcePlatform`                     | `data.source.platform` (same value) |
| `data.type` ("artist" / "track" / "album")| `data.source.urlType`              |
| `data.resolvedFrom`                       | `data.source.resolvedFrom`         |
| *(new)*                                   | `data.source.originalUrl`          |
| *(new)*                                   | `data.source.storefront` (Apple only, nullable) |
| *(new)*                                   | `data.scanId` (UUID per scan)      |
| *(new)*                                   | `data.schemaVersion` ("1.0.0")     |

### Subject (the thing being audited)

| Old                        | New                          |
|----------------------------|------------------------------|
| `data.artistName`          | `data.subject.artistName`    |
| `data.artistId`            | `data.subject.artistId`      |
| `data.trackTitle`          | `data.subject.trackTitle`    |
| `data.trackIsrc`           | `data.subject.trackIsrc`     |
| `data.trackIsrcSource`     | `data.subject.trackIsrcSource` |
| `data.appleMusicSource.albumName` | `data.subject.albumName` |

### Metrics (all the raw numbers)

| Old                        | New                           |
|----------------------------|-------------------------------|
| `data.followers`           | `data.metrics.followers`      |
| `data.popularity`          | `data.metrics.popularity`     |
| `data.genres`              | `data.metrics.genres`         |
| `data.lastfmPlays`         | `data.metrics.lastfmPlays`    |
| `data.lastfmListeners`     | `data.metrics.lastfmListeners` |
| `data.deezerFans`          | `data.metrics.deezerFans`     |
| `data.tidalPopularity`     | `data.metrics.tidalPopularity` |
| `data.discogsReleases`     | `data.metrics.discogsReleases` |
| `data.country`             | `data.metrics.country`        |
| `data.wikipediaUrl`        | `data.metrics.wikipediaUrl`   |

### Platforms (now availability objects, not booleans)

```js
// OLD
if (data.platforms.spotify) { ... }
if (data.platforms.youtube) { ... }

// NEW
if (data.platforms.spotify.availability === 'VERIFIED') { ... }
if (data.platforms.youtube.availability === 'VERIFIED') { ... }

// AUTH_UNAVAILABLE must be handled explicitly — do NOT treat as NOT_FOUND
if (data.platforms.youtube.availability === 'AUTH_UNAVAILABLE') {
  renderChip('YouTube — Unavailable', 'muted');
}
```

Rich details (previously on root) are now on `.details`:

| Old                              | New                                     |
|----------------------------------|-----------------------------------------|
| `data.youtube.officialChannel`   | `data.platforms.youtube.details.officialChannel` |
| `data.youtube.ugc`               | `data.platforms.youtube.details.ugc`    |
| `data.youtube.subscriberCount`   | `data.platforms.youtube.details.subscriberCount` |
| `data.appleMusic.catalogComparison` | `data.platforms.appleMusic.details.catalogComparison` |
| `data.appleMusic.isrcLookup`     | `data.platforms.appleMusic.details.isrcLookup` |

### Audit coverage

| Old                                          | New (unchanged path, but `auditCoverageRaw` deprecated) |
|----------------------------------------------|--------------------------------------------------------|
| `data.auditCoverage.spotify.status`          | `data.auditCoverage.spotify.status` ✓ (same)           |
| `data.auditCoverageRaw.spotify.connected`    | **DEPRECATED** — read `data.auditCoverage.spotify.status === 'Verified'` instead |
| *(new)*                                      | `data.auditCoverage.spotify.tier` (e.g. "isrc", "name_artist_duration") |

`auditCoverageRaw` is still emitted for one version with `_deprecated: true`
so the frontend doesn't break on deploy. It will be removed in v2.0.0.

### Modules (standardized shape)

```js
// OLD
data.modules.metadata.score
data.modules.metadata.flags
// (no grade, no issueCount, no availability, no key)

// NEW — every module has the same shape
data.modules.metadata = {
  key: 'metadata',
  name: 'Metadata Integrity',
  score: 82,            // OR null when availability === 'AUTH_UNAVAILABLE'
  grade: 'B',           // OR null
  availability: 'AVAILABLE',   // or 'AUTH_UNAVAILABLE'
  issueCount: 1,
  flags: ['ISRC signal not detected on this track'],
}
```

When rendering module cards: if `availability === 'AUTH_UNAVAILABLE'`,
show an "Unavailable" chip and dash out the score/grade/issue count.
Do NOT render a 0 or empty value.

### Issues (replaces `flags`)

```js
// OLD
data.flags = [
  { module: 'Publishing Risk', severity: 'high', description: '...' }
]

// NEW
data.issues = [
  {
    id: 'a1b2c3d4e5f6',       // stable hash for dedup
    module: 'publishing',      // module KEY (lowercase, for lookup)
    moduleName: 'Publishing Risk',  // display name
    severity: 'HIGH',          // UPPERCASE: CRITICAL | HIGH | WARNING | INFO
    title: 'Catalog active for 33 years',
    detail: 'Catalog active for 33 years — extended period of potential royalty exposure detected',
    source: 'catalog',         // 'module' | 'catalog' | 'ownership' | 'platform'
  }
]
```

**Severity mapping** (for existing CSS classes):

| Old (lowercase) | New (uppercase) |
|-----------------|-----------------|
| `'high'` + module.score < 40 | `'CRITICAL'` |
| `'high'` (other)             | `'HIGH'`     |
| `'medium'`                   | `'WARNING'`  |
| `'low'`                      | `'INFO'`     |

Quick adapter if rewriting CSS selectors would be too invasive:

```js
const severityClass = {
  CRITICAL: 'flag-high',
  HIGH:     'flag-high',
  WARNING:  'flag-medium',
  INFO:     'flag-low',
}[issue.severity];
```

### Score + risk

| Old                   | New                       |
|-----------------------|---------------------------|
| `data.overallScore`   | `data.score.overall`      |
| *(new)*               | `data.score.riskLevel` ("LOW" / "MODERATE" / "HIGH" / "CRITICAL") |
| *(new)*               | `data.score.riskSummary` (human-readable banner string) |
| *(new)*               | `data.score.moduleAverage` |
| *(new)*               | `data.score.ownershipImpact` |

The critical-banner component can now read `data.score.riskSummary`
directly instead of building the string in JS from top flags.

### Ownership & publishing

| Old                                    | New                          |
|----------------------------------------|------------------------------|
| `data.ownershipVerification.ownership_status` | `data.ownership.status`      |
| `data.ownershipVerification.confidence`       | `data.ownership.confidence`  |
| `data.ownershipVerification.score_impact`     | `data.ownership.scoreImpact` |
| `data.ownershipVerificationRender`            | `data.ownership.render`      |

### Royalty gap, PRO guide, catalog

These keep the same shapes (and mostly the same paths):

- `data.royaltyGap.*` — unchanged
- `data.proGuide.*` — unchanged
- `data.catalog.*` — unchanged

---

## Recommended migration path

1. **Add a thin compatibility shim at the top of the response handler**
   that spreads the canonical payload into the legacy fields you already
   read. This keeps render code untouched while the new paths become the
   source of truth:

   ```js
   function legacyShim(data) {
     return {
       ...data,
       artistName: data.subject.artistName,
       trackTitle: data.subject.trackTitle,
       followers:  data.metrics.followers,
       popularity: data.metrics.popularity,
       genres:     data.metrics.genres,
       overallScore: data.score.overall,
       flags: data.issues.map(i => ({
         module: i.moduleName,
         severity: i.severity.toLowerCase() === 'critical' ? 'high' : i.severity.toLowerCase(),
         description: i.detail,
       })),
     };
   }
   const audit = legacyShim(await fetch('/api/audit?url=...').then(r => r.json()));
   ```

2. **Incrementally move each render block off the shim** and onto canonical
   paths. Start with the score banner, then modules, then issues/flags,
   then platform chips.

3. **Delete the shim** once every render block uses canonical paths.
   Remove the deprecated `auditCoverageRaw` read at the same time.

4. **`dashboard.html` migration** (the portal work you've already noted):
   when the live/soon elements listed in memory get moved from `index.html`
   to `dashboard.html`, they read canonical fields from day one — no shim
   needed in the new file.

---

## What's explicitly NOT in v1

These are reserved as `null` in the canonical payload for forward-compat,
so the frontend can check for them but render gracefully when absent:

- `data.territoryCoverage` — always `null` in v1; engine doesn't populate it yet
- `data.isrcValidation` — always `null` in v1; 5-track ISRC cross-platform table is a v2 feature

When the engine starts populating these, the schema version bumps to 1.1.0,
the Pydantic model gets extended, and renderers pick them up with no
frontend changes (as long as frontend checks for `null` before rendering).
