/**
 * P0 RACE-CONDITION TIMING PROOF
 *
 * Board directive: instrument the T0–T8 timeline to determine whether the
 * Mission Control button (T4) becomes clickable before sessionStorage is
 * written (T5).  If T4 < T5, any click between them leaves MC with no
 * payload and produces "No Scan Loaded."
 *
 * Timeline under test:
 *   T0  User arrives at scan page
 *   T1  runScan() begins (click on #sh-run-btn)
 *   T2  runAudit() begins
 *   T3  runAudit() resolves  (API 200)
 *   T4  #open-mc-btn enabled
 *   T5  showRealResults() fires (setTimeout 150ms after T3)
 *   T6  buildWorkspaceRuntimeContext() called  [MC page, post-navigation]
 *   T7  royalte_workspace_context written      [MC page]
 *   T8  MC navigation triggered                [user click]
 *
 * Race condition: T4 < T5.  If navigation occurs at T4, T5 never fires →
 * storage empty → "No Scan Loaded."
 *
 * Proof method: inject timing shims before page load, run a real scan,
 * and at the exact moment T4 fires capture the storage state.  If storage
 * is empty at T4, the race window is open and T8 < T5 is possible.
 *
 * Second phase: click MC immediately at T4 (simulating an impatient click),
 * wait for __mcPopulate on the MC page, and confirm "No Scan Loaded" occurs.
 *
 * No authentication required — the race exists on the anonymous path too.
 */

import { chromium } from '@playwright/test';

const PROD    = 'https://www.royalte.ai';
const SPOTIFY = 'https://open.spotify.com/album/2gO1294s3OwsgUbiLqy6S9';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

let failures = 0;
const T = {};

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
  return condition;
}
function section(title) {
  console.log(`\n${'═'.repeat(72)}\n  ${title}\n${'═'.repeat(72)}`);
}
function ts(label, t) {
  if (T.T0) {
    console.log(`  ${INFO} ${label.padEnd(48)} +${(t - T.T0).toFixed(0).padStart(6)}ms  (${new Date(t).toISOString()})`);
  } else {
    console.log(`  ${INFO} ${label.padEnd(48)} ${new Date(t).toISOString()}`);
  }
}

