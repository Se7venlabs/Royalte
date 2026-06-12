// ─────────────────────────────────────────────────────────────────────
//  Royaltē Executive Brief Engine™ — deterministic test suite (Phase 8)
// ─────────────────────────────────────────────────────────────────────
//
//  Exercises generateExecutiveBrief() against:
//    (a) the Phase 6.5 Golden Fixture Library piped through the
//        Phase 6 Intelligence Engine + Phase 7 Health Engine + an
//        "enriched HealthReport" bundle, and
//    (b) synthetic HealthReports with directly-constructed upstream
//        arrays for the contract-level assertions.
//
//  All 40 assertions are deterministic (no network, no clock — the
//  engine inherits `generatedAt` verbatim).
//
//  Input-shape note: the Phase 7 HealthReport carries only counts
//  (strengthCount, riskCount, …); the upstream `strengths[]`,
//  `risks[]`, `opportunities[]`, `recommendations[]` arrays live on
//  the Phase 6 engineOutput. Callers pass an "enriched HealthReport"
//  that bundles both. The engine reads the upstream arrays
//  defensively (empty when absent) and NEVER invents entries.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { loadFixture } from './fixtures/fixture-loader.mjs';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import { computeHealthScore } from '../api/_lib/health-engine.js';
import {
  BRIEF_VERSION,
  HEALTH_HEADLINES,
  RECOMMENDED_NEXT_STEPS,
  emptyBrief,
  generateExecutiveBrief,
} from '../api/_lib/executive-brief-engine.js';

let passed = 0;
let failed = 0;
function it(name, fn) {
  try { fn(); passed += 1; console.log('  ✓ ' + name); }
  catch (e) { failed += 1; console.log('  ✗ ' + name + ': ' + (e && e.message ? e.message : String(e))); }
}

// ─── Helpers ──────────────────────────────────────────────────────

function enrichedHealthReportFor(fixtureName) {
  const cio = loadFixture(fixtureName);
  const ir  = runIntelligenceEngine(cio, ALL_RULES);
  const hr  = computeHealthScore(ir);
  return {
    ...hr,
    strengths:       ir.strengths,
    risks:           ir.risks,
    opportunities:   ir.opportunities,
    recommendations: ir.recommendations,
    observations:    ir.observations,
  };
}

function syntheticHealthReport(overrides = {}) {
  return {
    healthVersion:       '1.0.0',
    generatedAt:         '2026-06-12T00:00:00.000Z',
    overallScore:        50,
    overallGrade:        'F',
    identityScore:       50,
    publishingScore:     50,
    catalogScore:        50,
    metadataScore:       50,
    coverageScore:       50,
    confidenceScore:     50,
    strengthCount:       0,
    riskCount:           0,
    opportunityCount:    0,
    recommendationCount: 0,
    categoryBreakdown:   [],
    summary:             '',
    reserved:            { monitoring: null, revenue: null },
    strengths:           [],
    risks:               [],
    opportunities:       [],
    recommendations:     [],
    observations:        [],
    ...overrides,
  };
}

function isValidISO(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString() === s;
}

function isValidBriefShape(b) {
  if (!b || typeof b !== 'object') return false;
  for (const k of ['briefVersion', 'generatedAt', 'executiveSummary', 'healthHeadline',
    'executiveNarrative', 'topStrengths', 'topRisks', 'topOpportunities',
    'priorityActions', 'confidenceStatement', 'recommendedNextStep',
    'aiExecutiveInsight', 'reserved']) {
    if (!(k in b)) return false;
  }
  if (!Array.isArray(b.topStrengths) || !Array.isArray(b.topRisks)) return false;
  if (!Array.isArray(b.topOpportunities) || !Array.isArray(b.priorityActions)) return false;
  if (!b.reserved || typeof b.reserved !== 'object') return false;
  return true;
}

