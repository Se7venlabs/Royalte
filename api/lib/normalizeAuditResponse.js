// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL AUDIT RESPONSE SCHEMA v1
// Single source of truth for the shape of /api/audit output.
// Every renderer (web preview, brand PDF, print PDF) MUST consume this shape.
// Any change to this file is a breaking change — bump AUDIT_RESPONSE_VERSION.
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_RESPONSE_VERSION = '1.0.0';

// ── Enums ────────────────────────────────────────────────────────────────────
export const PLATFORM_AVAILABILITY = Object.freeze({
  VERIFIED:         'VERIFIED',          // confirmed present
  NOT_FOUND:        'NOT_FOUND',         // looked, not there (real gap)
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',  // API key missing / auth failed — NOT a gap
  ERROR:            'ERROR',             // upstream API threw
});

export const COVERAGE_STATUS = Object.freeze({
  VERIFIED:      'Verified',
  NOT_CONFIRMED: 'Not Confirmed',
  NOT_CONNECTED: 'Not Connected',
});

export const MODULE_AVAILABILITY = Object.freeze({
  AVAILABLE:        'AVAILABLE',
  PARTIAL:          'PARTIAL',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
});

export const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  WARNING:  'WARNING',
  INFO:     'INFO',
});

export const RISK_LEVEL = Object.freeze({
  LOW:      'LOW',
  MODERATE: 'MODERATE',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
});

export const OWNERSHIP_STATUS = Object.freeze({
  VERIFIED:   'verified',
  UNVERIFIED: 'unverified',
  AT_RISK:    'at_risk',
});

export const OWNERSHIP_CONFIDENCE = Object.freeze({
  HIGH:             'HIGH',
  MEDIUM:           'MEDIUM',
  LOW:              'LOW',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
});

export const MODULE_KEYS = Object.freeze([
  'metadata', 'coverage', 'publishing', 'duplicates', 'youtube', 'sync',
]);

export const PLATFORM_KEYS = Object.freeze([
  'spotify', 'appleMusic', 'musicbrainz', 'deezer', 'audiodb',
  'discogs', 'soundcloud', 'lastfm', 'wikipedia', 'youtube', 'tidal',
]);

