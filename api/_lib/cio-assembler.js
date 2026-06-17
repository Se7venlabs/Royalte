// ----------------------------------------------------
//
// Royaltē Canonical Intelligence Assembly Engine™
//
// The Assembly Engine constructs Royaltē's
// Canonical Intelligence Object™.
//
// Identity Graph owns relationships.
//
// Adapters own provider normalization.
//
// CIO owns intelligence.
//
// Consumers never bypass the Assembly Engine.
//
// The CIO is immutable once assembled.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Phase 4 sole purpose: produce a deterministic, frozen
//  CanonicalIntelligenceObject from three optional source inputs by
//  SUMMARISING — never duplicating — graph + adapter + scan state.
//
//    sources = {
//      identityGraph:   { compositions?, … } | null,
//      publishingWorks: PublishingWork[]      | null,
//      scanPayload:     CanonicalAuditResponse | null,
//    }
//
//  Section ownership (Board rule):
//    identity   ← scanPayload.subject + scanPayload.source
//    publishing ← publishingWorks (counts, IPIs) + identityGraph
//                 (royalteIds)
//    catalog    ← scanPayload.catalog
//    metadata   ← scanPayload.modules / .issues  (flag count only)
//    sources    ← append-only attribution from every observation
//
//  Phase 4 NEVER:
//    - embeds PublishingWork or CompositionNode objects in the CIO
//      (per Board rule "never duplicate graph storage")
//    - computes domain-specific intelligence (Health Score, Mission
//      Control facts, Executive Brief narrative) — those belong to
//      consumers downstream
//    - mutates ANY input source (graph, adapter output, scan payload)
//    - performs I/O or persistence
//    - throws on any input (missing / null / malformed)
//
//  Determinism: the only non-deterministic input is the clock. The
//  assembler accepts an injectable `options.now: () => string` for
//  deterministic tests; the default is `() => new Date().toISOString()`.
//
//  Immutability: the returned CIO is deeply frozen. Callers receiving
//  a CIO from this engine cannot mutate it; any modification raises a
//  TypeError under strict-mode JavaScript, and silently no-ops under
//  sloppy mode. This is the contract: "The CIO is immutable once
//  assembled."

import { CIO_VERSION, emptyCio } from '../schema/cio.js';

// ─── Internal helpers ───────────────────────────────────────────────

// deepFreeze: recursively freeze an object's nested properties so the
// returned CIO satisfies the "immutable once assembled" contract.
function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

function defaultNow() {
  return new Date().toISOString();
}

// Build a single externalProfile entry from a scan payload's resolved
// source platform + artistId. Other platforms are intentionally NOT
// inferred here — only the platform the scan actually authenticated
// against. Future adapters can append additional providers.
function buildExternalProfileFromScan(scanPayload) {
  if (!scanPayload || typeof scanPayload !== 'object') return null;
  const subject  = scanPayload.subject;
  const source   = scanPayload.source;
  if (!subject || typeof subject.artistId !== 'string' || subject.artistId === '') return null;
  if (!source  || typeof source.platform !== 'string') return null;
  if (source.platform !== 'spotify' && source.platform !== 'apple_music') return null;
  return {
    provider:  source.platform === 'apple_music' ? 'apple' : 'spotify',
    profileId: subject.artistId,
    verified:  true,
  };
}

// Push a source-attribution entry into the CIO's sources[] array.
// Internal helper — operates on the unfrozen shell during assembly.
function pushSource(cio, entry) {
  cio.sources.sources.push(entry);
}

// ─── Public API ─────────────────────────────────────────────────────

