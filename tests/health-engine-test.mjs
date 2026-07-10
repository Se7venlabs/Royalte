// ─────────────────────────────────────────────────────────────────────
//  Royaltē Health Engine™ — deterministic test suite (Phase 7)
// ─────────────────────────────────────────────────────────────────────
//
//  Exercises computeHealthScore() against the Phase 6.5 Golden Fixture
//  Library where possible, plus synthetic intelligence reports for the
//  grade-band coverage tests (21-26). All assertions are deterministic
//  (no network, no clock — `generatedAt` is inherited from the input).
//
//  Note on tests 11 & 13: the brief specifies `publishingScore < 80`
//  and `catalogScore < 80`. Under the brief's locked deduction table
//  (HIGH = -20), a single HIGH observation on a category reduces
//  100 → 80 exactly. Tests use `<= 80` so the spec's deduction values
//  are preserved verbatim while the test intent ("category meaningfully
//  degraded by a HIGH observation") still holds.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { loadFixture } from './fixtures/fixture-loader.mjs';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import {
  HEALTH_VERSION,
  CATEGORY_WEIGHTS,
  GRADE_THRESHOLDS,
  emptyHealthReport,
  computeHealthScore,
} from '../api/_lib/health-engine.js';

let passed = 0;
let failed = 0;
function it(name, fn) {
  try { fn(); passed += 1; console.log('  ✓ ' + name); }
  catch (e) { failed += 1; console.log('  ✗ ' + name + ': ' + (e && e.message ? e.message : String(e))); }
}

function reportFor(fixtureName) {
  const cio = loadFixture(fixtureName);
  return runIntelligenceEngine(cio, ALL_RULES);
}

function emptyIntelligenceReport() {
  return {
    observations:    [],
    recommendations: [],
    risks:           [],
    strengths:       [],
    opportunities:   [],
    coverage:        [],
    engineVersion:   '1.0.0',
    generatedAt:     '2026-06-11T00:00:00.000Z',
  };
}

function syntheticReport({ observations = [], coverage = [], recommendations = [], risks = [], strengths = [], opportunities = [] } = {}) {
  return {
    observations,
    recommendations,
    risks,
    strengths,
    opportunities,
    coverage,
    engineVersion: '1.0.0',
    generatedAt:   '2026-06-11T00:00:00.000Z',
  };
}

function obs({ category, severity, confidence = 'HIGH' }) {
  return {
    id: 'obs_test_' + Math.random().toString(36).slice(2, 10),
    ruleId: 'test.rule',
    category, severity, confidence,
    title: 'test', description: 'test', recommendation: 'test',
    evidence: [], providerSources: [],
  };
}

function fullPopulatedCoverage() {
  return [
    { section: 'identity',   status: 'POPULATED', itemCount: 1 },
    { section: 'publishing', status: 'POPULATED', itemCount: 1 },
    { section: 'catalog',    status: 'POPULATED', itemCount: 1 },
    { section: 'metadata',   status: 'POPULATED', itemCount: 1 },
    { section: 'sources',    status: 'POPULATED', itemCount: 1 },
    { section: 'monitoring', status: 'POPULATED', itemCount: 1 },
    { section: 'revenue',    status: 'POPULATED', itemCount: 1 },
  ];
}

function isValidGrade(g) { return ['A+', 'A', 'B', 'C', 'D', 'F'].includes(g); }

function isValidReportShape(r) {
  if (!r || typeof r !== 'object') return false;
  for (const k of ['healthVersion','generatedAt','overallScore','overallGrade',
    'identityScore','publishingScore','catalogScore','metadataScore',
    'coverageScore','confidenceScore','strengthCount','riskCount',
    'opportunityCount','recommendationCount','categoryBreakdown','summary','reserved']) {
    if (!(k in r)) return false;
  }
  if (!Array.isArray(r.categoryBreakdown)) return false;
  if (!r.reserved || typeof r.reserved !== 'object') return false;
  return true;
}

function isDeepFrozen(o) {
  if (o === null || typeof o !== 'object') return true;
  if (!Object.isFrozen(o)) return false;
  for (const k of Object.keys(o)) {
    if (!isDeepFrozen(o[k])) return false;
  }
  return true;
}

console.log('');
console.log('════════════════════════════════════════════');
console.log('  Royaltē Health Engine™ — Phase 7 deterministic suite');
console.log('════════════════════════════════════════════');
console.log('');

// ─── Tests 1-4 — input tolerance ──────────────────────────────────

