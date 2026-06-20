// ─────────────────────────────────────────────────────────────────────
//  Royaltē Executive Brief Engine™ — deterministic test suite (Phase 8)
// ─────────────────────────────────────────────────────────────────────
//
//  Exercises generateExecutiveBrief(cio, intelligenceReport, healthReport,
//  canonicalHealth) against:
//    (a) the Phase 6.5 Golden Fixture Library piped through the full
//        constitutional pipeline, and
//    (b) synthetic canonicalHealth objects for contract-level assertions
//        that need specific score values.
//
//  Canonical ownership per Board directive:
//    cio               → artistName
//    intelligenceReport → arrays (strengths/risks/opportunities/
//                          recommendations/observations)
//    healthReport      → generatedAt (presentation metadata)
//    canonicalHealth   → all score and grade fields
//
//  Contract-level tests that intentionally supply empty or absent upstream
//  objects use Object.freeze(Object.create(null)) — immutable, prototype-
//  free, consistent with Royaltē's deep-freeze philosophy — for cio,
//  intelligenceReport, and healthReport slots only.
//
//  The canonicalHealth slot always receives syntheticCanonicalHealth()
//  (or a real pipeline value) because the production pipeline never
//  executes generateExecutiveBrief without a canonical health object.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { loadFixture } from './fixtures/fixture-loader.mjs';
import { runIntelligenceEngine } from '../api/_lib/intelligence-engine.js';
import { ALL_RULES } from '../api/rules/index.js';
import {
  computeHealthScore,
  generateHealthReport,
} from '../api/_lib/health-engine.js';
import {
  BRIEF_VERSION,
  HEALTH_HEADLINES,
  RECOMMENDED_NEXT_STEPS,
  generateExecutiveBrief,
} from '../api/_lib/executive-brief-engine.js';

let passed = 0;
let failed = 0;
function it(name, fn) {
  try { fn(); passed += 1; console.log('  ✓ ' + name); }
  catch (e) { failed += 1; console.log('  ✗ ' + name + ': ' + (e && e.message ? e.message : String(e))); }
}

// ─── Helpers ──────────────────────────────────────────────────────

// Full constitutional pipeline for a named fixture.
// Returns { cio, ir, hr, ch } — one object per layer.
function pipelineFor(fixtureName) {
  const cio = loadFixture(fixtureName);
  const ir  = runIntelligenceEngine(cio, ALL_RULES);
  const ch  = computeHealthScore(ir);
  const hr  = generateHealthReport(cio, ir);
  return { cio, ir, hr, ch };
}

// Synthetic canonicalHealth for tests that need specific score values.
// Mirrors the computeHealthScore() output shape.
function syntheticCanonicalHealth(overrides = {}) {
  return {
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
    generatedAt:         '2026-06-20T00:00:00.000Z',
    summary:             '',
    ...overrides,
  };
}

// Immutable null-prototype placeholder for upstream layers in synthetic
// contract tests. Frozen + prototype-free: no inherited props, no
// mutation during testing, consistent with Royaltē's deep-freeze
// philosophy. Used for cio, intelligenceReport, healthReport slots only.
const empty = () => Object.freeze(Object.create(null));

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

it('01 null canonicalHealth → fail-closed: valid brief, no throw', () => {
  const b = generateExecutiveBrief(empty(), empty(), empty(), null);
  assert.ok(isValidBriefShape(b));
  assert.equal(b.briefVersion, BRIEF_VERSION);
});

it('02 undefined canonicalHealth → fail-closed: valid brief, no throw', () => {
  const b = generateExecutiveBrief(empty(), empty(), empty(), undefined);
  assert.ok(isValidBriefShape(b));
});

it('03 null intelligenceReport → fail-closed: valid brief, no throw', () => {
  const ch = syntheticCanonicalHealth();
  const b  = generateExecutiveBrief(empty(), null, empty(), ch);
  assert.ok(isValidBriefShape(b));
});

it('04 absent upstream layers with canonical health → valid brief, no throw', () => {
  const b = generateExecutiveBrief(empty(), empty(), empty(), syntheticCanonicalHealth());
  assert.ok(isValidBriefShape(b));
});

// ─── Tests 5-6 — grade-derived headlines ──────────────────────────

it('05 perfect fixture → high-grade headline', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(['A+', 'A', 'B'].includes(ch.overallGrade), 'grade=' + ch.overallGrade);
  assert.equal(b.healthHeadline, HEALTH_HEADLINES[ch.overallGrade]);
});

it('06 low-grade synthetic → matching headline', () => {
  const ch = syntheticCanonicalHealth({ overallGrade: 'F', overallScore: 30 });
  const b  = generateExecutiveBrief(empty(), empty(), empty(), ch);
  assert.equal(b.healthHeadline, HEALTH_HEADLINES['F']);
});