// assembleCio(artistName, sources, options?)
//
// Always returns a deeply-frozen, structurally-valid CIO. Never throws.
// Deterministic given the same (artistName, sources, options.now) tuple.
//
// Sources are independently optional; passing `{}`, `null`, or
// `undefined` is equivalent to passing every sub-source as null. The
// resulting CIO is a valid empty shell whose only populated content is
// the envelope (cioVersion, generatedAt, confidence) and whatever the
// caller derived from artistName.
export function assembleCio(artistName, sources, options) {
  // ── Normalise inputs (never throws) ─────────────────────────────
  const opts        = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
  const now         = (typeof opts.now === 'function') ? opts.now : defaultNow;
  const safeSources = (sources && typeof sources === 'object' && !Array.isArray(sources)) ? sources : {};

  const identityGraph   = safeSources.identityGraph;
  const publishingWorks = safeSources.publishingWorks;
  const scanPayload     = safeSources.scanPayload;

  // ── Empty shell + envelope timestamp ────────────────────────────
  const cio = emptyCio(artistName);
  cio.generatedAt = now();

  // ── identity (from scanPayload) ─────────────────────────────────
  if (scanPayload && typeof scanPayload === 'object' && !Array.isArray(scanPayload)) {
    if (!cio.identity.canonicalArtistName
        && scanPayload.subject
        && typeof scanPayload.subject.artistName === 'string') {
      const n = scanPayload.subject.artistName.trim();
      cio.identity.canonicalArtistName = n === '' ? null : n;
    }
    const profile = buildExternalProfileFromScan(scanPayload);
    if (profile) cio.identity.externalProfiles.push(profile);

    // Apple-canonical identity fields (Stage 2B). Sourced from the
    // Apple Adapter's output as it lands in the canonical scan
    // response. Apple is canonical for artwork + Apple URL regardless
    // of whether the scan started from Spotify or Apple — these
    // values are populated whenever the adapter found the artist.
    const appleDetails = scanPayload.platforms
                      && scanPayload.platforms.appleMusic
                      && scanPayload.platforms.appleMusic.details;
    if (appleDetails && typeof appleDetails === 'object') {
      if (typeof appleDetails.artistUrl === 'string' && appleDetails.artistUrl !== '') {
        cio.identity.appleUrl = appleDetails.artistUrl;
      }
      if (typeof appleDetails.artwork === 'string' && appleDetails.artwork !== '') {
        cio.identity.artwork = appleDetails.artwork;
      }
    }
    if (scanPayload.source
        && typeof scanPayload.source.storefront === 'string'
        && scanPayload.source.storefront !== '') {
      cio.identity.storefront = scanPayload.source.storefront;
    }
  }

  // ── catalog (from scanPayload.catalog) ──────────────────────────
  if (scanPayload && scanPayload.catalog && typeof scanPayload.catalog === 'object') {
    const c = scanPayload.catalog;
    if (typeof c.totalReleases   === 'number') cio.catalog.releasesCount   = c.totalReleases;
    if (typeof c.catalogAgeYears === 'number') cio.catalog.catalogAgeYears = c.catalogAgeYears;
  }

  // ── metadata (flag count only in Phase 4) ───────────────────────
  if (scanPayload) {
    if (Array.isArray(scanPayload.issues)) {
      cio.metadata.flagCount = scanPayload.issues.length;
    } else if (Array.isArray(scanPayload.modules)) {
      cio.metadata.flagCount = scanPayload.modules.length;
    }
  }

  // ── publishing (counts + references from publishingWorks) ───────
  if (Array.isArray(publishingWorks)) {
    cio.publishing.worksCount = publishingWorks.length;

    const writerIPIs = new Set();
    for (const work of publishingWorks) {
      if (!work || typeof work !== 'object') continue;
      if (!Array.isArray(work.writers)) continue;
      for (const writer of work.writers) {
        if (writer && typeof writer.writerIPI === 'string' && writer.writerIPI !== '') {
          writerIPIs.add(writer.writerIPI);
        }
      }
    }
    cio.publishing.writerIPIs = Array.from(writerIPIs);
    cio.publishing.writerCount = cio.publishing.writerIPIs.length;
  }

  // ── publishing (royalteId references from identityGraph) ────────
  if (identityGraph
      && typeof identityGraph === 'object'
      && !Array.isArray(identityGraph)
      && Array.isArray(identityGraph.compositions)) {
    for (const comp of identityGraph.compositions) {
      if (comp && typeof comp.royalteId === 'string' && comp.royalteId !== '') {
        cio.publishing.workRoyalteIds.push(comp.royalteId);
      }
    }
  }

  // ── source attribution (append-only; preserves provider, confidence,
  //    observedAt, rawReference per Board rule) ──────────────────────

  // Identity-graph attribution — one entry summarising the snapshot.
  if (identityGraph
      && typeof identityGraph === 'object'
      && !Array.isArray(identityGraph)) {
    const compCount = Array.isArray(identityGraph.compositions) ? identityGraph.compositions.length : 0;
    pushSource(cio, {
      provider:     'identity-graph',
      confidence:   'UNKNOWN',
      observedAt:   now(),
      rawReference: `identity-graph:compositions=${compCount}`,
    });
  }

  // Publishing-adapter attribution — one entry per PublishingWork so
  // per-work provider confidence is preserved without duplicating the
  // PublishingWork itself.
  if (Array.isArray(publishingWorks)) {
    for (const work of publishingWorks) {
      pushSource(cio, {
        provider:     (work && typeof work.source     === 'string') ? work.source     : 'publishing-adapter',
        confidence:   (work && typeof work.confidence === 'string') ? work.confidence : 'UNKNOWN',
        observedAt:   (work && typeof work.lastUpdated === 'string') ? work.lastUpdated : now(),
        rawReference: `publishing-adapter:mlcSongCode=${(work && typeof work.mlcSongCode === 'string') ? work.mlcSongCode : 'unknown'}`,
      });
    }
  }

  // Scan-engine attribution — one entry per scan payload.
  if (scanPayload && typeof scanPayload === 'object' && !Array.isArray(scanPayload)) {
    pushSource(cio, {
      provider:     'scan-engine',
      confidence:   'UNKNOWN',
      observedAt:   (typeof scanPayload.scannedAt === 'string') ? scanPayload.scannedAt : now(),
      rawReference: `scan-engine:scanId=${(typeof scanPayload.scanId === 'string' && scanPayload.scanId !== '') ? scanPayload.scanId : 'unknown'}`,
    });
  }

  // ── Freeze and return — CIO is immutable once assembled ─────────
  return deepFreeze(cio);
}