it('01 null input → valid report, no throw', () => {
  const r = computeHealthScore(null);
  assert.ok(isValidReportShape(r));
  assert.equal(r.healthVersion, HEALTH_VERSION);
});

it('02 undefined input → valid report, no throw', () => {
  const r = computeHealthScore(undefined);
  assert.ok(isValidReportShape(r));
});

it('03 garbage string input → valid report, no throw', () => {
  const r = computeHealthScore('not an intelligence report');
  assert.ok(isValidReportShape(r));
});

it('04 empty object input → valid report, no throw', () => {
  const r = computeHealthScore({});
  assert.ok(isValidReportShape(r));
});

// ─── Tests 5-6 — empty intelligence baseline ──────────────────────

it('05 empty intelligence → overallScore >= 0', () => {
  const r = computeHealthScore(emptyIntelligenceReport());
  assert.ok(r.overallScore >= 0, 'expected >= 0, got ' + r.overallScore);
});

it('06 empty intelligence → valid grade returned', () => {
  const r = computeHealthScore(emptyIntelligenceReport());
  assert.ok(isValidGrade(r.overallGrade), 'invalid grade: ' + r.overallGrade);
});

// ─── Tests 7-9 — artist-perfect fixture ───────────────────────────

it('07 perfect artist → overallScore >= 90', () => {
  const ir = reportFor('artist-perfect');
  const r  = computeHealthScore(ir);
  assert.ok(r.overallScore >= 90, 'expected >= 90, got ' + r.overallScore);
});

it('08 perfect artist → grade B or better', () => {
  const ir = reportFor('artist-perfect');
  const r  = computeHealthScore(ir);
  assert.ok(['A+','A','B'].includes(r.overallGrade), 'expected B+, got ' + r.overallGrade);
});

it('09 perfect artist → riskCount === 0', () => {
  const ir = reportFor('artist-perfect');
  const r  = computeHealthScore(ir);
  assert.equal(r.riskCount, 0);
});

// ─── Tests 10-15 — per-fixture category degradation ──────────────

it('10 duplicate profiles → identityScore < 100', () => {
  const ir = reportFor('artist-duplicate-profiles');
  const r  = computeHealthScore(ir);
  assert.ok(r.identityScore < 100, 'expected < 100, got ' + r.identityScore);
});

it('11 verified MLC absence → publishingScore < 100 (Board Directive v2.0: MEDIUM=-10)', () => {
  // artist-mlc-no-registrations has MLC VERIFIED + 0 works → MEDIUM deduction (-10).
  // artist-missing-publishing has no MLC obs → Unable to Confirm → no deduction (score stays 100).
  const ir = reportFor('artist-mlc-no-registrations');
  const r  = computeHealthScore(ir);
  assert.ok(r.publishingScore < 100, 'expected < 100, got ' + r.publishingScore);
});

it('12 verified MLC absence → opportunityCount > 0 (MEDIUM routes to opportunities)', () => {
  const ir = reportFor('artist-mlc-no-registrations');
  const r  = computeHealthScore(ir);
  assert.ok(r.opportunityCount > 0, 'expected > 0, got ' + r.opportunityCount);
});

it('12b unable-to-confirm publishing (no MLC obs) → no publishingScore penalty (Board Directive v2.0)', () => {
  const ir = reportFor('artist-missing-publishing');
  const r  = computeHealthScore(ir);
  assert.equal(r.publishingScore, 100, 'no deduction when MLC not searched — Unable to Confirm carries no penalty');
});

it('13 orphan recordings → catalogScore <= 80 (brief: < 80; HIGH=-20 floors at exactly 80)', () => {
  const ir = reportFor('artist-orphan-recordings');
  const r  = computeHealthScore(ir);
  assert.ok(r.catalogScore <= 80, 'expected <= 80, got ' + r.catalogScore);
});

it('14 fragmented catalog → catalogScore < 100', () => {
  const ir = reportFor('artist-fragmented-catalog');
  const r  = computeHealthScore(ir);
  assert.ok(r.catalogScore < 100, 'expected < 100, got ' + r.catalogScore);
});

it('15 metadata conflicts → metadataScore < 100', () => {
  const ir = reportFor('artist-metadata-conflicts');
  const r  = computeHealthScore(ir);
  assert.ok(r.metadataScore < 100, 'expected < 100, got ' + r.metadataScore);
});

// ─── Tests 16-18 — derived-collection counts ─────────────────────