function wordCount(s) {
  if (typeof s !== 'string' || s.length === 0) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
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
console.log('  Royaltē Executive Brief Engine™ — Phase 8 deterministic suite');
console.log('════════════════════════════════════════════');
console.log('');

// ─── Tests 1-4 — input tolerance ──────────────────────────────────

it('01 null input → valid brief, no throw', () => {
  const b = generateExecutiveBrief(null);
  assert.ok(isValidBriefShape(b));
  assert.equal(b.briefVersion, BRIEF_VERSION);
});

it('02 undefined input → valid brief, no throw', () => {
  const b = generateExecutiveBrief(undefined);
  assert.ok(isValidBriefShape(b));
});

it('03 garbage string → valid brief, no throw', () => {
  const b = generateExecutiveBrief('not a health report');
  assert.ok(isValidBriefShape(b));
});

it('04 empty object → valid brief, no throw', () => {
  const b = generateExecutiveBrief({});
  assert.ok(isValidBriefShape(b));
});

// ─── Tests 5-6 — grade-derived headlines ──────────────────────────

it('05 perfect health report → grade A/B headline', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(['A+', 'A', 'B'].includes(hr.overallGrade), 'grade ' + hr.overallGrade);
  assert.equal(b.healthHeadline, HEALTH_HEADLINES[hr.overallGrade]);
});

it('06 poor health report → grade D/F headline', () => {
  const hr = syntheticHealthReport({ overallGrade: 'F', overallScore: 30 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(['D', 'F'].includes(hr.overallGrade));
  assert.equal(b.healthHeadline, HEALTH_HEADLINES[hr.overallGrade]);
});

// ─── Tests 7-10 — summary / narrative shape ──────────────────────

it('07 executiveSummary non-empty string', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(typeof b.executiveSummary === 'string' && b.executiveSummary.length > 0);
});

it('08 executiveSummary max 300 words', () => {
  const hr = enrichedHealthReportFor('artist-fragmented-catalog');
  const b  = generateExecutiveBrief(hr);
  assert.ok(wordCount(b.executiveSummary) <= 300, 'words=' + wordCount(b.executiveSummary));
});

it('09 executiveNarrative non-empty string', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(typeof b.executiveNarrative === 'string' && b.executiveNarrative.length > 0);
});

it('10 executiveNarrative max 150 words', () => {
  const hr = enrichedHealthReportFor('artist-fragmented-catalog');
  const b  = generateExecutiveBrief(hr);
  assert.ok(wordCount(b.executiveNarrative) <= 150, 'words=' + wordCount(b.executiveNarrative));
});

// ─── Test 11 — headline map across all 6 grades ──────────────────

it('11 healthHeadline maps from HEALTH_HEADLINES across all 6 grades', () => {
  for (const grade of Object.keys(HEALTH_HEADLINES)) {
    const hr = syntheticHealthReport({ overallGrade: grade });
    const b  = generateExecutiveBrief(hr);
    assert.equal(b.healthHeadline, HEALTH_HEADLINES[grade], 'grade=' + grade);
  }
});

// ─── Tests 12-15 — top-N capped at 5 ─────────────────────────────

it('12 topStrengths max 5 items', () => {
  const strengths = Array.from({ length: 8 }, (_, i) => ({
    id: 'obs_s' + i, ruleId: 'rule.s' + i,
    category: 'PUBLISHING', severity: 'INFO', confidence: 'HIGH',
    title: 'Strength ' + i, description: '', recommendation: '',
    evidence: [], providerSources: [],
  }));
  const hr = syntheticHealthReport({ strengths, strengthCount: 8 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.topStrengths.length <= 5, 'len=' + b.topStrengths.length);
});

it('13 topRisks max 5 items', () => {
  const risks = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_r' + i, ruleId: 'rule.r' + i,
    category: 'IDENTITY', severity: 'HIGH', title: 'Risk ' + i,
  }));
  const hr = syntheticHealthReport({ risks, riskCount: 8 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.topRisks.length <= 5);
});

it('14 topOpportunities max 5 items', () => {
  const opportunities = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_o' + i, ruleId: 'rule.o' + i,
    category: 'CATALOG', severity: 'MEDIUM', title: 'Opp ' + i,
  }));
  const hr = syntheticHealthReport({ opportunities, opportunityCount: 8 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.topOpportunities.length <= 5);
});

it('15 priorityActions max 5 items', () => {
  const recommendations = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_a' + i, ruleId: 'rule.a' + i,
    recommendation: 'Action ' + i,
  }));
  const hr = syntheticHealthReport({ recommendations, recommendationCount: 8 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.priorityActions.length <= 5);
});

// ─── Test 16 — risk ordering ─────────────────────────────────────

