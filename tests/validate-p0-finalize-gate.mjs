/**
 * P0 FINALIZE GATE — 100-ITERATION REGRESSION TEST
 *
 * Board directive: prove that after the finalizeScan() architectural fix,
 * clicking Mission Control immediately at T4 (button-enabled) NEVER produces
 * "No Scan Loaded" across 100 consecutive iterations.
 *
 * Contract under test (from finalizeScan() in public/index.html):
 *   At the exact moment #open-mc-btn.disabled transitions to false, BOTH of
 *   the following MUST already be present in sessionStorage:
 *     • royalte_scan_payload
 *     • royalte_workspace_context
 *
 * Approach:
 *   Phase 1 — Run ONE real scan against production to capture a valid response.
 *   Phase 2 — Intercept /api/audit and serve the cached response for the next
 *             100 iterations (no real API calls; 100× deterministic simulations).
 *   Phase 3 — Per iteration: submit scan → as soon as #open-mc-btn enables,
 *             record storage state → click immediately → verify on MC page.
 *
 * Expected: 100/100 PASS.  0 races.  0 "No Scan Loaded".
 */

import { chromium } from '@playwright/test';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const RoyalteContext = _require('../public/js/mc-workspace-context.js');

const PROD    = 'https://www.royalte.ai';
const SPOTIFY = 'https://open.spotify.com/album/2gO1294s3OwsgUbiLqy6S9';
const ITERATIONS = 100;

const PASS  = '\x1b[32m✓\x1b[0m';
const FAIL  = '\x1b[31m✗\x1b[0m';
const INFO  = '\x1b[36m·\x1b[0m';
const WARN  = '\x1b[33m⚠\x1b[0m';
const BOLD  = '\x1b[1m';
const RESET = '\x1b[0m';

