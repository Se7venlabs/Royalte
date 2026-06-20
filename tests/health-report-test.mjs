// ─────────────────────────────────────────────────────────────────────
//  Royaltē Health Engine™ — generateHealthReport() test suite (Phase 7)
// ─────────────────────────────────────────────────────────────────────
//
//  Validates generateHealthReport(cio, engineOutput) as a projection
//  wrapper that delegates all scoring to computeHealthScore(). No
//  second scoring algorithm; one canonical authority.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert }       from 'node:assert';
import { loadFixture }             from './fixtures/fixture-loader.mjs';
import { runIntelligenceEngine }   from '../api/_lib/intelligence-engine.js';
import { ALL_RULES }               from '../api/rules/index.js';
import {
  HEALTH_VERSION,
  computeHealthScore,
  generateHealthReport,
} from '../api/_lib/health-engine.js';

let passed = 0;
let failed = 0;
function it(name, fn) {
  try { fn(); passed += 1; console.log('  ✓ ', name); }
  catch (e) { failed += 1; console.log('  ✗ ', name + ': ' + (e && e.message ? e.message : String(e))); }
}

function engineOutputFor(fixtureName) {
  const cio = loadFixture(fixtureName);
  return runIntelligenceEngine(cio, ALL_RULES);
}

function isDeepFrozen(o) {
  if (o === null || typeof o !== 'object') return true;
  if (!Object.isFrozen(o)) return false;
  for (const k of Object.keys(o)) {
    if (!isDeepFrozen(o[k])) return false;
  }
  return true;
}

function isValidReport7(r) {
  if (!r || typeof r !== 'object') return false;
  for (const k of ['score','grade','trend','strengths','risks','opportunities',
                    'drivers','confidence','engineVersion','generatedAt']) {
    if (!(k in r)) return false;
  }
  return (
    typeof r.score === 'number' &&
    typeof r.grade === 'string' &&
    typeof r.trend === 'string' &&
    Array.isArray(r.strengths) &&
    Array.isArray(r.risks) &&
    Array.isArray(r.opportunities) &&
    Array.isArray(r.drivers)
  );
}

const FIXTURES = [
  'artist-empty',
  'artist-perfect',
  'artist-duplicate-profiles',
  'artist-missing-publishing',
  'artist-orphan-recordings',
  'artist-fragmented-catalog',
  'artist-metadata-conflicts',
  'catalog-well-structured',
];

console.log('');
console.log('════════════════════════════════════════════');
console.log('  Royaltē Health Engine™ — generateHealthReport() suite');
console.log('════════════════════════════════════════════');
console.log('');

// ─── Input tolerance ─────────────────────────────────────────────────

it('01 null engineOutput → valid report, no throw', () => {
  const r = generateHealthReport({}, null);
  assert.ok(isValidReport7(r), 'invalid report shape');
  assert.equal(r.score, 0);
  assert.equal(r.grade, 'F');
});

it('02 undefined engineOutput → valid report, no throw', () => {
  const r = generateHealthReport({}, undefined);
  assert.ok(isValidReport7(r));
});

it('03 garbage string engineOutput → valid report, no throw', () => {
  const r = generateHealthReport({}, 'not an object');
  assert.ok(isValidReport7(r));
});

it('04 empty object engineOutput → valid report, no throw', () => {
  const r = generateHealthReport({}, {});
  assert.ok(isValidReport7(r));
});

it('05 null cio is tolerated', () => {
  const eo = engineOutputFor('artist-perfect');
  const r  = generateHealthReport(null, eo);
  assert.ok(isValidReport7(r));
});

// ─── Delegation to computeHealthScore ────────────────────────────────

it('06 score matches computeHealthScore().overallScore', () => {
  const eo        = engineOutputFor('artist-perfect');
  const canonical = computeHealthScore(eo);
  const r         = generateHealthReport({}, eo);
  assert.equal(r.score, canonical.overallScore,
    `score ${r.score} !== canonical ${canonical.overallScore}`);
});

it('07 grade matches computeHealthScore().overallGrade', () => {
  const eo        = engineOutputFor('artist-perfect');
  const canonical = computeHealthScore(eo);
  const r         = generateHealthReport({}, eo);
  assert.equal(r.grade, canonical.overallGrade);
});

it('08 score and grade delegation holds for all 8 golden fixtures', () => {
  for (const f of FIXTURES) {
    const eo        = engineOutputFor(f);
    const canonical = computeHealthScore(eo);
    const r         = generateHealthReport({}, eo);
    assert.equal(r.score, canonical.overallScore,
      `${f}: score ${r.score} !== canonical ${canonical.overallScore}`);
    assert.equal(r.grade, canonical.overallGrade,
      `${f}: grade ${r.grade} !== canonical ${canonical.overallGrade}`);
  }
});

// ─── Score bounds ─────────────────────────────────────────────────────

it('09 score is always 0–100', () => {
  for (const f of FIXTURES) {
    const r = generateHealthReport({}, engineOutputFor(f));
    assert.ok(r.score >= 0 && r.score <= 100,
      `${f}: score out of bounds: ${r.score}`);
  }
});

// ─── Trend ───────────────────────────────────────────────────────────

it('10 trend is always "Unknown" for Phase 7', () => {
  for (const f of FIXTURES) {
    const r = generateHealthReport({}, engineOutputFor(f));
    assert.equal(r.trend, 'Unknown', `${f}: trend was ${r.trend}`);
  }
});