// validateCio(cio) — structural validation. Returns { valid, errors }
// with stable machine-readable error codes. Never throws.
//
// Required envelope fields:
//   cioVersion, generatedAt, confidence  (non-empty strings)
// Required sections (each must be an object):
//   identity, publishing, catalog, metadata, sources, monitoring, revenue
// Required fields within sections:
//   identity.canonicalArtistName  must be a non-empty string
//   sources.sources               must be an array
export function validateCio(cio) {
  const errors = [];

  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) {
    return { valid: false, errors: ['not_an_object'] };
  }

  if (typeof cio.cioVersion  !== 'string' || cio.cioVersion  === '') errors.push('missing_cioVersion');
  if (typeof cio.generatedAt !== 'string' || cio.generatedAt === '') errors.push('missing_generatedAt');
  if (typeof cio.confidence  !== 'string' || cio.confidence  === '') errors.push('missing_confidence');

  const sectionKeys = ['identity', 'publishing', 'catalog', 'metadata', 'sources', 'monitoring', 'revenue'];
  for (const key of sectionKeys) {
    const value = cio[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`missing_${key}`);
    }
  }

  if (cio.identity && typeof cio.identity === 'object') {
    const n = cio.identity.canonicalArtistName;
    if (typeof n !== 'string' || n === '') errors.push('missing_canonicalArtistName');
  }

  if (cio.sources && typeof cio.sources === 'object') {
    if (!Array.isArray(cio.sources.sources)) errors.push('sources_array_missing');
  }

  return { valid: errors.length === 0, errors };
}

// Re-export CIO_VERSION so callers do not have to import the schema
// module directly when they only need to read the version constant.
export { CIO_VERSION };
