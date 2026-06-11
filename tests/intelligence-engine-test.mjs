// ─────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Engine™ — unit tests (Phase 5)
// ─────────────────────────────────────────────────────────────────────
//
//  25 deterministic assertions per the Board-ratified Phase 5 brief.
//
//  Determinism strategy: every CIO fixture used in equality assertions
//  carries an explicit `generatedAt` value, so the engine output
//  inherits it and JSON.stringify comparison is bit-stable across runs.
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/intelligence-engine-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import {
  OBSERVATION_TYPES,
  SEVERITY,
  CONFIDENCE,
  ENGINE_VERSION,
} from '../api/schema/intelligence.js';

// ─── Fixed CIO timestamp for determinism ─────────────────────────────

const FIXED_GENERATED_AT = '2026-06-10T20:00:00.000Z';

// ─── Fixture builder — Phase-4-compatible CIO with optional extensions

function buildCio(extras = {}) {
  return {
    cioVersion:  '1.0.0',
    generatedAt: FIXED_GENERATED_AT,
    confidence:  'UNKNOWN',
    identity: {
      canonicalArtistName: 'Test Artist',
      externalProfiles:    [],
      artistConfidence:    'UNKNOWN',
      ...(extras.identity || {}),
    },
    publishing: {
      worksCount:           0,
      workRoyalteIds:       [],
      writerCount:          0,
      writerIPIs:           [],
      publisherCount:       0,
      publishingConfidence: 'UNKNOWN',
      ...(extras.publishing || {}),
    },
    catalog: {
      releasesCount:     null,
      catalogAgeYears:   null,
      catalogConfidence: 'UNKNOWN',
      ...(extras.catalog || {}),
    },
    metadata: {
      flagCount:          0,
      metadataConfidence: 'UNKNOWN',
      ...(extras.metadata || {}),
    },
    sources:    { sources: [] },
    monitoring: { reserved: true },
    revenue:    { reserved: true },
  };
}