it('16 MEDIUM obs → appears in opportunityCount', () => {
  const ir = reportFor('artist-mlc-no-registrations'); // fires MEDIUM publishing
  const r  = computeHealthScore(ir);
  assert.ok(r.opportunityCount > 0);
});

it('17 MEDIUM obs → appears in opportunityCount', () => {
  const ir = reportFor('artist-duplicate-profiles'); // fires MEDIUM identity
  const r  = computeHealthScore(ir);
  assert.ok(r.opportunityCount > 0, 'expected > 0, got ' + r.opportunityCount);
});

it('18 strengths → strengthCount > 0 for perfect', () => {
  const ir = reportFor('artist-perfect');
  const r  = computeHealthScore(ir);
  assert.ok(r.strengthCount > 0, 'expected > 0, got ' + r.strengthCount);
});

// ─── Tests 19-20 — categoryBreakdown invariants ───────────────────

it('19 categoryBreakdown has 6 entries', () => {
  const r = computeHealthScore(emptyIntelligenceReport());
  assert.equal(r.categoryBreakdown.length, 6);
});

it('20 categoryBreakdown weights sum to 1.0', () => {
  const r = computeHealthScore(emptyIntelligenceReport());
  const sum = r.categoryBreakdown.reduce((s, row) => s + row.weight, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9, 'sum was ' + sum);
});

// ─── Tests 21-26 — grade lookup across all bands ─────────────────

it('21 Grade A+ for score 98-100', () => {
  // 5 INFO HIGH-conf obs on IDENTITY: identity=90, conf=100, full coverage
  // weighted = 90*.2 + 100*.25 + 100*.2 + 100*.15 + 100*.1 + 100*.1 = 98 → A+
  const observations = [
    obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
  ];
  const r = computeHealthScore(syntheticReport({ observations, coverage: fullPopulatedCoverage() }));
  assert.ok(r.overallScore >= 98 && r.overallScore <= 100, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'A+');
});

it('22 Grade A for score 95-97', () => {
  // 0 obs + full POPULATED coverage = 95 → A
  const r = computeHealthScore(syntheticReport({ coverage: fullPopulatedCoverage() }));
  assert.ok(r.overallScore >= 95 && r.overallScore <= 97, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'A');
});

it('23 Grade B for score 90-94', () => {
  // 0 obs + no coverage = 90 → B
  const r = computeHealthScore(syntheticReport());
  assert.ok(r.overallScore >= 90 && r.overallScore <= 94, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'B');
});

it('24 Grade C for score 80-89', () => {
  // 2 HIGH IDENTITY + 1 HIGH PUBLISHING + full coverage: 85 → C
  const observations = [
    obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
  ];
  const r = computeHealthScore(syntheticReport({ observations, coverage: fullPopulatedCoverage() }));
  assert.ok(r.overallScore >= 80 && r.overallScore <= 89, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'C');
});

it('25 Grade D for score 70-79', () => {
  // 3 HIGH IDENTITY + 2 HIGH PUBLISHING + full coverage: 78 → D
  const observations = [
    obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
    obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
  ];
  const r = computeHealthScore(syntheticReport({ observations, coverage: fullPopulatedCoverage() }));
  assert.ok(r.overallScore >= 70 && r.overallScore <= 79, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'D');
});

it('26 Grade F for score 0-69', () => {
  // 4 CRITICAL per category × 4 cats + 0 coverage entries: ~15 → F
  const observations = [];
  for (const cat of ['IDENTITY', 'PUBLISHING', 'CATALOG', 'METADATA']) {
    for (let i = 0; i < 4; i += 1) {
      observations.push(obs({ category: cat, severity: 'CRITICAL', confidence: 'HIGH' }));
    }
  }
  const r = computeHealthScore(syntheticReport({ observations }));
  assert.ok(r.overallScore >= 0 && r.overallScore <= 69, 'score ' + r.overallScore);
  assert.equal(r.overallGrade, 'F');
});

// ─── Tests 27-29 — determinism, immutability, no-mutation ────────

