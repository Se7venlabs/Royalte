// ─────────────────────────────────────────────────────────────────────
//  Royaltē Golden Fixture Library™ — unit tests (Phase 6.5)
// ─────────────────────────────────────────────────────────────────────
//
//  30 deterministic assertions per the Board-ratified Phase 6.5 brief.
//
//  Test strategy:
//    - Load each of the 7 fixtures through tests/fixtures/fixture-loader.mjs
//    - Run runIntelligenceEngine(fixture, ALL_RULES) from the Phase 6
//      engine + Phase 5 Rule Library
//    - Snapshot the output, run the engine again with the same input,
//      compare JSON.stringify of both outputs (determinism)
//    - Assert each fixture fires its expected observation pattern
//    - Verify the loader returns a deep clone (not a reference)
//    - Verify fixtures are not mutated by either the loader or the engine
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/golden-fixture-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { execSync }         from 'node:child_process';
import { readFileSync }     from 'node:fs';
import { fileURLToPath }    from 'node:url';
import { dirname, join }    from 'node:path';

import { loadFixture, listFixtures } from './fixtures/fixture-loader.mjs';
import { runIntelligenceEngine }     from '../api/_lib/intelligence-engine.js';
import { ALL_RULES }                 from '../api/rules/index.js';
import { SEVERITY }                  from '../api/schema/intelligence.js';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR  = join(__dirname, 'fixtures');

const FIXTURE_NAMES = [
  'artist-empty',
  'artist-perfect',
  'artist-duplicate-profiles',
  'artist-missing-publishing',
  'artist-orphan-recordings',
  'artist-fragmented-catalog',
  'artist-metadata-conflicts',
  'catalog-well-structured',   // Phase 6C — Canonical Catalog Model™ v1.0 shape
];

function rawJson(name) {
  return readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8');
}

function rawParsed(name) {
  return JSON.parse(rawJson(name));
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
//  Loading (1–8)
// ═════════════════════════════════════════════════════════════════════

test('1.  artist-empty loads successfully', () => {
  const cio = loadFixture('artist-empty');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-empty');
});

test('2.  artist-empty deep clone (not the same reference across calls)', () => {
  const a = loadFixture('artist-empty');
  const b = loadFixture('artist-empty');
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.identity, b.identity);
  assert.deepStrictEqual(a, b);
});

test('3.  artist-perfect loads successfully', () => {
  const cio = loadFixture('artist-perfect');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-perfect');
});

test('4.  artist-duplicate-profiles loads successfully', () => {
  const cio = loadFixture('artist-duplicate-profiles');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-duplicate-profiles');
});

test('5.  artist-missing-publishing loads successfully', () => {
  const cio = loadFixture('artist-missing-publishing');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-missing-publishing');
});

test('6.  artist-orphan-recordings loads successfully', () => {
  const cio = loadFixture('artist-orphan-recordings');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-orphan-recordings');
});

test('7.  artist-fragmented-catalog loads successfully', () => {
  const cio = loadFixture('artist-fragmented-catalog');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-fragmented-catalog');
});

test('8.  artist-metadata-conflicts loads successfully', () => {
  const cio = loadFixture('artist-metadata-conflicts');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'artist-metadata-conflicts');
});

// ═════════════════════════════════════════════════════════════════════
//  Loader edge cases (9–10)
// ═════════════════════════════════════════════════════════════════════

test('9.  loadFixture("nonexistent") returns null', () => {
  assert.equal(loadFixture('nonexistent'),         null);
  assert.equal(loadFixture(''),                    null);
  assert.equal(loadFixture(null),                  null);
  assert.equal(loadFixture(undefined),             null);
  assert.equal(loadFixture(42),                    null);
  // Path-traversal rejection
  assert.equal(loadFixture('../api/audit'),        null);
  assert.equal(loadFixture('subdir/something'),    null);
});

test('10. listFixtures() returns the 8 fixture names, sorted', () => {
  const names = listFixtures();
  assert.deepStrictEqual(names, [...FIXTURE_NAMES].sort());
  assert.equal(names.length, 8);
});

// ═════════════════════════════════════════════════════════════════════
//  Engine behaviour per fixture (11–18)
// ═════════════════════════════════════════════════════════════════════

test('11. artist-empty → engine returns a valid output and never throws', () => {
  const cio = loadFixture('artist-empty');
  let out;
  assert.doesNotThrow(() => { out = runIntelligenceEngine(cio, ALL_RULES); });
  assert.ok(out);
  assert.ok(Array.isArray(out.observations));
  assert.ok(Array.isArray(out.coverage));
  assert.deepStrictEqual(out.observations, []);
  assert.deepStrictEqual(out.risks,         []);
  assert.deepStrictEqual(out.strengths,     []);
  assert.deepStrictEqual(out.opportunities, []);
});

