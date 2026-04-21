// Royaltē — /api/process-audit.js
// MODULE 3: Audit Processing Engine
//
// PURPOSE: Take a pending audit_requests row, run the audit engine, and write
//          results (or failure) back to Supabase.
//
// CALLED BY: api/submit-audit.js (fire-and-forget after successful insert)
// REUSES:    api/audit.js → runAudit()
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { runAudit } from './audit.js';
import { verifyInternalSecret } from './_lib/rate-limit.js';

// ── SUPABASE CLIENT (mirrors submit-audit.js pattern) ────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[process-audit] Supabase credentials not configured');
  return createClient(url, key);
}

// ── SUPABASE UPDATE HELPER — single update surface ───────────────────────────
async function updateAuditRequest(supabase, id, patch) {
  const { error } = await supabase
    .from('audit_requests')
    .update(patch)
    .eq('id', id);

  if (error) {
    console.error('[process-audit] Update failed | id:', id, '| patch keys:', Object.keys(patch), '| err:', error.message);
    throw new Error(`Supabase update failed: ${error.message}`);
  }
}

// ── SUMMARY BUILDER — trims full audit payload to a compact Supabase-safe blob
function buildSummary(payload) {
  const moduleScores = {};
  if (payload.modules && typeof payload.modules === 'object') {
    for (const [k, v] of Object.entries(payload.modules)) {
      moduleScores[k] = v?.score ?? null;
    }
  }

  return {
    overallScore:        payload.overallScore ?? null,
    flagCount:           payload.flagCount ?? 0,
    previewFlags:        payload.previewFlags || [],
    moduleScores,
    platforms:           payload.platforms || {},
    artistId:            payload.artistId || null,
    followers:           payload.followers || 0,
    popularity:          payload.popularity || 0,
    genres:              payload.genres || [],
    country:             payload.country || null,
    catalogAgeYears:     payload.catalog?.catalogAgeYears ?? null,
    catalogReleaseCount: payload.catalog?.totalReleases ?? null,
    catalogEarliestYear: payload.catalog?.earliestYear ?? null,
    catalogLatestYear:   payload.catalog?.latestYear ?? null,
    royaltyGapLow:       payload.royaltyGap?.potentialGapLow ?? null,
    royaltyGapHigh:      payload.royaltyGap?.potentialGapHigh ?? null,
    estAnnualStreams:    payload.royaltyGap?.estAnnualStreams ?? null,
    trackTitle:          payload.trackTitle || null,
    trackIsrc:           payload.trackIsrc || null,
    resolvedFrom:        payload.resolvedFrom || null,
    platform:            payload.platform || null,
    scannedAt:           payload.scannedAt || new Date().toISOString(),
  };
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── INTERNAL AUTH — only submit-audit.js (via INTERNAL_API_SECRET) may trigger this
  if (!verifyInternalSecret(req)) {
    console.warn('[process-audit] Rejected — missing/invalid x-internal-secret header');
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body || {};
  if (!id) {
    console.error('[process-audit] Missing id in request body');
    return res.status(400).json({ error: 'Missing id' });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    console.error('[process-audit] Supabase init failed:', err.message);
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  // ── STEP 1: Load the row ───────────────────────────────────────────────────
  const { data: row, error: fetchErr } = await supabase
    .from('audit_requests')
    .select('id, status, source_url, url_type, artist_name, email')
    .eq('id', id)
    .single();

  if (fetchErr || !row) {
    console.error('[process-audit] Row not found | id:', id, '| err:', fetchErr?.message);
    return res.status(404).json({ error: 'Audit request not found' });
  }

  // Idempotency: only process pending rows. Prevents duplicate runs.
  if (row.status !== 'pending') {
    console.warn('[process-audit] Skipping | id:', id, '| current status:', row.status);
    return res.status(200).json({ skipped: true, status: row.status });
  }

  if (!row.source_url) {
    console.error('[process-audit] Row has no source_url | id:', id);
    try {
      await updateAuditRequest(supabase, id, {
        status: 'failed',
        error_message: 'Missing source_url',
        processed_at: new Date().toISOString(),
      });
    } catch (_) { /* best effort */ }
    return res.status(400).json({ error: 'Missing source_url' });
  }

  // ── STEP 2: Flip to processing ─────────────────────────────────────────────
  try {
    await updateAuditRequest(supabase, id, { status: 'processing' });
    console.log('[process-audit] ▶ processing | id:', id, '| url:', row.source_url);
  } catch (err) {
    // If we can't even flip status, bail — don't run the expensive audit.
    return res.status(500).json({ error: 'Failed to set processing status' });
  }

  // ── STEP 3: Run the audit ──────────────────────────────────────────────────
  let auditResult;
  try {
    auditResult = await runAudit(row.source_url, row.url_type || undefined);
  } catch (err) {
    console.error('[process-audit] runAudit threw | id:', id, '| err:', err.message);
    auditResult = { ok: false, error: 'Audit engine threw unexpectedly', detail: err.message };
  }

  // ── STEP 4a: Failure path ──────────────────────────────────────────────────
  if (!auditResult.ok) {
    const errMsg = auditResult.detail
      ? `${auditResult.error}: ${auditResult.detail}`
      : auditResult.error || 'Unknown audit failure';

    try {
      await updateAuditRequest(supabase, id, {
        status: 'failed',
        error_message: errMsg.slice(0, 2000), // defensive truncation
        processed_at: new Date().toISOString(),
      });
      console.log('[process-audit] ✗ failed | id:', id, '| reason:', errMsg);
    } catch (updateErr) {
      console.error('[process-audit] Could not write failed status | id:', id, '| err:', updateErr.message);
    }

    return res.status(200).json({ ok: false, id, status: 'failed', error: errMsg });
  }

  // ── STEP 4b: Success path ──────────────────────────────────────────────────
  const summary = buildSummary(auditResult.payload);
  const resolvedArtistName = auditResult.payload.artistName || row.artist_name || null;
  const resolvedUrlType    = auditResult.payload.resolvedFrom || auditResult.payload.type || row.url_type || null;

  try {
    await updateAuditRequest(supabase, id, {
      status: 'completed',
      result_payload: summary,
      artist_name: resolvedArtistName,
      url_type: resolvedUrlType,
      processed_at: new Date().toISOString(),
      error_message: null,
    });
    console.log('[process-audit] ✓ completed | id:', id, '| artist:', resolvedArtistName, '| score:', summary.overallScore);
  } catch (updateErr) {
    console.error('[process-audit] Audit ran but could not save result | id:', id, '| err:', updateErr.message);
    // Attempt to mark as failed so the row doesn't get stuck in 'processing'.
    try {
      await updateAuditRequest(supabase, id, {
        status: 'failed',
        error_message: `Result save failed: ${updateErr.message}`.slice(0, 2000),
        processed_at: new Date().toISOString(),
      });
    } catch (_) { /* last-ditch; nothing more we can do */ }
    return res.status(500).json({ ok: false, id, status: 'failed', error: 'Result save failed' });
  }

  return res.status(200).json({
    ok: true,
    id,
    status: 'completed',
    overallScore: summary.overallScore,
    flagCount: summary.flagCount,
  });
}
