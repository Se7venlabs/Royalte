// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Intelligence Assembly Engine™ — tests (Phase 4)
// ─────────────────────────────────────────────────────────────────────
//
//  Board-ratified Phase 4 brief (2026-06-10). Covers every checkmark
//  from the brief's testing section:
//
//    ✅ Empty graph
//    ✅ Publishing graph
//    ✅ Identity graph
//    ✅ Missing providers
//    ✅ Null-safe operation
//    ✅ Source attribution preserved
//    ✅ Confidence preserved
//    ✅ Identical input = identical output
//    ✅ Graph immutability
//    ✅ Provider immutability
//    ✅ Reserved sections exist
//    ✅ Assembler never throws
//
//  Plus immutability of the assembled CIO itself (Phase 4 contract:
//  "The CIO is immutable once assembled").
//
//  Determinism strategy: every test that compares CIO outputs across
//  multiple calls injects a fixed clock via options.now, so generatedAt
//  and per-source observedAt are bit-identical across runs.
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/cio-assembler-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import {
  assembleCio,
  validateCio,
} from '../api/_lib/cio-assembler.js';
import { CIO_VERSION } from '../api/schema/cio.js';

// ─── Fixed clock for determinism ─────────────────────────────────────

const FIXED_NOW = '2026-06-10T20:00:00.000Z';
const fixedNow  = () => FIXED_NOW;
const OPTS      = { now: fixedNow };

// ─── Fixture builders ────────────────────────────────────────────────

function publishingWork({ suffix, source = 'mlc', confidence = 'MEDIUM' } = {}) {
  return {
    title:          `Work ${suffix}`,
    canonicalTitle: `Work ${suffix}`,
    mlcSongCode:    `MLC_${suffix}`,
    iswc:           `T-${suffix}`,
    writers: [{
      writerIPI: `IPI_${suffix}`,
      firstName: 'Writer',
      lastName:  suffix,
      fullName:  `Writer ${suffix}`,
      role:      'Composer',
    }],
    publishers:     [],
    source,
    rawMlcResponse: { mlcSongCode: `MLC_${suffix}` },
    lastUpdated:    '2026-06-10T19:00:00.000Z',
    confidence,
  };
}

function compositionNode(suffix) {
  return {
    royalteId: `rc_test_${suffix}`,
    externalIds: { mlc: `MLC_${suffix}`, socan: null, ascap: null, bmi: null, cisac: null, musicbrainz: null },
    iswc: `T-${suffix}`,
    title: `Composition ${suffix}`,
    canonicalTitle: `Composition ${suffix}`,
    writers: [{
      writerIPI: `IPI_${suffix}`,
      firstName: 'Writer',
      lastName:  suffix,
      fullName:  `Writer ${suffix}`,
      role:      'Composer',
      providerConfidence: 'MEDIUM',
    }],
    publishers: [],
    recordings: [],
    sources: [{
      provider:    'mlc',
      confidence:  'MEDIUM',
      attribution: { mlcSongCode: `MLC_${suffix}` },
      observedAt:  '2026-06-10T19:00:00.000Z',
    }],
    addedAt:        '2026-06-10T19:00:00.000Z',
    lastObservedAt: '2026-06-10T19:00:00.000Z',
    confidence:     'UNKNOWN',
  };
}

function scanPayload({
  scanId      = 'scan-test',
  artistName  = 'Test Artist',
  trackIsrc   = null,
  trackTitle  = null,
  platform    = 'spotify',
  artistId    = 'art_123',
  totalReleases = null,
  catalogAgeYears = null,
  modules     = null,
  issues      = null,
} = {}) {
  return {
    scanId,
    scannedAt: '2026-06-10T19:30:00.000Z',
    source:    { platform, urlType: 'artist' },
    subject:   { artistName, artistId, trackIsrc, trackTitle },
    catalog:   (totalReleases !== null || catalogAgeYears !== null)
                ? { totalReleases, catalogAgeYears }
                : undefined,
    modules:   modules || undefined,
    issues:    issues  || undefined,
  };
}

// ─── Test harness ────────────────────────────────────────────────────

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓  ${name}`);
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e?.message || e}`);
    process.exit(1);
  }
}

// ═════════════════════════════════════════════════════════════════════
//  Deterministic assertions covering every Board-listed test area
// ═════════════════════════════════════════════════════════════════════

