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

// Read a publishing source observation (Board Directive v2.0 — 4-state model).
// Returns { availability, details } or null. Null = Unable to Confirm → no deduction.
// Never treats null as Not Found per cio-assembler.js Board D5 contract.
function safePublishingSource(cio, provider) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const o = cio.observations;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const ps = o.publishingSources;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return null;
  const entry = ps[provider];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry;
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
    // Board Directive v2.0: title scoped to "reviewed sources" — absence in MLC
    // does not imply global PRO absence (artist may be registered with SOCAN,
    // PRS, ASCAP, or others not yet reviewed). Severity downgraded HIGH→MEDIUM.
    title:           'No composition registrations found in reviewed publishing sources',
    description:     'Recordings are identified but no associated composition registrations were found in currently reviewed publishing sources. This finding is limited to the sources reviewed and does not indicate that registrations are absent from all publishing registries.',
    severity:        'MEDIUM',
    confidence:      'HIGH',
    recommendation:  'Verify composition registrations across publishing partners to ensure royalty collection is active in all reviewed sources.',
    providerSources: [],
    condition(cio) {
      // Board Directive v2.0: gate on a VERIFIED publishing source observation.
      // Without a verified observation, absence cannot be confirmed — Unable to
      // Confirm status carries no deduction per the new scoring model.
      const mlc = safePublishingSource(cio, 'mlc');
      if (!mlc || mlc.availability !== 'VERIFIED') return false;
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
    polarity:        'positive',
    condition(cio) {
      const pub = safePublishing(cio);
      if (!pub) return false;
      const works    = (typeof pub.worksCount === 'number') ? pub.worksCount : 0;
      const coverage = pub.publishingCoverage;
      if (typeof coverage !== 'number' || !Number.isFinite(coverage)) return false;
      return works > 0 && coverage >= 80;
    },
  }),

  // Board Directive v2.0 — ISWC is the primary verified rights indicator.
  // Fires when a publishing source confirms ISWC assignments for identified
  // compositions. ISWC presence = verified entry into the international
  // music rights ecosystem.
  Object.freeze({
    id:              'publishing.iswc-verified',
    category:        'PUBLISHING',
    title:           'Composition rights registration verified',
    description:     'ISWC assignments have been confirmed for identified compositions in reviewed publishing sources, indicating verified entry into the international music rights ecosystem.',
    severity:        'INFO',
    confidence:      'HIGH',
    recommendation:  'Maintain current registration discipline and ensure new compositions receive ISWC assignments promptly.',
    providerSources: [],
    polarity:        'positive',
    condition(cio) {
      const mlc = safePublishingSource(cio, 'mlc');
      if (!mlc || mlc.availability !== 'VERIFIED') return false;
      const d = mlc.details;
      if (!d || typeof d !== 'object') return false;
      return typeof d.iswcCount === 'number' && d.iswcCount > 0;
    },
  }),

]);
