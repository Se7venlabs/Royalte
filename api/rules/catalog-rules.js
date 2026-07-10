// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — Catalog rules
// ─────────────────────────────────────────────────────────────────────
//
//  Leaf module. Constitutional header lives in api/rules/index.js.
//  Rules are declarative; the Intelligence Engine evaluates them.
//  Conditions are pure (cio) => boolean.
//
//  Phase 6D — Canonical Catalog Model™ migration layer:
//    catalogField(cio, fieldName) — dual-read: catalogModel first, legacy fallback
//    readonlyCatalogValue(cio, v) — deep-frozen clone; cache scoped to CIO lifetime
// ─────────────────────────────────────────────────────────────────────

function safeCatalog(cio) {
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) return null;
  const c = cio.catalog;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  return c;
}

function deepFreeze(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return obj;

  seen.add(obj);
  Object.freeze(obj);

  for (const value of Object.values(obj)) {
    deepFreeze(value, seen);
  }

  return obj;
}

// Outer WeakMap is keyed by the root CIO object.
// Each scan evaluation receives its own immutable cache shard.
// The inner WeakMap caches frozen structuredClone() results for
// catalog objects encountered during that evaluation.
// When the CIO graph becomes unreachable, the entire cache shard
// becomes eligible for garbage collection automatically.
const _evalCaches = new WeakMap();

function readonlyCatalogValue(cio, value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  let cache = _evalCaches.get(cio);
  if (!cache) {
    cache = new WeakMap();
    _evalCaches.set(cio, cache);
  }
  if (cache.has(value)) {
    return cache.get(value);
  }
  const frozen = deepFreeze(structuredClone(value));
  cache.set(value, frozen);
  return frozen;
}

function catalogField(cio, fieldName) {
  const c = safeCatalog(cio);
  if (!c) return undefined;
  const model = c.catalogModel;
  if (model && typeof model === 'object' && !Array.isArray(model) && Object.prototype.hasOwnProperty.call(model, fieldName)) {
    return readonlyCatalogValue(cio, model[fieldName]);
  }
  if (Object.prototype.hasOwnProperty.call(c, fieldName)) {
    return readonlyCatalogValue(cio, c[fieldName]);
  }
  return undefined;
}

// Derives orphan count using releaseIds[] semantics on Canonical Catalog Model™.
// Falls back to legacy orphanRecordings[] when catalogModel is absent.
function orphanCount(cio) {
  const c = safeCatalog(cio);
  if (!c) return 0;
  const model = c.catalogModel;
  if (model && typeof model === 'object' && !Array.isArray(model) && Array.isArray(model.recordings)) {
    return model.recordings.filter(
      (r) => r && Array.isArray(r.releaseIds) && r.releaseIds.length === 0
    ).length;
  }
  if (Object.prototype.hasOwnProperty.call(c, 'orphanRecordings') && Array.isArray(c.orphanRecordings)) {
    return c.orphanRecordings.length;
  }
  return 0;
}

function recordingsCount(cio) {
  const c = safeCatalog(cio);
  if (!c) return 0;
  const model = c.catalogModel;
  if (model && typeof model === 'object' && !Array.isArray(model)) {
    if (Array.isArray(model.recordings)) return model.recordings.length;
    if (typeof model.releasesCount === 'number' && Number.isFinite(model.releasesCount)) return model.releasesCount;
  }
  if (Array.isArray(c.recordings)) return c.recordings.length;
  if (typeof c.releasesCount === 'number' && Number.isFinite(c.releasesCount)) return c.releasesCount;
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
      const byProvider = catalogField(cio, 'byProvider');
      if (!byProvider || typeof byProvider !== 'object' || Array.isArray(byProvider)) return false;
      const numericValues = Object.values(byProvider).filter(
        (v) => typeof v === 'number' && Number.isFinite(v)
      );
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
      return orphanCount(cio) > 0;
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
    polarity:        'positive',
    condition(cio) {
      const recs = recordingsCount(cio);
      if (recs <= 0) return false;
      return orphanCount(cio) === 0;
    },
  }),

]);