test('1. EMPTY GRAPH — assembleCio with no sources returns a valid CIO', () => {
  const cio = assembleCio('Artist 1', {}, OPTS);
  const v = validateCio(cio);
  assert.equal(v.valid, true, `expected valid, got: ${JSON.stringify(v.errors)}`);
  assert.equal(cio.cioVersion,  CIO_VERSION);
  assert.equal(cio.generatedAt, FIXED_NOW);
  assert.equal(cio.confidence,  'UNKNOWN');
  assert.equal(cio.identity.canonicalArtistName, 'Artist 1');
});

test('2. PUBLISHING GRAPH — publishingWorks summarised into counts + writer IPIs', () => {
  const works = [
    publishingWork({ suffix: 'A' }),
    publishingWork({ suffix: 'B' }),
    publishingWork({ suffix: 'C' }),
  ];
  const cio = assembleCio('Artist 2', { publishingWorks: works }, OPTS);
  assert.equal(cio.publishing.worksCount, 3);
  // writerIPIs are deduped; one IPI per work in the fixture → 3 unique
  assert.equal(cio.publishing.writerCount, 3);
  // Copy the frozen array before sorting (frozen arrays cannot be mutated
  // — sort() would throw — which is exactly the immutability contract).
  assert.deepStrictEqual(
    [...cio.publishing.writerIPIs].sort(),
    ['IPI_A', 'IPI_B', 'IPI_C'].sort(),
  );
  // CRITICAL — no PublishingWork objects embedded in the CIO
  assert.equal(cio.publishing.publishingWorks, undefined,
    'publishingWorks must NOT be embedded — CIO summarises, never duplicates graph storage');
});

test('3. IDENTITY GRAPH — composition royalteIds become references in publishing.workRoyalteIds', () => {
  const comps = [compositionNode('X'), compositionNode('Y'), compositionNode('Z')];
  const cio = assembleCio('Artist 3', { identityGraph: { compositions: comps } }, OPTS);
  // CRITICAL — only royalteId references, not embedded CompositionNodes.
  // Copy before sorting; the assembled CIO's arrays are frozen.
  assert.deepStrictEqual(
    [...cio.publishing.workRoyalteIds].sort(),
    ['rc_test_X', 'rc_test_Y', 'rc_test_Z'].sort(),
  );
  assert.equal(cio.publishing.compositions, undefined,
    'CompositionNodes must NOT be embedded — CIO carries references only');
  // Identity Graph attribution recorded
  const igEntries = cio.sources.sources.filter((s) => s.provider === 'identity-graph');
  assert.equal(igEntries.length, 1);
  assert.equal(igEntries[0].rawReference, 'identity-graph:compositions=3');
});

test('4. MISSING PROVIDERS — every section reachable, no throw, empty defaults', () => {
  const cio = assembleCio('Artist 4', { publishingWorks: null }, OPTS);
  assert.equal(cio.publishing.worksCount, 0);
  assert.deepStrictEqual(cio.publishing.workRoyalteIds, []);
  assert.deepStrictEqual(cio.publishing.writerIPIs,     []);
  assert.equal(cio.publishing.writerCount,    0);
  assert.equal(cio.publishing.publisherCount, 0);
  assert.equal(cio.catalog.releasesCount,   null);
  assert.equal(cio.catalog.catalogAgeYears, null);
  assert.equal(cio.metadata.flagCount, 0);
});

test('5. NULL-SAFE — all sources null produces a valid empty CIO', () => {
  const cio = assembleCio('Artist 5', { identityGraph: null, publishingWorks: null, scanPayload: null }, OPTS);
  assert.equal(validateCio(cio).valid, true);
  assert.equal(cio.sources.sources.length, 0);
});

test('6. SOURCE ATTRIBUTION PRESERVED — every observation appended', () => {
  const sources = {
    publishingWorks: [publishingWork({ suffix: 'S1' }), publishingWork({ suffix: 'S2' })],
    identityGraph:   { compositions: [compositionNode('S')] },
    scanPayload:     scanPayload({ scanId: 'src-1' }),
  };
  const cio = assembleCio('Artist 6', sources, OPTS);
  const providers = cio.sources.sources.map((s) => s.provider);
  // One per publishingWork + one identity-graph + one scan-engine = 4
  assert.equal(cio.sources.sources.length, 4);
  assert.equal(providers.filter((p) => p === 'mlc').length, 2);
  assert.ok(providers.includes('identity-graph'));
  assert.ok(providers.includes('scan-engine'));
});

