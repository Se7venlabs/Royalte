# Royaltē Migration Retirement Register™

**Status:** living Board document — updated after every provider migration.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.
**Board Directive:** 2026-07-02 (Apple Production Migration, PR #189).

**Purpose:** Master checklist for eliminating legacy architecture. Every component that is
TRANSITIONAL or READY FOR RETIREMENT has an explicit owner, consumer list, and retirement
trigger. This register is the Board's primary tool for ensuring each migration shrinks —
never grows — the legacy footprint.

**Engineering Rule (effective 2026-07-02):**
> Every migration must leave LESS legacy than it started with.

**Status vocabulary:**

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Constitutional component — permanent, no retirement plan |
| `TRANSITIONAL` | Required now, but has a defined retirement trigger |
| `READY FOR RETIREMENT` | Zero active callers — can be deleted on Board approval |
| `RETIRED` | Deleted from codebase; recorded here for history |

---

## Ownership Framework

Every subsystem must have exactly one answer to each:

| Question | Constitutional Owner |
|----------|---------------------|
| Who owns acquisition? | Provider Acquisition Layer (PAL) |
| Who owns intelligence? | Royaltē Intelligence Engine (RIE) |
| Who owns storage? | Supabase (via persist layer) |
| Who owns presentation? | Mission Control / Audit UI / PDF renderer |

If more than one component answers the same question, the migration is not complete.

---

## Apple Music Components

### Constitutional (ACTIVE — permanent)

| Component | File | Role |
|-----------|------|------|
| `AppleMusicConnector` | `provider-acquisition/connectors/apple-music/AppleMusicConnector.js` | Sole acquisition connector for Apple Music; AVAILABILITY now covers all 167 storefronts |
| `ProviderAcquisitionLayer` | `provider-acquisition/pal/ProviderAcquisitionLayer.js` | Sole production acquisition boundary |
| `EvidenceContract` | `provider-acquisition/evidence/EvidenceContract.js` | Constitutional envelope returned by every connector |
| `acquireAppleEvidence()` | `api/_lib/apple-pal-acquisition.js` | PAL orchestration for a single scan; sequential ARTIST_IDENTITY → ALBUMS → AVAILABILITY |
| `resolveAppleArtist()` | `api/_lib/identity/apple.js` | Input resolution only (URL → subjectRef); not acquisition; stays until PAL handles subject discovery natively |

### Transitional (TRANSITIONAL — retirement trigger defined)

| Component | File | Current Consumer(s) | Retirement Trigger | Retirement Phase |
|-----------|------|--------------------|--------------------|-----------------|
| `synthesizeAppleMusicCompat()` | `api/_lib/apple-pal-acquisition.js` | `run-scan.js` → `runModules()`, `buildFlags()` (V1 module system) | `runModules()` and `buildFlags()` migrate to RIE Rule Library | Spotify migration or dedicated V1 module retirement |
| `_mergeApplePalEvidence()` | `lib/rie/index.js` | `runRIE()` hybrid path | Spotify migrates to PAL (legacy `canonicalForEnrichment` shape disappears) | Spotify Production Migration |
| `EvidenceBridge` | `lib/rie/EvidenceBridge.js` | `runRIE()` PAL path | All providers migrated to PAL; bridge collapses into RIE directly | Final provider migration |
| `CimAdapter` (buildCimEnrichment) | `lib/rie/CimAdapter.js` | `api/audit.js`, `api/cron/scan-subscription.js` | MC and Audit migrate to CIM-native reads | Phase 3.2 (Mission Control migration) |
| `normalizeAuditResponse()` | `api/lib/normalizeAuditResponse.js` | All scan persistence paths | Products read from CIM directly; `rawResponse` shape retired | After all products migrate to CIM |
| `getArtistSongs()` import | `api/_lib/run-scan.js` | Apple→Spotify ISRC bridge in `resolveToArtist()` | PAL handles cross-provider ISRC resolution natively | Cross-provider identity phase |
| Apple `rawResponse.appleMusic` field | `api/_lib/run-scan.js` → `normalizeAuditResponse` | `_normalizePlatforms()` → `canonical.platforms.appleMusic.details` | EvidenceBridge becomes sole Apple canonical source (when `normalizeAuditResponse` reads from CIM) | After `normalizeAuditResponse` retirement |

### Ready for Retirement (READY FOR RETIREMENT — zero callers, Board approval required)

| Component | File | Confirmed Zero Callers | Notes |
|-----------|------|----------------------|-------|
| `getAppleMusic()` | `api/_lib/identity/apple.js` | Yes — removed from `run-scan.js`; no other production callers | Full function body still present. Delete on Board approval. |
| `checkGlobalStorefrontAvailability()` | `api/apple-music.js` | Yes — replaced by `AppleMusicConnector#fetchGlobalStorefrontAvailability` | Can delete after verifying no direct test or script callers |
| `generateAppleToken` import in `run-scan.js` | `api/_lib/run-scan.js` line 24 | Yes — commented out | Remove the commented import line |
| `lookupByISRC`, `checkStorefrontAvailability`, `getArtistAlbums` imports in `run-scan.js` | `api/_lib/run-scan.js` line 25 | Yes — commented out | Remove the commented import line |

### Retired (RETIRED — deleted from codebase)

| Component | Deleted at | PR | Replacement |
|-----------|-----------|-----|------------|
| `computeV2HealthScore()` (direct callers) | 2026-07-02 | #188 | `cim.health.score` (One Health Engine) |

---

## Platform-Level Components

| Component | File | Status | Constitutional Owner | Retirement Trigger |
|-----------|------|--------|---------------------|-------------------|
| `runModules()` / `buildFlags()` | `api/_lib/run-scan.js` | TRANSITIONAL | RIE Rule Library | When V1 module logic is expressed as Rule Library rules |
| `assembleGlobalMusicFootprint()` | `api/_lib/global-music-footprint.js` | TRANSITIONAL | RIE (via CIM) | When `cim.globalFootprint` is produced directly from PAL evidence without legacy normalization |
| `ALL_APPLE_STOREFRONTS` in `api/apple-music.js` | `api/apple-music.js` | TRANSITIONAL | `AppleMusicConnector` | When `api/apple-music.js` is retired; connector's copy is the source |
| `BIG6_STOREFRONTS` in `api/apple-music.js` | `api/apple-music.js` | TRANSITIONAL | `AppleMusicConnector` | Same — connector owns both constants |
| `api/apple-music.js` (module) | `api/apple-music.js` | TRANSITIONAL | `AppleMusicConnector` + `ProviderAcquisitionLayer` | When all direct Apple API callers migrate to PAL; module can be deleted |

---

## Migration Progress

| Provider | Acquisition Owner | Status |
|----------|-----------------|--------|
| Apple Music | **PAL → AppleMusicConnector** | ✅ MIGRATED (PR #189, 2026-07-02) |
| Spotify | `getSpotifyArtist()` / `getSpotifyAlbums()` etc. (direct) | ⬜ Not started — Board must authorize |
| MusicBrainz | `getMusicBrainz()` (direct) | ⬜ Not started |
| Deezer | `getDeezer()` (direct) | ⬜ Not started |
| YouTube | `getYouTube()` (direct) | ⬜ Not started |
| Last.fm | `getLastFm()` (direct) | ⬜ Not started |
| Discogs | `getDiscogs()` (direct) | ⬜ Not started |
| AudioDB | `getAudioDB()` (direct) | ⬜ Not started |
| SoundCloud | `getSoundCloud()` (direct) | ⬜ Not started |
| Wikidata | `getWikidata()` (direct) | ⬜ Not started |
| MLC | `fetchMlcWorksByArtist()` (direct) | ⬜ Not started |

---

## Next Provider Migration Recommendation

**Recommended: Spotify**

Spotify is the deepest entangled legacy dependency — it owns artist resolution AND is the
primary canonical identity anchor. Every subsequent migration has a Spotify dependency.
Migrating Spotify unblocks the clearest path to eliminating the legacy `canonicalForEnrichment`
shape from the RIE hybrid merge path.

The Apple Production Migration blueprint applies verbatim. SpotifyConnector follows the
same `ProviderConnector` interface. The hybrid merge path in `runRIE()` already handles
multi-provider evidence.

**Alternative: Deezer** — Lowest complexity single migration. Single function, rich detail
object already returned. Good validation that the blueprint generalizes.

**Board decides.** Engineering is ready to execute either on authorization.

---

*Register maintained by the engineering team. Updated after every migration.*
*Board Directive origin: 2026-07-02, Apple Production Migration (PR #189).*
