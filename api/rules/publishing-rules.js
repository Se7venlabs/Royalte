// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — Publishing rules
// ─────────────────────────────────────────────────────────────────────
//
//  Leaf module. Constitutional header lives in api/rules/index.js.
//  Rules are declarative; the Intelligence Engine (future phase)
//  evaluates them. Conditions are pure (cio) => boolean.
// ─────────────────────────────────────────────────────────────────────

function safePublishing(cio) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const p = cio.publishing;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  return p;
}

function safeCatalog(cio) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const c = cio.catalog;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  return c;
}

function recordingsCount(cio) {
  const cat = safeCatalog(cio);
  if (!cat) return 0;
  if (Array.isArray(cat.recordings)) return cat.recordings.length;
  if (typeof cat.releasesCount === 'number' && Number.isFinite(cat.releasesCount)) return cat.releasesCount;
  return 0;
}

export const publishingRules = Object.freeze([

  Object.freeze({
    id:              'publishing.coverage-incomplete',
    category:        'PUBLISHING',
    title:           'Publishing coverage appears incomplete',
    description:     'Identified compositions show publishing coverage below the typical threshold in reviewed sources.',
    severity:        'MEDIUM',
    confidence:      'MEDIUM',
    recommendation:  'Review composition registrations across reviewed publishing sources.',
    providerSources: [],
    condition(cio) {
      const pub = safePublishing(cio);
      if (!pub) return false;
      const works = (typeof pub.worksCount === 'number') ? pub.worksCount : 0;
      const coverage = pub.publishingCoverage;
      if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return false;
      return works > 0 && coverage < 80;
    },
  }),

  Object.freeze({
    id:              'publishing.no-registrations-with-recordings',
    category:        'PUBLISHING',
    title:           'No publishing registrations found',
    description:     'Recordings are identified in reviewed sources but no associated composition registrations were found.',
    severity:        'HIGH',
    confidence:      'HIGH',
    recommendation:  'Register compositions with a performance rights organization to claim publishing revenue.',
    providerSources: [],
    condition(cio) {
      const pub = safePublishing(cio);
      if (!pub) return false;
      const works = (typeof pub.worksCount === 'number') ? pub.worksCount : 0;
      const recs  = recordingsCount(cio);
      return works === 0 && recs > 0;
    },
  }),

  Object.freeze({
    id:              'publishing.writers-without-publishers',
    category:        'PUBLISHING',
    title:           'Writers identified but no publisher found',
    description:     'Writer information is present in reviewed sources but no publisher entries were identified.',
    severity:        'MEDIUM',
    confidence:      'MEDIUM',
    recommendation:  'Verify publishing administration arrangements for the identified writers.',
    providerSources: [],
    condition(cio) {
      const pub = safePublishing(cio);
      if (!pub) return false;
      const writers    = (typeof pub.writerCount    === 'number') ? pub.writerCount    : 0;
      const publishers = (typeof pub.publisherCount === 'number') ? pub.publisherCount : 0;
      return writers > 0 && publishers === 0;
    },
  }),

  Object.freeze({
    id:              'publishing.strong-coverage',
    category:        'PUBLISHING',
    title:           'Strong publishing coverage',
    description:     'Identified compositions show strong publishing coverage in reviewed sources.',
    severity:        'INFO',
    confidence:      'HIGH',
    recommendation:  'Maintain current registration discipline.',
    providerSources: [],
    condition(cio) {
      const pub = safePublishing(cio);
      if (!pub) return false;
      const works    = (typeof pub.worksCount === 'number') ? pub.worksCount : 0;
      const coverage = pub.publishingCoverage;
      if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return false;
      return works > 0 && coverage >= 80;
    },
  }),

]);