// ─── Tests 7-10 — summary / narrative shape ──────────────────────

it('07 executiveSummary non-empty string', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(typeof b.executiveSummary === 'string' && b.executiveSummary.length > 0);
});

it('08 executiveSummary max 300 words', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(wordCount(b.executiveSummary) <= 300, 'words=' + wordCount(b.executiveSummary));
});

it('09 executiveNarrative non-empty string', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(typeof b.executiveNarrative === 'string' && b.executiveNarrative.length > 0);
});

it('10 executiveNarrative max 150 words', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(wordCount(b.executiveNarrative) <= 150, 'words=' + wordCount(b.executiveNarrative));
});

// ─── Test 11 — headline map across all 6 grades ──────────────────

it('11 healthHeadline maps from HEALTH_HEADLINES across all 6 grades', () => {
  for (const grade of Object.keys(HEALTH_HEADLINES)) {
    const ch = syntheticCanonicalHealth({ overallGrade: grade });
    const b  = generateExecutiveBrief(empty(), empty(), empty(), ch);
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
  const ir = { strengths };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ strengthCount: 8 }));
  assert.ok(b.topStrengths.length <= 5, 'len=' + b.topStrengths.length);
});

it('13 topRisks max 5 items', () => {
  const risks = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_r' + i, ruleId: 'rule.r' + i,
    category: 'IDENTITY', severity: 'HIGH', title: 'Risk ' + i,
  }));
  const ir = { risks };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ riskCount: 8 }));
  assert.ok(b.topRisks.length <= 5);
});

it('14 topOpportunities max 5 items', () => {
  const opportunities = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_o' + i, ruleId: 'rule.o' + i,
    category: 'CATALOG', severity: 'MEDIUM', title: 'Opp ' + i,
  }));
  const ir = { opportunities };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ opportunityCount: 8 }));
  assert.ok(b.topOpportunities.length <= 5);
});

it('15 priorityActions max 5 items', () => {
  const recommendations = Array.from({ length: 8 }, (_, i) => ({
    observationId: 'obs_a' + i, ruleId: 'rule.a' + i,
    recommendation: 'Action ' + i,
  }));
  const ir = { recommendations };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ recommendationCount: 8 }));
  assert.ok(b.priorityActions.length <= 5);
});

// ─── Test 16 — risk ordering ─────────────────────────────────────

it('16 topRisks ordered by severity (CRITICAL first)', () => {
  const risks = [
    { observationId: 'a', ruleId: 'r1', category: 'IDENTITY',   severity: 'HIGH',     title: 'High risk' },
    { observationId: 'b', ruleId: 'r2', category: 'PUBLISHING', severity: 'CRITICAL', title: 'Critical risk' },
    { observationId: 'c', ruleId: 'r3', category: 'CATALOG',    severity: 'MEDIUM',   title: 'Medium risk' },
  ];
  const ir = { risks };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ riskCount: 3 }));
  assert.equal(b.topRisks[0].severity, 'CRITICAL', 'first severity=' + b.topRisks[0].severity);
  assert.equal(b.topRisks[1].severity, 'HIGH');
  assert.equal(b.topRisks[2].severity, 'MEDIUM');
});

// ─── Test 17 — priorityActions never invented ────────────────────

it('17 priorityActions come only from intelligenceReport.recommendations (never invented)', () => {
  const recommendations = [
    { observationId: 'a', ruleId: 'r1', recommendation: 'Do X' },
    { observationId: 'b', ruleId: 'r2', recommendation: 'Do Y' },
  ];
  const ir = { recommendations };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ recommendationCount: 2 }));
  assert.ok(b.priorityActions.length > 0);
  const inputRecs = new Set(recommendations.map((r) => r.recommendation));
  for (const a of b.priorityActions) {
    assert.ok(inputRecs.has(a.recommendation), 'invented action: ' + JSON.stringify(a));
  }
});

// ─── Tests 18-19 — confidence statement templates ────────────────

it('18 confidenceStatement HIGH → correct template', () => {
  const ch = syntheticCanonicalHealth({ confidenceScore: 90 });
  const b  = generateExecutiveBrief(empty(), empty(), empty(), ch);
  assert.equal(b.confidenceStatement, 'This assessment is based on verified intelligence from multiple sources.');
});

it('19 confidenceStatement UNKNOWN → correct template', () => {
  const ch = syntheticCanonicalHealth({ confidenceScore: 0 });
  const b  = generateExecutiveBrief(empty(), empty(), empty(), ch);
  assert.equal(b.confidenceStatement, 'Confidence level has not yet been determined for this assessment.');
});