let totalFailures = 0;
let passCount = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    passCount++;
    return true;
  }
  console.log(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`);
  totalFailures++;
  return false;
}
function section(title) {
  console.log(`\n${'═'.repeat(72)}\n  ${title}\n${'═'.repeat(72)}`);
}

async function run() {
  console.log(`\n${BOLD}ROYALTĒ — P0 FINALIZE GATE — 100-ITERATION REGRESSION TEST${RESET}`);
  console.log(`Target:     ${PROD}`);
  console.log(`Scan URL:   ${SPOTIFY}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Time:       ${new Date().toISOString()}\n`);
  console.log(`  Contract: royalte_scan_payload + royalte_workspace_context must`);
  console.log(`  both be present in sessionStorage at the exact moment`);
  console.log(`  #open-mc-btn.disabled transitions to false.\n`);

  const browser = await chromium.launch({ headless: true });

  // ── Phase 1: Real scan to capture cached API response ─────────────────────
  section('PHASE 1 — REAL SCAN (cache API response for 100 iterations)');

  const ctxCapture = await browser.newContext();
  const pgCapture  = await ctxCapture.newPage();
  pgCapture.setDefaultTimeout(120000);

  let cachedResponse = null;
  let cachedStatus   = 200;

  // Intercept /api/audit to capture the real response body
  pgCapture.on('response', async resp => {
    if (resp.url().includes('/api/audit') && !cachedResponse) {
      try {
        cachedStatus   = resp.status();
        cachedResponse = await resp.text();
      } catch { /* page may navigate before body is available */ }
    }
  });

  await pgCapture.goto(PROD, { waitUntil: 'networkidle' });
  await pgCapture.locator('#url-input').fill(SPOTIFY);
  await pgCapture.locator('#sh-run-btn').click();

  try {
    await pgCapture.waitForFunction(
      () => { const b = document.getElementById('open-mc-btn'); return b && !b.disabled; },
      null, { timeout: 90000 }
    );
    console.log(`  ${PASS} Real scan complete — response captured (${cachedResponse?.length || 0} bytes)`);
  } catch {
    console.log(`  ${FAIL} Real scan did not complete within 90s — aborting`);
    await browser.close(); process.exit(1);
  }

  if (!cachedResponse) {
    console.log(`  ${FAIL} No /api/audit response captured — aborting`);
    await browser.close(); process.exit(1);
  }

  // Verify the cached response is valid JSON with a canonical payload
  let cachedJson;
  try {
    cachedJson = JSON.parse(cachedResponse);
    assert(!!cachedJson.success,    'Cached response has success:true');
    assert(!!cachedJson.canonical,  'Cached response has canonical object');
    assert(!!cachedJson.canonical.subject?.artistName, `Artist: "${cachedJson.canonical.subject?.artistName}"`);
    console.log(`  ${INFO} Artist: ${cachedJson.canonical.subject?.artistName}`);
    console.log(`  ${INFO} scanId: ${cachedJson.scanId || '(none)'}`);
  } catch (e) {
    console.log(`  ${FAIL} Cached response is not valid JSON — aborting`);
    await browser.close(); process.exit(1);
  }

  await ctxCapture.close();

  // ── Phase 2: 100 iterations ────────────────────────────────────────────────
  section(`PHASE 2 — 100-ITERATION GATE REGRESSION`);

  const iterResults = [];
  let raceFailures = 0;
  let noScanLoaded = 0;

  for (let i = 1; i <= ITERATIONS; i++) {
    const iter = { n: i, raceDetected: false, noScanLoaded: false, errors: [] };

    // Fresh browser context each iteration — guarantees clean sessionStorage
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);

    const consoleLogs = [];
    const consoleErrs = [];
    page.on('console', m => {
      consoleLogs.push(m.text());
      if (m.type() === 'error') consoleErrs.push(m.text());
    });

    // Intercept ALL /api/audit requests and return the cached response
    await page.route('**/api/audit**', route => {
      route.fulfill({
        status:  cachedStatus,
        headers: { 'content-type': 'application/json' },
        body:    cachedResponse,
      });
    });

    // Inject timing shim before page scripts run
    await ctx.addInitScript(() => {
      window.__gateTimings = {};
      const _origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        const r = _origSet.call(this, key, value);
        if (this === window.sessionStorage) {
          window.__gateTimings[key] = Date.now();
        }
        return r;
      };
    });

    try {
      // Load scan page
      await page.goto(PROD, { waitUntil: 'domcontentloaded' });

      // Submit scan (intercepted — returns immediately with cached response)
      await page.locator('#url-input').fill(SPOTIFY);
      await page.locator('#sh-run-btn').click();

      // Wait for #open-mc-btn to become enabled — this is T4
      const T4 = await page.waitForFunction(
        () => { const b = document.getElementById('open-mc-btn'); return b && !b.disabled ? Date.now() : false; },
        null, { timeout: 15000 }
      );
      const T4_ms = await T4.jsonValue();

      // ── CRITICAL: read storage state AT T4 (race-detection window) ─────────
      const stateAtT4 = await page.evaluate(() => ({
        hasScanPayload:    !!sessionStorage.getItem('royalte_scan_payload'),
        hasWorkspaceCtx:   !!sessionStorage.getItem('royalte_workspace_context'),
        hasScanId:         !!window.__royalteScan?.scanId,
        T4_scan_payload:   window.__gateTimings['royalte_scan_payload']   ?? null,
        T4_workspace_ctx:  window.__gateTimings['royalte_workspace_context'] ?? null,
        now:               Date.now(),
      }));

      // Race condition: either storage key missing at T4 → gate failed
      if (!stateAtT4.hasScanPayload || !stateAtT4.hasWorkspaceCtx) {
        iter.raceDetected = true;
        raceFailures++;
        iter.errors.push(
          `RACE at T4: scan_payload=${stateAtT4.hasScanPayload} workspace_ctx=${stateAtT4.hasWorkspaceCtx}`
        );
      }

      // scanId must be available (click handler uses it)
      if (!stateAtT4.hasScanId) {
        iter.errors.push('window.__royalteScan.scanId not set at T4');
      }

      // ── Click immediately (simulate Board's flow) ───────────────────────────
      await page.locator('#open-mc-btn').click();
      await page.waitForURL('**/mission-control.html**', { timeout: 10000 });
      await page.waitForLoadState('domcontentloaded');

      // Storage must have survived navigation (same tab = same sessionStorage)
      const afterNav = await page.evaluate(() => ({
        hasScanPayload:  !!sessionStorage.getItem('royalte_scan_payload'),
        hasWorkspaceCtx: !!sessionStorage.getItem('royalte_workspace_context'),
        hasLsPayload:    !!localStorage.getItem('royalte_scan_payload_ls'),
      }));

      if (!afterNav.hasWorkspaceCtx) {
        iter.errors.push('royalte_workspace_context missing on MC page after navigation');
      }

      // Navigate to health-intelligence workspace — the definitive "No Scan Loaded" check
      await page.goto(`${PROD}/workspaces/health-intelligence.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      const wsResult = await page.evaluate(() => {
        const body   = document.body?.innerText || '';
        const ol     = document.getElementById('ws-no-scan-overlay');
        const olVis  = ol && !ol.hasAttribute('hidden') && ol.style.display !== 'none';
        return {
          noScanText:  body.includes('No Scan Loaded') || body.includes('No scan loaded'),
          overlayVis:  !!olVis,
          hasCtx:      !!sessionStorage.getItem('royalte_workspace_context'),
        };
      });

      if (wsResult.noScanText || wsResult.overlayVis || !wsResult.hasCtx) {
        iter.noScanLoaded = true;
        noScanLoaded++;
        iter.errors.push(
          `"No Scan Loaded" detected — text:${wsResult.noScanText} overlay:${wsResult.overlayVis} ctx:${wsResult.hasCtx}`
        );
      }

    } catch (err) {
      iter.errors.push('iteration threw: ' + (err?.message || String(err)));
      raceFailures++;
    }

    await ctx.close();

    // Per-iteration output (compact)
    if (iter.errors.length === 0) {
      if (i % 10 === 0 || i <= 5) {
        console.log(`  ${PASS} iteration ${String(i).padStart(3)} — GATE PASSED`);
      } else if (i % 10 === 1) {
        process.stdout.write(`  ${PASS} `);
      } else {
        process.stdout.write(`${PASS} `);
        if (i % 10 === 0) process.stdout.write('\n');
      }
    } else {
      console.log(`\n  ${FAIL} iteration ${String(i).padStart(3)} — ${iter.errors.join(' | ')}`);
    }

    iterResults.push(iter);
  }

  // ── Phase 3: Summary ───────────────────────────────────────────────────────
  section('PHASE 3 — RESULTS SUMMARY');

  const passed     = iterResults.filter(r => r.errors.length === 0).length;
  const raceFailed = iterResults.filter(r => r.raceDetected).length;
  const noScanFail = iterResults.filter(r => r.noScanLoaded).length;
  const otherFail  = iterResults.filter(r => !r.raceDetected && !r.noScanLoaded && r.errors.length > 0).length;

  console.log(`
  Iterations run:          ${ITERATIONS}
  Gate passed (T4 clean):  ${passed}
  Race condition hits:     ${raceFailed}
  "No Scan Loaded":        ${noScanFail}
  Other failures:          ${otherFail}
  `);

  if (raceFailed > 0 || noScanFail > 0) {
    console.log(`  ${FAIL} REGRESSION DETECTED — race fix did not hold across all iterations`);
    const failures = iterResults.filter(r => r.errors.length > 0);
    failures.slice(0, 5).forEach(r => console.log(`    iteration ${r.n}: ${r.errors.join(' | ')}`));
    if (failures.length > 5) console.log(`    ... and ${failures.length - 5} more`);
  } else if (passed === ITERATIONS) {
    console.log(`  ${PASS} ${BOLD}${ITERATIONS}/${ITERATIONS} PASSED — race condition eliminated${RESET}`);
    console.log(`  ${PASS} Both storage keys present at T4 in every iteration`);
    console.log(`  ${PASS} 0 "No Scan Loaded" overlays detected`);
    console.log(`  ${PASS} 0 race-condition failures`);
    console.log(`\n  Architecture: finalizeScan() gate holds under 100 immediate clicks.`);
  }

  await browser.close();

  console.log(`\n${'═'.repeat(72)}`);
  if (totalFailures === 0 && passed === ITERATIONS) {
    console.log(`  \x1b[32m${BOLD} P0 RACE FIX VERIFIED — 100/100 CLEAN${RESET}`);
  } else {
    console.log(`  \x1b[31m FAILED — ${totalFailures} total failure(s)${RESET}`);
  }
  console.log('═'.repeat(72) + '\n');
  process.exit(totalFailures > 0 || passed < ITERATIONS ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
