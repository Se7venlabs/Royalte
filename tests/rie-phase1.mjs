// Royaltē Intelligence Engine™ — Phase 1 Exit Gate Tests
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Phase 1 Board Authorization: 2026-07-01
//
// Exit gate requirement (RIE Operating System Rebuild Brief §5 Phase 1):
//   "RIE produces a certified Canonical Intelligence Model from at least
//    one provider, with the full §8.2 schema present, versioned, and
//    testable (§7.11)."
//
// These tests verify that contract without making live provider calls.
// The radiohead fixture provides the normalized evidence input.

import { strict as assert } from 'node:assert';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// ── Helpers ─────────────────────────────────────────────────────

function pass(label) { console.log(`  ✓  ${label}`); }
function fail(label, err) { console.error(`  ✗  ${label}`); throw err; }

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    pass(label);
    passed++;
  } catch (err) {
    fail(label, err);
    failed++;
  }
}

async function testAsync(label, fn) {
  try {
    await fn();
    pass(label);
    passed++;
  } catch (err) {
    fail(label, err);
    failed++;
  }
}

// ── Load fixture ────────────────────────────────────────────────

const fixturePath = path.join(REPO, 'api/fixtures/canonical-radiohead.json');
const canonicalForEnrichment = JSON.parse(await readFile(fixturePath, 'utf8'));

// ── Import RIE modules ───────────────────────────────────────────

const { CIM_VERSION, CIM_OBJECTS, emptyCIM, validateCIM } =
  await import(path.join(REPO, 'api/schema/canonical-intelligence-model.js'));

const { assembleCIM, runRIE } =
  await import(path.join(REPO, 'lib/rie/index.js'));

const { certifyCIM } =
  await import(path.join(REPO, 'lib/rie/certify.js'));

const { applyIdentityAnchor } =
  await import(path.join(REPO, 'lib/rie/reconciliation/identity-anchor.js'));

// ════════════════════════════════════════════════════════════════
// SUITE 1 — CIM Schema
// ════════════════════════════════════════════════════════════════
console.log('\nSuite 1 — CIM Schema');

test('CIM_VERSION is a semver string', () => {
  assert.match(CIM_VERSION, /^\d+\.\d+\.\d+$/, 'CIM_VERSION must be semver');
});

test('CIM_OBJECTS contains all 12 §8.2 objects', () => {
  const required = [
    'identity','health','globalFootprint','catalog','verification',
    'metadata','publishing','opportunities','actions',
    'aiInsight','revenueSignals','scanAuthority',
  ];
  for (const obj of required) {
    assert.ok(CIM_OBJECTS.includes(obj), `CIM_OBJECTS must include "${obj}"`);
  }
  assert.equal(CIM_OBJECTS.length, 12, 'CIM_OBJECTS must have exactly 12 entries');
});

test('emptyCIM() produces all 12 keys with null values', () => {
  const cim = emptyCIM();
  for (const key of CIM_OBJECTS) {
    assert.ok(key in cim, `emptyCIM() must include key "${key}"`);
  }
  assert.equal(cim._cimVersion, CIM_VERSION, 'emptyCIM() must set _cimVersion');
});

test('validateCIM() passes on a complete CIM', () => {
  const cim = emptyCIM();
  const { valid, missing } = validateCIM(cim);
  assert.ok(valid, `validateCIM should pass; missing: ${missing.join(', ')}`);
  assert.deepEqual(missing, []);
});

test('validateCIM() detects missing keys', () => {
  const partial = { identity: null, health: null };
  const { valid, missing } = validateCIM(partial);
  assert.ok(!valid, 'validateCIM should fail on partial CIM');
  assert.ok(missing.length > 0, 'missing array must be non-empty');
  assert.ok(missing.includes('scanAuthority'), 'must flag missing scanAuthority');
});

test('validateCIM() treats null values as valid (present-but-unknown)', () => {
  const cim = emptyCIM();
  cim.publishing = null;
  const { valid } = validateCIM(cim);
  assert.ok(valid, 'null value should be valid (null ≠ missing)');
});

// ════════════════════════════════════════════════════════════════
// SUITE 2 — Identity Anchor Reconciliation Rule
// ════════════════════════════════════════════════════════════════
console.log('\nSuite 2 — Identity Anchor Reconciliation Rule');