// ── Schema definition (descriptive, drives the validator below) ─────────────
export const AUDIT_RESPONSE_SCHEMA = {
  schemaVersion: { type: 'string', required: true },
  scanId:        { type: 'string', required: true },
  scannedAt:     { type: 'string', required: true, format: 'iso8601' },

  source: {
    type: 'object', required: true,
    shape: {
      platform:     { type: 'string', required: true, enum: ['spotify', 'apple_music'] },
      urlType:      { type: 'string', required: true, enum: ['artist', 'track', 'album'] },
      resolvedFrom: { type: 'string', required: true, enum: ['artist', 'track', 'album'] },
      originalUrl:  { type: 'string', required: true },
      storefront:   { type: 'string', required: false, nullable: true },
    },
  },

  subject: {
    type: 'object', required: true,
    shape: {
      artistName:      { type: 'string',  required: true },
      artistId:        { type: 'string',  required: true },
      trackTitle:      { type: 'string',  required: false, nullable: true },
      trackIsrc:       { type: 'string',  required: false, nullable: true },
      trackIsrcSource: { type: 'string',  required: false, nullable: true },
      albumName:       { type: 'string',  required: false, nullable: true },
    },
  },

  metrics: {
    type: 'object', required: true,
    shape: {
      followers:        { type: 'number', required: true },
      popularity:       { type: 'number', required: true },
      genres:           { type: 'array',  required: true, itemType: 'string' },
      // Provenance — which platform supplied the value in the corresponding field.
      // Introduced in v1.0.0 alongside multi-source fallback for Spotify's
      // abbreviated responses. Safe to ignore if the frontend doesn't care about attribution.
      followersSource:  { type: 'string', required: true, enum: ['spotify', 'deezer', 'lastfm'] },
      popularitySource: { type: 'string', required: true, enum: ['spotify', 'lastfm_derived'] },
      genresSource:     { type: 'string', required: true, enum: ['spotify', 'audiodb', 'lastfm'] },
      lastfmPlays:      { type: 'number', required: true },
      lastfmListeners:  { type: 'number', required: true },
      deezerFans:       { type: 'number', required: true },
      tidalPopularity:  { type: 'number', required: true },
      discogsReleases:  { type: 'number', required: true },
      country:          { type: 'string', required: false, nullable: true },
      wikipediaUrl:     { type: 'string', required: false, nullable: true },
    },
  },

  catalog: {
    type: 'object', required: true,
    shape: {
      totalReleases:          { type: 'number',  required: true },
      earliestYear:           { type: 'number',  required: false, nullable: true },
      latestYear:             { type: 'number',  required: false, nullable: true },
      catalogAgeYears:        { type: 'number',  required: true },
      estimatedAnnualStreams: { type: 'number',  required: true },
      recentActivity:         { type: 'boolean', required: true },
    },
  },

  platforms: {
    type: 'object', required: true,
    shapePerKey: {
      keys: PLATFORM_KEYS,
      shape: {
        availability: { type: 'string', required: true, enum: Object.values(PLATFORM_AVAILABILITY) },
        details:      { type: 'any',    required: false, nullable: true },
      },
    },
  },

  auditCoverage: {
    type: 'object', required: true,
    shape: {
      spotify:       { type: 'object', required: true, shape: _coverageEntry() },
      appleMusic:    { type: 'object', required: true, shape: _coverageEntry() },
      publishing:    { type: 'object', required: true, shape: _coverageEntry() },
      soundExchange: { type: 'object', required: true, shape: _coverageEntry() },
    },
  },

  // DEPRECATED — mirror of auditCoverage.*.status as booleans.
  // Kept for one version to avoid breaking the existing frontend.
  // TODO: remove in v2.0.0.
  auditCoverageRaw: {
    type: 'object', required: true,
    shape: {
      _deprecated: { type: 'boolean', required: true },
      spotify:     { type: 'object',  required: true, shape: { connected: { type: 'boolean', required: true } } },
      apple_music: { type: 'object',  required: true, shape: { connected: { type: 'boolean', required: true } } },
    },
  },

  modules: {
    type: 'object', required: true,
    shapePerKey: {
      keys: MODULE_KEYS,
      shape: {
        key:          { type: 'string',  required: true },
        name:         { type: 'string',  required: true },
        score:        { type: 'number',  required: true, nullable: true, min: 0, max: 100 },
        grade:        { type: 'string',  required: true, nullable: true, enum: ['A', 'B', 'C', 'D', 'F'] },
        availability: { type: 'string',  required: true, enum: Object.values(MODULE_AVAILABILITY) },
        issueCount:   { type: 'number',  required: true },
        flags:        { type: 'array',   required: true, itemType: 'string' },
      },
    },
  },

  issues: {
    type: 'array', required: true,
    itemShape: {
      id:         { type: 'string', required: true },
      module:     { type: 'string', required: true },
      moduleName: { type: 'string', required: true },
      severity:   { type: 'string', required: true, enum: Object.values(SEVERITY) },
      title:      { type: 'string', required: true },
      detail:     { type: 'string', required: true },
      source:     { type: 'string', required: true, enum: ['module', 'catalog', 'ownership', 'platform'] },
    },
  },

  score: {
    type: 'object', required: true,
    shape: {
      overall:         { type: 'number', required: true, min: 0, max: 100 },
      riskLevel:       { type: 'string', required: true, enum: Object.values(RISK_LEVEL) },
      riskSummary:     { type: 'string', required: true },
      moduleAverage:   { type: 'number', required: true, min: 0, max: 100 },
      ownershipImpact: { type: 'number', required: true },
    },
  },

  royaltyGap: {
    type: 'object', required: true,
    shape: {
      estAnnualStreams:     { type: 'number', required: true },
      estLifetimeStreams:   { type: 'number', required: true },
      estSpotifyRoyalties:  { type: 'number', required: true },
      estPROEarnings:       { type: 'number', required: true },
      estTotalRoyalties:    { type: 'number', required: true },
      potentialGapLow:      { type: 'number', required: true },
      potentialGapHigh:     { type: 'number', required: true },
      catalogYears:         { type: 'number', required: true },
      ugcUnmonetisedViews:  { type: 'number', required: true },
      ugcPotentialRevenue:  { type: 'number', required: true },
      disclaimer:           { type: 'string', required: true },
    },
  },

  proGuide: {
    type: 'object', required: true,
    shape: {
      pro:     { type: 'string', required: true },
      url:     { type: 'string', required: true },
      steps:   { type: 'array',  required: true, itemType: 'string' },
      note:    { type: 'string', required: true },
      country: { type: 'string', required: false, nullable: true },
    },
  },

  ownership: {
    type: 'object', required: true,
    shape: {
      status:      { type: 'string', required: true, enum: Object.values(OWNERSHIP_STATUS) },
      confidence:  { type: 'string', required: true, enum: Object.values(OWNERSHIP_CONFIDENCE) },
      scoreImpact: { type: 'number', required: true },
      render:      { type: 'any',    required: true }, // widget-ready payload, opaque to schema
    },
  },

  // Reserved for future engine output. Explicit null is valid; absence is NOT.
  territoryCoverage: { type: 'any', required: true, nullable: true },
  isrcValidation:    { type: 'any', required: true, nullable: true },
};