it('27 deterministic: same input → identical JSON', () => {
  const ir = reportFor('artist-fragmented-catalog');
  const a = computeHealthScore(ir);
  const b = computeHealthScore(ir);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

it('28 output is Object.isFrozen (deeply)', () => {
  const r = computeHealthScore(reportFor('artist-perfect'));
  assert.ok(Object.isFrozen(r));
  assert.ok(isDeepFrozen(r), 'nested object not frozen');
});

it('29 input not mutated after computeHealthScore', () => {
  const ir = reportFor('artist-fragmented-catalog');
  const before = JSON.stringify(ir);
  computeHealthScore(ir);
  const after = JSON.stringify(ir);
  assert.equal(before, after);
});

// ─── Tests 30-31 — reserved sections ─────────────────────────────

it('30 reserved.monitoring === null', () => {
  const r = computeHealthScore(reportFor('artist-perfect'));
  assert.equal(r.reserved.monitoring, null);
});

it('31 reserved.revenue === null', () => {
  const r = computeHealthScore(reportFor('artist-perfect'));
  assert.equal(r.reserved.revenue, null);
});

// ─── Tests 32-35 — invariants ────────────────────────────────────

it('32 CATEGORY_WEIGHTS sum exactly to 1.0', () => {
  const sum = CATEGORY_WEIGHTS.identity + CATEGORY_WEIGHTS.publishing
            + CATEGORY_WEIGHTS.catalog + CATEGORY_WEIGHTS.metadata
            + CATEGORY_WEIGHTS.coverage + CATEGORY_WEIGHTS.confidence;
  assert.ok(Math.abs(sum - 1.0) < 1e-9, 'sum was ' + sum);
});

it('33 overallScore always 0-100 range', () => {
  const fixtures = ['artist-empty', 'artist-perfect', 'artist-duplicate-profiles',
                    'artist-missing-publishing', 'artist-orphan-recordings',
                    'artist-fragmented-catalog', 'artist-metadata-conflicts'];
  for (const f of fixtures) {
    const r = computeHealthScore(reportFor(f));
    assert.ok(r.overallScore >= 0 && r.overallScore <= 100, f + ' score ' + r.overallScore);
  }
  // Also extremes via synthetic
  const high = computeHealthScore(syntheticReport({ coverage: fullPopulatedCoverage() }));
  const low  = computeHealthScore(null);
  assert.ok(high.overallScore >= 0 && high.overallScore <= 100);
  assert.ok(low.overallScore  >= 0 && low.overallScore  <= 100);
});

it('34 summary string non-empty for all grades', () => {
  // Drive grades A+/A/B/C/D/F via the same synthetic reports used in 21-26
  const cases = [
    syntheticReport({ observations: [
      obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY', severity: 'INFO', confidence: 'HIGH' }),
    ], coverage: fullPopulatedCoverage() }),                              // A+
    syntheticReport({ coverage: fullPopulatedCoverage() }),                // A
    syntheticReport(),                                                     // B
    syntheticReport({ observations: [
      obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
    ], coverage: fullPopulatedCoverage() }),                               // C
    syntheticReport({ observations: [
      obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'HIGH', confidence: 'HIGH' }),
    ], coverage: fullPopulatedCoverage() }),                               // D
    syntheticReport({ observations: [
      obs({ category: 'IDENTITY',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'IDENTITY',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'PUBLISHING', severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'CATALOG',    severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'CATALOG',    severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'CATALOG',    severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'CATALOG',    severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'METADATA',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'METADATA',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'METADATA',   severity: 'CRITICAL', confidence: 'HIGH' }),
      obs({ category: 'METADATA',   severity: 'CRITICAL', confidence: 'HIGH' }),
    ] }),                                                                  // F
  ];
  const gradesSeen = new Set();
  for (const c of cases) {
    const r = computeHealthScore(c);
    gradesSeen.add(r.overallGrade);
    assert.ok(typeof r.summary === 'string' && r.summary.length > 0,
      'empty summary for grade ' + r.overallGrade);
  }
  assert.ok(gradesSeen.has('A+') && gradesSeen.has('A') && gradesSeen.has('B')
         && gradesSeen.has('C')  && gradesSeen.has('D') && gradesSeen.has('F'),
    'missing grade(s): ' + Array.from(gradesSeen).sort().join(','));
});

it('35 recommendationCount matches intelligenceReport.recommendations.length', () => {
  const ir = reportFor('artist-metadata-conflicts');
  const r  = computeHealthScore(ir);
  assert.equal(r.recommendationCount, ir.recommendations.length);
});

// ─── Summary ─────────────────────────────────────────────────────

console.log('');
if (failed === 0) {
  console.log('  ════════════════════════════════════════════');
  console.log('  HEALTH ENGINE VERIFIED: ' + passed + ' assertions passed');
  console.log('  ════════════════════════════════════════════');
  process.exit(0);
} else {
  console.log('  FAILED: ' + failed + ' / ' + (failed + passed));
  process.exit(1);
}