test('12. artist-perfect → engine produces a non-empty strengths[]', () => {
  const out = runIntelligenceEngine(loadFixture('artist-perfect'), ALL_RULES);
  assert.ok(out.strengths.length >= 1, 'expected at least one strength entry');
  const titles = out.strengths.map((s) => s.title);
  // Both strength rules should fire on the perfect fixture
  assert.ok(titles.includes('Strong publishing coverage'));
  assert.ok(titles.includes('Complete catalog delivery verified'));
});

test('13. artist-perfect → engine produces an empty risks[]', () => {
  const out = runIntelligenceEngine(loadFixture('artist-perfect'), ALL_RULES);
  assert.deepStrictEqual(out.risks, []);
});

test('14. artist-duplicate-profiles → engine produces an IDENTITY observation', () => {
  const out = runIntelligenceEngine(loadFixture('artist-duplicate-profiles'), ALL_RULES);
  const obs = out.observations.find((o) => o.title === 'Duplicate artist profiles detected');
  assert.ok(obs, `expected duplicate-profiles observation; got: ${JSON.stringify(out.observations.map((o) => o.title))}`);
  assert.equal(obs.category, 'IDENTITY');
  assert.equal(obs.severity, SEVERITY.MEDIUM);
});

test('15. artist-missing-publishing → engine produces a PUBLISHING HIGH observation', () => {
  const out = runIntelligenceEngine(loadFixture('artist-missing-publishing'), ALL_RULES);
  const obs = out.observations.find((o) => o.title === 'No publishing registrations found');
  assert.ok(obs);
  assert.equal(obs.category, 'PUBLISHING');
  assert.equal(obs.severity, SEVERITY.HIGH);
  // And it shows up in risks[]
  const inRisks = out.risks.find((r) => r.title === 'No publishing registrations found');
  assert.ok(inRisks);
});

test('16. artist-orphan-recordings → engine produces a CATALOG HIGH observation', () => {
  const out = runIntelligenceEngine(loadFixture('artist-orphan-recordings'), ALL_RULES);
  const obs = out.observations.find((o) => o.title === 'Orphan recordings detected');
  assert.ok(obs);
  assert.equal(obs.category, 'CATALOG');
  assert.equal(obs.severity, SEVERITY.HIGH);
  const inRisks = out.risks.find((r) => r.title === 'Orphan recordings detected');
  assert.ok(inRisks);
});

test('17. artist-fragmented-catalog → engine produces a CATALOG observation', () => {
  const out = runIntelligenceEngine(loadFixture('artist-fragmented-catalog'), ALL_RULES);
  const obs = out.observations.find((o) => o.category === 'CATALOG');
  assert.ok(obs, 'expected at least one CATALOG observation');
  // The mismatch rule fires at MEDIUM
  assert.equal(obs.title,    'Catalog count inconsistency detected');
  assert.equal(obs.severity, SEVERITY.MEDIUM);
});

test('18. artist-metadata-conflicts → engine produces METADATA observations', () => {
  const out = runIntelligenceEngine(loadFixture('artist-metadata-conflicts'), ALL_RULES);
  const mdObs = out.observations.filter((o) => o.category === 'METADATA');
  assert.equal(mdObs.length, 3, `expected 3 metadata observations, got ${mdObs.length}: ${JSON.stringify(mdObs.map((o) => o.title))}`);
  const titles = mdObs.map((o) => o.title);
  assert.ok(titles.includes('Missing credits detected'));
  assert.ok(titles.includes('Duplicate releases detected'));
  assert.ok(titles.includes('Metadata inconsistencies found'));
});

// ═════════════════════════════════════════════════════════════════════
//  Determinism per fixture (19–25)
// ═════════════════════════════════════════════════════════════════════

function assertDeterministic(name) {
  const a = runIntelligenceEngine(loadFixture(name), ALL_RULES);
  const b = runIntelligenceEngine(loadFixture(name), ALL_RULES);
  assert.equal(JSON.stringify(a), JSON.stringify(b), `${name} not deterministic`);
}

test('19. artist-empty → deterministic',               () => assertDeterministic('artist-empty'));
test('20. artist-perfect → deterministic',             () => assertDeterministic('artist-perfect'));
test('21. artist-duplicate-profiles → deterministic',  () => assertDeterministic('artist-duplicate-profiles'));
test('22. artist-missing-publishing → deterministic',  () => assertDeterministic('artist-missing-publishing'));
test('23. artist-orphan-recordings → deterministic',   () => assertDeterministic('artist-orphan-recordings'));
test('24. artist-fragmented-catalog → deterministic',  () => assertDeterministic('artist-fragmented-catalog'));
test('25. artist-metadata-conflicts → deterministic',  () => assertDeterministic('artist-metadata-conflicts'));