it('16 topRisks ordered by severity (CRITICAL first)', () => {
  const risks = [
    { observationId: 'a', ruleId: 'r1', category: 'IDENTITY',   severity: 'HIGH',     title: 'High risk' },
    { observationId: 'b', ruleId: 'r2', category: 'PUBLISHING', severity: 'CRITICAL', title: 'Critical risk' },
    { observationId: 'c', ruleId: 'r3', category: 'CATALOG',    severity: 'MEDIUM',   title: 'Medium risk' },
  ];
  const hr = syntheticHealthReport({ risks, riskCount: 3 });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.topRisks[0].severity, 'CRITICAL', 'first severity=' + b.topRisks[0].severity);
  assert.equal(b.topRisks[1].severity, 'HIGH');
  assert.equal(b.topRisks[2].severity, 'MEDIUM');
});

// ─── Test 17 — priorityActions never invented ────────────────────

it('17 priorityActions come only from healthReport.recommendations (never invented)', () => {
  const recommendations = [
    { observationId: 'a', ruleId: 'r1', recommendation: 'Do X' },
    { observationId: 'b', ruleId: 'r2', recommendation: 'Do Y' },
  ];
  const hr = syntheticHealthReport({ recommendations, recommendationCount: 2 });
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.priorityActions.length > 0);
  const inputRecs = new Set(recommendations.map((r) => r.recommendation));
  for (const a of b.priorityActions) {
    assert.ok(inputRecs.has(a.recommendation), 'invented action: ' + JSON.stringify(a));
  }
});

// ─── Tests 18-19 — confidence statement templates ────────────────

it('18 confidenceStatement HIGH → correct template', () => {
  const hr = syntheticHealthReport({ confidenceScore: 90 });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.confidenceStatement, 'This assessment is based on verified intelligence from multiple sources.');
});

it('19 confidenceStatement UNKNOWN → correct template', () => {
  const hr = syntheticHealthReport({ confidenceScore: 0 });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.confidenceStatement, 'Confidence level has not yet been determined for this assessment.');
});

// ─── Tests 20-21 — recommended next step ─────────────────────────

it('20 recommendedNextStep non-empty string', () => {
  const hr = enrichedHealthReportFor('artist-missing-publishing');
  const b  = generateExecutiveBrief(hr);
  assert.ok(typeof b.recommendedNextStep === 'string' && b.recommendedNextStep.length > 0);
});

it('21 recommendedNextStep value drawn from RECOMMENDED_NEXT_STEPS', () => {
  const allValues = new Set(Object.values(RECOMMENDED_NEXT_STEPS));
  // exercise via every fixture so multiple paths hit
  const fixtures = ['artist-empty', 'artist-perfect', 'artist-duplicate-profiles',
                    'artist-missing-publishing', 'artist-orphan-recordings',
                    'artist-fragmented-catalog', 'artist-metadata-conflicts'];
  for (const f of fixtures) {
    const hr = enrichedHealthReportFor(f);
    const b  = generateExecutiveBrief(hr);
    assert.ok(allValues.has(b.recommendedNextStep), f + ': ' + b.recommendedNextStep);
  }
});

// ─── Tests 22-23 — AI executive insight ──────────────────────────

it('22 aiExecutiveInsight non-empty string', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(typeof b.aiExecutiveInsight === 'string' && b.aiExecutiveInsight.length > 0);
});

it('23 aiExecutiveInsight max 120 words', () => {
  const hr = enrichedHealthReportFor('artist-fragmented-catalog');
  const b  = generateExecutiveBrief(hr);
  assert.ok(wordCount(b.aiExecutiveInsight) <= 120, 'words=' + wordCount(b.aiExecutiveInsight));
});

// ─── Tests 24-26 — immutability + determinism ────────────────────

it('24 output is Object.isFrozen (deeply)', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(Object.isFrozen(b));
  assert.ok(isDeepFrozen(b), 'nested value not frozen');
});

it('25 input not mutated after generateExecutiveBrief', () => {
  const hr     = enrichedHealthReportFor('artist-fragmented-catalog');
  const before = JSON.stringify(hr);
  generateExecutiveBrief(hr);
  const after  = JSON.stringify(hr);
  assert.equal(before, after);
});

