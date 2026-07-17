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
//    07-musicbrainz         MusicBrainz PAL connector certified
//    08-discogs             Discogs PAL connector certified
//    09-youtube             YouTube Official Artist Channel PAL connector certified
//    10-mlc                 The MLC Publishing Authority PAL connector certified
//    11-deezer              Deezer Streaming Verification Authority™ PAL connector certified
//    12-audiodb             TheAudioDB Artist & Media Intelligence Authority™ PAL connector certified
//    13-lastfm              Last.fm Community Intelligence Authority™ PAL connector certified
//    14-monitoring          Monitoring Intelligence Migration Sprint™ constitutional foundation
//    15-acrcloud             ACRCloud Audio Recognition Connector™ PAL connector certified
//    16-spotify              Spotify AVAILABILITY capability PAL connector certified
//    17-tidal                TIDAL Connector™ PAL connector certified
//    18-acrcloud-ai-detection ACRCloud AI Detection Connector™ PAL connector certified
//    19-territory-intelligence Territory Intelligence Engine™ certified
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
import { runYouTubeConnector }      from './suites/09-youtube-connector.mjs';
import { runMLCConnector }          from './suites/10-mlc-connector.mjs';
import { runDeezerConnector }       from './suites/11-deezer-connector.mjs';
import { runAudioDbConnector }    from './suites/12-audiodb-connector.mjs';
import { runLastFmConnector }     from './suites/13-lastfm-connector.mjs';
import { runMonitoring }         from './suites/14-monitoring.mjs';
import { runACRCloudConnector }  from './suites/15-acrcloud-connector.mjs';
import { runSpotifyConnector }   from './suites/16-spotify-connector.mjs';
import { runTidalConnector }     from './suites/17-tidal-connector.mjs';
import { runACRCloudAIDetectionConnector } from './suites/18-acrcloud-ai-detection-connector.mjs';
import { runTerritoryIntelligence } from './suites/19-territory-intelligence.mjs';
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
  results.push(await runSuite('09-youtube',             runYouTubeConnector));
  results.push(await runSuite('10-mlc',                 runMLCConnector));
  results.push(await runSuite('11-deezer',              runDeezerConnector));
  results.push(await runSuite('12-audiodb',             runAudioDbConnector));
  results.push(await runSuite('13-lastfm',              runLastFmConnector));
  results.push(await runSuite('14-monitoring',          runMonitoring));
  results.push(await runSuite('15-acrcloud',             runACRCloudConnector));
  results.push(await runSuite('16-spotify',               runSpotifyConnector));
  results.push(await runSuite('17-tidal',                  runTidalConnector));
  results.push(await runSuite('18-acrcloud-ai-detection',  runACRCloudAIDetectionConnector));
  results.push(await runSuite('19-territory-intelligence', runTerritoryIntelligence));

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