test('7. CONFIDENCE PRESERVED — per-source provider confidence carried through', () => {
  const sources = {
    publishingWorks: [
      publishingWork({ suffix: 'HI', confidence: 'HIGH' }),
      publishingWork({ suffix: 'LO', confidence: 'LOW'  }),
    ],
  };
  const cio = assembleCio('Artist 7', sources, OPTS);
  const confidences = cio.sources.sources
    .filter((s) => s.provider === 'mlc')
    .map((s) => s.confidence);
  assert.ok(confidences.includes('HIGH'));
  assert.ok(confidences.includes('LOW'));
  // Envelope confidence stays UNKNOWN — graph never aggregates
  assert.equal(cio.confidence, 'UNKNOWN');
  assert.equal(cio.publishing.publishingConfidence, 'UNKNOWN');
});

test('8. DETERMINISTIC — identical input → identical CIO output', () => {
  const sources = {
    publishingWorks: [publishingWork({ suffix: 'D' })],
    identityGraph:   { compositions: [compositionNode('D')] },
    scanPayload:     scanPayload({ scanId: 'det-1', artistName: 'Det Artist' }),
  };
  const a = assembleCio('Det Artist', sources, OPTS);
  const b = assembleCio('Det Artist', sources, OPTS);
  assert.deepStrictEqual(a, b);
});

test('9. GRAPH IMMUTABILITY — assembleCio never mutates the identityGraph input', () => {
  const comp     = compositionNode('IM');
  const graphRef = { compositions: [comp] };
  const before   = JSON.parse(JSON.stringify(graphRef));
  assembleCio('Artist 9', { identityGraph: graphRef }, OPTS);
  const after    = JSON.parse(JSON.stringify(graphRef));
  assert.deepStrictEqual(after, before);
});

test('10. PROVIDER IMMUTABILITY — assembleCio never mutates publishingWorks entries', () => {
  const work     = publishingWork({ suffix: 'PI' });
  const worksRef = [work];
  const before   = JSON.parse(JSON.stringify(worksRef));
  assembleCio('Artist 10', { publishingWorks: worksRef }, OPTS);
  const after    = JSON.parse(JSON.stringify(worksRef));
  assert.deepStrictEqual(after, before);
});

test('11. RESERVED SECTIONS — monitoring + revenue exist as { reserved: true } placeholders', () => {
  const cio = assembleCio('Artist 11', {}, OPTS);
  assert.equal(typeof cio.monitoring, 'object');
  assert.equal(cio.monitoring.reserved, true);
  assert.equal(typeof cio.revenue, 'object');
  assert.equal(cio.revenue.reserved, true);
  // No other keys leak into the reserved sections
  assert.deepStrictEqual(Object.keys(cio.monitoring), ['reserved']);
  assert.deepStrictEqual(Object.keys(cio.revenue),    ['reserved']);
});

test('12. ASSEMBLER NEVER THROWS on garbage inputs', () => {
  // Inputs the assembler should treat as null / equivalent-to-empty
  const garbageInputs = [
    null, undefined, 42, 'string', [], true, false,
    { identityGraph:   42 },
    { publishingWorks: 'not-an-array' },
    { scanPayload:     [] },
    { identityGraph:   { compositions: 'not-an-array' } },
    { identityGraph:   { compositions: [null, 'x', {}, { royalteId: '' }] } },
    { publishingWorks: [null, undefined, {}, 'x'] },
  ];
  for (const input of garbageInputs) {
    let result;
    assert.doesNotThrow(() => { result = assembleCio('Artist 12', input, OPTS); });
    assert.ok(result);
    assert.equal(result.cioVersion, CIO_VERSION);
  }
  // And garbage artistName
  for (const name of [null, undefined, 42, '', '   ', {}, []]) {
    let cio;
    assert.doesNotThrow(() => { cio = assembleCio(name, {}, OPTS); });
    assert.equal(cio.identity.canonicalArtistName, null);
  }
});