it('26 deterministic: same input → identical JSON', () => {
  const hr = enrichedHealthReportFor('artist-fragmented-catalog');
  const a  = generateExecutiveBrief(hr);
  const b  = generateExecutiveBrief(hr);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── Tests 27-28 — envelope ──────────────────────────────────────

it('27 briefVersion matches BRIEF_VERSION constant', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.briefVersion, BRIEF_VERSION);
});

it('28 generatedAt is valid ISO timestamp (inherited from input)', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.ok(isValidISO(b.generatedAt), 'generatedAt=' + b.generatedAt);
});

// ─── Tests 29-30 — reserved sections ─────────────────────────────

it('29 reserved.monitoring === null', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.reserved.monitoring, null);
});

it('30 reserved.revenue === null', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.reserved.revenue, null);
});

// ─── Tests 31-34 — empty-array fall-through ──────────────────────

it('31 topStrengths empty when no strengths in report', () => {
  const hr = syntheticHealthReport({ strengths: [] });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.topStrengths.length, 0);
});

it('32 topRisks empty when no risks in report', () => {
  const hr = syntheticHealthReport({ risks: [] });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.topRisks.length, 0);
});

it('33 topOpportunities empty when no opportunities', () => {
  const hr = syntheticHealthReport({ opportunities: [] });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.topOpportunities.length, 0);
});

it('34 priorityActions empty when no recommendations', () => {
  const hr = syntheticHealthReport({ recommendations: [] });
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.priorityActions.length, 0);
});

// ─── Tests 35-36 — fixture-driven semantics ──────────────────────

it('35 perfect artist → topRisks empty', () => {
  const hr = enrichedHealthReportFor('artist-perfect');
  const b  = generateExecutiveBrief(hr);
  assert.equal(b.topRisks.length, 0);
});

it('36 missing publishing → recommendedNextStep routes to publishing', () => {
  const hr = enrichedHealthReportFor('artist-missing-publishing');
  const b  = generateExecutiveBrief(hr);
  // artist-missing-publishing fires a HIGH PUBLISHING risk; the engine
  // routes the top-risk category (publishing) into the recommended-
  // next-step lookup.
  assert.equal(b.recommendedNextStep, RECOMMENDED_NEXT_STEPS.publishing,
    'got: ' + b.recommendedNextStep);
});

// ─── Tests 37-38 — schema invariants ─────────────────────────────

it('37 HEALTH_HEADLINES has entry for all 6 grades', () => {
  for (const g of ['A+', 'A', 'B', 'C', 'D', 'F']) {
    assert.ok(typeof HEALTH_HEADLINES[g] === 'string' && HEALTH_HEADLINES[g].length > 0, 'missing: ' + g);
  }
});

it('38 RECOMMENDED_NEXT_STEPS has default entry', () => {
  assert.ok(typeof RECOMMENDED_NEXT_STEPS.default === 'string'
         && RECOMMENDED_NEXT_STEPS.default.length > 0);
});

// ─── Test 39 — summary contains the score number ─────────────────

it('39 executiveSummary contains the overallScore number from healthReport', () => {
  const hr = enrichedHealthReportFor('artist-fragmented-catalog');
  const b  = generateExecutiveBrief(hr);
  assert.ok(b.executiveSummary.includes(String(hr.overallScore)),
    'score ' + hr.overallScore + ' missing from summary');
});

// ─── Test 40 — full regression ───────────────────────────────────

it('40 full regression: pipeline-test.mjs still green', () => {
  // Re-runs the canonical pipeline test in a subprocess so this suite
  // verifies the platform stack still holds end-to-end. (The brief's
  // "203+8" notation is interpreted as "the canonical pipeline test
  // remains green"; the precise assertion count is owned by that
  // suite itself.)
  execSync('node tests/pipeline-test.mjs', { stdio: 'ignore' });
});

// ─── Summary ─────────────────────────────────────────────────────

console.log('');
if (failed === 0) {
  console.log('  ════════════════════════════════════════════');
  console.log('  EXECUTIVE BRIEF ENGINE VERIFIED: ' + passed + ' assertions passed');
  console.log('  ════════════════════════════════════════════');
  process.exit(0);
} else {
  console.log('  FAILED: ' + failed + ' / ' + (failed + passed));
  process.exit(1);
}
