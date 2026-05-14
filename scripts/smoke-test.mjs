#!/usr/bin/env node
import { validateAuditResponse } from '../api/schema/auditResponse.js';
import { normalizeAuditResponse } from '../api/lib/normalizeAuditResponse.js';

const RADIOHEAD_SPOTIFY_URL = 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb';
const TIMEOUT_MS = 30000;

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error('Usage: smoke-test.mjs <baseUrl>');
    process.exit(1);
  }

  const BYPASS_TOKEN = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  let auditUrl = `${baseUrl.replace(/\/$/, '')}/api/audit?url=${encodeURIComponent(RADIOHEAD_SPOTIFY_URL)}`;
  if (BYPASS_TOKEN) {
    auditUrl += `&x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;
    console.log(`[smoke-test] Using Vercel automation bypass for protected deployment`);
  }

  console.log(`[smoke-test] Probing: ${auditUrl}`);
  console.log(`[smoke-test] Test artist: Radiohead`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response, body;
  try {
    response = await fetch(auditUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (err) {
    console.error(`[smoke-test] FAILED: fetch error — ${err.message}`);
    process.exit(1);
  }

  console.log(`[smoke-test] HTTP status: ${response.status}`);

  if (response.status !== 200) {
    const errText = await response.text().catch(() => '<unreadable>');
    console.error(`[smoke-test] FAILED: expected 200, got ${response.status}`);
    console.error(`[smoke-test] body: ${errText.slice(0, 500)}`);
    process.exit(1);
  }

  try {
    body = await response.json();
  } catch (err) {
    console.error(`[smoke-test] FAILED: response body is not valid JSON — ${err.message}`);
    process.exit(1);
  }

  console.log(`[smoke-test] Response body parsed; ${Object.keys(body).length} top-level fields`);

  // Production /api/audit responds with the RAW wire shape by design
  // (the canonical is only persisted server-side to audit_scans.payload).
  // Mirror the server's pipeline locally: normalize → validate.
  // This exercises the same code path the server runs internally.
  let canonical;
  try {
    canonical = normalizeAuditResponse(body);
  } catch (err) {
    console.error(`[smoke-test] FAILED: normalizeAuditResponse threw — ${err.message}`);
    process.exit(1);
  }

  console.log(`[smoke-test] Normalized canonical from wire response`);

  try {
    validateAuditResponse(canonical);
  } catch (err) {
    console.error(`[smoke-test] FAILED: validateAuditResponse threw on normalized canonical`);
    console.error(`[smoke-test] error name: ${err.name}`);
    console.error(`[smoke-test] error message: ${err.message}`);
    console.error(`[smoke-test] error path: ${err.path || '(none)'}`);
    console.error(`[smoke-test] error detail: ${err.detail || '(none)'}`);
    process.exit(1);
  }

  console.log(`[smoke-test] SUCCESS: response validates against canonical schema`);
  console.log(`[smoke-test] artist: ${canonical?.subject?.artistName || '(unknown)'}`);
  console.log(`[smoke-test] scan_id: ${canonical?.scanId || '(unknown)'}`);
}

main().catch(err => {
  console.error(`[smoke-test] FAILED: unexpected error — ${err.message}`);
  process.exit(1);
});
