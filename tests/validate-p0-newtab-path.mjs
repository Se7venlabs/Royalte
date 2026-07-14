/**
 * P0 NEW-TAB PATH VALIDATION — PR #326 (localStorage bridge)
 *
 * Simulates the Board's reproduction scenario: Mission Control is opened in a
 * NEW browser context after a scan, meaning sessionStorage is empty on the MC
 * page.  Without PR #326 this caused "No Scan Loaded" in all workspaces.
 *
 * Simulation approach:
 *   1. Scan on royalte.ai (real API call) — scan payload is written to BOTH
 *      sessionStorage AND localStorage (royalte_scan_payload_ls) by the fix.
 *   2. Capture the localStorage entry from the scan page context.
 *   3. Open a NEW browser context (fresh tab — empty sessionStorage).
 *   4. Navigate to mission-control.html with the real scanId+sessionId URL
 *      (same URL the Board's new tab would receive from Cmd+click).
 *   5. Inject ONLY the localStorage entry into the new context
 *      (sessionStorage remains empty — this is the divergence point).
 *   6. Wait for __mcPopulate() to fire (localStorage FALLBACK HIT path).
 *   7. Validate royalte_workspace_context written by the fallback.
 *   8. Validate all 8 workspace contracts.
 *   9. Navigate each workspace — confirm no "No Scan Loaded".
 */

import { chromium } from '@playwright/test';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const RoyalteContext = _require('../public/js/mc-workspace-context.js');

const PROD    = 'https://www.royalte.ai';
const SPOTIFY = 'https://open.spotify.com/album/2gO1294s3OwsgUbiLqy6S9';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';
let failures = 0;

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
  console.log(`\n${'═'.repeat(70)}\n  ${title}\n${'═'.repeat(70)}`);
}