test('applyIdentityAnchor resolves Apple as canonical identity source', () => {
  const evidence = {
    appleMusic: { artistName: 'Radiohead', artistId: 'am-123', genres: ['Alternative'] },
    spotify:    { artistName: 'Radiohead', artistId: 'sp-456', followers: 7000000 },
  };
  const result = applyIdentityAnchor(evidence);
  assert.equal(result.artistId, 'am-123', 'artistId must come from Apple');
  assert.equal(result.spotifyId, 'sp-456', 'spotifyId must come from Spotify');
  assert.deepEqual(result.primaryGenres, ['Alternative'], 'genres must come from Apple when available');
  assert.equal(result.followersCount, 7000000, 'followersCount must come from Spotify');
});

test('applyIdentityAnchor falls back to Spotify name when Apple is absent', () => {
  const evidence = { spotify: { artistName: 'Test Artist', artistId: 'sp-789' } };
  const result   = applyIdentityAnchor(evidence);
  assert.equal(result.canonicalName, 'Test Artist', 'must fall back to Spotify name');
});

test('applyIdentityAnchor includes _anchor audit trail', () => {
  const result = applyIdentityAnchor({ appleMusic: { artistName: 'Test', artistId: 'am-1' } });
  assert.equal(result._anchor.provider, 'apple', '_anchor.provider must be "apple"');
  assert.equal(result._anchor.rule, 'identity-anchor-v1', '_anchor.rule must be versioned');
  assert.ok(typeof result._anchor.authority === 'object', '_anchor.authority must be present');
});

test('applyIdentityAnchor handles empty evidence gracefully', () => {
  const result = applyIdentityAnchor({});
  assert.equal(result.canonicalName, null);
  assert.equal(result.artistId, null);
  assert.equal(result._anchor.provider, 'apple');
});

// ════════════════════════════════════════════════════════════════
// SUITE 3 — CIM Certification
// ════════════════════════════════════════════════════════════════
console.log('\nSuite 3 — CIM Certification');

test('certifyCIM stamps _certified and _certifiedAt', () => {
  const cim = emptyCIM();
  const certified = certifyCIM(cim, { generatedAt: '2026-07-01T00:00:00.000Z' });
  assert.equal(certified._certified, true);
  assert.equal(certified._certifiedAt, '2026-07-01T00:00:00.000Z');
  assert.equal(certified._cimVersion, CIM_VERSION);
});

test('certifyCIM output is frozen (deep)', () => {
  const cim = emptyCIM();
  const certified = certifyCIM(cim);
  assert.ok(Object.isFrozen(certified), 'top-level CIM must be frozen');
});

test('certifyCIM throws when a §8.2 key is missing', () => {
  const incomplete = { identity: null, health: null }; // missing 10 objects
  assert.throws(
    () => certifyCIM(incomplete),
    /missing required §8\.2 objects/,
    'must throw on incomplete CIM',
  );
});

test('certifyCIM accepts null §8.2 object values (not missing — just unknown)', () => {
  const cim = emptyCIM(); // all 12 keys present, all null
  assert.doesNotThrow(() => certifyCIM(cim));
});

// ════════════════════════════════════════════════════════════════
// SUITE 4 — assembleCIM mapping
// ════════════════════════════════════════════════════════════════
console.log('\nSuite 4 — assembleCIM mapping');

test('assembleCIM maps health objects into unified health{}', () => {
  const cim = assembleCIM({
    canonicalForEnrichment,
    healthScore:    { overallScore: 72, overallGrade: 'B', categoryScores: {} },
    healthIntelligence: { score: 72, status: 'good', drivers: [] },
    healthReport:   { summary: 'test' },
    report:         { opportunities: [] },
    executiveBrief: { priorityActions: [] },
    now:            () => '2026-07-01T00:00:00.000Z',
  });
  assert.ok(cim.health, 'health must be populated when healthScore is provided');
  assert.equal(cim.health.score, 72, 'health.score must match healthScore.overallScore');
  assert.equal(cim.health.grade, 'B', 'health.grade must match healthScore.overallGrade');
});

test('assembleCIM emits revenueSignals as RESERVED stub', () => {
  const cim = assembleCIM({
    canonicalForEnrichment,
    report: { opportunities: [] },
    executiveBrief: { priorityActions: [] },
    now: () => '2026-07-01T00:00:00.000Z',
  });
  assert.equal(cim.revenueSignals.status, 'RESERVED', 'revenueSignals must be RESERVED stub');
  assert.equal(cim.revenueSignals.data, null);
});