// ─── Tests 20-21 — recommended next step ─────────────────────────

it('20 recommendedNextStep non-empty string', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-missing-publishing');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(typeof b.recommendedNextStep === 'string' && b.recommendedNextStep.length > 0);
});

it('21 recommendedNextStep value drawn from RECOMMENDED_NEXT_STEPS', () => {
  const allValues = new Set(Object.values(RECOMMENDED_NEXT_STEPS));
  const fixtures = ['artist-empty', 'artist-perfect', 'artist-duplicate-profiles',
                    'artist-missing-publishing', 'artist-orphan-recordings',
                    'artist-fragmented-catalog', 'artist-metadata-conflicts'];
  for (const f of fixtures) {
    const { cio, ir, hr, ch } = pipelineFor(f);
    const b = generateExecutiveBrief(cio, ir, hr, ch);
    assert.ok(allValues.has(b.recommendedNextStep), f + ': ' + b.recommendedNextStep);
  }
});

// ─── Tests 22-23 — AI executive insight ──────────────────────────

it('22 aiExecutiveInsight non-empty string', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(typeof b.aiExecutiveInsight === 'string' && b.aiExecutiveInsight.length > 0);
});

it('23 aiExecutiveInsight max 120 words', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(wordCount(b.aiExecutiveInsight) <= 120, 'words=' + wordCount(b.aiExecutiveInsight));
});

// ─── Tests 24-26 — immutability + determinism ────────────────────

it('24 output is Object.isFrozen (deeply)', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(Object.isFrozen(b));
  assert.ok(isDeepFrozen(b), 'nested value not frozen');
});

it('25 inputs not mutated after generateExecutiveBrief', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const beforeIr = JSON.stringify(ir);
  const beforeHr = JSON.stringify(hr);
  const beforeCh = JSON.stringify(ch);
  generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(JSON.stringify(ir), beforeIr, 'intelligenceReport was mutated');
  assert.equal(JSON.stringify(hr), beforeHr, 'healthReport was mutated');
  assert.equal(JSON.stringify(ch), beforeCh, 'canonicalHealth was mutated');
});

it('26 deterministic: same input → identical JSON', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const a = generateExecutiveBrief(cio, ir, hr, ch);
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ─── Tests 27-28 — envelope ──────────────────────────────────────

it('27 briefVersion matches BRIEF_VERSION constant', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(b.briefVersion, BRIEF_VERSION);
});

it('28 generatedAt is valid ISO timestamp (inherited from healthReport)', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(isValidISO(b.generatedAt), 'generatedAt=' + b.generatedAt);
});

// ─── Tests 29-30 — reserved sections ─────────────────────────────

it('29 reserved.monitoring === null', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(b.reserved.monitoring, null);
});

it('30 reserved.revenue === null', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(b.reserved.revenue, null);
});

// ─── Tests 31-34 — empty-array fall-through ──────────────────────

it('31 topStrengths empty when no strengths in intelligenceReport', () => {
  const ir = { strengths: [] };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ strengthCount: 0 }));
  assert.equal(b.topStrengths.length, 0);
});

it('32 topRisks empty when no risks in intelligenceReport', () => {
  const ir = { risks: [] };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ riskCount: 0 }));
  assert.equal(b.topRisks.length, 0);
});

it('33 topOpportunities empty when no opportunities in intelligenceReport', () => {
  const ir = { opportunities: [] };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ opportunityCount: 0 }));
  assert.equal(b.topOpportunities.length, 0);
});

it('34 priorityActions empty when no recommendations in intelligenceReport', () => {
  const ir = { recommendations: [] };
  const b  = generateExecutiveBrief(empty(), ir, empty(), syntheticCanonicalHealth({ recommendationCount: 0 }));
  assert.equal(b.priorityActions.length, 0);
});

// ─── Tests 35-36 — fixture-driven semantics ──────────────────────

it('35 perfect artist → topRisks empty', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-perfect');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.equal(b.topRisks.length, 0);
});

it('36 missing publishing → recommendedNextStep routes to publishing', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-missing-publishing');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
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

// ─── Test 39 — summary contains the computed score ───────────────

it('39 executiveSummary contains the computed overallScore', () => {
  const { cio, ir, hr, ch } = pipelineFor('artist-fragmented-catalog');
  const b = generateExecutiveBrief(cio, ir, hr, ch);
  assert.ok(b.executiveSummary.includes(String(ch.overallScore)),
    'score ' + ch.overallScore + ' missing from summary');
});

// ─── Test 40 — full regression ───────────────────────────────────

it('40 full regression: pipeline-test.mjs still green', () => {
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
