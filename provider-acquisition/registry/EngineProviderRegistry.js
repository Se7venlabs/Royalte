// ─────────────────────────────────────────────────────────────────────
//  Royaltē Engine Provider Registry™ — v1.0
// ─────────────────────────────────────────────────────────────────────
//
//  ROYALTĒ v3.0 §1 — Board Implementation Brief. The governance-level
//  source of truth for every external provider, API, connector, and
//  data source used throughout the Royaltē platform.
//
//  ── Relationship to the runtime ProviderRegistry (read this first) ──
//
//  This file is NOT the same thing as provider-acquisition/registry/
//  ProviderRegistry.js + RegistryEntry.js, and does not modify, extend,
//  or wrap them. They serve genuinely different responsibilities:
//
//    ProviderRegistry.js (runtime, unchanged by this brief)
//      - A Map-backed class. One fresh instance per ProviderAcquisitionLayer,
//        i.e. per scan (see provider-acquisition/pal/ProviderAcquisitionLayer.js).
//      - Populated at runtime via lifecycle.register() when a connector
//        is activated for that scan; discarded when the scan ends.
//      - 7 fields (name, version, capabilityProfile, trustValue,
//        healthState, enabled, implementationStatus) — exactly what a
//        running scan needs to know about the connector it just loaded.
//      - Audience: code. Never read by a human directly.
//
//    EngineProviderRegistry.js (governance, this file)
//      - A static, declarative, version-controlled catalog. One entry
//        per provider Royaltē has EVER integrated, persisted in source
//        control, unaffected by any individual scan's lifecycle.
//      - 14 fields covering ownership, purpose, auth, endpoints, rate
//        limits, and Board certification history — governance concerns
//        the runtime registry has no reason to know about.
//      - Audience: the Board, developers, and future integration work.
//
//  Board Rule: one runtime registry, one governance registry — they
//  complement each other and must never duplicate responsibilities.
//  Every new provider must be added to THIS file in the same PR that
//  introduces it (Board Rule, ROYALTĒ v3.0 §1).
//
//  ── Architecture ──────────────────────────────────────────────────
//
//    ┌─────────────────────────────────────────────────────────────┐
//    │                     ROYALTĒ PLATFORM                        │
//    │                                                               │
//    │   ┌───────────────────────┐      ┌──────────────────────┐  │
//    │   │ Engine Provider        │      │ Intelligence Engines  │  │
//    │   │ Registry™ (this file)  │      │ (Identity / Catalog / │  │
//    │   │                         │      │  Publishing / Recording│  │
//    │   │ governance · inventory  │─────▶│  / Territory / Monitor)│  │
//    │   │ engine mappings         │ docs │                        │  │
//    │   │ Board certification     │ only │  consume evidence via  │  │
//    │   └───────────┬─────────────┘      │  RIE assemblers, never │  │
//    │               │ documents          │  call providers        │  │
//    │               │ (no runtime edge)  │  directly               │  │
//    │               ▼                    └───────────▲────────────┘  │
//    │   ┌───────────────────────┐                    │ evidence      │
//    │   │ Provider Acquisition   │                    │ contracts     │
//    │   │ Layer (PAL)            │────────────────────┘               │
//    │   │                         │                                    │
//    │   │  ┌──────────────────┐  │                                    │
//    │   │  │ Runtime           │  │  per-scan, ephemeral               │
//    │   │  │ ProviderRegistry   │  │◀─ lifecycle.register()             │
//    │   │  └──────────────────┘  │                                    │
//    │   └───────────┬─────────────┘                                    │
//    │               │ activates                                        │
//    │               ▼                                                  │
//    │   ┌───────────────────────┐                                     │
//    │   │ Connectors (14)        │──▶ External Providers (Apple,       │
//    │   │ AppleMusicConnector,    │    Spotify, MusicBrainz, Discogs,   │
//    │   │ SpotifyConnector, ...   │    YouTube, MLC, Deezer, TIDAL,     │
//    │   └───────────────────────┘    AudioDB, Last.fm, ACRCloud ×2,   │
//    │                                  Listen Notes, SoundCloud*,      │
//    │                                  Wikidata* (*not yet PAL-migrated)│
//    └─────────────────────────────────────────────────────────────────┘
//
//  The Engine Provider Registry has NO runtime edge into this diagram —
//  it documents the architecture, it does not participate in it. The
//  only live path from an Intelligence Engine to an external provider is
//  Engine → RIE assembler → PAL → Connector → Provider; this file is a
//  read-only map of that path for governance purposes.
//
//  ── Verification method ───────────────────────────────────────────
//
//  Every entry below was confirmed against the actual current repository
//  (connector source, env var references, merged PR history, and the
//  certification harness) at the time this registry was built — not
//  reconstructed from memory. See each entry's `certification.evidence`
//  field for the exact citation.
//
// ─────────────────────────────────────────────────────────────────────

