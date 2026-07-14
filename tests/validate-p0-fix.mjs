/**
 * P0 FIX VALIDATION — PR #324
 *
 * Validates the full runtime pipeline after adding mission-control.js to
 * mission-control.html.
 *
 * Architecture:
 *   - Serves public/ via http-server on localhost:7799 (the fixed code)
 *   - Uses a real scan payload from www.royalte.ai (Black Alternative)
 *   - Playwright injects the payload, navigates MC, verifies all 8 workspaces
 *
 * Steps:
 *  1. Verify mission-control.js loads (HTTP 200, window.__mcPopulate = function)
 *  2. Verify royalte_workspace_context is written after __mcPopulate()
 *  3. Validate all 8 workspace contracts (RoyalteContext.validateContract)
 *  4. Verify each workspace renders without "No Scan Loaded"
 *  5. Provide direct HTML workspace links
 *  6. Negative test: no scan → overlay shown
 *  7. Refresh: context survives within same tab session
 *  8. Navigation chain: context intact through all workspaces
 *  9. Console audit: no MC/contract errors
 * 10. Final proof summary
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
// mc-workspace-context.js is CJS (public/js/package.json forces commonjs)
const RoyalteContext = _require('../public/js/mc-workspace-context.js');

const PORT    = 7799;
const BASE    = `http://localhost:${PORT}`;
const PAYLOAD = JSON.parse(fs.readFileSync('/tmp/black-alternative-scan.json', 'utf8'));

const WORKSPACES = [
  { id: 'health-intelligence',    contract: 'health-intelligence',    label: 'Health Intelligence' },
  { id: 'identity-intelligence',  contract: 'identity-intelligence',  label: 'Identity Intelligence' },
  { id: 'publishing-intelligence',contract: 'publishing-intelligence',label: 'Publishing Intelligence' },
  { id: 'catalog-intelligence',   contract: 'catalog-intelligence',   label: 'Catalog Intelligence' },
  { id: 'backend-intelligence',   contract: 'backend-intelligence',   label: 'Backend Intelligence' },
  { id: 'global-music-footprint', contract: 'global-music-footprint', label: 'Global Music Footprint' },
  { id: 'ai-insights',            contract: 'ai-insights',            label: 'AI Insights' },
  { id: 'monitoring-timeline',    contract: 'monitoring-timeline',    label: 'Monitoring Timeline' },
];

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';
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

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('npx', [
      'http-server', 'public', '-p', String(PORT), '--cors', '-c-1', '--silent',
    ], { cwd: process.cwd(), stdio: 'pipe' });

    let started = false;
    const ready = () => {
      if (!started) { started = true; resolve(server); }
    };

    // http-server prints "Available on:" when ready; fall back to 1.5s timeout
    server.stdout.on('data', d => { if (d.toString().includes('localhost')) ready(); });
    server.stderr.on('data', d => { if (d.toString().includes('localhost')) ready(); });
    setTimeout(ready, 1500);
    server.on('error', reject);
  });
}

async function waitForFunction(page, fn, label, timeout = 10000) {
  try {
    await page.waitForFunction(fn, null, { timeout });
    return true;
  } catch {
    console.log(`  ${FAIL} Timeout: ${label}`);
    failures++;
    return false;
  }
}

async function run() {
  console.log('\nROYALTĒ — P0 FIX VALIDATION');
  console.log(`Scan: Black Alternative (${PAYLOAD.scanId})`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Code: local public/ (branch fix/mc-script-load-p0)\n`);

  // ── Start local server ────────────────────────────────────────────────────
  let server;
  try {
    server = await startServer();
    console.log(`  ${INFO} Local server started on ${BASE}\n`);
  } catch (err) {
    console.error('Could not start http-server:', err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();
  page.setDefaultTimeout(30000);

  // Capture console + network
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const loadedScripts = [];
  page.on('response', resp => {
    const u = resp.url();
    if (u.endsWith('.js') || u.includes('.js?')) loadedScripts.push({ url: u, status: resp.status() });
  });

  // ── Seed sessionStorage with real scan payload ────────────────────────────
  section('STEP A — SEED REAL SCAN PAYLOAD');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((payload) => {
    sessionStorage.setItem('royalte_scan_payload', JSON.stringify(payload));
  }, PAYLOAD);
  const seeded = await page.evaluate(() => !!sessionStorage.getItem('royalte_scan_payload'));
  assert(seeded, `royalte_scan_payload seeded (Black Alternative, scanId: ${PAYLOAD.scanId})`);

  // ── STEP 1 — mission-control.js loads ────────────────────────────────────
  section('STEP 1 — VERIFY SCRIPT LOAD');

  await page.goto(`${BASE}/mission-control.html?vault=1`, { waitUntil: 'networkidle' });

  // Wait for mission-control.js module to execute and define __mcPopulate
  const mcDefined = await waitForFunction(
    page,
    () => typeof window.__mcPopulate === 'function',
    'window.__mcPopulate defined',
    12000
  );

  const mcType = await page.evaluate(() => typeof window.__mcPopulate);
  assert(mcType === 'function', `typeof window.__mcPopulate = "${mcType}"`, 'expected "function"');

  const mcScript  = loadedScripts.find(s => s.url.includes('mission-control.js'));
  const mapScript = loadedScripts.find(s => s.url.includes('runtime-context-mapper.js'));
  const vaultSc   = loadedScripts.find(s => s.url.includes('vault-auth.js'));

  assert(mcScript?.status === 200,  `mission-control.js      HTTP ${mcScript?.status ?? 'not requested'}`);
  assert(mapScript?.status === 200, `runtime-context-mapper.js HTTP ${mapScript?.status ?? 'not requested'}`);
  assert(vaultSc?.status === 200,   `vault-auth.js            HTTP ${vaultSc?.status ?? 'not requested'}`);

  const js404 = loadedScripts.filter(s => s.status === 404 && s.url.includes('localhost'));
  assert(js404.length === 0, `No 404 JS errors`, js404.map(s => s.url).join(', '));

  const mapperReady = await page.evaluate(() => typeof window.buildWorkspaceRuntimeContext);
  assert(mapperReady === 'function', `window.buildWorkspaceRuntimeContext = "${mapperReady}"`);

  // ── STEP 2 — royalte_workspace_context written ───────────────────────────
  section('STEP 2 — RUNTIME CONTEXT WRITTEN');

  // Confirm payload survived navigation to MC
  const payloadSurvived = await page.evaluate(() => !!sessionStorage.getItem('royalte_scan_payload'));
  assert(payloadSurvived, 'royalte_scan_payload survived navigation to MC');

  // Call __mcPopulate() directly (mirrors what vault-auth.js does after auth unlock)
  if (mcDefined) {
    try {
      await page.evaluate(async () => { await window.__mcPopulate(); });
    } catch (e) {
      // Supabase calls inside __mcPopulate may fail in local env — that's OK;
      // the sessionStorage write happens before any Supabase interaction
    }
  }
  await page.waitForTimeout(600);

  const rawCtx = await page.evaluate(() => sessionStorage.getItem('royalte_workspace_context'));
  assert(!!rawCtx, 'royalte_workspace_context written to sessionStorage');

  let ctx = null;
  if (rawCtx) {
    try { ctx = JSON.parse(rawCtx); } catch { assert(false, 'royalte_workspace_context is valid JSON'); }
  }

  if (ctx) {
    assert(ctx.schemaVersion === '1.1',         `schemaVersion    = "${ctx.schemaVersion}"`);
    assert(!!ctx.scanId,                         `scanId           = "${ctx.scanId}"`);
    assert(!!ctx.generatedAt,                    `generatedAt      = "${ctx.generatedAt}"`);
    assert(ctx.subject?.artistName === 'Black Alternative',
                                                 `subject.artistName = "${ctx.subject?.artistName}"`);
    assert(ctx.subject?.artistName !== 'Gentlemen X', 'No stale artist "Gentlemen X"');
    assert(ctx.subject?.artistName !== 'Interscope', 'No stale label "Interscope" as artist');

    console.log(`\n  Runtime Context:`);
    console.log(`    schemaVersion:      ${ctx.schemaVersion}`);
    console.log(`    scanId:             ${ctx.scanId}`);
    console.log(`    generatedAt:        ${ctx.generatedAt}`);
    console.log(`    subject.artistName: ${ctx.subject?.artistName}`);
    console.log(`    healthScore:        ${ctx.healthScore?.overallScore ?? '(null)'}`);
    console.log(`    monitoringStatus:   ${ctx.monitoringIntelligence?.status ?? '(null)'}`);
    console.log(`    executiveBrief:     ${ctx.executiveBrief ? 'present' : '(null)'}`);
    console.log(`    executiveBrief.headline: ${ctx.executiveBrief?.headline ?? '(null)'}`);
  }

  // ── STEP 3 — Runtime Contract validation (Node) ──────────────────────────
  section('STEP 3 — RUNTIME CONTRACT VALIDATION (8 contracts)');

  const contractNames = [
    'health-intelligence', 'identity-intelligence', 'publishing-intelligence',
    'catalog-intelligence', 'backend-intelligence', 'global-music-footprint',
    'ai-insights', 'monitoring-timeline',
  ];
  const contractResults = contractNames.map(name => ({
    contract: name,
    ...RoyalteContext.validateContract(ctx, name),
  }));

  for (const r of contractResults) {
    const ok = r.state === 'valid';
    assert(ok, `Contract [${r.contract}]`, ok ? '' : `state=${r.state} reason=${r.reason || ''}`);
    if (!ok && r.missingDomains) console.log(`      missing domains: ${JSON.stringify(r.missingDomains)}`);
    if (!ok && r.missingFields)  console.log(`      missing fields:  ${JSON.stringify(r.missingFields)}`);
    if (!ok && r.typeMismatches) console.log(`      type mismatches: ${JSON.stringify(r.typeMismatches)}`);
  }

  // ── STEP 4 — Workspace rendering ─────────────────────────────────────────
  section('STEP 4 — WORKSPACE RENDERING (8/8)');

  for (const ws of WORKSPACES) {
    await page.goto(`${BASE}/workspaces/${ws.id}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => {
      // "No Scan Loaded" overlay detection — check common selector patterns
      const selectors = [
        '.ws-no-scan', '[data-no-scan]', '.no-scan-overlay', '.ws-no-data',
        '.scan-required', '[data-state="missing"]',
      ];
      let overlayVisible = false;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0') {
            overlayVisible = true;
            break;
          }
        }
      }
      // Also look for the text "No Scan Loaded" anywhere visible
      const bodyText = document.body.innerText || '';
      const hasNoScanText = bodyText.includes('No Scan Loaded') || bodyText.includes('No scan loaded');

      return {
        overlayVisible: overlayVisible || hasNoScanText,
        hasNoScanText,
        hasGentlemenX: bodyText.includes('Gentlemen X'),
        hasInterscope: bodyText.includes('Interscope'),
        hasBlackAlt:   bodyText.includes('Black Alternative'),
        ctxPresent: !!sessionStorage.getItem('royalte_workspace_context'),
      };
    });

    const ok = !r.overlayVisible && r.ctxPresent;
    console.log(`\n  ${ok ? PASS : FAIL} ${ws.label}`);
    console.log(`    No Scan overlay:    ${r.overlayVisible  ? 'VISIBLE ← FAIL' : 'hidden ✓'}`);
    console.log(`    "No Scan" text:     ${r.hasNoScanText   ? 'FOUND ← FAIL'   : 'absent ✓'}`);
    console.log(`    royalte_ws_ctx:     ${r.ctxPresent      ? 'present ✓'       : 'MISSING ← FAIL'}`);
    console.log(`    "Black Alternative":${r.hasBlackAlt     ? 'found ✓'          : 'not in body text'}`);
    console.log(`    Gentlemen X:        ${r.hasGentlemenX   ? 'FOUND ← STALE'   : 'absent ✓'}`);
    console.log(`    Interscope:         ${r.hasInterscope   ? 'FOUND ← STALE'   : 'absent ✓'}`);
    if (!ok) failures++;
    if (r.hasGentlemenX || r.hasInterscope) failures++;
  }

  // ── STEP 5 — Direct HTML links ───────────────────────────────────────────
  section('STEP 5 — WORKSPACE PREVIEW LINKS');
  const VERCEL = 'https://royalte-dtmiy2k2s-darrylwest-7086s-projects.vercel.app';
  for (const ws of WORKSPACES) {
    console.log(`  ${INFO} ${ws.label.padEnd(28)} ${VERCEL}/workspaces/${ws.id}.html`);
  }

  // ── STEP 6 — Negative test ───────────────────────────────────────────────
  section('STEP 6 — NEGATIVE TEST (fresh session → overlay)');
  const negCtx  = await browser.newContext();
  const negPage = await negCtx.newPage();
  await negPage.goto(`${BASE}/workspaces/health-intelligence.html`, { waitUntil: 'networkidle' });
  await negPage.waitForTimeout(800);
  const neg = await negPage.evaluate(() => {
    const ctxPresent = !!sessionStorage.getItem('royalte_workspace_context');
    const bodyText = document.body.innerText || '';
    const hasNoScanText = bodyText.includes('No Scan Loaded') || bodyText.includes('No scan loaded');
    const selectors = ['.ws-no-scan', '[data-no-scan]', '.no-scan-overlay'];
    let overlayVisible = hasNoScanText;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const s = window.getComputedStyle(el);
        if (s.display !== 'none' && s.visibility !== 'hidden') { overlayVisible = true; break; }
      }
    }
    return { ctxPresent, overlayVisible };
  });
  assert(!neg.ctxPresent,     'Fresh session: royalte_workspace_context is absent');
  assert(neg.overlayVisible,  'Fresh session: "No Scan Loaded" overlay IS visible');
  await negCtx.close();

  // ── STEP 7 — Refresh persistence ─────────────────────────────────────────
  section('STEP 7 — REFRESH PERSISTENCE');
  await page.goto(`${BASE}/workspaces/health-intelligence.html`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const afterReload = await page.evaluate(() => !!sessionStorage.getItem('royalte_workspace_context'));
  assert(afterReload, 'royalte_workspace_context present after page reload');

  // ── STEP 8 — Navigation chain ─────────────────────────────────────────────
  section('STEP 8 — NAVIGATION CHAIN (MC → all workspaces → MC)');
  const navChain = [
    { name: 'Mission Control', path: '/mission-control.html?vault=1' },
    ...WORKSPACES.map(w => ({ name: w.label, path: `/workspaces/${w.id}.html` })),
    { name: 'Mission Control (return)', path: '/mission-control.html?vault=1' },
  ];
  for (const nav of navChain) {
    await page.goto(`${BASE}${nav.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const ok = await page.evaluate(() => !!sessionStorage.getItem('royalte_workspace_context'));
    assert(ok, `Context intact: ${nav.name}`);
  }

  // ── STEP 9 — Console audit ───────────────────────────────────────────────
  section('STEP 9 — CONSOLE AUDIT');
  const mcErrors = consoleErrors.filter(e =>
    e.includes('__mcPopulate') || e.includes('__mc') ||
    e.includes('workspace_context') || e.includes('buildWorkspaceRuntimeContext') ||
    e.includes('RoyalteContext') || e.includes('contract') ||
    (e.includes('undefined') && e.includes('mission-control'))
  );
  assert(mcErrors.length === 0,
    `No MC pipeline console errors (${mcErrors.length} found)`,
    mcErrors.slice(0, 2).join(' | ')
  );
  console.log(`  ${INFO} Total console errors:      ${consoleErrors.length}`);
  console.log(`  ${INFO} MC pipeline errors:        ${mcErrors.length}`);
  if (mcErrors.length > 0) mcErrors.slice(0, 3).forEach(e => console.log(`      ${e}`));

  // ── STEP 10 — Final proof ─────────────────────────────────────────────────
  section('STEP 10 — FINAL PROOF SUMMARY');
  console.log(`\n  Scan ID:             ${PAYLOAD.scanId}`);
  console.log(`  Artist:              Black Alternative`);
  console.log(`  Source:              www.royalte.ai (live production scan)`);
  console.log(`  Schema version:      ${ctx?.schemaVersion}`);
  console.log(`  Context generated:   ${ctx?.generatedAt}`);
  console.log(`  Health score:        ${ctx?.healthScore?.overallScore}`);
  console.log(`  Monitoring status:   ${ctx?.monitoringIntelligence?.status}`);
  console.log(`\n  Contracts:`);
  for (const r of contractResults) {
    console.log(`    ${r.state === 'valid' ? PASS : FAIL} ${r.contract}`);
  }
  console.log(`\n  PR:      https://github.com/Se7venlabs/Royalte/pull/324`);
  console.log(`  Preview: ${VERCEL}`);
  console.log(`  Branch:  fix/mc-script-load-p0`);

  // ── Teardown ──────────────────────────────────────────────────────────────
  await browser.close();
  server.kill();

  console.log(`\n${'═'.repeat(70)}`);
  if (failures === 0) {
    console.log(`  \x1b[32m ALL STEPS PASSED — PR #324 READY FOR BOARD REVIEW\x1b[0m`);
  } else {
    console.log(`  \x1b[31m FAILED — ${failures} assertion(s) failed\x1b[0m`);
  }
  console.log('═'.repeat(70) + '\n');
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => { console.error('Unhandled error:', err); process.exit(1); });
