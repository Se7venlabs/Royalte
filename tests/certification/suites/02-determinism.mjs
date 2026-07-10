// ─── Suite 02: Determinism Verification ──────────────────────────────────────
//
// The same evidence must always produce the same CIM.
// Runs each fixture N times through the Intelligence Engine and Health Engine,
// then verifies JSON.stringify equality across all runs.
//
// Also runs a full RIE pipeline determinism check using the canonical-radiohead
// fixture with a fixed clock injection.
//
// Returns: { name, passed, failed, assertions, details[] }

import { loadFixture, listFixtures } from '../../fixtures/fixture-loader.mjs';
import { loadArtist, listArtists }   from '../artist-library/library-loader.mjs';
import { runIntelligenceEngine }     from '../../../api/_lib/intelligence-engine.js';
import { ALL_RULES }                 from '../../../api/rules/index.js';
import { computeHealthScore }        from '../../../api/_lib/health-engine.js';
import { runRIE }                    from '../../../lib/rie/index.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNS         = 10;  // determinism run count for IE/Health
const RIE_RUNS     = 5;   // determinism run count for full RIE pipeline
const FIXED_TS     = '2026-07-02T00:00:00.000Z';
const FIXED_CLOCK  = () => FIXED_TS;

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

// Run the Intelligence Engine + Health Engine N times on the same CIO.
// Returns { deterministic: boolean, divergentRun: number|null, sampleOutput: string }
function testIEDeterminism(cio) {
  let baseline;
  for (let i = 0; i < RUNS; i++) {
    // Deep-clone input so no run can mutate another run's input.
    const input = deepClone(cio);
    const report = runIntelligenceEngine(input, ALL_RULES);
    const health = computeHealthScore(report);
    // Combine both outputs for comparison (exclude any internal timers).
    const snapshot = JSON.stringify({ report, healthScore: health });

    if (i === 0) {
      baseline = snapshot;
    } else if (snapshot !== baseline) {
      return { deterministic: false, divergentRun: i + 1, sampleOutput: snapshot };
    }
  }
  return { deterministic: true, divergentRun: null, sampleOutput: baseline };
}

// Run the full RIE pipeline N times with a fixed clock.
// Returns { deterministic: boolean, divergentRun: number|null }
async function testRIEDeterminism(canonicalForEnrichment) {
  let baseline;
  for (let i = 0; i < RIE_RUNS; i++) {
    const input = deepClone(canonicalForEnrichment);
    const cim = await runRIE(
      { canonicalForEnrichment: input },
      { now: FIXED_CLOCK }
    );
    // Exclude scanAuthority.scanId (randomUUID per call) and _certifiedAt from comparison.
    const comparable = JSON.parse(JSON.stringify(cim));
    // Exclude fields that legitimately vary across calls:
    //   scanAuthority.scanId     — randomUUID per call (provenance, not intelligence)
    //   _certifiedAt             — wall-clock stamp (overridden by options.now at CIM level
    //                              but inner assemblers have their own clocks)
    //   health.report.generatedAt — healthReport uses new Date() internally
    //   aiInsight.generatedAt    — royalteAI assembler uses new Date() internally
    //   brief.generatedAt        — executiveBrief assembler uses new Date() internally
    if (comparable.scanAuthority)      delete comparable.scanAuthority.scanId;
    if (comparable._certifiedAt)       delete comparable._certifiedAt;
    if (comparable.health?.report)     delete comparable.health.report.generatedAt;
    if (comparable.aiInsight)          delete comparable.aiInsight.generatedAt;
    if (comparable.brief)              delete comparable.brief.generatedAt;
    const snapshot = JSON.stringify(comparable);

    if (i === 0) {
      baseline = snapshot;
    } else if (snapshot !== baseline) {
      return { deterministic: false, divergentRun: i + 1 };
    }
  }
  return { deterministic: true, divergentRun: null };
}

export async function runDeterminism() {
  const suite = { name: '02-determinism', passed: 0, failed: 0, assertions: 0, details: [] };

  // ── Part A: Intelligence Engine determinism (golden fixtures) ──────────────
  const available = listFixtures();
  for (const name of available) {
    const cio = loadFixture(name);
    if (!cio) continue;

    let result;
    try {
      result = testIEDeterminism(cio);
    } catch (e) {
      suite.failed++;
      suite.assertions++;
      suite.details.push({
        fixture: name, layer: 'IE', status: 'ERROR', reason: e.message
      });
      continue;
    }

    const pass = result.deterministic;
    suite.assertions++;
    pass ? suite.passed++ : suite.failed++;
    suite.details.push({
      fixture: name,
      layer:   'IE',
      status:  pass ? 'DETERMINISTIC' : 'NON-DETERMINISTIC',
      runs:    RUNS,
      divergentRun: result.divergentRun,
    });
  }

  // ── Part B: Intelligence Engine determinism (certification artist library) ─
  const artists = listArtists();
  for (const name of artists) {
    const cio = loadArtist(name);
    if (!cio) continue;

    let result;
    try {
      result = testIEDeterminism(cio);
    } catch (e) {
      suite.failed++;
      suite.assertions++;
      suite.details.push({
        fixture: name, layer: 'IE-library', status: 'ERROR', reason: e.message
      });
      continue;
    }

    const pass = result.deterministic;
    suite.assertions++;
    pass ? suite.passed++ : suite.failed++;
    suite.details.push({
      fixture: name,
      layer:   'IE-library',
      status:  pass ? 'DETERMINISTIC' : 'NON-DETERMINISTIC',
      runs:    RUNS,
      divergentRun: result.divergentRun,
    });
  }

  // ── Part C: Full RIE pipeline determinism ─────────────────────────────────
  let radiohead;
  try {
    const raw = readFileSync(
      join(__dirname, '../../../api/fixtures/canonical-radiohead.json'), 'utf8'
    );
    radiohead = JSON.parse(raw);
  } catch (e) {
    suite.failed++;
    suite.details.push({
      fixture: 'canonical-radiohead', layer: 'RIE', status: 'ERROR',
      reason: `fixture load failed: ${e.message}`
    });
  }

  if (radiohead) {
    let result;
    try {
      result = await testRIEDeterminism(radiohead);
    } catch (e) {
      suite.failed++;
      suite.assertions++;
      suite.details.push({
        fixture: 'canonical-radiohead', layer: 'RIE', status: 'ERROR', reason: e.message
      });
      return suite;
    }

    const pass = result.deterministic;
    suite.assertions++;
    pass ? suite.passed++ : suite.failed++;
    suite.details.push({
      fixture: 'canonical-radiohead',
      layer:   'RIE',
      status:  pass ? 'DETERMINISTIC' : 'NON-DETERMINISTIC',
      runs:    RIE_RUNS,
      divergentRun: result.divergentRun,
      note: 'scanId and _certifiedAt excluded from comparison (expected to vary)',
    });
  }

  return suite;
}
