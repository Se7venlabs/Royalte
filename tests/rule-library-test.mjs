// ─────────────────────────────────────────────────────────────────────
//  Royaltē Rule Library™ — unit tests (Phase 5)
// ─────────────────────────────────────────────────────────────────────
//
//  Deterministic assertions covering every Board-listed test area:
//
//    ✅ Rule objects valid
//    ✅ Rule IDs unique
//    ✅ Categories valid
//    ✅ Conditions deterministic
//    ✅ Conditions never throw
//    ✅ Null-safe evaluation
//    ✅ Empty CIO safe
//    ✅ Duplicate rule IDs rejected
//    ✅ Reserved categories present
//    ✅ Index exports every rule
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/rule-library-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import {
  ALL_RULES,
  RULE_CATEGORIES,
  SEVERITY,
  CONFIDENCE,
  identityRules,
  publishingRules,
  catalogRules,
  metadataRules,
  monitoringRules,
  revenueRules,
  generalRules,
  validateRule,
  getRulesByCategory,
} from '../api/rules/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function emptyCio() {
  return {
    cioVersion:  '1.0.0',
    generatedAt: '2026-06-11T00:00:00.000Z',
    confidence:  'UNKNOWN',
    identity:    { canonicalArtistName: 'X', externalProfiles: [], artistConfidence: 'UNKNOWN' },
    publishing:  { worksCount: 0, workRoyalteIds: [], writerCount: 0, writerIPIs: [], publisherCount: 0, publishingConfidence: 'UNKNOWN' },
    catalog:     { releasesCount: null, catalogAgeYears: null, catalogConfidence: 'UNKNOWN' },
    metadata:    { flagCount: 0, metadataConfidence: 'UNKNOWN' },
    sources:     { sources: [] },
    monitoring:  { reserved: true },
    revenue:     { reserved: true },
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
//  Structure of the library
// ═════════════════════════════════════════════════════════════════════

test('1. ALL_RULES is a non-empty array', () => {
  assert.ok(Array.isArray(ALL_RULES));
  assert.ok(ALL_RULES.length > 0);
});

test('2. Every rule passes validateRule()', () => {
  for (const rule of ALL_RULES) {
    const result = validateRule(rule);
    assert.equal(result.valid, true,
      `rule ${rule && rule.id} failed validation: ${JSON.stringify(result.errors)}`);
  }
});

test('3. All rule IDs are unique across the library', () => {
  const ids = ALL_RULES.map((r) => r.id);
  const set = new Set(ids);
  assert.equal(ids.length, set.size, `duplicate ids found: ${ids.length - set.size}`);
});

test('4. Every rule.category is a valid RULE_CATEGORIES value', () => {
  const valid = new Set(Object.values(RULE_CATEGORIES));
  for (const rule of ALL_RULES) {
    assert.ok(valid.has(rule.category), `bad category on ${rule.id}: ${rule.category}`);
  }
});

test('5. Every rule.severity is a valid SEVERITY value', () => {
  const valid = new Set(Object.values(SEVERITY));
  for (const rule of ALL_RULES) {
    assert.ok(valid.has(rule.severity), `bad severity on ${rule.id}: ${rule.severity}`);
  }
});

test('6. Every rule.confidence is a valid CONFIDENCE value', () => {
  const valid = new Set(Object.values(CONFIDENCE));
  for (const rule of ALL_RULES) {
    assert.ok(valid.has(rule.confidence), `bad confidence on ${rule.id}: ${rule.confidence}`);
  }
});

test('7. Every rule.condition is a function', () => {
  for (const rule of ALL_RULES) {
    assert.equal(typeof rule.condition, 'function', `condition not a function on ${rule.id}`);
  }
});

// ═════════════════════════════════════════════════════════════════════
//  Behavioural contract on conditions
// ═════════════════════════════════════════════════════════════════════

test('8. Every condition returns a strict boolean', () => {
  const cio = emptyCio();
  for (const rule of ALL_RULES) {
    const out = rule.condition(cio);
    assert.equal(typeof out, 'boolean', `${rule.id} did not return a boolean (got ${typeof out})`);
  }
});

test('9. Every condition is null-safe (cio=null)', () => {
  for (const rule of ALL_RULES) {
    let out;
    assert.doesNotThrow(() => { out = rule.condition(null); }, `${rule.id} threw on null`);
    assert.equal(typeof out, 'boolean');
  }
});

test('10. Every condition is undefined-safe (cio=undefined)', () => {
  for (const rule of ALL_RULES) {
    let out;
    assert.doesNotThrow(() => { out = rule.condition(undefined); }, `${rule.id} threw on undefined`);
    assert.equal(typeof out, 'boolean');
  }
});

test('11. Every condition tolerates garbage non-object inputs', () => {
  const garbage = [42, 'string', true, false, [], () => {}];
  for (const rule of ALL_RULES) {
    for (const g of garbage) {
      let out;
      assert.doesNotThrow(() => { out = rule.condition(g); }, `${rule.id} threw on ${JSON.stringify(g)}`);
      assert.equal(typeof out, 'boolean');
    }
  }
});

test('12. Every condition tolerates malformed CIO shapes', () => {
  const partials = [
    {},
    { identity: 'oops' },
    { publishing: null },
    { catalog: 'not-an-object' },
    { metadata: [] },
    { identity: { externalProfiles: 'not-an-array' } },
    { publishing: { worksCount: 'not-a-number' } },
    { catalog: { releasesCount: NaN, byProvider: 'oops', orphanRecordings: 42 } },
    { metadata: { missingCredits: null, duplicateReleases: 'x', inconsistentMetadata: {} } },
  ];
  for (const rule of ALL_RULES) {
    for (const cio of partials) {
      let out;
      assert.doesNotThrow(() => { out = rule.condition(cio); }, `${rule.id} threw on ${JSON.stringify(cio)}`);
      assert.equal(typeof out, 'boolean');
    }
  }
});

test('13. Every condition is deterministic (same input twice → same output)', () => {
  const inputs = [
    emptyCio(),
    {
      ...emptyCio(),
      identity: { ...emptyCio().identity, artistConfidence: 'HIGH',
        externalProfiles: [{ provider: 'spotify', profileId: 'A' }, { provider: 'spotify', profileId: 'B' }] },
    },
    {
      ...emptyCio(),
      publishing: { ...emptyCio().publishing, worksCount: 10, writerCount: 5, publisherCount: 0, publishingCoverage: 60 },
      catalog:    { ...emptyCio().catalog, releasesCount: 12, orphanRecordings: ['ISRC-X'] },
    },
  ];
  for (const rule of ALL_RULES) {
    for (const cio of inputs) {
      const a = rule.condition(cio);
      const b = rule.condition(cio);
      assert.equal(a, b, `${rule.id} returned different values across consecutive calls`);
    }
  }
});

test('14. Every condition leaves the input CIO unmutated', () => {
  const inputs = [
    emptyCio(),
    {
      ...emptyCio(),
      identity: { ...emptyCio().identity, artistConfidence: 'HIGH',
        externalProfiles: [{ provider: 'spotify', profileId: 'A' }, { provider: 'spotify', profileId: 'B' }] },
      publishing: { ...emptyCio().publishing, worksCount: 4, writerCount: 3, publisherCount: 0 },
      catalog:    { ...emptyCio().catalog, releasesCount: 6, orphanRecordings: ['X'], byProvider: { a: 1, b: 2 } },
      metadata:   { ...emptyCio().metadata, missingCredits: [{}], duplicateReleases: [{}], inconsistentMetadata: [{}] },
    },
  ];
  for (const rule of ALL_RULES) {
    for (const cio of inputs) {
      const before = JSON.stringify(cio);
      rule.condition(cio);
      const after  = JSON.stringify(cio);
      assert.equal(after, before, `${rule.id} mutated the CIO`);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
//  validateRule — failure surfaces
// ═════════════════════════════════════════════════════════════════════

test('15. validateRule rejects non-object inputs with not_an_object', () => {
  for (const input of [null, undefined, 42, 'string', [], true]) {
    const r = validateRule(input);
    assert.equal(r.valid, false);
    assert.deepStrictEqual(r.errors, ['not_an_object']);
  }
});

test('16. validateRule accumulates every missing field', () => {
  const r = validateRule({});
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('missing_id'));
  assert.ok(r.errors.includes('missing_title'));
  assert.ok(r.errors.includes('missing_description'));
  assert.ok(r.errors.includes('missing_recommendation'));
  assert.ok(r.errors.includes('missing_category'));
  assert.ok(r.errors.includes('missing_severity'));
  assert.ok(r.errors.includes('missing_confidence'));
  assert.ok(r.errors.includes('missing_condition'));
  assert.ok(r.errors.includes('providerSources_not_an_array'));
});

test('17. validateRule rejects invalid enum values', () => {
  const base = {
    id: 'test.x', title: 't', description: 'd', recommendation: 'r',
    condition: () => false, providerSources: [],
    category: 'NOT_REAL', severity: 'NOPE', confidence: 'NAH',
  };
  const r = validateRule(base);
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('invalid_category'));
  assert.ok(r.errors.includes('invalid_severity'));
  assert.ok(r.errors.includes('invalid_confidence'));
});

test('18. validateRule rejects non-function condition', () => {
  const base = {
    id: 'test.x', title: 't', description: 'd', recommendation: 'r',
    category: 'IDENTITY', severity: 'LOW', confidence: 'LOW',
    providerSources: [], condition: 'not-a-function',
  };
  const r = validateRule(base);
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('condition_not_a_function'));
});

// ═════════════════════════════════════════════════════════════════════
//  Index exports + reserved categories
// ═════════════════════════════════════════════════════════════════════

test('19. Each category exposes its rules through the index module', () => {
  assert.ok(Array.isArray(identityRules)   && identityRules.length   > 0, 'identityRules empty');
  assert.ok(Array.isArray(publishingRules) && publishingRules.length > 0, 'publishingRules empty');
  assert.ok(Array.isArray(catalogRules)    && catalogRules.length    > 0, 'catalogRules empty');
  assert.ok(Array.isArray(metadataRules)   && metadataRules.length   > 0, 'metadataRules empty');
});

test('20. Reserved categories (Monitoring, Revenue, General) are present and empty in Phase 5', () => {
  assert.ok(Array.isArray(monitoringRules) && monitoringRules.length === 0);
  assert.ok(Array.isArray(revenueRules)    && revenueRules.length    === 0);
  assert.ok(Array.isArray(generalRules)    && generalRules.length    === 0);
  // RULE_CATEGORIES constant still surfaces them so consumers can iterate
  assert.equal(RULE_CATEGORIES.MONITORING, 'MONITORING');
  assert.equal(RULE_CATEGORIES.REVENUE,    'REVENUE');
  assert.equal(RULE_CATEGORIES.GENERAL,    'GENERAL');
});

test('21. ALL_RULES contains every rule from every category file', () => {
  const expected = identityRules.length + publishingRules.length + catalogRules.length + metadataRules.length;
  assert.equal(ALL_RULES.length, expected);
});

test('22. getRulesByCategory returns the right slice + [] for unknown / bad input', () => {
  assert.equal(getRulesByCategory('IDENTITY').length,   identityRules.length);
  assert.equal(getRulesByCategory('PUBLISHING').length, publishingRules.length);
  assert.equal(getRulesByCategory('CATALOG').length,    catalogRules.length);
  assert.equal(getRulesByCategory('METADATA').length,   metadataRules.length);
  assert.equal(getRulesByCategory('MONITORING').length, 0);
  assert.equal(getRulesByCategory('REVENUE').length,    0);
  assert.equal(getRulesByCategory('GENERAL').length,    0);
  // Unknown / bad inputs
  assert.equal(getRulesByCategory('UNKNOWN_CATEGORY').length, 0);
  assert.equal(getRulesByCategory(null).length,              0);
  assert.equal(getRulesByCategory(undefined).length,         0);
  assert.equal(getRulesByCategory(42).length,                0);
  assert.equal(getRulesByCategory('').length,                0);
});

// ═════════════════════════════════════════════════════════════════════
//  Spot-check rule firing against representative CIOs
// ═════════════════════════════════════════════════════════════════════

test('23. identity.duplicate-dsp-profiles fires when two profiles share a provider', () => {
  const rule = ALL_RULES.find((r) => r.id === 'identity.duplicate-dsp-profiles');
  assert.ok(rule);
  const cio = {
    ...emptyCio(),
    identity: { ...emptyCio().identity,
      externalProfiles: [
        { provider: 'spotify', profileId: 'A' },
        { provider: 'spotify', profileId: 'B' },
      ] },
  };
  assert.equal(rule.condition(cio), true);
  // And NOT when each provider is unique
  cio.identity.externalProfiles = [
    { provider: 'spotify', profileId: 'A' },
    { provider: 'apple',   profileId: 'B' },
  ];
  assert.equal(rule.condition(cio), false);
});

test('24. publishing.no-registrations-with-recordings fires for the documented case', () => {
  const rule = ALL_RULES.find((r) => r.id === 'publishing.no-registrations-with-recordings');
  assert.ok(rule);
  const cio = {
    ...emptyCio(),
    publishing: { ...emptyCio().publishing, worksCount: 0 },
    catalog:    { ...emptyCio().catalog, releasesCount: 5 },
  };
  assert.equal(rule.condition(cio), true);
  // And NOT when there are works
  cio.publishing.worksCount = 3;
  assert.equal(rule.condition(cio), false);
});

test('25. catalog.orphan-recordings-detected fires only when orphans > 0', () => {
  const rule = ALL_RULES.find((r) => r.id === 'catalog.orphan-recordings-detected');
  assert.ok(rule);
  const empty = { ...emptyCio(), catalog: { ...emptyCio().catalog, orphanRecordings: [] } };
  assert.equal(rule.condition(empty), false);
  const withOrphans = { ...emptyCio(), catalog: { ...emptyCio().catalog, orphanRecordings: ['X', 'Y'] } };
  assert.equal(rule.condition(withOrphans), true);
});

test('26. metadata.duplicate-releases fires only when duplicates > 0', () => {
  const rule = ALL_RULES.find((r) => r.id === 'metadata.duplicate-releases');
  assert.ok(rule);
  assert.equal(rule.condition(emptyCio()), false);
  const cio = { ...emptyCio(), metadata: { ...emptyCio().metadata, duplicateReleases: [{ title: 'X' }] } };
  assert.equal(rule.condition(cio), true);
});

test('27. Empty CIO never fires more than identity.confidence-unresolved', () => {
  // The empty fixture has artistConfidence: 'UNKNOWN' — that rule SHOULD fire.
  // Every other rule SHOULD NOT fire on the empty fixture.
  const cio = emptyCio();
  const fired = ALL_RULES.filter((r) => r.condition(cio)).map((r) => r.id);
  assert.deepStrictEqual(fired, ['identity.confidence-unresolved']);
});

// ═════════════════════════════════════════════════════════════════════
//  Provider-neutrality + frozen guarantees
// ═════════════════════════════════════════════════════════════════════

test('28. No rule title contains a provider-specific term', () => {
  const forbidden = ['mlc', 'spotify', 'apple', 'youtube', 'musicbrainz', 'discogs', 'soundcloud', 'lastfm', 'tidal'];
  for (const rule of ALL_RULES) {
    const t = rule.title.toLowerCase();
    for (const term of forbidden) {
      assert.ok(!t.includes(term), `rule ${rule.id} title contains provider term "${term}"`);
    }
  }
});

test('29. ALL_RULES + each category array are frozen (immutable)', () => {
  assert.ok(Object.isFrozen(ALL_RULES));
  assert.ok(Object.isFrozen(identityRules));
  assert.ok(Object.isFrozen(publishingRules));
  assert.ok(Object.isFrozen(catalogRules));
  assert.ok(Object.isFrozen(metadataRules));
  assert.ok(Object.isFrozen(monitoringRules));
  assert.ok(Object.isFrozen(revenueRules));
  assert.ok(Object.isFrozen(generalRules));
  for (const rule of ALL_RULES) {
    assert.ok(Object.isFrozen(rule), `rule ${rule.id} is not frozen`);
  }
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  RULE LIBRARY VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
