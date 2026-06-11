// ─────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Engine™ — unit tests (Phase 6)
// ─────────────────────────────────────────────────────────────────────
//
//  30 deterministic assertions per the Board-ratified Phase 6 brief.
//
//  Determinism strategy: every CIO fixture used in equality assertions
//  pins `generatedAt` to a fixed ISO string; the engine inherits it.
//  Observation ids are stable SHA-256 prefixes — so `JSON.stringify`
//  comparison is bit-stable across runs.
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/intelligence-engine-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import {
  CATEGORIES,
  SEVERITY,
  CONFIDENCE,
  ENGINE_VERSION,
} from '../api/schema/intelligence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXED_GENERATED_AT = '2026-06-11T00:00:00.000Z';

// ─── Fixture builders ────────────────────────────────────────────────

function buildCio(extras = {}) {
  return {
    cioVersion:  '1.0.0',
    generatedAt: FIXED_GENERATED_AT,
    confidence:  'UNKNOWN',
    identity:    { canonicalArtistName: 'X', externalProfiles: [], artistConfidence: 'UNKNOWN', ...(extras.identity || {}) },
    publishing:  { worksCount: 0, workRoyalteIds: [], writerCount: 0, writerIPIs: [], publisherCount: 0, publishingConfidence: 'UNKNOWN', ...(extras.publishing || {}) },
    catalog:     { releasesCount: null, catalogAgeYears: null, catalogConfidence: 'UNKNOWN', ...(extras.catalog || {}) },
    metadata:    { flagCount: 0, metadataConfidence: 'UNKNOWN', ...(extras.metadata || {}) },
    sources:     { sources: [] },
    monitoring:  { reserved: true },
    revenue:     { reserved: true },
  };
}

