// Canonical Intelligence Platform(tm) -- Severity Engine(tm)
// Board-locked deterministic severity classification rules.
// Severity is determined by domain + field name. Change type never overrides domain/field severity.

import { SEVERITY_LEVELS } from './types.js';

// Board-locked severity rule table.
// domain → { fieldName: SEVERITY_LEVEL, _default: SEVERITY_LEVEL }
// Exact field name match wins; _default applied when no exact match.
const DOMAIN_FIELD_SEVERITY = Object.freeze({
  identity: Object.freeze({
    ownership:      SEVERITY_LEVELS.CRITICAL,
    rightsholder:   SEVERITY_LEVELS.CRITICAL,
    ipi:            SEVERITY_LEVELS.CRITICAL,
    isni:           SEVERITY_LEVELS.CRITICAL,
    rights:         SEVERITY_LEVELS.CRITICAL,
    verified:       SEVERITY_LEVELS.HIGH,
    label:          SEVERITY_LEVELS.HIGH,
    distributor:    SEVERITY_LEVELS.HIGH,
    artistName:     SEVERITY_LEVELS.MEDIUM,
    genre:          SEVERITY_LEVELS.MEDIUM,
    biography:      SEVERITY_LEVELS.LOW,
    artwork:        SEVERITY_LEVELS.LOW,
    profileImage:   SEVERITY_LEVELS.LOW,
    _default:       SEVERITY_LEVELS.MEDIUM,
  }),
  publishing: Object.freeze({
    publisher:      SEVERITY_LEVELS.CRITICAL,
    coPublisher:    SEVERITY_LEVELS.CRITICAL,
    writer:         SEVERITY_LEVELS.CRITICAL,
    iswc:           SEVERITY_LEVELS.CRITICAL,
    pro:            SEVERITY_LEVELS.CRITICAL,
    rights:         SEVERITY_LEVELS.CRITICAL,
    split:          SEVERITY_LEVELS.CRITICAL,
    ownership:      SEVERITY_LEVELS.CRITICAL,
    label:          SEVERITY_LEVELS.HIGH,
    distributor:    SEVERITY_LEVELS.HIGH,
    genre:          SEVERITY_LEVELS.MEDIUM,
    artwork:        SEVERITY_LEVELS.LOW,
    _default:       SEVERITY_LEVELS.HIGH,
  }),
  recording: Object.freeze({
    isrc:           SEVERITY_LEVELS.CRITICAL,
    ownership:      SEVERITY_LEVELS.CRITICAL,
    rights:         SEVERITY_LEVELS.CRITICAL,
    label:          SEVERITY_LEVELS.HIGH,
    distributor:    SEVERITY_LEVELS.HIGH,
    releaseDate:    SEVERITY_LEVELS.MEDIUM,
    genre:          SEVERITY_LEVELS.MEDIUM,
    artwork:        SEVERITY_LEVELS.LOW,
    _default:       SEVERITY_LEVELS.MEDIUM,
  }),
  catalog: Object.freeze({
    label:          SEVERITY_LEVELS.HIGH,
    distributor:    SEVERITY_LEVELS.HIGH,
    releaseDate:    SEVERITY_LEVELS.MEDIUM,
    genre:          SEVERITY_LEVELS.MEDIUM,
    biography:      SEVERITY_LEVELS.LOW,
    profileImage:   SEVERITY_LEVELS.LOW,
    artwork:        SEVERITY_LEVELS.LOW,
    _default:       SEVERITY_LEVELS.MEDIUM,
  }),
  verification: Object.freeze({
    status:         SEVERITY_LEVELS.HIGH,
    verified:       SEVERITY_LEVELS.HIGH,
    providerLoss:   SEVERITY_LEVELS.HIGH,
    coverage:       SEVERITY_LEVELS.MEDIUM,
    _default:       SEVERITY_LEVELS.HIGH,
  }),
  distribution: Object.freeze({
    label:          SEVERITY_LEVELS.HIGH,
    distributor:    SEVERITY_LEVELS.HIGH,
    dspCoverage:    SEVERITY_LEVELS.MEDIUM,
    status:         SEVERITY_LEVELS.MEDIUM,
    _default:       SEVERITY_LEVELS.MEDIUM,
  }),
  metadata: Object.freeze({
    artistName:     SEVERITY_LEVELS.MEDIUM,
    genre:          SEVERITY_LEVELS.MEDIUM,
    biography:      SEVERITY_LEVELS.LOW,
    artwork:        SEVERITY_LEVELS.LOW,
    profileImage:   SEVERITY_LEVELS.LOW,
    _default:       SEVERITY_LEVELS.LOW,
  }),
  system: Object.freeze({
    scanComplete:   SEVERITY_LEVELS.INFORMATION,
    catalogVerified:SEVERITY_LEVELS.INFORMATION,
    rescanComplete: SEVERITY_LEVELS.INFORMATION,
    _default:       SEVERITY_LEVELS.INFORMATION,
  }),
});

// Unknown domain fallback
const UNKNOWN_DOMAIN_DEFAULT = SEVERITY_LEVELS.INFORMATION;

export function classifyChangeSeverity(domain, field) {
  const domainRules = DOMAIN_FIELD_SEVERITY[domain];
  if (!domainRules) return UNKNOWN_DOMAIN_DEFAULT;
  if (field && Object.prototype.hasOwnProperty.call(domainRules, field)) {
    return domainRules[field];
  }
  return domainRules._default;
}

export { DOMAIN_FIELD_SEVERITY };