// ═════════════════════════════════════════════════════════════════════
//  Immutability + housekeeping (26–30)
// ═════════════════════════════════════════════════════════════════════

test('26. Fixture is not mutated after engine run (re-read from disk)', () => {
  for (const name of FIXTURE_NAMES) {
    const before = rawJson(name);
    const cio = loadFixture(name);
    runIntelligenceEngine(cio, ALL_RULES);
    const after  = rawJson(name);
    assert.equal(after, before, `${name} on-disk fixture changed after engine run`);
  }
});

test('27. Pipeline test (tests/pipeline-test.mjs) still passes', () => {
  // Invoke the pipeline test as a subprocess; exit code 0 = pass.
  // stdio:'pipe' suppresses its output during this run.
  assert.doesNotThrow(() => {
    execSync('node tests/pipeline-test.mjs', { stdio: 'pipe' });
  });
});

test('28. All 7 fixtures carry a _fixtureVersion field', () => {
  for (const name of FIXTURE_NAMES) {
    const cio = loadFixture(name);
    assert.equal(typeof cio._fixtureVersion, 'string');
    assert.match(cio._fixtureVersion, /^\d+\.\d+\.\d+$/, `${name}._fixtureVersion is not semver`);
  }
});

test('29. All 7 fixtures carry a _fixtureName field that matches the file name', () => {
  for (const name of FIXTURE_NAMES) {
    const cio = loadFixture(name);
    assert.equal(cio._fixtureName, name);
  }
});

test('30. loadFixture returns a deep clone — mutating the result does not affect future loads', () => {
  const name = 'artist-empty';
  const first = loadFixture(name);
  // Mutate the cloned result aggressively
  first.identity.canonicalArtistName = 'MUTATED';
  first.identity.externalProfiles.push({ provider: 'mutated', profileId: 'X' });
  first.publishing.worksCount = 99999;
  first.catalog.recordings.push({ isrc: 'MUTATED-1' });
  // Reload from disk + compare to the on-disk truth
  const second   = loadFixture(name);
  const onDisk   = rawParsed(name);
  assert.deepStrictEqual(second, onDisk);
  assert.notDeepStrictEqual(second, first);
});

// ═════════════════════════════════════════════════════════════════════
//  Phase 6C — catalog-well-structured fixture (31–35)
// ═════════════════════════════════════════════════════════════════════

test('31. catalog-well-structured loads successfully', () => {
  const cio = loadFixture('catalog-well-structured');
  assert.ok(cio);
  assert.equal(cio._fixtureName, 'catalog-well-structured');
});

test('32. catalog-well-structured — catalogModel has the locked v1.0 shape', () => {
  const cio = loadFixture('catalog-well-structured');
  const cm  = cio.catalog.catalogModel;
  assert.ok(cm, 'catalogModel must be present');
  assert.equal(cm.modelVersion,      '1.0.0');
  assert.equal(cm.catalogVersion,    null,  'catalogVersion must be null (RESERVED)');
  assert.equal(cm.releases.length,   3,     'three releases');
  assert.equal(cm.recordings.length, 5,     'five recordings');
  assert.equal(cm.releasesCount,     3,     'releasesCount matches releases.length');
  assert.equal(cm.byProvider.apple,   3,    'byProvider.apple = 3');
  assert.equal(cm.byProvider.spotify, 3,    'byProvider.spotify = 3');
  assert.equal(cm.upcCoverage,     null,    'upcCoverage must be null');
  assert.equal(cm.contributorData, null,    'contributorData must be null');
});

test('33. catalog-well-structured — all releases confirmed on both Apple and Spotify', () => {
  const cio      = loadFixture('catalog-well-structured');
  const releases = cio.catalog.catalogModel.releases;
  for (const r of releases) {
    assert.ok(r.externalIds.apple,             `release "${r.title}" must have an Apple ID`);
    assert.ok(r.externalIds.spotify,           `release "${r.title}" must have a Spotify ID`);
    assert.ok(r.providers.includes('apple'),   `release "${r.title}" must list apple in providers`);
    assert.ok(r.providers.includes('spotify'), `release "${r.title}" must list spotify in providers`);
  }
});

test('34. catalog-well-structured — engine produces CATALOG strength via catalog.complete-delivery-verified', () => {
  const out             = runIntelligenceEngine(loadFixture('catalog-well-structured'), ALL_RULES);
  const catalogStrength = out.strengths.find((s) => s.category === 'CATALOG');
  assert.ok(catalogStrength, 'expected at least one CATALOG strength observation');
  // Bind to the stable Rule Library identifier, not mutable UX title copy
  assert.equal(catalogStrength.ruleId, 'catalog.complete-delivery-verified');
});

test('35. catalog-well-structured → deterministic', () => assertDeterministic('catalog-well-structured'));

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  GOLDEN FIXTURE LIBRARY VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