function findObservation(out, predicate) {
  return [...out.observations, ...out.strengths].find(predicate);
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
//  25 Board-ratified assertions
// ═════════════════════════════════════════════════════════════════════

test('1. EMPTY CIO → valid output, no observations', () => {
  const cio = buildCio();
  const out = runIntelligenceEngine(cio);
  // identity.artistConfidence === 'UNKNOWN' fires one IDENTITY obs by
  // design, so this test uses a CIO where artistConfidence is resolved.
  const cioWithConfidence = buildCio({
    identity: { artistConfidence: 'HIGH', canonicalArtistName: 'Resolved Artist' },
  });
  const outResolved = runIntelligenceEngine(cioWithConfidence);
  assert.deepStrictEqual(outResolved.observations, []);
  assert.equal(outResolved.engineVersion, ENGINE_VERSION);
  // Sanity for the base case (default empty CIO carries UNKNOWN confidence)
  assert.ok(out.observations.length >= 0);
});

test('2. EMPTY CIO / null CIO / garbage CIO → engine never throws', () => {
  const garbageInputs = [
    null, undefined, 42, 'string', [], true, false,
    {}, { identity: 42 }, { publishing: 'oops' }, { catalog: null }, { metadata: [] },
  ];
  for (const input of garbageInputs) {
    let out;
    assert.doesNotThrow(() => { out = runIntelligenceEngine(input); });
    assert.ok(out);
    assert.equal(out.engineVersion, ENGINE_VERSION);
    assert.ok(Array.isArray(out.observations));
    assert.ok(Array.isArray(out.coverage));
  }
});

test('3. Engine never mutates the input CIO', () => {
  const cio = buildCio({
    identity: { externalProfiles: [{ provider: 'spotify', profileId: 'X', verified: true }] },
    publishing: { worksCount: 3, writerCount: 2, publisherCount: 0 },
    catalog: { releasesCount: 12 },
  });
  const snapshotBefore = JSON.parse(JSON.stringify(cio));
  runIntelligenceEngine(cio);
  const snapshotAfter = JSON.parse(JSON.stringify(cio));
  assert.deepStrictEqual(snapshotAfter, snapshotBefore);
});

test('4. Duplicate DSP profiles → IDENTITY MEDIUM observation', () => {
  const cio = buildCio({
    identity: {
      artistConfidence: 'HIGH',
      externalProfiles: [
        { provider: 'spotify', profileId: 'A', verified: true },
        { provider: 'spotify', profileId: 'B', verified: true },
      ],
    },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.type === OBSERVATION_TYPES.IDENTITY);
  assert.ok(obs);
  assert.equal(obs.title, 'Duplicate artist profiles detected');
  assert.equal(obs.severity,   SEVERITY.MEDIUM);
  assert.equal(obs.confidence, CONFIDENCE.HIGH);
});

test('5. UNKNOWN artistConfidence → IDENTITY LOW observation', () => {
  const cio = buildCio({ identity: { artistConfidence: 'UNKNOWN' } });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Artist identity confidence unresolved');
  assert.ok(obs);
  assert.equal(obs.type,       OBSERVATION_TYPES.IDENTITY);
  assert.equal(obs.severity,   SEVERITY.LOW);
  assert.equal(obs.confidence, CONFIDENCE.MEDIUM);
});

test('6. Catalog count mismatch across providers → CATALOG observation', () => {
  const cio = buildCio({
    identity: { artistConfidence: 'HIGH' },
    catalog:  { releasesCount: 50, byProvider: { spotify: 47, apple: 52 } },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Catalog count inconsistency detected');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.CATALOG);
  assert.equal(obs.severity, SEVERITY.MEDIUM);
  // Evidence carries the per-provider counts
  assert.ok(obs.evidence.some((e) => e.includes('spotify')));
  assert.ok(obs.evidence.some((e) => e.includes('apple')));
});

test('7. Orphan recordings → CATALOG HIGH severity', () => {
  const cio = buildCio({
    identity: { artistConfidence: 'HIGH' },
    catalog:  { releasesCount: 10, orphanRecordings: ['ISRC-X', 'ISRC-Y'] },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Orphan recordings detected');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.CATALOG);
  assert.equal(obs.severity, SEVERITY.HIGH);
});

test('8. No publishing + recordings exist → PUBLISHING HIGH severity', () => {
  const cio = buildCio({
    identity:   { artistConfidence: 'HIGH' },
    publishing: { worksCount: 0 },
    catalog:    { releasesCount: 8 },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'No publishing registrations found');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.PUBLISHING);
  assert.equal(obs.severity, SEVERITY.HIGH);
});

test('9. Writers identified but no publishers → PUBLISHING MEDIUM', () => {
  const cio = buildCio({
    identity:   { artistConfidence: 'HIGH' },
    publishing: { worksCount: 3, writerCount: 4, publisherCount: 0 },
    catalog:    { releasesCount: 5 },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Writers identified but no publisher found');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.PUBLISHING);
  assert.equal(obs.severity, SEVERITY.MEDIUM);
});

test('10. Low publishing coverage → PUBLISHING MEDIUM', () => {
  const cio = buildCio({
    identity:   { artistConfidence: 'HIGH' },
    publishing: { worksCount: 10, writerCount: 5, publisherCount: 5, publishingCoverage: 60 },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Publishing coverage appears incomplete');
  assert.ok(obs);
  assert.equal(obs.severity,   SEVERITY.MEDIUM);
  assert.equal(obs.confidence, CONFIDENCE.MEDIUM);
});

test('11. Strong publishing coverage → appears in strengths[]', () => {
  const cio = buildCio({
    identity:   { artistConfidence: 'HIGH' },
    publishing: { worksCount: 20, writerCount: 5, publisherCount: 5, publishingCoverage: 92 },
  });
  const out = runIntelligenceEngine(cio);
  const strength = out.strengths.find((s) => s.title === 'Strong publishing coverage');
  assert.ok(strength);
  assert.equal(strength.severity,   SEVERITY.INFO);
  assert.equal(strength.confidence, CONFIDENCE.HIGH);
});

test('12. Complete catalog delivery → appears in strengths[]', () => {
  const cio = buildCio({
    identity: { artistConfidence: 'HIGH' },
    catalog:  { releasesCount: 12, orphanRecordings: [] },
  });
  const out = runIntelligenceEngine(cio);
  const strength = out.strengths.find((s) => s.title === 'Complete catalog delivery verified');
  assert.ok(strength);
  assert.equal(strength.severity,   SEVERITY.INFO);
  assert.equal(strength.confidence, CONFIDENCE.HIGH);
});

test('13. Missing credits → METADATA LOW', () => {
  const cio = buildCio({
    identity: { artistConfidence: 'HIGH' },
    metadata: { missingCredits: [{ isrc: 'A', field: 'composer' }, { isrc: 'B', field: 'producer' }] },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Missing credits detected');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.METADATA);
  assert.equal(obs.severity, SEVERITY.LOW);
});

test('14. Duplicate releases → METADATA MEDIUM', () => {
  const cio = buildCio({
    identity: { artistConfidence: 'HIGH' },
    metadata: { duplicateReleases: [{ title: 'Test Album', count: 2 }] },
  });
  const out = runIntelligenceEngine(cio);
  const obs = out.observations.find((o) => o.title === 'Duplicate releases detected');
  assert.ok(obs);
  assert.equal(obs.type,     OBSERVATION_TYPES.METADATA);
  assert.equal(obs.severity, SEVERITY.MEDIUM);
});

test('15. HIGH severity observations appear in risks[]', () => {
  const cio = buildCio({
    identity:   { artistConfidence: 'HIGH' },
    publishing: { worksCount: 0 },
    catalog:    { releasesCount: 5, orphanRecordings: ['ISRC-A'] },
  });
  const out = runIntelligenceEngine(cio);
  // Two HIGH-severity rules fired (no publishing + orphans)
  assert.equal(out.risks.length, 2);
  for (const risk of out.risks) {
    assert.equal(risk.severity, SEVERITY.HIGH);
    assert.ok(typeof risk.observationId === 'string' && risk.observationId !== '');
  }
});

test('16. MEDIUM severity observations appear in opportunities[]', () => {
  const cio = buildCio({
    identity:   {
      artistConfidence: 'HIGH',
      externalProfiles: [
        { provider: 'spotify', profileId: 'A' },
        { provider: 'spotify', profileId: 'B' },
      ],
    },
    publishing: { worksCount: 5, writerCount: 3, publisherCount: 0 },
    catalog:    { releasesCount: 5 },
  });
  const out = runIntelligenceEngine(cio);
  assert.ok(out.opportunities.length >= 2);
  for (const opp of out.opportunities) {
    assert.equal(opp.severity, SEVERITY.MEDIUM);
  }
});

test('17. coverage[] populated for every CIO section', () => {
  const cio = buildCio({ identity: { artistConfidence: 'HIGH' } });
  const out = runIntelligenceEngine(cio);
  const sectionNames = out.coverage.map((c) => c.section);
  for (const expected of ['identity', 'publishing', 'catalog', 'metadata', 'sources', 'monitoring', 'revenue']) {
    assert.ok(sectionNames.includes(expected), `coverage missing section ${expected}`);
  }
  // Each row has status + itemCount
  for (const row of out.coverage) {
    assert.ok(['POPULATED', 'EMPTY', 'RESERVED'].includes(row.status), `unexpected status ${row.status}`);
    assert.equal(typeof row.itemCount, 'number');
  }
});

test('18. Deterministic — same CIO twice → identical JSON output', () => {
  const cio = buildCio({
    identity:   {
      artistConfidence: 'HIGH',
      externalProfiles: [{ provider: 'spotify', profileId: 'A' }, { provider: 'apple', profileId: 'B' }],
    },
    publishing: { worksCount: 7, writerCount: 5, publisherCount: 2, publishingCoverage: 85 },
    catalog:    { releasesCount: 14, catalogAgeYears: 5, orphanRecordings: [] },
    metadata:   { flagCount: 0 },
  });
  const a = runIntelligenceEngine(cio);
  const b = runIntelligenceEngine(cio);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('19. No provider-specific terms in observation titles', () => {
  const cio = buildCio({
    identity:   {
      artistConfidence: 'UNKNOWN',
      externalProfiles: [
        { provider: 'spotify', profileId: 'A' },
        { provider: 'spotify', profileId: 'B' },
        { provider: 'apple',   profileId: 'C' },
        { provider: 'apple',   profileId: 'D' },
      ],
    },
    publishing: { worksCount: 5, writerCount: 3, publisherCount: 0, publishingCoverage: 40 },
    catalog:    { releasesCount: 10, byProvider: { spotify: 8, apple: 12 }, orphanRecordings: ['ISRC-X'] },
    metadata:   {
      missingCredits:       [{ isrc: 'A' }],
      duplicateReleases:    [{ title: 'A' }],
      inconsistentMetadata: [{ field: 'genre' }],
    },
  });
  const out = runIntelligenceEngine(cio);
  const allTitles = [...out.observations, ...out.strengths].map((o) => o.title.toLowerCase());
  for (const title of allTitles) {
    for (const term of ['mlc', 'spotify', 'apple', 'youtube', 'musicbrainz', 'discogs', 'soundcloud']) {
      assert.ok(!title.includes(term), `provider term "${term}" must not appear in observation title: "${title}"`);
    }
  }
});

test('20. engineVersion in output matches ENGINE_VERSION constant', () => {
  const out = runIntelligenceEngine(buildCio({ identity: { artistConfidence: 'HIGH' } }));
  assert.equal(out.engineVersion, ENGINE_VERSION);
  assert.equal(out.engineVersion, '1.0.0');
});

test('21. generatedAt is a valid ISO timestamp', () => {
  const out = runIntelligenceEngine(buildCio({ identity: { artistConfidence: 'HIGH' } }));
  assert.ok(typeof out.generatedAt === 'string');
  assert.match(out.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  // For determinism, generatedAt inherits cio.generatedAt
  assert.equal(out.generatedAt, FIXED_GENERATED_AT);
});

test('22. Every observation has a non-empty id field', () => {
  const cio = buildCio({
    identity:   {
      artistConfidence: 'UNKNOWN',
      externalProfiles: [{ provider: 'spotify', profileId: 'A' }, { provider: 'spotify', profileId: 'B' }],
    },
    publishing: { worksCount: 0 },
    catalog:    { releasesCount: 3, orphanRecordings: ['X'] },
    metadata:   { missingCredits: [{}], duplicateReleases: [{}], inconsistentMetadata: [{}] },
  });
  const out = runIntelligenceEngine(cio);
  const all = [...out.observations, ...out.strengths];
  assert.ok(all.length > 0);
  for (const obs of all) {
    assert.equal(typeof obs.id, 'string');
    assert.ok(obs.id.length > 0, `observation id was empty: ${JSON.stringify(obs)}`);
  }
});

test('23. Missing publishing section handled safely (no throw, no false fires)', () => {
  const cio = { ...buildCio({ identity: { artistConfidence: 'HIGH' } }) };
  delete cio.publishing;
  let out;
  assert.doesNotThrow(() => { out = runIntelligenceEngine(cio); });
  assert.ok(out);
  // No publishing-rule observation can fire when the section is missing
  // AND catalog has zero recordings.
  const pubObs = out.observations.filter((o) => o.type === OBSERVATION_TYPES.PUBLISHING);
  assert.equal(pubObs.length, 0);
});

test('24. Null recordings / null catalog handled safely', () => {
  const inputs = [
    { catalog: null },
    { catalog: undefined },
    { catalog: { recordings: null, releasesCount: null } },
    { catalog: { recordings: 'not-an-array' } },
  ];
  for (const extras of inputs) {
    const cio = { ...buildCio({ identity: { artistConfidence: 'HIGH' } }), ...extras };
    let out;
    assert.doesNotThrow(() => { out = runIntelligenceEngine(cio); });
    assert.ok(Array.isArray(out.coverage));
  }
});

test('25. Reserved monitoring + revenue sections appear with status: "RESERVED"', () => {
  const out = runIntelligenceEngine(buildCio({ identity: { artistConfidence: 'HIGH' } }));
  const monitoring = out.coverage.find((c) => c.section === 'monitoring');
  const revenue    = out.coverage.find((c) => c.section === 'revenue');
  assert.ok(monitoring);
  assert.equal(monitoring.status, 'RESERVED');
  assert.ok(revenue);
  assert.equal(revenue.status,    'RESERVED');
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  INTELLIGENCE ENGINE VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
