/**
 * P0 REAL-FLOW VALIDATION — PR #324 (post-merge)
 *
 * Exercises the EXACT production path the Board describes:
 *   Scan at royalte.ai → Open Mission Control → Workspaces
 *
 * Does NOT inject a pre-seeded payload. Does NOT call __mcPopulate() directly.
 * The test drives the UI like a real user and waits for the pipeline to fire.
 *
 * Timeline:
 *   ~30–60s  scan API response
 *   ~10s     preactivate animation before __mcPopulate() fires
 *   ~2s      workspace load + render check
 */

import { chromium } from '@playwright/test';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const RoyalteContext = _require('../public/js/mc-workspace-context.js');

const PROD       = 'https://www.royalte.ai';
const SPOTIFY    = 'https://open.spotify.com/album/2gO1294s3OwsgUbiLqy6S9';

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
  console.log('\nROYALTĒ — REAL-FLOW P0 VALIDATION (production)');
  console.log(`Target: ${PROD}`);
  console.log(`Scan:   ${SPOTIFY}`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log('\nThis test drives the UI exactly as the Board does.');
  console.log('No payload injection. No direct __mcPopulate() calls.\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();
  page.setDefaultTimeout(120000);

  const consoleLog    = [];
  const consoleErrors = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLog.push(text);
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), err: req.failure()?.errorText });
  });

  // ── STEP 1: Navigate to homepage ─────────────────────────────────────────
  section('STEP 1 — HOMEPAGE LOAD');
  await page.goto(PROD, { waitUntil: 'networkidle' });
  const title = await page.title();
  assert(!!title, `Page title: "${title}"`);

  const urlInput = page.locator('#url-input');
  const scanBtn  = page.locator('#sh-run-btn');
  assert(await urlInput.isVisible(), '#url-input scan input visible');
  assert(await scanBtn.isVisible(),  '#sh-run-btn scan button visible');

  // ── STEP 2: Submit a real scan ────────────────────────────────────────────
  section('STEP 2 — REAL SCAN SUBMISSION');
  console.log(`  ${INFO} Filling URL: ${SPOTIFY}`);
  await urlInput.fill(SPOTIFY);
  await scanBtn.click();
  console.log(`  ${INFO} Scan submitted. Waiting for result (up to 90s)…\n`);

  // Wait for #open-mc-btn to become enabled — the signal that scan is complete
  try {
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('open-mc-btn');
        return btn && !btn.disabled;
      },
      null, { timeout: 90000 }
    );
    console.log(`  ${PASS} Scan complete — #open-mc-btn is enabled`);
  } catch {
    assert(false, 'Scan timed out (90s) — #open-mc-btn never became enabled');
    await browser.close();
    printSummary();
    return;
  }

  // Wait for index.html to write royalte_scan_payload (fires in the scan success handler,
  // just before open-mc-btn is enabled — but headless timing can have a slight lag)
  let payloadRaw = null;
  try {
    await page.waitForFunction(
      () => !!sessionStorage.getItem('royalte_scan_payload'),
      null, { timeout: 5000 }
    );
    payloadRaw = await page.evaluate(() => sessionStorage.getItem('royalte_scan_payload'));
  } catch {
    payloadRaw = await page.evaluate(() => sessionStorage.getItem('royalte_scan_payload'));
  }
  assert(!!payloadRaw, 'royalte_scan_payload written to sessionStorage by index.html');

  let storedPayload = null;
  if (payloadRaw) {
    try {
      storedPayload = JSON.parse(payloadRaw);
      const artist = storedPayload?.subject?.artistName
        || storedPayload?.canonical?.subject?.artistName
        || '(unknown)';
      console.log(`  ${INFO} Stored artist: ${artist}`);
      console.log(`  ${INFO} Payload keys:  ${Object.keys(storedPayload).slice(0, 12).join(', ')}`);
      assert(!!storedPayload.subject?.artistName || !!storedPayload.canonical?.subject?.artistName,
        `Artist name resolvable from payload`);
    } catch (e) {
      assert(false, 'royalte_scan_payload is valid JSON', e.message);
    }
  }

  // ── STEP 3: Click "Open in Mission Control" ───────────────────────────────
  section('STEP 3 — NAVIGATE TO MISSION CONTROL (preactivate path)');

  // Intercept the navigation so we can stay in Playwright
  let mcUrl = null;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && frame.url().includes('mission-control')) {
      mcUrl = frame.url();
    }
  });

  console.log(`  ${INFO} Clicking #open-mc-btn…`);
  await page.locator('#open-mc-btn').click();

  // Wait for MC page to load
  await page.waitForURL('**/mission-control.html**', { timeout: 15000 });
  mcUrl = page.url();
  console.log(`  ${INFO} Navigated to: ${mcUrl}`);

  assert(mcUrl.includes('preactivate=1'), 'URL contains preactivate=1');
  assert(mcUrl.includes('vault=1'),       'URL contains vault=1');

  // ── STEP 4: Verify mission-control.js loaded ──────────────────────────────
  section('STEP 4 — SCRIPT LOAD ON MC PAGE');

  // Wait for MC page network idle then check scripts
  await page.waitForLoadState('networkidle');

  const mcPopulateType = await page.evaluate(() => typeof window.__mcPopulate);
  assert(mcPopulateType === 'function',
    `typeof window.__mcPopulate = "${mcPopulateType}"`,
    'mission-control.js must be loaded'
  );

  const builderType = await page.evaluate(() => typeof window.buildWorkspaceRuntimeContext);
  assert(builderType === 'function',
    `typeof window.buildWorkspaceRuntimeContext = "${builderType}"`
  );

  // Verify royalte_scan_payload survived navigation (same tab, same origin)
  const payloadSurvived = await page.evaluate(() => !!sessionStorage.getItem('royalte_scan_payload'));
  assert(payloadSurvived, 'royalte_scan_payload survived navigation to MC');
  if (!payloadSurvived) {
    console.log(`  ${WARN} CRITICAL: sessionStorage was cleared — payload cannot be read by __mcPopulate()`);
  }

  // ── STEP 5: Wait for __mcPopulate() to fire (preactivate animation) ───────
  section('STEP 5 — WAIT FOR __mcPopulate() TO FIRE (preactivate animation ~10s)');
  console.log(`  ${INFO} Waiting for royalte_workspace_context to appear (up to 30s)…`);

  let ctx = null;
  try {
    await page.waitForFunction(
      () => !!sessionStorage.getItem('royalte_workspace_context'),
      null, { timeout: 30000 }
    );
    const rawCtx = await page.evaluate(() => sessionStorage.getItem('royalte_workspace_context'));
    assert(!!rawCtx, 'royalte_workspace_context written after __mcPopulate() fired');
    ctx = JSON.parse(rawCtx);

    assert(ctx.schemaVersion === '1.1',  `schemaVersion = "${ctx.schemaVersion}"`);
    assert(!!ctx.scanId,                  `scanId        = "${ctx.scanId}"`);
    assert(!!ctx.generatedAt,             `generatedAt   = "${ctx.generatedAt}"`);
    assert(!!ctx.subject?.artistName,     `artistName    = "${ctx.subject?.artistName}"`);

    console.log(`\n  Runtime Context (written by __mcPopulate via real animation):`);
    console.log(`    schemaVersion:      ${ctx.schemaVersion}`);
    console.log(`    scanId:             ${ctx.scanId}`);
    console.log(`    generatedAt:        ${ctx.generatedAt}`);
    console.log(`    subject.artistName: ${ctx.subject?.artistName}`);
    console.log(`    healthScore:        ${ctx.healthScore?.overallScore ?? '(null)'}`);
    console.log(`    monitoringStatus:   ${ctx.monitoringIntelligence?.status ?? '(null)'}`);
    console.log(`    executiveBrief:     ${ctx.executiveBrief ? 'present' : '(null)'}`);
    console.log(`    executiveBrief.headline: ${ctx.executiveBrief?.headline ?? '(null)'}`);

  } catch (err) {
    assert(false, `royalte_workspace_context was NOT written within 30s`, err.message);

    // Diagnostic: check what happened
    const noPayload = await page.evaluate(() => !sessionStorage.getItem('royalte_scan_payload'));
    const noCtx     = await page.evaluate(() => !sessionStorage.getItem('royalte_workspace_context'));
    console.log(`  ${WARN} Diagnostic:`);
    console.log(`    royalte_scan_payload consumed (removed): ${noPayload}`);
    console.log(`    royalte_workspace_context missing:       ${noCtx}`);
    console.log(`\n  Console log (last 10 entries):`);
    consoleLog.slice(-10).forEach(l => console.log(`    ${l}`));

    await browser.close();
    printSummary();
    return;
  }

  // ── STEP 6: Contract validation ───────────────────────────────────────────
  section('STEP 6 — CONTRACT VALIDATION AGAINST REAL CONTEXT');

  const contracts = [
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'backend-intelligence', 'global-music-footprint',
    'ai-insights', 'monitoring-timeline',
  ];

  for (const name of contracts) {
    const r = RoyalteContext.validateContract(ctx, name);
    const ok = r.state === 'valid';
    assert(ok, `Contract [${name}]`, ok ? '' : `state=${r.state} reason=${r.reason || ''}`);
    if (!ok) {
      if (r.missingDomains?.length) console.log(`      missing domains: ${JSON.stringify(r.missingDomains)}`);
      if (r.missingFields?.length)  console.log(`      missing fields:  ${JSON.stringify(r.missingFields)}`);
      if (r.typeMismatches?.length) console.log(`      type mismatches: ${JSON.stringify(r.typeMismatches)}`);
    }
  }

  // ── STEP 7: Navigate to each workspace ────────────────────────────────────
  section('STEP 7 — WORKSPACE RENDERING (8/8)');

  const workspaces = [
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'backend-intelligence', 'global-music-footprint',
    'ai-insights', 'monitoring-timeline',
  ];

  for (const ws of workspaces) {
    await page.goto(`${PROD}/workspaces/${ws}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const noScanText = bodyText.includes('No Scan Loaded') || bodyText.includes('No scan loaded');
      const selectors = ['.ws-no-scan', '[data-no-scan]', '.no-scan-overlay'];
      let overlayVisible = noScanText;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
            overlayVisible = true; break;
          }
        }
      }
      return {
        overlayVisible,
        noScanText,
        ctxPresent: !!sessionStorage.getItem('royalte_workspace_context'),
        hasGentlemenX: bodyText.includes('Gentlemen X'),
        hasInterscope:  bodyText.includes('Interscope'),
      };
    });

    const ok = !r.overlayVisible && r.ctxPresent;
    console.log(`\n  ${ok ? PASS : FAIL} ${ws}`);
    console.log(`    No Scan overlay: ${r.overlayVisible ? 'VISIBLE ← FAIL' : 'hidden ✓'}`);
    console.log(`    "No Scan" text:  ${r.noScanText    ? 'FOUND ← FAIL'   : 'absent ✓'}`);
    console.log(`    workspace ctx:   ${r.ctxPresent     ? 'present ✓'      : 'MISSING ← FAIL'}`);
    console.log(`    Gentlemen X:     ${r.hasGentlemenX  ? 'FOUND ← STALE'  : 'absent ✓'}`);
    console.log(`    Interscope:      ${r.hasInterscope   ? 'FOUND ← STALE'  : 'absent ✓'}`);
    if (!ok) failures++;
    if (r.hasGentlemenX || r.hasInterscope) failures++;
  }

  // ── STEP 8: Console audit ─────────────────────────────────────────────────
  section('STEP 8 — CONSOLE AUDIT');

  const diagEntries = consoleLog.filter(l => l.includes('[mc-diag]') || l.includes('[hp-diag]'));
  console.log(`  ${INFO} Diagnostic log from real pipeline:`);
  diagEntries.forEach(l => console.log(`    ${l}`));

  const mcErrors = consoleErrors.filter(e =>
    e.includes('__mcPopulate') || e.includes('buildWorkspaceRuntimeContext') ||
    e.includes('workspace_context') || e.includes('RoyalteContext') ||
    e.includes('mission-control')
  );
  assert(mcErrors.length === 0,
    `No MC pipeline errors (${mcErrors.length} found)`,
    mcErrors.slice(0, 2).join(' | ')
  );

  // ── Final summary ─────────────────────────────────────────────────────────
  section('FINAL PROOF');
  console.log(`\n  Scan ID:        ${ctx?.scanId}`);
  console.log(`  Artist:         ${ctx?.subject?.artistName}`);
  console.log(`  Schema:         ${ctx?.schemaVersion}`);
  console.log(`  Health score:   ${ctx?.healthScore?.overallScore ?? '(null)'}`);
  console.log(`  Brief:          ${ctx?.executiveBrief?.headline ?? '(null)'}`);
  console.log(`\n  PR:      https://github.com/Se7venlabs/Royalte/pull/324`);
  console.log(`  Source:  ${PROD} (production)`);

  await browser.close();
  printSummary();
}

function printSummary() {
  console.log(`\n${'═'.repeat(70)}`);
  if (failures === 0) {
    console.log(`  \x1b[32m ALL REAL-FLOW STEPS PASSED\x1b[0m`);
  } else {
    console.log(`  \x1b[31m FAILED — ${failures} assertion(s)\x1b[0m`);
  }
  console.log('═'.repeat(70) + '\n');
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