test('assembleCIM populates scanAuthority with anchor metadata', () => {
  const cim = assembleCIM({
    canonicalForEnrichment,
    report: { opportunities: [] },
    executiveBrief: { priorityActions: [] },
    now: () => '2026-07-01T00:00:00.000Z',
  });
  assert.ok(cim.scanAuthority, 'scanAuthority must be present');
  assert.equal(cim.scanAuthority._cimVersion, CIM_VERSION);
  assert.equal(cim.scanAuthority.anchorProvider, 'apple');
  assert.equal(cim.scanAuthority.reconciliationRule, 'identity-anchor-v1');
  assert.equal(cim.scanAuthority.generatedAt, '2026-07-01T00:00:00.000Z');
});

test('assembleCIM passes validateCIM', () => {
  const cim = assembleCIM({
    canonicalForEnrichment,
    report: { opportunities: [] },
    executiveBrief: { priorityActions: [] },
    now: () => '2026-07-01T00:00:00.000Z',
  });
  const { valid, missing } = validateCIM(cim);
  assert.ok(valid, `assembleCIM output must pass validateCIM; missing: ${missing.join(', ')}`);
});

test('assembleCIM + certifyCIM produces a certified frozen CIM', () => {
  const cim = assembleCIM({
    canonicalForEnrichment,
    report: { opportunities: [] },
    executiveBrief: { priorityActions: [] },
    now: () => '2026-07-01T00:00:00.000Z',
  });
  const certified = certifyCIM(cim, { generatedAt: '2026-07-01T00:00:00.000Z' });
  assert.ok(certified._certified, 'must be certified');
  assert.ok(Object.isFrozen(certified), 'must be frozen');
  assert.equal(certified._cimVersion, CIM_VERSION);
});

// ════════════════════════════════════════════════════════════════
// SUITE 5 — runRIE (Phase 1 Exit Gate — full integration)
// ════════════════════════════════════════════════════════════════
console.log('\nSuite 5 — runRIE (Phase 1 Exit Gate)');

await testAsync('runRIE produces a certified CIM from fixture evidence', async () => {
  const cim = await runRIE(
    { canonicalForEnrichment, publishingWorks: [] },
    { artistName: 'Radiohead', now: () => '2026-07-01T00:00:00.000Z' },
  );
  assert.ok(cim, 'runRIE must return a CIM');
  assert.equal(cim._certified, true, 'CIM must be certified');
  assert.equal(cim._cimVersion, CIM_VERSION, 'CIM must carry correct version');
  assert.ok(Object.isFrozen(cim), 'CIM must be frozen');
});

await testAsync('runRIE — all 12 §8.2 objects are present in the output', async () => {
  const cim = await runRIE(
    { canonicalForEnrichment, publishingWorks: [] },
    { artistName: 'Radiohead', now: () => '2026-07-01T00:00:00.000Z' },
  );
  const { valid, missing } = validateCIM(cim);
  assert.ok(valid, `All 12 §8.2 objects must be present; missing: ${missing.join(', ')}`);
});

await testAsync('runRIE — revenueSignals is RESERVED stub', async () => {
  const cim = await runRIE(
    { canonicalForEnrichment, publishingWorks: [] },
    { artistName: 'Radiohead', now: () => '2026-07-01T00:00:00.000Z' },
  );
  assert.equal(cim.revenueSignals.status, 'RESERVED');
});

await testAsync('runRIE — scanAuthority identifies Apple as anchor', async () => {
  const cim = await runRIE(
    { canonicalForEnrichment, publishingWorks: [] },
    { artistName: 'Radiohead', now: () => '2026-07-01T00:00:00.000Z' },
  );
  assert.equal(cim.scanAuthority.anchorProvider, 'apple');
  assert.equal(cim.scanAuthority.reconciliationRule, 'identity-anchor-v1');
  assert.equal(cim.scanAuthority.subjectName, 'Radiohead');
});

await testAsync('runRIE — handles missing publishingWorks gracefully', async () => {
  const cim = await runRIE(
    { canonicalForEnrichment },
    { artistName: 'Radiohead' },
  );
  assert.ok(cim._certified, 'must still produce a certified CIM when publishing is absent');
});

await testAsync('runRIE — handles null evidence gracefully (returns empty CIM, does not throw)', async () => {
  const cim = await runRIE({ canonicalForEnrichment: null }, {});
  assert.ok(cim._certified, 'must return a certified (if empty) CIM, never throw');
});

// ════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════
console.log(`\n────────────────────────────────────────`);
console.log(`RIE Phase 1 Exit Gate — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log(`Phase 1 exit gate: SATISFIED`);
console.log(`The RIE produces a certified Canonical Intelligence Model`);
console.log(`from provider evidence. All 12 §8.2 objects present,`);
console.log(`versioned (${CIM_VERSION}), and verified by ${passed} assertions.`);
