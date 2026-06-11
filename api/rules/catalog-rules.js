// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — Catalog rules
// ─────────────────────────────────────────────────────────────────────
//
//  Leaf module. Constitutional header lives in api/rules/index.js.
//  Rules are declarative; the Intelligence Engine (future phase)
//  evaluates them. Conditions are pure (cio) => boolean.
// ─────────────────────────────────────────────────────────────────────

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

export const catalogRules = Object.freeze([

  Object.freeze({
    id:              'catalog.count-mismatch-across-providers',
    category:        'CATALOG',
    title:           'Catalog count inconsistency detected',
    description:     'Reviewed providers report different release counts for this artist.',
    severity:        'MEDIUM',
    confidence:      'HIGH',
    recommendation:  'Review distribution status to ensure consistent catalog delivery across reviewed sources.',
    providerSources: [],
    condition(cio) {
      const cat = safeCatalog(cio);
      if (!cat) return false;
      const byProvider = cat.byProvider;
      if (!byProvider || typeof byProvider !== 'object' || Array.isArray(byProvider)) return false;
      const numericValues = Object.values(byProvider).filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (numericValues.length < 2) return false;
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      return min !== max;
    },
  }),

  Object.freeze({
    id:              'catalog.orphan-recordings-detected',
    category:        'CATALOG',
    title:           'Orphan recordings detected',
    description:     'Recordings exist without corresponding release linkage in reviewed sources.',
    severity:        'HIGH',
    confidence:      'HIGH',
    recommendation:  'Verify catalog delivery and confirm release linkage for the affected recordings.',
    providerSources: [],
    condition(cio) {
      const cat = safeCatalog(cio);
      if (!cat) return false;
      const orphans = Array.isArray(cat.orphanRecordings) ? cat.orphanRecordings : [];
      return orphans.length > 0;
    },
  }),

  Object.freeze({
    id:              'catalog.complete-delivery-verified',
    category:        'CATALOG',
    title:           'Complete catalog delivery verified',
    description:     'All identified recordings have corresponding release linkage in reviewed sources.',
    severity:        'INFO',
    confidence:      'HIGH',
    recommendation:  'Continue current catalog delivery practices.',
    providerSources: [],
    condition(cio) {
      const recs = recordingsCount(cio);
      if (recs <= 0) return false;
      const cat = safeCatalog(cio);
      if (!cat) return false;
      const orphans = Array.isArray(cat.orphanRecordings) ? cat.orphanRecordings : [];
      return orphans.length === 0;
    },
  }),

]);