test('13. IMMUTABLE ONCE ASSEMBLED — the returned CIO is deeply frozen', () => {
  const cio = assembleCio('Artist 13', {
    publishingWorks: [publishingWork({ suffix: 'F' })],
    identityGraph:   { compositions: [compositionNode('F')] },
  }, OPTS);
  assert.ok(Object.isFrozen(cio),                  'CIO root must be frozen');
  assert.ok(Object.isFrozen(cio.identity),         'identity must be frozen');
  assert.ok(Object.isFrozen(cio.publishing),       'publishing must be frozen');
  assert.ok(Object.isFrozen(cio.publishing.workRoyalteIds), 'workRoyalteIds must be frozen');
  assert.ok(Object.isFrozen(cio.publishing.writerIPIs),     'writerIPIs must be frozen');
  assert.ok(Object.isFrozen(cio.catalog),          'catalog must be frozen');
  assert.ok(Object.isFrozen(cio.metadata),         'metadata must be frozen');
  assert.ok(Object.isFrozen(cio.sources),          'sources must be frozen');
  assert.ok(Object.isFrozen(cio.sources.sources),  'sources.sources must be frozen');
  assert.ok(Object.isFrozen(cio.monitoring),       'monitoring must be frozen');
  assert.ok(Object.isFrozen(cio.revenue),          'revenue must be frozen');
  // Mutation attempts must throw under strict mode
  assert.throws(() => { cio.confidence = 'HIGH'; });
  assert.throws(() => { cio.sources.sources.push({}); });
});

test('14. validateCio passes on a fresh CIO, fails on missing cioVersion + canonicalArtistName', () => {
  const cio = assembleCio('Artist 14', {}, OPTS);
  // Pass case
  const pass = validateCio(cio);
  assert.equal(pass.valid, true);
  assert.deepStrictEqual(pass.errors, []);
  // Synthesise broken copies (cio is frozen, so build replicas)
  const replica = JSON.parse(JSON.stringify(cio));
  const noVersion = { ...replica, cioVersion: '' };
  const r1 = validateCio(noVersion);
  assert.equal(r1.valid, false);
  assert.ok(r1.errors.includes('missing_cioVersion'));
  const noName = { ...replica, identity: { ...replica.identity, canonicalArtistName: '' } };
  const r2 = validateCio(noName);
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.includes('missing_canonicalArtistName'));
  // Non-object input
  assert.equal(validateCio(null).valid,      false);
  assert.equal(validateCio(undefined).valid, false);
  assert.equal(validateCio(42).valid,        false);
  assert.equal(validateCio([]).valid,        false);
});

test('15. NO PROVIDER-SPECIFIC TOP-LEVEL KEYS in the assembled CIO', () => {
  const cio = assembleCio('Artist 15', {
    publishingWorks: [publishingWork({ suffix: 'L' })],
    identityGraph:   { compositions: [compositionNode('L')] },
    scanPayload:     scanPayload({ scanId: 'leak-test' }),
  }, OPTS);
  const topKeys = Object.keys(cio);
  for (const providerName of ['mlc', 'spotify', 'apple', 'youtube', 'musicbrainz', 'discogs', 'deezer', 'soundcloud', 'lastfm', 'tidal']) {
    assert.ok(!topKeys.includes(providerName), `${providerName} must not be a top-level CIO key`);
  }
  // Approved Phase 4 top-level keys + Phase 3B `observations` section
  // (Board D2, 2026-06-17): per-provider scan observations live in a
  // sibling section to keep cio.identity lean and locked.
  const approved = new Set([
    'cioVersion', 'generatedAt', 'confidence',
    'identity', 'publishing', 'catalog', 'metadata', 'sources',
    'observations',
    'monitoring', 'revenue',
  ]);
  for (const k of topKeys) {
    assert.ok(approved.has(k), `unexpected top-level key: ${k}`);
  }
});