function _coverageEntry() {
  return {
    status: { type: 'string', required: true, enum: Object.values(COVERAGE_STATUS) },
    tier:   { type: 'string', required: false, nullable: true },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR
// Throws AuditSchemaError on any required-field miss or type/enum mismatch.
// Logs a warning (via optional logger) for unknown fields — forward-compat.
// Returns the payload on success (unchanged).
// ─────────────────────────────────────────────────────────────────────────────

export class AuditSchemaError extends Error {
  constructor(message, path, detail) {
    super(`[AuditSchemaError] ${message}` + (path ? ` at ${path}` : '') + (detail ? ` — ${detail}` : ''));
    this.name = 'AuditSchemaError';
    this.path = path || null;
    this.detail = detail || null;
  }
}

export function validateAuditResponse(payload, { logger = console } = {}) {
  if (payload == null || typeof payload !== 'object') {
    throw new AuditSchemaError('payload is not an object', '$', typeof payload);
  }
  if (payload.schemaVersion !== AUDIT_RESPONSE_VERSION) {
    throw new AuditSchemaError(
      'schemaVersion mismatch',
      '$.schemaVersion',
      `expected ${AUDIT_RESPONSE_VERSION}, got ${payload.schemaVersion}`
    );
  }

  const knownRootKeys = new Set(Object.keys(AUDIT_RESPONSE_SCHEMA));
  for (const k of Object.keys(payload)) {
    if (!knownRootKeys.has(k)) {
      logger?.warn?.(`[AuditSchema] unknown root key: ${k} (forward-compat — not failing)`);
    }
  }

  for (const [key, spec] of Object.entries(AUDIT_RESPONSE_SCHEMA)) {
    _validateField(payload[key], spec, `$.${key}`, logger);
  }

  return payload;
}

function _validateField(value, spec, path, logger) {
  const present = value !== undefined;
  const isNull = value === null;

  if (!present) {
    if (spec.required) {
      throw new AuditSchemaError('required field missing', path);
    }
    return;
  }

  if (isNull) {
    if (spec.nullable) return;
    throw new AuditSchemaError('field is null but not nullable', path);
  }

  // Type checks
  switch (spec.type) {
    case 'string':
      if (typeof value !== 'string') throw new AuditSchemaError(`expected string, got ${typeof value}`, path);
      if (spec.enum && !spec.enum.includes(value)) {
        throw new AuditSchemaError(`value not in enum`, path, `got "${value}", expected one of ${JSON.stringify(spec.enum)}`);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new AuditSchemaError(`expected finite number, got ${typeof value}`, path);
      }
      if (spec.min != null && value < spec.min) throw new AuditSchemaError(`below min ${spec.min}`, path, `got ${value}`);
      if (spec.max != null && value > spec.max) throw new AuditSchemaError(`above max ${spec.max}`, path, `got ${value}`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') throw new AuditSchemaError(`expected boolean, got ${typeof value}`, path);
      break;
    case 'array':
      if (!Array.isArray(value)) throw new AuditSchemaError(`expected array, got ${typeof value}`, path);
      if (spec.itemType) {
        value.forEach((item, i) => {
          if (typeof item !== spec.itemType) {
            throw new AuditSchemaError(`array item wrong type`, `${path}[${i}]`, `expected ${spec.itemType}, got ${typeof item}`);
          }
        });
      }
      if (spec.itemShape) {
        value.forEach((item, i) => _validateShape(item, spec.itemShape, `${path}[${i}]`, logger));
      }
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new AuditSchemaError(`expected object, got ${Array.isArray(value) ? 'array' : typeof value}`, path);
      }
      if (spec.shape) _validateShape(value, spec.shape, path, logger);
      if (spec.shapePerKey) _validateShapePerKey(value, spec.shapePerKey, path, logger);
      break;
    case 'any':
      // no-op — any value passes, including null when nullable
      break;
    default:
      throw new AuditSchemaError(`schema has unknown type "${spec.type}"`, path);
  }
}

function _validateShape(obj, shape, path, logger) {
  const knownKeys = new Set(Object.keys(shape));
  for (const k of Object.keys(obj)) {
    if (!knownKeys.has(k)) logger?.warn?.(`[AuditSchema] unknown key at ${path}: ${k}`);
  }
  for (const [k, spec] of Object.entries(shape)) {
    _validateField(obj[k], spec, `${path}.${k}`, logger);
  }
}

function _validateShapePerKey(obj, { keys, shape }, path, logger) {
  for (const k of keys) {
    if (!(k in obj)) throw new AuditSchemaError(`required key missing`, `${path}.${k}`);
    _validateShape(obj[k], shape, `${path}.${k}`, logger);
  }
  const keySet = new Set(keys);
  for (const k of Object.keys(obj)) {
    if (!keySet.has(k)) logger?.warn?.(`[AuditSchema] unknown key at ${path}: ${k}`);
  }
}