it('11 trend is "Unknown" on empty engineOutput', () => {
  assert.equal(generateHealthReport({}, {}).trend, 'Unknown');
});

// ─── Confidence passthrough ───────────────────────────────────────────

it('12 confidence passed through when present as string', () => {
  const eo = { ...engineOutputFor('artist-perfect'), confidence: 'HIGH' };
  const r  = generateHealthReport({}, eo);
  assert.equal(r.confidence, 'HIGH');
});

it('13 confidence defaults to empty string when absent', () => {
  assert.equal(generateHealthReport({}, {}).confidence, '');
});

it('14 confidence defaults to empty string on non-string value', () => {
  assert.equal(generateHealthReport({}, { confidence: 42 }).confidence, '');
});

// ─── Arrays passthrough ───────────────────────────────────────────────

it('15 strengths array passed through from engineOutput', () => {
  const eo = engineOutputFor('artist-perfect');
  const r  = generateHealthReport({}, eo);
  assert.equal(r.strengths.length, eo.strengths.length);
});

it('16 risks array passed through from engineOutput', () => {
  const eo = engineOutputFor('artist-missing-publishing');
  const r  = generateHealthReport({}, eo);
  assert.equal(r.risks.length, eo.risks.length);
});

it('17 opportunities array passed through from engineOutput', () => {
  const eo = engineOutputFor('artist-duplicate-profiles');
  const r  = generateHealthReport({}, eo);
  assert.equal(r.opportunities.length, eo.opportunities.length);
});

// ─── Drivers ─────────────────────────────────────────────────────────

it('18 drivers contain all risk and strength titles (order-independent)', () => {
  const eo       = engineOutputFor('artist-missing-publishing');
  const r        = generateHealthReport({}, eo);
  const expected = [
    ...eo.risks.map(x => x.title),
    ...eo.strengths.map(x => x.title),
  ].filter(Boolean);
  assert.deepEqual([...r.drivers].sort(), [...expected].sort());
});

it('19 drivers contain no null/undefined elements', () => {
  for (const f of FIXTURES) {
    const r = generateHealthReport({}, engineOutputFor(f));
    assert.ok(r.drivers.every(d => typeof d === 'string' && d.length > 0),
      `${f}: drivers contain non-string element`);
  }
});

it('20 drivers are empty when no risks or strengths', () => {
  const eo = {
    ...engineOutputFor('artist-empty'),
    risks:         [],
    strengths:     [],
    opportunities: [],
  };
  const r = generateHealthReport({}, eo);
  assert.equal(r.drivers.length, 0);
});

// ─── Metadata ─────────────────────────────────────────────────────────

it('21 engineVersion is HEALTH_VERSION', () => {
  const r = generateHealthReport({}, engineOutputFor('artist-perfect'));
  assert.equal(r.engineVersion, HEALTH_VERSION);
});

it('22 generatedAt inherited from engineOutput when present', () => {
  const eo = {
    ...engineOutputFor('artist-perfect'),
    generatedAt: '2026-06-20T00:00:00.000Z',
  };
  const r = generateHealthReport({}, eo);
  assert.equal(r.generatedAt, '2026-06-20T00:00:00.000Z');
});

it('23 generatedAt defaults to empty string when absent', () => {
  assert.equal(generateHealthReport({}, {}).generatedAt, '');
});

// ─── Determinism ─────────────────────────────────────────────────────

it('24 deterministic: same input → identical JSON', () => {
  const eo = engineOutputFor('artist-fragmented-catalog');
  const a  = generateHealthReport({}, eo);
  const b  = generateHealthReport({}, eo);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── Immutability ─────────────────────────────────────────────────────

it('25 output is deeply frozen', () => {
  const r = generateHealthReport({}, engineOutputFor('artist-perfect'));
  assert.ok(isDeepFrozen(r), 'report is not deeply frozen');
});

it('26 engineOutput not mutated after call', () => {
  const eo     = engineOutputFor('artist-fragmented-catalog');
  const before = JSON.stringify(eo);
  generateHealthReport({}, eo);
  assert.equal(JSON.stringify(eo), before, 'engineOutput was mutated');
});

it('27 CIO not mutated after call', () => {
  const cio    = loadFixture('artist-perfect');
  const eo     = runIntelligenceEngine(cio, ALL_RULES);
  const before = JSON.stringify(cio);
  generateHealthReport(cio, eo);
  assert.equal(JSON.stringify(cio), before, 'CIO was mutated');
});

// ─── Golden fixture coverage ──────────────────────────────────────────

it('28 all 8 golden fixtures produce valid Health Reports', () => {
  for (const f of FIXTURES) {
    const r = generateHealthReport({}, engineOutputFor(f));
    assert.ok(isValidReport7(r), `${f}: invalid report shape`);
    assert.ok(['A+','A','B','C','D','F'].includes(r.grade),
      `${f}: invalid grade: ${r.grade}`);
  }
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
if (failed === 0) {
  console.log('  ════════════════════════════════════════════');
  console.log('  HEALTH REPORT VERIFIED: ' + passed + ' assertions passed');
  console.log('  ════════════════════════════════════════════');
  process.exit(0);
} else {
  console.log('  FAILED: ' + failed + ' / ' + (failed + passed));
  process.exit(1);
}