test('16. SCAN PAYLOAD INTEGRATION — identity + catalog + metadata populated correctly from scan', () => {
  const cio = assembleCio('Artist 16', {
    scanPayload: scanPayload({
      scanId:          'scan-16',
      artistName:      'Artist From Scan',
      platform:        'apple_music',
      artistId:        'apple_456',
      totalReleases:   42,
      catalogAgeYears: 7,
      issues:          [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    }),
  }, OPTS);
  // Caller's artistName wins over scan-derived ("Artist 16" not "Artist From Scan")
  assert.equal(cio.identity.canonicalArtistName, 'Artist 16');
  // External profile derived from scan
  assert.equal(cio.identity.externalProfiles.length, 1);
  assert.equal(cio.identity.externalProfiles[0].provider, 'apple');
  assert.equal(cio.identity.externalProfiles[0].profileId, 'apple_456');
  // Catalog summary
  assert.equal(cio.catalog.releasesCount,   42);
  assert.equal(cio.catalog.catalogAgeYears, 7);
  // Metadata flag count
  assert.equal(cio.metadata.flagCount, 3);
  // Scan-engine attribution
  const scanEntry = cio.sources.sources.find((s) => s.provider === 'scan-engine');
  assert.ok(scanEntry);
  assert.equal(scanEntry.rawReference, 'scan-engine:scanId=scan-16');
});

test('17. CALLER-OMITTED artistName falls back to scanPayload.subject.artistName', () => {
  const cio = assembleCio(null, {
    scanPayload: scanPayload({ scanId: 'fallback', artistName: 'Scan Derived Artist' }),
  }, OPTS);
  assert.equal(cio.identity.canonicalArtistName, 'Scan Derived Artist');
});

// ═════════════════════════════════════════════════════════════════════
//  Phase 6C — Canonical Catalog Model™ reference (tests 18–22)
// ═════════════════════════════════════════════════════════════════════
//
//  These tests enforce the "CIO references the Catalog Model; it never
//  duplicates it" architectural invariant (Board directive 2026-06-20).

const SAMPLE_CATALOG_MODEL = Object.freeze({
  modelVersion:       '1.0.0',
  catalogVersion:     null,
  releases:           Object.freeze([Object.freeze({ releaseId: 'rl_abc123', title: 'Album One', providers: Object.freeze(['apple']) })]),
  recordings:         Object.freeze([Object.freeze({ isrc: 'USTEST00001', title: 'Track One', releaseIds: Object.freeze(['rl_abc123']), providers: Object.freeze(['apple']) })]),
  byProvider:         Object.freeze({ apple: 1, spotify: null }),
  releasesCount:      1,
  earliestYear:       2021,
  latestYear:         2021,
  catalogAgeYears:    5,
  recentActivity:     false,
  catalogSync:        null,
  storefrontCoverage: null,
  upcCoverage:        null,
  contributorData:    null,
});

test('18. CATALOG MODEL — catalogModel reference stored when present in scan payload', () => {
  const cio = assembleCio('Artist 18', {
    scanPayload: {
      scanId:    'scan-18',
      scannedAt: '2026-06-20T00:00:00.000Z',
      source:    { platform: 'apple_music', urlType: 'artist' },
      subject:   { artistName: 'Artist 18', artistId: 'art_18' },
      catalog:   { totalReleases: 1, catalogAgeYears: 5, catalogModel: SAMPLE_CATALOG_MODEL },
    },
  }, OPTS);
  assert.ok(cio.catalog.catalogModel,                              'catalogModel must be present');
  assert.equal(cio.catalog.catalogModel.modelVersion,  '1.0.0',   'modelVersion must be 1.0.0');
  assert.equal(cio.catalog.catalogModel.releasesCount, 1,         'releasesCount must be 1');
  assert.equal(cio.catalog.catalogModel.releases.length,   1,     'releases must have 1 entry');
  assert.equal(cio.catalog.catalogModel.recordings.length, 1,     'recordings must have 1 entry');
  assert.equal(cio.catalog.catalogModel.byProvider.apple,   1,    'byProvider.apple must be 1');
  assert.equal(cio.catalog.catalogModel.byProvider.spotify, null, 'byProvider.spotify must be null');
  assert.equal(cio.catalog.catalogModel.catalogVersion, null,     'catalogVersion must remain null (RESERVED)');
});

test('19. CATALOG MODEL — catalogModel is null when absent from scan payload', () => {
  const cio = assembleCio('Artist 19', {
    scanPayload: {
      scanId:    'scan-19',
      scannedAt: '2026-06-20T00:00:00.000Z',
      source:    { platform: 'spotify', urlType: 'artist' },
      subject:   { artistName: 'Artist 19', artistId: 'art_19' },
      catalog:   { totalReleases: 5, catalogAgeYears: 3 },
    },
  }, OPTS);
  assert.equal(cio.catalog.catalogModel, null, 'catalogModel must be null when absent');
  assert.equal(cio.catalog.releasesCount,   5, 'legacy releasesCount still populated');
  assert.equal(cio.catalog.catalogAgeYears, 3, 'legacy catalogAgeYears still populated');
});

test('20. CATALOG MODEL — CIO references catalogModel; no flat field duplication on cio.catalog', () => {
  const cio = assembleCio('Artist 20', {
    scanPayload: {
      scanId:    'scan-20',
      scannedAt: '2026-06-20T00:00:00.000Z',
      source:    { platform: 'apple_music', urlType: 'artist' },
      subject:   { artistName: 'Artist 20', artistId: 'art_20' },
      catalog:   { totalReleases: 1, catalogAgeYears: 5, catalogModel: SAMPLE_CATALOG_MODEL },
    },
  }, OPTS);
  // One truth → many consumers. Catalog Model fields must NOT be flattened
  // onto cio.catalog — they live exclusively inside cio.catalog.catalogModel.
  assert.equal(cio.catalog.releases,           undefined, 'releases must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.recordings,         undefined, 'recordings must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.byProvider,         undefined, 'byProvider must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.catalogSync,        undefined, 'catalogSync must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.storefrontCoverage, undefined, 'storefrontCoverage must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.earliestYear,       undefined, 'earliestYear must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.latestYear,         undefined, 'latestYear must NOT be a direct field on cio.catalog');
  assert.equal(cio.catalog.recentActivity,     undefined, 'recentActivity must NOT be a direct field on cio.catalog');
});

test('21. CATALOG MODEL — legacy fields still populated independently of catalogModel', () => {
  const cio = assembleCio('Artist 21', {
    scanPayload: {
      scanId:    'scan-21',
      scannedAt: '2026-06-20T00:00:00.000Z',
      source:    { platform: 'spotify', urlType: 'artist' },
      subject:   { artistName: 'Artist 21', artistId: 'art_21' },
      catalog:   { totalReleases: 12, catalogAgeYears: 8 },
    },
  }, OPTS);
  assert.equal(cio.catalog.releasesCount,   12);
  assert.equal(cio.catalog.catalogAgeYears,  8);
  assert.equal(cio.catalog.catalogModel,  null);
});

test('22. CATALOG MODEL — structural integrity and CIO immutability contract preserved', () => {
  const cio = assembleCio('Artist 22', {
    scanPayload: {
      scanId:    'scan-22',
      scannedAt: '2026-06-20T00:00:00.000Z',
      source:    { platform: 'apple_music', urlType: 'artist' },
      subject:   { artistName: 'Artist 22', artistId: 'art_22' },
      catalog:   { totalReleases: 1, catalogAgeYears: 5, catalogModel: SAMPLE_CATALOG_MODEL },
    },
  }, OPTS);
  // CIO immutability contract — constitutional (not an implementation detail)
  assert.ok(Object.isFrozen(cio),         'assembled CIO must be frozen');
  assert.ok(Object.isFrozen(cio.catalog), 'cio.catalog must be frozen');
  // Structural integrity of the catalogModel reference
  assert.ok(cio.catalog.catalogModel,                                   'catalogModel must be present');
  assert.equal(cio.catalog.catalogModel.modelVersion,  '1.0.0');
  assert.equal(cio.catalog.catalogModel.releases.length,   1,           'releases accessible via catalogModel');
  assert.equal(cio.catalog.catalogModel.recordings.length, 1,           'recordings accessible via catalogModel');
  assert.equal(cio.catalog.catalogModel.releasesCount,     1,           'releasesCount in model matches releases.length');
  assert.equal(cio.catalog.catalogModel.catalogVersion,    null,        'catalogVersion RESERVED — must remain null');
  // Architectural invariant: releases accessible and carry the correct shape
  const firstRelease = cio.catalog.catalogModel.releases[0];
  assert.equal(firstRelease.releaseId, 'rl_abc123',  'releaseId preserved through assembler');
  assert.equal(firstRelease.title,     'Album One',  'title preserved through assembler');
  assert.ok(firstRelease.providers.includes('apple'), 'providers preserved through assembler');
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  CIO ASSEMBLER VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
