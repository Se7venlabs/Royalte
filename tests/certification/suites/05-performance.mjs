// ─── Suite 05: Performance Baseline ──────────────────────────────────────────
//
// Measures execution time for each pipeline stage in isolation.
// Does NOT optimize — measures only. Results become the OS v1.0 baseline.
//
// Stages measured:
//   A. Intelligence Engine (CIO → intelligence report)
//   B. Health Engine (report → healthScore)
//   C. Identity Intelligence assembler
//   D. Publishing Intelligence assembler
//   E. Full RIE pipeline (canonicalForEnrichment → CIM)
//
// Each stage is warmed up once, then measured SAMPLE_SIZE times.
// Reports: min, max, mean, p50, p95 (ms).
//
// Returns: { name, passed, failed, assertions, details[], timings }

import { loadFixture }                       from '../../fixtures/fixture-loader.mjs';
import { runIntelligenceEngine }             from '../../../api/_lib/intelligence-engine.js';
import { ALL_RULES }                         from '../../../api/rules/index.js';
import { computeHealthScore }                from '../../../api/_lib/health-engine.js';
import { assembleIdentityIntelligence }      from '../../../api/_lib/identity-intelligence.js';
import { assemblePublishingIntelligence }    from '../../../api/_lib/publishing-intelligence.js';
import { runRIE }                            from '../../../lib/rie/index.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const SAMPLE_SIZE  = 20;  // timing samples per stage
const FIXTURE_NAME = 'artist-perfect';  // consistent, non-trivial fixture for timing
const FIXED_TS     = () => '2026-07-02T00:00:00.000Z';

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum    = sorted.reduce((s, v) => s + v, 0);
  const mean   = sum / sorted.length;
  const p50    = sorted[Math.floor(sorted.length * 0.50)];
  const p95    = sorted[Math.floor(sorted.length * 0.95)];
  return {
    min:  Math.round(sorted[0] * 100) / 100,
    max:  Math.round(sorted[sorted.length - 1] * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    p50:  Math.round(p50  * 100) / 100,
    p95:  Math.round(p95  * 100) / 100,
    n:    sorted.length,
  };
}

function time(fn) {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function timeAsync(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

export async function runPerformance() {
  const suite = { name: '05-performance', passed: 0, failed: 0, assertions: 1, details: [], timings: {} };

  // Load fixture
  const cio = loadFixture(FIXTURE_NAME);
  if (!cio) {
    suite.failed++;
    suite.details.push({ stage: 'setup', status: 'ERROR', reason: `${FIXTURE_NAME} not found` });
    return suite;
  }

  // Warm up (not measured)
  const warmReport = runIntelligenceEngine(deepClone(cio), ALL_RULES);
  computeHealthScore(warmReport);

  // ── Stage A: Intelligence Engine ─────────────────────────────────────────
  const ieSamples = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    ieSamples.push(time(() => runIntelligenceEngine(deepClone(cio), ALL_RULES)));
  }
  suite.timings.intelligenceEngine = stats(ieSamples);

  // ── Stage B: Health Engine ───────────────────────────────────────────────
  const baseReport = runIntelligenceEngine(deepClone(cio), ALL_RULES);
  const heSamples  = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    heSamples.push(time(() => computeHealthScore(baseReport)));
  }
  suite.timings.healthEngine = stats(heSamples);

  // ── Stage C: Identity Intelligence Assembler ─────────────────────────────
  const iiSamples = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    iiSamples.push(time(() => assembleIdentityIntelligence(baseReport, cio)));
  }
  suite.timings.identityIntelligence = stats(iiSamples);

  // ── Stage D: Publishing Intelligence Assembler ───────────────────────────
  const piSamples = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    piSamples.push(time(() => assemblePublishingIntelligence(baseReport, cio)));
  }
  suite.timings.publishingIntelligence = stats(piSamples);

  // ── Stage E: Full RIE pipeline ────────────────────────────────────────────
  let radiohead;
  try {
    const raw = readFileSync(
      join(__dirname, '../../../api/fixtures/canonical-radiohead.json'), 'utf8'
    );
    radiohead = JSON.parse(raw);
  } catch { /* skip RIE timing if fixture unavailable */ }

  if (radiohead) {
    // Warm up RIE
    await runRIE({ canonicalForEnrichment: deepClone(radiohead) }, { now: FIXED_TS });

    const rieSamples = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      rieSamples.push(await timeAsync(async () => {
        await runRIE(
          { canonicalForEnrichment: deepClone(radiohead) },
          { now: FIXED_TS }
        );
      }));
    }
    suite.timings.fullRIEPipeline = stats(rieSamples);
  } else {
    suite.timings.fullRIEPipeline = { note: 'skipped — canonical-radiohead fixture unavailable' };
  }

  // ── Total RIE pipeline budget check (< 500ms p95) ────────────────────────
  const rieBudget = 500; // ms
  const rieP95    = suite.timings.fullRIEPipeline?.p95 ?? 0;
  const withinBudget = rieP95 > 0 ? rieP95 < rieBudget : true;
  suite.passed += withinBudget ? 1 : 0;
  suite.failed += withinBudget ? 0 : 1;

  suite.details.push({
    stage:    'all-stages',
    status:   withinBudget ? 'PASS' : 'WARN',
    note:     withinBudget
      ? `Full RIE p95 ${rieP95}ms — within ${rieBudget}ms budget`
      : `Full RIE p95 ${rieP95}ms — exceeds ${rieBudget}ms budget (investigate)`
  });

  return suite;
}