import { Capability } from '../capability/capabilityVocabulary.js';

/** @typedef {'Active'|'Planned'|'Deprecated'} ProviderStatus */
export const ProviderStatus = Object.freeze({
  ACTIVE:     'Active',
  PLANNED:    'Planned',
  DEPRECATED: 'Deprecated',
});

/** @typedef {'Healthy'|'Degraded'|'Down'|'Unknown'} HealthStatus */
export const HealthStatus = Object.freeze({
  HEALTHY:  'Healthy',
  DEGRADED: 'Degraded',
  DOWN:     'Down',
  UNKNOWN:  'Unknown',
});

/** @typedef {'Certified'|'Uncertified'|'Not Applicable'} CertificationStatus */
export const CertificationStatus = Object.freeze({
  CERTIFIED:      'Certified',
  UNCERTIFIED:    'Uncertified',
  NOT_APPLICABLE: 'Not Applicable',
});

// Engine Groups — the Intelligence Engines/domains a provider's evidence
// feeds into. Deliberately coarser-grained than Capability (which is
// per-evidence-type); this is "which product surface cares if this
// provider goes down," not "which field it fills."
export const EngineGroup = Object.freeze({
  IDENTITY_INTELLIGENCE:   'Identity Intelligence',
  CATALOG_INTELLIGENCE:    'Catalog Intelligence',
  PUBLISHING_INTELLIGENCE: 'Publishing Intelligence',
  RECORDING_INTELLIGENCE:  'Recording Intelligence',
  TERRITORY_INTELLIGENCE:  'Territory Intelligence',
  MONITORING:              'Monitoring',
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// ── Registry ─────────────────────────────────────────────────────────
//
// Each entry's 14 fields, per the Board Implementation Brief:
//   name, engineGroups, purpose, capabilityProfile, dataTypes,
//   authMethod, endpoints, rateLimits, runtimeReference, owner, status,
//   healthStatus, certification (status + evidence), lastValidationDate

const PROVIDERS_RAW = [
  {
    id:   'apple_music',
    name: 'Apple Music',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE, EngineGroup.CATALOG_INTELLIGENCE, EngineGroup.TERRITORY_INTELLIGENCE],
    purpose: 'Canonical artist identity (Apple-as-canonical, Board-locked); catalog/release data; sole territory-availability acquisition provider (Board Decision 1, Phase 5.2).',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.GENRES, Capability.ALBUMS, Capability.RELEASES, Capability.TERRITORIES, Capability.AVAILABILITY, Capability.ISRC],
    dataTypes: ['Artist identity', 'Genres', 'Albums', 'Global storefront availability (167 markets)', 'ISRC lookup'],
    authMethod: 'JWT (ES256, team/key/private-key)',
    envVars: ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
    endpoints: ['https://api.music.apple.com/v1'],
    rateLimits: 'Not publicly documented by Apple; connector batches the 167-storefront global sweep in waves of 50 (Promise.allSettled, isolated per-wave failures).',
    runtimeReference: 'provider-acquisition/connectors/apple-music/AppleMusicConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #184 (Phase 2.2, 46/46 connector tests); Phase 5.2 territory-intelligence suite 19, 57/57 assertions; sole legacy-duplication-free 167-storefront acquisition path, certified suite 19 Group J.',
    },
    notes: 'Constitutional reference implementation for every PAL connector (Board Directive, Phase 2.2).',
  },
  {
    id:   'spotify',
    name: 'Spotify',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE, EngineGroup.CATALOG_INTELLIGENCE],
    purpose: 'Corroborating identity, release, track, and ISRC evidence. Explicitly NOT a territory-acquisition input (Board Decision 1, Phase 5.2) — Spotify removed bulk available_markets in Feb 2026; exhaustive per-market acquisition is out of scope.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.ALBUMS, Capability.TRACKS, Capability.ISRC, Capability.AVAILABILITY],
    dataTypes: ['Artist identity', 'Albums', 'Tracks', 'ISRC', 'Per-market is_playable availability (not bulk territory)'],
    authMethod: 'OAuth 2.0 client credentials',
    envVars: ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'],
    endpoints: ['https://accounts.spotify.com/api/token', 'https://api.spotify.com/v1'],
    rateLimits: 'Standard Spotify Web API tier limits; connector retries on 429.',
    runtimeReference: 'provider-acquisition/connectors/spotify/SpotifyConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #344 (commit 3a90c73), certification suite 16, 50/50 assertions. Live-API-verified during modernization: bulk available_markets confirmed removed Feb 2026, redesigned as per-market is_playable check.',
    },
    notes: null,
  },
  {
    id:   'musicbrainz',
    name: 'MusicBrainz',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE, EngineGroup.RECORDING_INTELLIGENCE, EngineGroup.PUBLISHING_INTELLIGENCE],
    purpose: 'Open-data identity cross-reference; recording/release-group evidence; publishing/songwriter/contributor/label metadata (capability-expanded Phase modernization).',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.RELEASES, Capability.PUBLISHING, Capability.SONGWRITERS, Capability.CONTRIBUTORS, Capability.LABELS, Capability.SOCIAL_LINKS],
    dataTypes: ['Artist identity', 'Release groups', 'Publishing metadata', 'Songwriters', 'Contributors', 'Labels', 'Social links'],
    authMethod: 'None — public API; required User-Agent header per MusicBrainz API etiquette (no API key).',
    envVars: [],
    endpoints: ['https://musicbrainz.org/ws/2'],
    rateLimits: '1 request/second (MusicBrainz-mandated; connector self-throttles).',
    runtimeReference: 'provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #196 (Phase 3.8) initial migration; PR #340 (commit 2f72a29) capability expansion. Certification suite 07, 96/96 assertions.',
    },
    notes: null,
  },
  {
    id:   'discogs',
    name: 'Discogs',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE, EngineGroup.CATALOG_INTELLIGENCE],
    purpose: 'Release-detail and catalog cross-reference evidence.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.RELEASES],
    dataTypes: ['Artist identity', 'Releases'],
    authMethod: 'OAuth-style consumer key/secret + required User-Agent',
    envVars: ['DISCOGS_CONSUMER_KEY', 'DISCOGS_CONSUMER_SECRET', 'DISCOGS_USER_AGENT'],
    endpoints: ['https://api.discogs.com'],
    rateLimits: '60 requests/minute (authenticated tier); connector respects Discogs rate-limit headers.',
    runtimeReference: 'provider-acquisition/connectors/discogs/DiscogsConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #197 (Phase 3.6) initial migration; PR #339 (commit 6e36739) release-detail enhancement. Certification suite 08, 79/79 assertions.',
    },
    notes: null,
  },
  {
    id:   'youtube',
    name: 'YouTube (Official Artist Channel)',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Official Artist Channel verification; channel statistics; video capability.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.COLLECTION_DATA, Capability.VIDEOS],
    dataTypes: ['Artist identity (OAC verification)', 'Channel statistics', 'Videos'],
    authMethod: 'API key',
    envVars: ['YOUTUBE_API_KEY'],
    endpoints: ['https://www.googleapis.com/youtube/v3'],
    rateLimits: 'Standard YouTube Data API v3 quota (10,000 units/day default project quota).',
    runtimeReference: 'provider-acquisition/connectors/youtube/YouTubeConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #198 (Phase 3.6) initial migration; PR #341 (commit 564b85f) VIDEOS capability + a real HealthState.UNAVAILABLE invalid-reference bug fix found and fixed during modernization. Certification suite 09, 79/79 assertions.',
    },
    notes: null,
  },
  {
    id:   'mlc',
    name: 'The MLC (Mechanical Licensing Collective)',
    engineGroups: [EngineGroup.PUBLISHING_INTELLIGENCE],
    purpose: 'Constitutional Publishing Authority — recording→song-code→musical-work hierarchy; the platform\'s sole source of publishing/rights evidence.',
    capabilityProfile: [Capability.ISRC, Capability.PUBLISHING],
    dataTypes: ['ISRC', 'Publishing works/recordings'],
    authMethod: 'OAuth refresh-token (username/password + refresh token)',
    envVars: ['MLC_API_URL', 'MLC_USERNAME', 'MLC_PASSWORD', 'MLC_REFRESH_TOKEN'],
    endpoints: ['configurable via MLC_API_URL'],
    rateLimits: 'Not publicly documented; connector applies conservative retry/backoff.',
    runtimeReference: 'provider-acquisition/connectors/mlc/MLCConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #199 (Phase 3.6) initial migration; PR #343 (commit 8b6e9af) song-code search, work-by-id, refresh-token auth. Certification suite 10, 83/83 assertions. Also the sole owner of MLC field-name parsing (lib/publishing/mlc-adapter.js, locked v1.0).',
    },
    notes: null,
  },
  {
    id:   'deezer',
    name: 'Deezer',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Streaming Verification Authority™ — independent evidence foundation for identity/presence verification.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.AVAILABILITY],
    dataTypes: ['Artist identity', 'Availability (presence signal, not territory)'],
    authMethod: 'None — public API',
    envVars: [],
    endpoints: ['https://api.deezer.com'],
    rateLimits: '50 requests/5 seconds (Deezer-documented).',
    runtimeReference: 'provider-acquisition/connectors/deezer/DeezerConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #201 (Phase 3.6) initial migration; PR #342 (commit 02fcfa2) AVAILABILITY capability. Certification suite 11, 74/74 assertions. Out of scope for territory acquisition per Board Decision 1 (Phase 5.2) — Deezer\'s AVAILABILITY capability serves identity/presence only in this architecture, not the Territory Intelligence Engine.',
    },
    notes: null,
  },
  {
    id:   'tidal',
    name: 'TIDAL',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Identity/presence verification, one of five constitutional identity providers (Phase 3C ISRC-First Verification Strategy™).',
    capabilityProfile: [Capability.ARTIST_IDENTITY],
    dataTypes: ['Artist identity'],
    authMethod: 'OAuth 2.0 client credentials',
    envVars: ['TIDAL_CLIENT_ID', 'TIDAL_CLIENT_SECRET'],
    endpoints: ['https://openapi.tidal.com'],
    rateLimits: 'Not publicly documented; connector applies conservative retry/backoff.',
    runtimeReference: 'provider-acquisition/connectors/tidal/TidalConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'Added Phase 3C (5-provider identity expansion, tag identity-intelligence-phase3c-v1.0); PR #345 (commit 12b3d5c) modernization fixed a capability under-declaration and a raw-evidence-reshaping constitutional violation found during a founder audit. Certification suite 17, 74/74 assertions.',
    },
    notes: null,
  },
  {
    id:   'audiodb',
    name: 'TheAudioDB',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE, EngineGroup.CATALOG_INTELLIGENCE],
    purpose: 'Artist & Media Intelligence Authority™ — biography, media assets, catalog cross-reference.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.ARTWORK, Capability.SOCIAL_LINKS],
    dataTypes: ['Artist identity', 'Biography', 'Artwork', 'Social links'],
    authMethod: 'Public API key (\'2\', free tier — embedded in the URL path, not a real credential).',
    envVars: [],
    endpoints: ['https://www.theaudiodb.com/api/v1/json/2'],
    rateLimits: 'Free-tier public API; no documented hard limit, connector applies conservative timeout/retry.',
    runtimeReference: 'provider-acquisition/connectors/audiodb/AudioDBConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #346 (commit 6183bc6) full constitutional audit + certification depth pass (already-compliant connector); PR #348 (commit f1916bc) fixed a live provider field-rename (strBiographyEN→strBiography, Twitter stub-value filter) found but not fixed during #346. Certification suite 12, 144/144 assertions.',
    },
    notes: null,
  },
  {
    id:   'lastfm',
    name: 'Last.fm',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Community Intelligence Authority™ — listener/community engagement evidence.',
    capabilityProfile: [Capability.ARTIST_IDENTITY, Capability.PERFORMANCE_DATA],
    dataTypes: ['Artist identity', 'Listener/community engagement stats'],
    authMethod: 'API key',
    envVars: ['LASTFM_API_KEY'],
    endpoints: ['https://ws.audioscrobbler.com/2.0'],
    rateLimits: 'Not publicly documented; connector applies conservative timeout/retry.',
    runtimeReference: 'provider-acquisition/connectors/lastfm/LastFmConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'Certification suite 13, 89/89 assertions.',
    },
    notes: null,
  },
  {
    id:   'acrcloud',
    name: 'ACRCloud (Audio Recognition)',
    engineGroups: [EngineGroup.RECORDING_INTELLIGENCE],
    purpose: 'Audio fingerprint recognition — confirms a recording\'s identity from raw audio.',
    capabilityProfile: [Capability.AUDIO_RECOGNITION],
    dataTypes: ['Audio fingerprint match results'],
    authMethod: 'HMAC-SHA1 signed request (accessKey/accessSecret/host)',
    envVars: ['(project-configured — accessKey/accessSecret/host passed via connector config, not fixed env var names)'],
    endpoints: ['configurable per ACRCloud project host'],
    rateLimits: 'Per-project ACRCloud plan quota.',
    runtimeReference: 'provider-acquisition/connectors/acrcloud/ACRCloudConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #338 (commit fdc9ff6). Capability vocabulary expansion (AUDIO_RECOGNITION) required a formal Discovery Report and Board re-authorization mid-implementation after an unauthorized capabilityVocabulary.js edit was caught and reverted. Certification suite 15, 79/79 assertions.',
    },
    notes: 'Architecturally distinct from acrcloud_ai_detection below despite the shared vendor — separate API family (Identification vs File Scanning), separate auth model (signed request vs Bearer), separate capability.',
  },
  {
    id:   'acrcloud_ai_detection',
    name: 'ACRCloud (AI Music Detection)',
    engineGroups: [EngineGroup.RECORDING_INTELLIGENCE],
    purpose: 'AI-generated music detection via ACRCloud\'s File Scanning API — asynchronous submit-and-poll model.',
    capabilityProfile: [Capability.AI_MUSIC_DETECTION],
    dataTypes: ['AI-generation detection results'],
    authMethod: 'Bearer token (pre-provisioned container; no login endpoint exists for this token type)',
    envVars: ['(project-configured — token/containerId/region passed via connector config)'],
    endpoints: ['configurable per ACRCloud File Scanning console project'],
    rateLimits: 'Per-project ACRCloud plan quota; connector enforces bounded polling (never infinite) with configurable interval/max-attempts/total-timeout.',
    runtimeReference: 'provider-acquisition/connectors/acrcloud-ai-detection/ACRCloudAIDetectionConnector.js',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: '2026-07-17',
    certification: {
      status: CertificationStatus.CERTIFIED,
      evidence: 'PR #347 (commit 012ccff), genuinely new connector (not a modernization) — distinct API family from acrcloud above. Certification suite 18, 82/82 assertions.',
    },
    notes: 'Must not create or delete its pre-provisioned container; fails clearly and constitutionally rather than attempting an implicit fallback (Board Directive, PR #347).',
  },
  {
    id:   'listen_notes',
    name: 'Listen Notes',
    engineGroups: [EngineGroup.PUBLISHING_INTELLIGENCE, EngineGroup.MONITORING],
    purpose: 'Podcast Intelligence — podcast-mention discovery. Monitoring-plan subscribers only (Brief 015o).',
    capabilityProfile: [Capability.PODCASTS],
    dataTypes: ['Podcast mentions'],
    authMethod: 'API key',
    envVars: ['LISTEN_NOTES_API_KEY'],
    endpoints: ['https://listen-api.listennotes.com'],
    rateLimits: 'Per Listen Notes plan tier; gated by isMonitoringSubscriber() before any call to conserve quota for free-tier scans.',
    runtimeReference: 'api/_lib/listen-notes.js (NOT PAL-migrated — see notes)',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.HEALTHY,
    lastValidationDate: null,
    certification: {
      status: CertificationStatus.NOT_APPLICABLE,
      evidence: 'Not PAL-migrated — direct call from api/_lib/listen-notes.js / api/_lib/podcast-intelligence.js, predates the PAL architecture. No certification suite exists for this provider today.',
    },
    notes: 'CONSTITUTIONAL CONSTRAINT (CLAUDE.md): must never be invoked from the free-tier /api/audit scan path. Sole legitimate caller is runPodcastDiscovery(), gated on isMonitoringSubscriber(). "Listen Notes" must never be named anywhere artist-facing.',
  },
  {
    id:   'soundcloud',
    name: 'SoundCloud',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Follower-count enrichment only (exact-match username/full_name lookup).',
    capabilityProfile: [],
    dataTypes: ['Follower count'],
    authMethod: '⚠️ Public client_id literal hardcoded directly in source (api/_lib/run-scan.js:1429) — not an environment variable. Flagged for remediation, not a registry violation in itself: this is a pre-existing, unmigrated legacy call, exactly the class of finding this registry exists to surface.',
    envVars: [],
    endpoints: ['https://api.soundcloud.com'],
    rateLimits: 'Not documented for this public client_id.',
    runtimeReference: 'api/_lib/run-scan.js:getSoundCloud() (NOT PAL-migrated — see notes)',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.UNKNOWN,
    lastValidationDate: null,
    certification: {
      status: CertificationStatus.NOT_APPLICABLE,
      evidence: 'Not PAL-migrated — legacy direct fetch() call inline in api/_lib/run-scan.js, predates the PAL architecture. No connector, no certification suite. Confirmed live and called on every scan via getSoundCloud().',
    },
    notes: 'CANDIDATE FOR PAL MIGRATION (ROYALTĒ v3.0 §1 finding). This is exactly the "hardcoded provider reference outside the registry" the Board\'s own rule is written to prevent — surfaced here as a pre-existing production condition, not introduced by this registry.',
  },
  {
    id:   'wikidata',
    name: 'Wikidata',
    engineGroups: [EngineGroup.IDENTITY_INTELLIGENCE],
    purpose: 'Musician-role verification enrichment only (exact-match label + musician/singer descriptor check).',
    capabilityProfile: [],
    dataTypes: ['Musician-role verification signal (not a primary identity source)'],
    authMethod: 'None — public API; User-Agent header only.',
    envVars: [],
    endpoints: ['https://www.wikidata.org/w/api.php'],
    rateLimits: 'Wikimedia REST API etiquette (no hard-documented limit for this endpoint); connector-side, unthrottled today.',
    runtimeReference: 'api/_lib/run-scan.js:getWikidata() (NOT PAL-migrated — see notes)',
    owner: 'Royaltē Engineering',
    status: ProviderStatus.ACTIVE,
    healthStatus: HealthStatus.UNKNOWN,
    lastValidationDate: null,
    certification: {
      status: CertificationStatus.NOT_APPLICABLE,
      evidence: 'Not PAL-migrated — legacy direct fetch() call inline in api/_lib/run-scan.js, predates the PAL architecture. No connector, no certification suite. Confirmed live and called on every scan via getWikidata().',
    },
    notes: 'CANDIDATE FOR PAL MIGRATION (ROYALTĒ v3.0 §1 finding), lower priority than SoundCloud since no embedded credential is involved — but still a hardcoded, unregistered call site the Board\'s rule is written to prevent.',
  },
];

export const PROVIDERS = deepFreeze(PROVIDERS_RAW);

// ── Lookup helpers ───────────────────────────────────────────────────

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export function getProvidersByEngineGroup(engineGroup) {
  return PROVIDERS.filter((p) => p.engineGroups.includes(engineGroup));
}

export function getProvidersByStatus(status) {
  return PROVIDERS.filter((p) => p.status === status);
}

export function getUncertifiedProviders() {
  return PROVIDERS.filter((p) => p.certification.status === CertificationStatus.UNCERTIFIED);
}

export function getUnmigratedProviders() {
  return PROVIDERS.filter((p) => p.runtimeReference.includes('NOT PAL-migrated'));
}
