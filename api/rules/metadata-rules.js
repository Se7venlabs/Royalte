// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — Metadata rules
// ─────────────────────────────────────────────────────────────────────
//
//  Leaf module. Constitutional header lives in api/rules/index.js.
//  Rules are declarative; the Intelligence Engine (future phase)
//  evaluates them. Conditions are pure (cio) => boolean.
// ─────────────────────────────────────────────────────────────────────

function safeMetadata(cio) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const m = cio.metadata;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  return m;
}

export const metadataRules = Object.freeze([

  Object.freeze({
    id:              'metadata.missing-credits',
    category:        'METADATA',
    title:           'Missing credits detected',
    description:     'One or more credits are missing from release metadata in reviewed sources.',
    severity:        'LOW',
    confidence:      'HIGH',
    recommendation:  'Complete metadata credits with the relevant distribution partners.',
    providerSources: [],
    condition(cio) {
      const md = safeMetadata(cio);
      if (!md) return false;
      const arr = Array.isArray(md.missingCredits) ? md.missingCredits : [];
      return arr.length > 0;
    },
  }),

  Object.freeze({
    id:              'metadata.duplicate-releases',
    category:        'METADATA',
    title:           'Duplicate releases detected',
    description:     'Releases appear duplicated across reviewed metadata sources.',
    severity:        'MEDIUM',
    confidence:      'HIGH',
    recommendation:  'Audit catalog for duplicates and consolidate where appropriate.',
    providerSources: [],
    condition(cio) {
      const md = safeMetadata(cio);
      if (!md) return false;
      const arr = Array.isArray(md.duplicateReleases) ? md.duplicateReleases : [];
      return arr.length > 0;
    },
  }),

  Object.freeze({
    id:              'metadata.inconsistent-fields',
    category:        'METADATA',
    title:           'Metadata inconsistencies found',
    description:     'Metadata fields show inconsistencies across reviewed sources.',
    severity:        'LOW',
    confidence:      'MEDIUM',
    recommendation:  'Standardize metadata across reviewed distribution partners.',
    providerSources: [],
    condition(cio) {
      const md = safeMetadata(cio);
      if (!md) return false;
      const arr = Array.isArray(md.inconsistentMetadata) ? md.inconsistentMetadata : [];
      return arr.length > 0;
    },
  }),

]);