function buildRule({
  ruleId,
  category        = CATEGORIES.METADATA,
  severity        = SEVERITY.MEDIUM,
  confidence      = CONFIDENCE.HIGH,
  title           = ruleId,
  description     = 'Test description.',
  recommendation  = 'Test recommendation.',
  condition       = () => true,
  evidence        = () => [],
  providerSources = () => [],
  polarity,
} = {}) {
  const out = {
    ruleId, category, severity, confidence, title, description, recommendation,
    condition, evidence, providerSources,
  };
  if (polarity) out.polarity = polarity;
  return out;
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
//  30 Board-ratified assertions
// ═════════════════════════════════════════════════════════════════════

test('1. Empty rule library → valid output, no observations', () => {
  const out = runIntelligenceEngine(buildCio(), []);
  assert.deepStrictEqual(out.observations, []);
  assert.equal(out.engineVersion, ENGINE_VERSION);
});

test('2. Empty CIO (but with rules) → valid output, no observations when conditions never fire', () => {
  const rules = [buildRule({ ruleId: 'r.never', condition: () => false })];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(out.observations, []);
  assert.ok(Array.isArray(out.coverage));
});

test('3. Both empty → engine never throws and returns a valid output', () => {
  assert.doesNotThrow(() => {
    const out = runIntelligenceEngine(null, null);
    assert.equal(out.engineVersion, ENGINE_VERSION);
    assert.ok(Array.isArray(out.observations));
  });
});

test('4. One matching rule → one observation generated', () => {
  const out = runIntelligenceEngine(buildCio(), [
    buildRule({ ruleId: 'r.match', condition: () => true }),
  ]);
  assert.equal(out.observations.length, 1);
  assert.equal(out.observations[0].ruleId, 'r.match');
});

test('5. One non-matching rule → zero observations', () => {
  const out = runIntelligenceEngine(buildCio(), [
    buildRule({ ruleId: 'r.no', condition: () => false }),
  ]);
  assert.equal(out.observations.length, 0);
});

test('6. Multiple matching rules → all observations generated', () => {
  const rules = [
    buildRule({ ruleId: 'r.a', condition: () => true }),
    buildRule({ ruleId: 'r.b', condition: () => true }),
    buildRule({ ruleId: 'r.c', condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.equal(out.observations.length, 3);
});

test('7. Rule order preserved in observations[]', () => {
  const rules = [
    buildRule({ ruleId: 'r.first',  condition: () => true }),
    buildRule({ ruleId: 'r.second', condition: () => true }),
    buildRule({ ruleId: 'r.third',  condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(
    out.observations.map((o) => o.ruleId),
    ['r.first', 'r.second', 'r.third'],
  );
});

test('8. Duplicate ruleId → second execution skipped', () => {
  let secondCondCalled = false;
  const rules = [
    buildRule({ ruleId: 'r.dup', condition: () => true }),
    buildRule({ ruleId: 'r.dup', condition: () => { secondCondCalled = true; return true; } }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.equal(out.observations.length, 1, 'second rule with duplicate ruleId must be skipped');
  assert.equal(secondCondCalled, false, 'second rule condition must not be evaluated');
});

test('9. observations[] entries carry a ruleId reference', () => {
  const out = runIntelligenceEngine(buildCio(), [
    buildRule({ ruleId: 'r.ref', condition: () => true }),
  ]);
  assert.equal(out.observations[0].ruleId, 'r.ref');
});

test('10. Severity preserved from rule to observation', () => {
  const rules = [
    buildRule({ ruleId: 'r.info',     severity: SEVERITY.INFO,     condition: () => true }),
    buildRule({ ruleId: 'r.low',      severity: SEVERITY.LOW,      condition: () => true }),
    buildRule({ ruleId: 'r.medium',   severity: SEVERITY.MEDIUM,   condition: () => true }),
    buildRule({ ruleId: 'r.high',     severity: SEVERITY.HIGH,     condition: () => true }),
    buildRule({ ruleId: 'r.critical', severity: SEVERITY.CRITICAL, condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(
    out.observations.map((o) => o.severity),
    ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  );
});

test('11. Confidence preserved from rule to observation', () => {
  const rules = [
    buildRule({ ruleId: 'r.unk', confidence: CONFIDENCE.UNKNOWN, condition: () => true }),
    buildRule({ ruleId: 'r.low', confidence: CONFIDENCE.LOW,     condition: () => true }),
    buildRule({ ruleId: 'r.med', confidence: CONFIDENCE.MEDIUM,  condition: () => true }),
    buildRule({ ruleId: 'r.hi',  confidence: CONFIDENCE.HIGH,    condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(
    out.observations.map((o) => o.confidence),
    ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH'],
  );
});

test('12. evidence() is called and its result is stored on the observation', () => {
  let evidenceCalledWithCio = null;
  const rules = [buildRule({
    ruleId:    'r.ev',
    condition: () => true,
    evidence:  (cio) => { evidenceCalledWithCio = cio; return ['x', 'y', 'z']; },
  })];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(out.observations[0].evidence, ['x', 'y', 'z']);
  assert.ok(evidenceCalledWithCio && typeof evidenceCalledWithCio === 'object', 'evidence must be invoked with the CIO');
});

test('13. providerSources() is called and its result is stored on the observation', () => {
  const rules = [buildRule({
    ruleId:          'r.prov',
    condition:       () => true,
    providerSources: () => ['spotify', 'apple'],
  })];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.deepStrictEqual(out.observations[0].providerSources, ['spotify', 'apple']);
});

test('14. recommendations[] built from MEDIUM+ severity (excludes INFO + LOW)', () => {
  const rules = [
    buildRule({ ruleId: 'r.info',     severity: SEVERITY.INFO,     condition: () => true, recommendation: 'a' }),
    buildRule({ ruleId: 'r.low',      severity: SEVERITY.LOW,      condition: () => true, recommendation: 'b' }),
    buildRule({ ruleId: 'r.medium',   severity: SEVERITY.MEDIUM,   condition: () => true, recommendation: 'c' }),
    buildRule({ ruleId: 'r.high',     severity: SEVERITY.HIGH,     condition: () => true, recommendation: 'd' }),
    buildRule({ ruleId: 'r.critical', severity: SEVERITY.CRITICAL, condition: () => true, recommendation: 'e' }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  const recs = out.recommendations.map((r) => r.recommendation);
  assert.deepStrictEqual(recs.sort(), ['c', 'd', 'e'].sort());
});

test('15. risks[] contains HIGH + CRITICAL severity observations only', () => {
  const rules = [
    buildRule({ ruleId: 'r.medium',   severity: SEVERITY.MEDIUM,   condition: () => true }),
    buildRule({ ruleId: 'r.high',     severity: SEVERITY.HIGH,     condition: () => true }),
    buildRule({ ruleId: 'r.critical', severity: SEVERITY.CRITICAL, condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.equal(out.risks.length, 2);
  for (const r of out.risks) {
    assert.ok(r.severity === SEVERITY.HIGH || r.severity === SEVERITY.CRITICAL);
  }
});

test('16. strengths[] contains rules marked with polarity: "positive"', () => {
  const rules = [
    buildRule({ ruleId: 'r.pos',  severity: SEVERITY.INFO, condition: () => true, polarity: 'positive' }),
    buildRule({ ruleId: 'r.high', severity: SEVERITY.HIGH, condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.equal(out.strengths.length, 1);
  assert.equal(out.strengths[0].ruleId, 'r.pos');
});

test('17. opportunities[] contains MEDIUM-severity observations only', () => {
  const rules = [
    buildRule({ ruleId: 'r.medium', severity: SEVERITY.MEDIUM, condition: () => true }),
    buildRule({ ruleId: 'r.high',   severity: SEVERITY.HIGH,   condition: () => true }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.equal(out.opportunities.length, 1);
  assert.equal(out.opportunities[0].severity, SEVERITY.MEDIUM);
});

test('18. coverage[] carries an entry for every CIO section', () => {
  const out = runIntelligenceEngine(buildCio(), []);
  const sections = out.coverage.map((c) => c.section);
  for (const expected of ['identity', 'publishing', 'catalog', 'metadata', 'sources', 'monitoring', 'revenue']) {
    assert.ok(sections.includes(expected), `coverage missing section ${expected}`);
  }
  for (const row of out.coverage) {
    assert.ok(['POPULATED', 'EMPTY', 'RESERVED'].includes(row.status));
    assert.equal(typeof row.itemCount, 'number');
  }
});

test('19. Output is deeply frozen (Object.isFrozen === true everywhere)', () => {
  const rules = [
    buildRule({ ruleId: 'r.f', condition: () => true, evidence: () => ['e1'], providerSources: () => ['p1'] }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.observations));
  assert.ok(Object.isFrozen(out.observations[0]));
  assert.ok(Object.isFrozen(out.observations[0].evidence));
  assert.ok(Object.isFrozen(out.coverage));
  assert.throws(() => { out.observations.push({}); });
});

test('20. CIO is not mutated after the engine runs', () => {
  const cio = buildCio({
    identity:   { externalProfiles: [{ provider: 'spotify', profileId: 'X' }] },
    publishing: { worksCount: 5, writerCount: 2 },
  });
  const before = JSON.stringify(cio);
  const rules = [buildRule({ ruleId: 'r.mut', condition: () => true })];
  runIntelligenceEngine(cio, rules);
  const after = JSON.stringify(cio);
  assert.equal(after, before);
});

test('21. Rule library is not mutated after the engine runs', () => {
  // Compare by stringifying non-function fields of each rule.
  const rules = [
    buildRule({ ruleId: 'r.lib.a', condition: () => true,  recommendation: 'one' }),
    buildRule({ ruleId: 'r.lib.b', condition: () => false, recommendation: 'two' }),
  ];
  const before = JSON.stringify(rules.map((r) => ({
    ruleId: r.ruleId, category: r.category, severity: r.severity, confidence: r.confidence,
    title: r.title, description: r.description, recommendation: r.recommendation,
  })));
  runIntelligenceEngine(buildCio(), rules);
  const after = JSON.stringify(rules.map((r) => ({
    ruleId: r.ruleId, category: r.category, severity: r.severity, confidence: r.confidence,
    title: r.title, description: r.description, recommendation: r.recommendation,
  })));
  assert.equal(after, before);
});

test('22. Deterministic — same input twice → identical JSON.stringify output', () => {
  const cio = buildCio({
    identity:   { externalProfiles: [{ provider: 'spotify', profileId: 'A' }] },
    publishing: { worksCount: 3, writerCount: 1, publisherCount: 0 },
  });
  const rules = [
    buildRule({ ruleId: 'r.det.a', severity: SEVERITY.MEDIUM, condition: () => true, evidence: () => ['e'], providerSources: () => ['p'] }),
    buildRule({ ruleId: 'r.det.b', severity: SEVERITY.HIGH,   condition: () => true }),
  ];
  const a = runIntelligenceEngine(cio, rules);
  const b = runIntelligenceEngine(cio, rules);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('23. Engine never throws on null cio', () => {
  assert.doesNotThrow(() => {
    const out = runIntelligenceEngine(null, [buildRule({ ruleId: 'r.x' })]);
    assert.ok(out);
  });
});

test('24. Engine never throws on null ruleLibrary', () => {
  assert.doesNotThrow(() => {
    const out = runIntelligenceEngine(buildCio(), null);
    assert.deepStrictEqual(out.observations, []);
  });
});

test('25. Engine never throws on malformed rules', () => {
  const garbage = [
    null, undefined, 42, 'string', [],
    {},                                              // no ruleId
    { ruleId: 'no.condition' },                      // no condition
    { ruleId: 'cond.not.fn', condition: 'nope' },    // non-function condition
    { ruleId: 'cond.throws', condition: () => { throw new Error('boom'); } },
    { ruleId: 'cond.non.bool', condition: () => 42 },// non-boolean return → falsy, no observation
    { ruleId: 'evidence.throws', condition: () => true, evidence: () => { throw new Error(); } },
    { ruleId: 'evidence.bad.return', condition: () => true, evidence: () => 'not-an-array' },
  ];
  let out;
  assert.doesNotThrow(() => { out = runIntelligenceEngine(buildCio(), garbage); });
  assert.ok(out);
  assert.equal(out.engineVersion, ENGINE_VERSION);
  // Only the rules that returned strict-true fire; for the
  // evidence-related rules, the engine falls back to [] on bad
  // returns instead of dropping the observation.
  const ruleIds = out.observations.map((o) => o.ruleId);
  assert.ok(ruleIds.includes('evidence.throws'));      // condition fired, evidence threw → []
  assert.ok(ruleIds.includes('evidence.bad.return')); // condition fired, evidence bad → []
});

test('26. No provider-specific terms in engine source code', () => {
  const enginePath = join(__dirname, '..', 'api', '_lib', 'intelligence-engine.js');
  const src = readFileSync(enginePath, 'utf8');
  for (const term of ['mlc', 'spotify', 'apple', 'youtube', 'musicbrainz', 'discogs', 'soundcloud', 'tidal', 'lastfm']) {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    assert.ok(!re.test(src), `engine source contains provider-specific term "${term}"`);
  }
});

test('27. engineVersion in output matches ENGINE_VERSION constant', () => {
  const out = runIntelligenceEngine(buildCio(), []);
  assert.equal(out.engineVersion, ENGINE_VERSION);
  assert.equal(out.engineVersion, '1.0.0');
});

test('28. generatedAt is a valid ISO timestamp string', () => {
  const out = runIntelligenceEngine(buildCio(), []);
  assert.equal(typeof out.generatedAt, 'string');
  assert.match(out.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('29. Every observation carries a non-empty id', () => {
  const rules = [
    buildRule({ ruleId: 'r.id.a', condition: () => true }),
    buildRule({ ruleId: 'r.id.b', condition: () => true }),
    buildRule({ ruleId: 'r.id.c', condition: () => true, polarity: 'positive' }),
  ];
  const out = runIntelligenceEngine(buildCio(), rules);
  for (const obs of [...out.observations, ...out.strengths]) {
    assert.equal(typeof obs.id, 'string');
    assert.ok(obs.id.length > 0, `observation id was empty: ${JSON.stringify(obs)}`);
  }
});

test('30. Hundreds of rules execute without error (500-rule load)', () => {
  const rules = [];
  for (let i = 0; i < 500; i += 1) {
    const sev = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 5];
    rules.push(buildRule({
      ruleId:    `r.bulk.${i}`,
      severity:  sev,
      condition: () => true,
      evidence:  () => [`evidence-${i}`],
    }));
  }
  let out;
  assert.doesNotThrow(() => { out = runIntelligenceEngine(buildCio(), rules); });
  assert.equal(out.observations.length, 500);
  for (let i = 0; i < 500; i += 1) {
    assert.equal(out.observations[i].ruleId, `r.bulk.${i}`);
  }
  // Determinism still holds at scale
  const second = runIntelligenceEngine(buildCio(), rules);
  assert.equal(JSON.stringify(out), JSON.stringify(second));
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  INTELLIGENCE ENGINE V2 VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
