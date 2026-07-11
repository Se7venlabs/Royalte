// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Provider Registry
// ─────────────────────────────────────────────────────────────────────────────
//
// The single source of truth for every evidence provider Royaltē recognises.
//
// No connector, contract, or intelligence module may hardcode provider names.
// All provider identifiers are looked up from this registry.
//
// Provider shape:
//   id            — stable kebab-case identifier; permanent; never changes
//   displayName   — human-readable name used in UI and reporting
//   category      — primary provider category (see PROVIDER_CATEGORIES in types.js)
//   version       — current provider API version this connector targets
//   status        — ACTIVE | DEPRECATED | RESERVED
//   capabilities  — evidence categories this provider can contribute
//
// ─────────────────────────────────────────────────────────────────────────────

import { EVIDENCE_CATEGORIES } from './types.js';

const { IDENTITY, RIGHTS, CATALOG, DISTRIBUTION, MONITORING, OPERATIONS } = EVIDENCE_CATEGORIES;

export const PROVIDERS = Object.freeze([

  // ── Streaming Platforms ───────────────────────────────────────────────────

  {
    id:           'apple-music',
    displayName:  'Apple Music',
    category:     'Streaming',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, DISTRIBUTION],
  },
  {
    id:           'spotify',
    displayName:  'Spotify',
    category:     'Streaming',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, DISTRIBUTION],
  },
  {
    id:           'deezer',
    displayName:  'Deezer',
    category:     'Streaming',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, DISTRIBUTION],
  },
  {
    id:           'tidal',
    displayName:  'TIDAL',
    category:     'Streaming',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, DISTRIBUTION],
  },
  {
    id:           'youtube',
    displayName:  'YouTube',
    category:     'Streaming',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, MONITORING],
  },

  // ── Metadata Authorities ──────────────────────────────────────────────────

  {
    id:           'musicbrainz',
    displayName:  'MusicBrainz',
    category:     'Metadata',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, RIGHTS],
  },
  {
    id:           'discogs',
    displayName:  'Discogs',
    category:     'Metadata',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG, RIGHTS],
  },
  {
    id:           'the-audio-db',
    displayName:  'TheAudioDB',
    category:     'Metadata',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, CATALOG],
  },
  {
    id:           'lastfm',
    displayName:  'Last.fm',
    category:     'Metadata',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, MONITORING],
  },

  // ── Publishing & Rights Authorities ──────────────────────────────────────

  {
    id:           'mlc',
    displayName:  'MLC',
    category:     'Publishing',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [RIGHTS],
  },
  {
    id:           'socan',
    displayName:  'SOCAN',
    category:     'Publishing',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [RIGHTS],
  },
  {
    id:           'ascap',
    displayName:  'ASCAP',
    category:     'Publishing',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [RIGHTS],
  },
  {
    id:           'bmi',
    displayName:  'BMI',
    category:     'Publishing',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [RIGHTS],
  },
  {
    id:           'sound-exchange',
    displayName:  'SoundExchange',
    category:     'Rights',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [RIGHTS],
  },

  // ── Internal / First-Party ────────────────────────────────────────────────

  {
    id:           'artist-verified-profile',
    displayName:  'Artist Verified Profile',
    category:     'Internal',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY],
  },
  {
    id:           'manual-override',
    displayName:  'Manual Override',
    category:     'Internal',
    version:      '1.0',
    status:       'ACTIVE',
    capabilities: [IDENTITY, RIGHTS, CATALOG, DISTRIBUTION, MONITORING, OPERATIONS],
  },

]);

// O(1) lookup set — stable provider IDs
export const VALID_PROVIDER_IDS = new Set(PROVIDERS.map((p) => p.id));

// O(1) lookup map — provider objects by ID
export const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));