async function run() {
  console.log('\nROYALTĒ — NEW-TAB PATH VALIDATION (PR #326 localStorage bridge)');
  console.log(`Target: ${PROD}`);
  console.log(`Scan:   ${SPOTIFY}`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log('\nThis test reproduces the Board\'s scenario:');
  console.log('  Mission Control opened in a NEW TAB (empty sessionStorage).');
  console.log('  Fix: localStorage fallback provides the payload.\n');

  const browser = await chromium.launch({ headless: true });

  // ── PHASE 1: Scan in Context A (the original tab) ─────────────────────────
  section('PHASE 1 — SCAN IN ORIGINAL TAB (Context A)');

  const ctxA = await browser.newContext();
  const pgA  = await ctxA.newPage();
  pgA.setDefaultTimeout(120000);

  const diagA = [];
  pgA.on('console', m => diagA.push(`[${m.type()}] ${m.text()}`));

  console.log(`  ${INFO} Loading homepage…`);
  await pgA.goto(PROD, { waitUntil: 'networkidle' });
  await pgA.locator('#url-input').fill(SPOTIFY);
  await pgA.locator('#sh-run-btn').click();
  console.log(`  ${INFO} Scan submitted. Waiting up to 90s…\n`);

  try {
    await pgA.waitForFunction(
      () => { const b = document.getElementById('open-mc-btn'); return b && !b.disabled; },
      null, { timeout: 90000 }
    );
  } catch {
    assert(false, 'Scan timed out — open-mc-btn never enabled');
    await browser.close();
    printSummary(); return;
  }
  console.log(`  ${PASS} Scan complete`);

  // Grab the MC destination URL the button would navigate to
  const mcUrl = await pgA.evaluate(() => {
    const scanId    = window.__royalteScan?.scanId || '';
    const sessionId = (typeof getOrCreateSessionId === 'function') ? getOrCreateSessionId() : '';
    let dest = '/mission-control.html?vault=1&preactivate=1';
    if (scanId)    dest += '&scanId='      + encodeURIComponent(scanId);
    if (sessionId) dest += '&session_id='  + encodeURIComponent(sessionId);
    return dest;
  });
  console.log(`  ${INFO} MC URL captured: ${mcUrl}`);

  // Capture the localStorage entry written by the fix
  let lsEntry = null;
  try {
    await pgA.waitForFunction(
      () => !!localStorage.getItem('royalte_scan_payload_ls'),
      null, { timeout: 5000 }
    );
    const raw = await pgA.evaluate(() => localStorage.getItem('royalte_scan_payload_ls'));
    lsEntry = raw ? JSON.parse(raw) : null;
  } catch {
    lsEntry = await pgA.evaluate(() => {
      const r = localStorage.getItem('royalte_scan_payload_ls');
      return r ? JSON.parse(r) : null;
    });
  }

  assert(!!lsEntry, 'royalte_scan_payload_ls written to localStorage by index.html (PR #326 fix)');
  if (lsEntry) {
    const age = Date.now() - (lsEntry.storedAt || 0);
    assert(!!lsEntry.payload?.subject?.artistName, `Payload artist in localStorage: "${lsEntry.payload?.subject?.artistName}"`);
    assert(age < 60000, `Entry is fresh (${Math.round(age / 1000)}s old)`);
    console.log(`  ${INFO} localStorage payload keys: ${Object.keys(lsEntry.payload || {}).slice(0, 12).join(', ')}`);
  }

  // Verify sessionStorage was also written (same-tab path still works)
  const ssPresent = await pgA.evaluate(() => !!sessionStorage.getItem('royalte_scan_payload'));
  assert(ssPresent, 'royalte_scan_payload also in sessionStorage (same-tab path unaffected)');

  await ctxA.close();

  // ── PHASE 2: Open MC in NEW CONTEXT (simulates new tab — empty sessionStorage) ─
  section('PHASE 2 — OPEN MC IN NEW TAB (Context B — empty sessionStorage)');

  const ctxB = await browser.newContext();
  const pgB  = await ctxB.newPage();
  pgB.setDefaultTimeout(120000);

  const diagB     = [];
  const errorsB   = [];
  pgB.on('console', m => {
    const t = `[${m.type()}] ${m.text()}`;
    diagB.push(t);
    if (m.type() === 'error') errorsB.push(m.text());
  });

  // Navigate to MC first so we're on the right origin
  console.log(`  ${INFO} Navigating new tab to ${PROD}${mcUrl}`);
  await pgB.goto(`${PROD}${mcUrl}`, { waitUntil: 'domcontentloaded' });

  // Verify sessionStorage is empty in this new context
  const ssEmpty = await pgB.evaluate(() => !sessionStorage.getItem('royalte_scan_payload'));
  assert(ssEmpty, 'sessionStorage is empty in new tab (reproduces Board scenario)');

  // Inject ONLY the localStorage entry (not sessionStorage — that's the divergence point)
  if (lsEntry) {
    await pgB.evaluate((entry) => {
      localStorage.setItem('royalte_scan_payload_ls', JSON.stringify(entry));
    }, lsEntry);
    console.log(`  ${INFO} localStorage entry injected into new tab (${JSON.stringify(lsEntry).length} bytes)`);
  }

  // Wait for the page to finish loading scripts
  await pgB.waitForLoadState('networkidle');

  const mcPopulateType = await pgB.evaluate(() => typeof window.__mcPopulate);
  assert(mcPopulateType === 'function', `window.__mcPopulate is defined ("${mcPopulateType}")`);

  // ── PHASE 3: Wait for __mcPopulate to fire via localStorage fallback ───────
  section('PHASE 3 — WAIT FOR __mcPopulate() (localStorage fallback path, ~10s)');
  console.log(`  ${INFO} Waiting for royalte_workspace_context (up to 30s)…`);

  let ctx = null;
  try {
    await pgB.waitForFunction(
      () => !!sessionStorage.getItem('royalte_workspace_context'),
      null, { timeout: 30000 }
    );
    const raw = await pgB.evaluate(() => sessionStorage.getItem('royalte_workspace_context'));
    assert(!!raw, 'royalte_workspace_context written (localStorage fallback path)');
    ctx = JSON.parse(raw);

    assert(ctx.schemaVersion === '1.1', `schemaVersion = "${ctx.schemaVersion}"`);
    assert(!!ctx.scanId,               `scanId        = "${ctx.scanId}"`);
    assert(!!ctx.subject?.artistName,  `artistName    = "${ctx.subject?.artistName}"`);

    // Confirm the fallback log line appeared in console
    const fbHit = diagB.some(l => l.includes('localStorage FALLBACK HIT'));
    assert(fbHit, '[mc-diag] localStorage FALLBACK HIT appeared in console');

    console.log(`\n  Runtime Context (written via localStorage fallback):`);
    console.log(`    schemaVersion:      ${ctx.schemaVersion}`);
    console.log(`    scanId:             ${ctx.scanId}`);
    console.log(`    subject.artistName: ${ctx.subject?.artistName}`);
    console.log(`    healthScore:        ${ctx.healthScore?.overallScore ?? '(null)'}`);
    console.log(`    executiveBrief:     ${ctx.executiveBrief?.headline ?? '(null)'}`);

  } catch (err) {
    assert(false, 'royalte_workspace_context NOT written within 30s — fallback did not fire', err.message);
    console.log(`\n  ${WARN} Console log (last 15):`);
    diagB.slice(-15).forEach(l => console.log(`    ${l}`));
    await browser.close();
    printSummary(); return;
  }

  // ── PHASE 4: Contract validation ──────────────────────────────────────────
  section('PHASE 4 — CONTRACT VALIDATION (localStorage-sourced context)');

  const contracts = [
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'backend-intelligence', 'global-music-footprint',
    'ai-insights', 'monitoring-timeline',
  ];
  for (const name of contracts) {
    const r  = RoyalteContext.validateContract(ctx, name);
    const ok = r.state === 'valid';
    assert(ok, `Contract [${name}]`, ok ? '' : `state=${r.state} — ${r.reason || ''}`);
  }

  // ── PHASE 5: Workspace rendering — all 8 must render without "No Scan Loaded" ─
  section('PHASE 5 — WORKSPACE RENDERING (8/8, new-tab context)');

  const workspaces = [
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'backend-intelligence', 'global-music-footprint',
    'ai-insights', 'monitoring-timeline',
  ];

  for (const ws of workspaces) {
    await pgB.goto(`${PROD}/workspaces/${ws}.html`, { waitUntil: 'networkidle' });
    await pgB.waitForTimeout(1200);

    const r = await pgB.evaluate(() => {
      const body = document.body.innerText || '';
      const noScanText = body.includes('No Scan Loaded') || body.includes('No scan loaded');
      const selectors  = ['.ws-no-scan', '[data-no-scan]', '.no-scan-overlay', '#ws-no-scan-overlay', '#ii-no-scan'];
      let overlayVisible = noScanText;
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) {
          const cs = window.getComputedStyle(el);
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0') {
            overlayVisible = true; break;
          }
        }
      }
      return {
        overlayVisible,
        noScanText,
        ctxPresent: !!sessionStorage.getItem('royalte_workspace_context'),
      };
    });

    const ok = !r.overlayVisible && r.ctxPresent;
    console.log(`\n  ${ok ? PASS : FAIL} ${ws}`);
    console.log(`    No Scan overlay: ${r.overlayVisible ? 'VISIBLE ← FAIL' : 'hidden ✓'}`);
    console.log(`    "No Scan" text:  ${r.noScanText    ? 'FOUND ← FAIL'   : 'absent ✓'}`);
    console.log(`    workspace ctx:   ${r.ctxPresent     ? 'present ✓'      : 'MISSING ← FAIL'}`);
    if (!ok) failures++;
  }

  // ── Final diagnostic summary ──────────────────────────────────────────────
  section('DIAGNOSTIC LOG — FALLBACK PATH TRACE');
  const keyLogs = diagB.filter(l =>
    l.includes('[mc-diag]') || l.includes('[hp-diag]') || l.includes('[mc]')
  );
  keyLogs.forEach(l => console.log(`  ${INFO} ${l}`));

  const mcErrors = errorsB.filter(e =>
    e.includes('__mcPopulate') || e.includes('workspace_context') ||
    e.includes('buildWorkspace') || e.includes('mission-control')
  );
  assert(mcErrors.length === 0,
    `No MC pipeline errors (${mcErrors.length} found)`,
    mcErrors.slice(0, 2).join(' | ')
  );

  section('FINAL PROOF — NEW-TAB PATH');
  console.log(`\n  Scan ID:        ${ctx?.scanId}`);
  console.log(`  Artist:         ${ctx?.subject?.artistName}`);
  console.log(`  Schema:         ${ctx?.schemaVersion}`);
  console.log(`  Health score:   ${ctx?.healthScore?.overallScore ?? '(null)'}`);
  console.log(`  Brief:          ${ctx?.executiveBrief?.headline ?? '(null)'}`);
  console.log(`  Path:           localStorage fallback (sessionStorage was empty)`);
  console.log(`\n  PR:             https://github.com/Se7venlabs/Royalte/pull/326`);
  console.log(`  Commit:         2dbf78e`);
  console.log(`  Source:         ${PROD} (production)`);

  await browser.close();
  printSummary();
}

function printSummary() {
  console.log(`\n${'═'.repeat(70)}`);
  if (failures === 0) {
    console.log(`  \x1b[32m ALL NEW-TAB PATH STEPS PASSED — "No Scan Loaded" does not occur\x1b[0m`);
    console.log(`  \x1b[32m localStorage fallback (PR #326) resolves the Board's reproduction\x1b[0m`);
  } else {
    console.log(`  \x1b[31m FAILED — ${failures} assertion(s)\x1b[0m`);
  }
  console.log('═'.repeat(70) + '\n');
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
