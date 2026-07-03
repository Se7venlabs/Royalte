#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
//  ROYALTĒ OS v1.0 — BOARD CERTIFICATION HARNESS
// ═══════════════════════════════════════════════════════════════════════════════
//
//  Constitutional authority: Phase 3.5 Board Directive (2026-07-02)
//
//  Purpose: Permanent certification framework. Runs every certification suite,
//  collects results, produces a Board Certification Report, and exits with
//  code 0 (certified) or 1 (not certified).
//
//  Usage:
//    node tests/certification/harness.mjs          — standard run
//    node tests/certification/harness.mjs --quiet  — errors only
//
//  Suite inventory:
//    01-regression          All 7 golden fixtures pass regression
//    02-determinism         Same evidence → same CIM (N runs)
//    03-artist-library      Certification artist archetypes pass
//    04-cim-integrity       CIM §8.2 structural contract verified
//    05-performance         Pipeline timing baseline measured
//    06-recording-intel     Recording Intelligence Foundation™ verified
//
//  This harness never throws. Any suite that throws is caught and reported
//  as a failed suite. The exit code reflects the overall certification status.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { execSync }              from 'node:child_process';
import { runRegression }         from './suites/01-regression.mjs';
import { runDeterminism }        from './suites/02-determinism.mjs';
import { runArtistLibrary }      from './suites/03-artist-library.mjs';
import { runCimIntegrity }       from './suites/04-cim-integrity.mjs';
import { runPerformance }        from './suites/05-performance.mjs';
import { runRecordingIntelligence } from './suites/06-recording-intelligence.mjs';
import { runMusicBrainzConnector }  from './suites/07-musicbrainz-connector.mjs';
import { runDiscogsConnector }      from './suites/08-discogs-connector.mjs';
import { printBoardReport }      from './reporters/board-report.mjs';

const QUIET = process.argv.includes('--quiet');

function log(...args) {
  if (!QUIET) console.log(...args);
}

function getCurrentCommit() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

async function runSuite(name, fn) {
  log(`  → running ${name}...`);
  try {
    const result = await fn();
    const icon   = result.failed === 0 ? '✓' : '✗';
    log(`    ${icon} ${result.assertions} assertions | ${result.passed} passed | ${result.failed} failed`);
    return result;
  } catch (e) {
    console.error(`    ✗ ${name} threw unexpectedly: ${e.message}`);
    return { name, passed: 0, failed: 1, assertions: 1, details: [{ status: 'ERROR', reason: e.message }] };
  }
}

async function main() {
  const startMs = performance.now();
  log('');
  log('════════════════════════════════════════════════════════════════════════');
  log('  ROYALTĒ OS v1.0 — BOARD CERTIFICATION HARNESS');
  log('════════════════════════════════════════════════════════════════════════');
  log('');

  const results = [];

  results.push(await runSuite('01-regression',          runRegression));
  results.push(await runSuite('02-determinism',         runDeterminism));
  results.push(await runSuite('03-artist-library',      runArtistLibrary));
  results.push(await runSuite('04-cim-integrity',       runCimIntegrity));
  results.push(await runSuite('05-performance',         runPerformance));
  results.push(await runSuite('06-recording-intel',     runRecordingIntelligence));
  results.push(await runSuite('07-musicbrainz',         runMusicBrainzConnector));
  results.push(await runSuite('08-discogs',             runDiscogsConnector));

  const elapsed = Math.round(performance.now() - startMs);
  log('');
  log(`  Harness complete in ${elapsed}ms`);
  log('');

  // ── Generate Board Certification Report ───────────────────────────────────
  const report = printBoardReport(results, {
    runAt:   new Date().toISOString(),
    version: '1.0.0',
    commit:  getCurrentCommit(),
  });

  console.log(report);

  // ── Exit code ─────────────────────────────────────────────────────────────
  const totalFailed = results.reduce((s, r) => s + (r.failed ?? 0), 0);
  process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('[harness] fatal:', e.message);
  process.exit(1);
});