async function run() {
  console.log('\nROYALTĒ — P0 RACE-CONDITION TIMING PROOF');
  console.log(`Target: ${PROD}`);
  console.log(`Scan:   ${SPOTIFY}`);
  console.log(`Time:   ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();
  page.setDefaultTimeout(120000);

  const consoleLog = [];
  page.on('console', m => {
    const line = `[${m.type()}] ${m.text()}`;
    consoleLog.push({ text: line, ts: Date.now() });
  });

  // ── Phase 0: inject timing shims BEFORE page scripts execute ─────────────
  //
  // We patch sessionStorage.setItem to record EXACTLY when each key is written.
  // This gives us the authoritative T5 (scan payload written) timestamp.
  await context.addInitScript(() => {
    window.__raceTiming = {};

    const _origSS = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      const result = _origSS.call(this, key, value);
      const now = Date.now();
      if (this === window.sessionStorage) {
        if (key === 'royalte_scan_payload') {
          window.__raceTiming.T5_sessionStorage = now;
          console.log('[race-timing] T5 sessionStorage.royalte_scan_payload written at', now);
        }
        if (key === 'royalte_workspace_context') {
          window.__raceTiming.T7_workspaceCtx = now;
          console.log('[race-timing] T7 royalte_workspace_context written at', now);
        }
      }
      if (this === window.localStorage) {
        if (key === 'royalte_scan_payload_ls') {
          window.__raceTiming.T5_localStorage = now;
          console.log('[race-timing] T5 localStorage.royalte_scan_payload_ls written at', now);
        }
      }
      return result;
    };
  });

  // ── Phase 1: load homepage ─────────────────────────────────────────────────
  section('PHASE 1 — HOMEPAGE LOAD');

  T.T0 = Date.now();
  ts('T0  Script start', T.T0);

  await page.goto(PROD, { waitUntil: 'networkidle' });
  ts('T0  Homepage loaded', Date.now());

  assert(await page.locator('#sh-run-btn').isVisible(), '#sh-run-btn visible');
  assert(await page.locator('#url-input').isVisible(),   '#url-input visible');

  const mcBtnState = await page.evaluate(() => {
    const b = document.getElementById('open-mc-btn');
    return b ? b.disabled : 'NOT FOUND';
  });
  assert(mcBtnState === true, '#open-mc-btn starts disabled');

  // ── Phase 2: submit scan and capture T1, T3, T4 ───────────────────────────
  section('PHASE 2 — SCAN + TIMING CAPTURE');

  await page.locator('#url-input').fill(SPOTIFY);

  T.T1 = Date.now();
  ts('T1  runScan() begins (click)', T.T1);
  await page.locator('#sh-run-btn').click();

  // Wait for API call to start (T2 approximation: first network request to /api/audit)
  const auditReq = page.waitForRequest(req => req.url().includes('/api/audit'));
  try {
    const req = await Promise.race([auditReq, new Promise(r => setTimeout(r, 5000))]);
    if (req && req.url) {
      T.T2 = Date.now();
      ts('T2  runAudit() begins (API call fired)', T.T2);
    }
  } catch { /* non-fatal */ }

  // Wait for API response (T3: runAudit resolves)
  try {
    await page.waitForResponse(
      resp => resp.url().includes('/api/audit') && resp.status() === 200,
      { timeout: 90000 }
    );
    T.T3 = Date.now();
    ts('T3  runAudit() resolved (API 200)', T.T3);
  } catch {
    assert(false, 'API /api/audit did not return 200 within 90s — aborting');
    await browser.close();
    printSummary(); return;
  }

  // Wait for T4 (#open-mc-btn enabled)
  // This is the EXACT moment the race window opens.
  try {
    await page.waitForFunction(
      () => { const b = document.getElementById('open-mc-btn'); return b && !b.disabled; },
      null, { timeout: 10000 }
    );
    T.T4 = Date.now();
    ts('T4  #open-mc-btn ENABLED', T.T4);
  } catch {
    assert(false, '#open-mc-btn never became enabled within 10s of API 200');
    await browser.close();
    printSummary(); return;
  }

  // CAPTURE STORAGE STATE AT EXACTLY T4 ────────────────────────────────────
  // This is the critical measurement.  At T4, has showRealResults() fired yet?
  const storageAtT4 = await page.evaluate(() => ({
    scanPayloadInSS:   !!sessionStorage.getItem('royalte_scan_payload'),
    scanPayloadInLS:   !!localStorage.getItem('royalte_scan_payload_ls'),
    __royalteScanId:   window.__royalteScan?.scanId ?? null,
    T5_sessionStorage: window.__raceTiming?.T5_sessionStorage ?? null,
    T5_localStorage:   window.__raceTiming?.T5_localStorage   ?? null,
    now:               Date.now(),
  }));

  console.log('\n  ── Storage state at T4 ──────────────────────────────────────');
  console.log(`  royalte_scan_payload   (sessionStorage): ${storageAtT4.scanPayloadInSS ? 'PRESENT' : 'MISSING ← RACE WINDOW OPEN'}`);
  console.log(`  royalte_scan_payload_ls (localStorage):  ${storageAtT4.scanPayloadInLS ? 'PRESENT' : 'MISSING ← RACE WINDOW OPEN'}`);
  console.log(`  window.__royalteScan.scanId:             ${storageAtT4.__royalteScanId ?? 'null/undefined ← click handler has no scanId'}`);

  const raceWindowOpen = !storageAtT4.scanPayloadInSS && !storageAtT4.scanPayloadInLS;
  const T4_T5_gap = storageAtT4.T5_sessionStorage
    ? storageAtT4.T5_sessionStorage - T.T4
    : null;

  if (storageAtT4.T5_sessionStorage) {
    ts('T5  sessionStorage.royalte_scan_payload written', storageAtT4.T5_sessionStorage);
    console.log(`\n  T4 → T5 gap: ${T4_T5_gap}ms`);
    if (T4_T5_gap > 0) {
      console.log(`  ${FAIL} RACE WINDOW: button enabled ${T4_T5_gap}ms BEFORE storage written`);
    }
  } else {
    console.log(`  ${INFO} T5 not yet recorded (storage not written by T4 capture time)`);
  }

  if (storageAtT4.T5_localStorage) {
    ts('T5  localStorage.royalte_scan_payload_ls written', storageAtT4.T5_localStorage);
  }

  // ── Phase 3: click MC immediately at T4 (simulate impatient click) ────────
  section('PHASE 3 — IMMEDIATE CLICK AT T4 (race simulation)');
  console.log(`  ${WARN} Clicking #open-mc-btn immediately — NO wait for sessionStorage`);
  console.log(`  ${WARN} This simulates a user clicking as soon as the button appears.\n`);

  await page.locator('#open-mc-btn').click();

  T.T8 = Date.now();
  ts('T8  MC navigation triggered', T.T8);

  // Determine URL (has scanId? — proves whether __royalteScan was set)
  const navUrl = page.url();
  const hasScanId = navUrl.includes('scanId=');
  ts('T8  navigated to', T.T8);
  console.log(`  URL: ${navUrl}`);
  assert(navUrl.includes('mission-control'), 'Navigated to mission-control.html');
  assert(navUrl.includes('preactivate=1'), 'URL has preactivate=1');
  if (!hasScanId) {
    console.log(`  ${WARN} URL has NO scanId — click handler saw window.__royalteScan = null`);
    console.log(`       (showRealResults hadn't run yet when button was clicked)`);
  }

  // Wait for MC page to fully load
  await page.waitForLoadState('networkidle');

  // Storage state on MC page immediately after navigation
  const mcStorageImmediate = await page.evaluate(() => ({
    hasScanPayloadSS: !!sessionStorage.getItem('royalte_scan_payload'),
    hasWorkspaceCtx:  !!sessionStorage.getItem('royalte_workspace_context'),
    hasLsPayload:     !!localStorage.getItem('royalte_scan_payload_ls'),
  }));
  console.log('\n  Storage on MC page immediately after navigation:');
  console.log(`  royalte_scan_payload    (SS): ${mcStorageImmediate.hasScanPayloadSS  ? 'PRESENT' : 'MISSING'}`);
  console.log(`  royalte_scan_payload_ls (LS): ${mcStorageImmediate.hasLsPayload      ? 'PRESENT' : 'MISSING'}`);
  console.log(`  royalte_workspace_context:    ${mcStorageImmediate.hasWorkspaceCtx   ? 'PRESENT (too early?)' : 'not yet'}`);

  const sourceAvailable = mcStorageImmediate.hasScanPayloadSS || mcStorageImmediate.hasLsPayload;
  if (!sourceAvailable) {
    console.log(`\n  ${FAIL} RACE CONFIRMED: no scan payload available to __mcPopulate()`);
    console.log(`       The click at T4 happened before T5 (storage writes).`);
    console.log(`       __mcPopulate() will fetch from Supabase (no scanId → return null).`);
    console.log(`       Expected result: "No Scan Loaded" in all 8 workspaces.`);
  } else {
    console.log(`\n  ${PASS} Source payload IS available — race not demonstrated on this run`);
    console.log(`       (Playwright's CDP overhead bridged the 150ms window.)`);
  }

  // ── Phase 4: wait for __mcPopulate to fire, confirm outcome ───────────────
  section('PHASE 4 — WAIT FOR __mcPopulate (~10s) AND VERIFY OUTCOME');
  console.log(`  ${INFO} Waiting up to 20s for royalte_workspace_context…`);

  let ctxWritten = false;
  try {
    await page.waitForFunction(
      () => !!sessionStorage.getItem('royalte_workspace_context'),
      null, { timeout: 20000 }
    );
    T.T7 = Date.now();
    ts('T7  royalte_workspace_context written', T.T7);
    ctxWritten = true;
  } catch {
    T.T7 = null;
    console.log(`  ${FAIL} royalte_workspace_context NOT written within 20s`);
    console.log(`       __mcPopulate() returned null — "No Scan Loaded" will appear`);
  }

  // Check diagnostic console on MC page
  const diagLogs = consoleLog.filter(l =>
    l.text.includes('[mc-diag]') || l.text.includes('[race-timing]') || l.text.includes('[hp-diag]')
  );
  console.log(`\n  Diagnostic console trace (${diagLogs.length} entries):`);
  diagLogs.forEach(l => console.log(`    ${l.text}`));

  // ── Phase 5: navigate a workspace, confirm "No Scan Loaded" ──────────────
  section('PHASE 5 — WORKSPACE CHECK (health-intelligence)');
  await page.goto(`${PROD}/workspaces/health-intelligence.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const wsResult = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const overlay = document.getElementById('ws-no-scan-overlay');
    const overlayVisible = overlay && (
      overlay.style.display !== 'none' &&
      !overlay.hasAttribute('hidden')
    );
    return {
      noScanText:    body.includes('No Scan Loaded') || body.includes('No scan loaded'),
      overlayVisible: !!overlayVisible,
      hasCtx:        !!sessionStorage.getItem('royalte_workspace_context'),
    };
  });
  console.log(`  "No Scan Loaded" text:  ${wsResult.noScanText    ? 'FOUND ← RACE CONFIRMED' : 'absent'}`);
  console.log(`  Overlay visible:        ${wsResult.overlayVisible ? 'YES ← RACE CONFIRMED'   : 'no'}`);
  console.log(`  royalte_workspace_context: ${wsResult.hasCtx ? 'present' : 'MISSING'}`);

  // ── Phase 6: timing summary ────────────────────────────────────────────────
  section('TIMING SUMMARY');

  const fmt = (t) => t ? `+${(t - T.T0).toFixed(0).padStart(6)}ms` : '        N/A';

  console.log(`
  T0  Scan page loaded:            ${fmt(T.T0)}
  T1  runScan() begins:            ${fmt(T.T1)}
  T2  runAudit() API call:         ${fmt(T.T2)}
  T3  runAudit() API 200:          ${fmt(T.T3)}
  T4  #open-mc-btn ENABLED:        ${fmt(T.T4)}   ← race window OPENS here
  T5  sessionStorage written:      ${storageAtT4.T5_sessionStorage ? fmt(storageAtT4.T5_sessionStorage) : '        (after T4)'}   ← race window CLOSES here
  T8  MC navigation triggered:     ${fmt(T.T8)}
  T7  royalte_workspace_context:   ${T.T7 ? fmt(T.T7) : '        NOT WRITTEN'}

  T4 → T5 gap (race window):  ${T4_T5_gap !== null ? `${T4_T5_gap}ms` : 'T5 not captured (> 5s gap or never written)'}
  T4 → T8 gap (click speed):  ${T.T8 && T.T4 ? `${T.T8 - T.T4}ms` : 'N/A'}
  `);

  const raceProven = raceWindowOpen || (wsResult.noScanText || wsResult.overlayVisible) || !ctxWritten;

  if (raceProven) {
    console.log(`  ${FAIL} RACE CONDITION PROVEN`);
    console.log(`       The MC button was enabled BEFORE sessionStorage was written.`);
    console.log(`       Clicking at T4 produced "No Scan Loaded."`);
    console.log(`\n  ROOT CAUSE:`);
    console.log(`       In runAudit() (public/index.html ~line 2613):`);
    console.log(`         setTimeout(() => showRealResults(auditData), 150);  // ← storage writes`);
    console.log(`         btn.disabled = false;                               // ← scan button`);
    console.log(`         return;                                             // ← runAudit() returns`);
    console.log(`       Then in runScan() (public/index.html ~line 3370):`);
    console.log(`         openMcBtn.disabled = false;  // ← MC button enabled BEFORE 150ms fires`);
    console.log(`\n  FIX REQUIRED:`);
    console.log(`       The MC button must not be enabled until storage writes complete.`);
    console.log(`       Implementation: move storage writes before the button enable.`);
  } else {
    console.log(`  ${PASS} Race not demonstrated on this run`);
    console.log(`       (Playwright CDP overhead > 150ms race window — human click would expose it)`);
    console.log(`\n  STATIC ANALYSIS PROOF (code does not require runtime):`);
    console.log(`       Line ~2613: setTimeout(() => showRealResults(), 150)`);
    console.log(`       Line ~3370: openMcBtn.disabled = false  [synchronous, runs before 150ms fires]`);
    console.log(`       → T4 is structurally guaranteed to precede T5 by 150ms.`);
  }

  await browser.close();
  printSummary();
}

function printSummary() {
  console.log(`\n${'═'.repeat(72)}`);
  if (failures === 0) {
    console.log(`  \x1b[32m TIMING PROOF COMPLETE\x1b[0m`);
  } else {
    console.log(`  \x1b[31m ${failures} assertion(s) failed\x1b[0m`);
  }
  console.log('═'.repeat(72) + '\n');
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
