// ─────────────────────────────────────────────────────────────────────────────
// lib/render-audit-pdf.js
//
// Renders a Royaltē audit PDF for a saved scan (audit_scans row).
//
// Pipeline:
//   1. Load audit_scans row by id (canonical AuditResponse v1.0.0 in payload).
//   2. Fill lib/audit-report-template.html with values from the canonical
//      payload — adapter-only logic, no re-derivation of scan data.
//   3. POST filled HTML to PDFShift /v3/convert/pdf, get PDF buffer.
//   4. Upload buffer to Supabase Storage bucket 'audit-reports' at key
//      '<scanId>.pdf' (upsert).
//   5. Update audit_scans row: pdf_status='ready', pdf_url=<public url>,
//      pdf_rendered_at=now(). On failure: pdf_status='failed', pdf_error.
//
// Idempotency: if the row is already pdf_status='ready', returns the
// existing pdf_url without re-rendering. Concurrent callers race-overwrite
// the Storage object — last write wins; cost is 2× PDFShift on collision.
// submit-audit.js enforces the 1-retry cap (file 4) to keep this rare.
//
// Public API:
//   renderAuditPdf(scanId) -> { scanId, pdfUrl, pdfStatus, alreadyRendered }
//
// TODO: switch bucket to private + signed URLs post-beta. Public bucket is
// intentional for now (anyone with a forwarded email link can read).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH     = join(__dirname, 'audit-report-template.html');
const STORAGE_BUCKET    = 'audit-reports';
const PDFSHIFT_ENDPOINT = 'https://api.pdfshift.io/v3/convert/pdf';

// ── Supabase client (service role bypasses RLS) ──────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[render-audit-pdf] Supabase credentials not configured');
  return createClient(url, key);
}

// ── Action library (Q2 B) ────────────────────────────────────────────────────
// Per-module prescriptive copy for the Action Plan section. Picked into the
// PDF based on the 3 lowest-scoring canonical modules. Static — does not
// vary per scan. Kept inline (single consumer) rather than a separate file.
const ACTION_LIBRARY = Object.freeze({
  metadata:   { title: 'Fix metadata gaps',         instruction: 'Reconcile metadata across distributor, PRO, and DSP records' },
  coverage:   { title: 'Confirm DSP distribution',  instruction: 'Confirm release distribution across all major DSPs' },
  publishing: { title: 'Register with PRO',         instruction: 'Register catalog with PRO and publishing administrator' },
  youtube:    { title: 'Enable Content ID',         instruction: 'Enable Content ID monitoring on YouTube' },
  duplicates: { title: 'Audit for duplicates',      instruction: 'Audit catalog for duplicate ISRC/UPC registrations' },
  sync:       { title: 'Verify sync splits',        instruction: 'Verify sync licensing splits across catalog' },
});

// ── Adapters: canonical → template ───────────────────────────────────────────

// Platform availability → display label + CSS class suffix (Q6 mapping).
function platformDisplay(availability) {
  switch (availability) {
    case 'VERIFIED':         return { label: 'Connected',     cls: 'connected' };
    case 'NOT_FOUND':        return { label: 'Not Connected', cls: 'not-connected' };
    case 'AUTH_UNAVAILABLE': return { label: 'Unknown',       cls: 'unknown' };
    case 'ERROR':            return { label: 'Unknown',       cls: 'unknown' };
    default:                 return { label: 'Unknown',       cls: 'unknown' };
  }
}

// Severity → high/medium/low bucket (template has 3, schema has 4).
// Lowercase output drives both the CSS class suffix and the visible badge —
// .risk-badge / .priority-pill / .status-pill all set text-transform:uppercase.
function severityBucket(severity) {
  switch (severity) {
    case 'CRITICAL': return 'high';
    case 'HIGH':     return 'high';
    case 'WARNING':  return 'medium';
    case 'INFO':     return 'low';
    default:         return 'low';
  }
}

// Stock impact strings for issue cards (Q1 ii — adapter, not invented data).
function impactString(bucket) {
  switch (bucket) {
    case 'high':   return 'High potential revenue exposure.';
    case 'medium': return 'Moderate revenue exposure.';
    case 'low':    return 'Limited revenue exposure.';
    default:       return 'Limited revenue exposure.';
  }
}

// Module score → band CSS (Q3 thresholds, Q4 AUTH_UNAVAILABLE handling).
function moduleBand(module) {
  if (module?.availability === 'AUTH_UNAVAILABLE') return 'warning';
  const s = module?.score;
  if (typeof s !== 'number') return 'warning';
  if (s >= 75) return 'healthy';
  if (s >= 40) return 'warning';
  return 'danger';
}

function moduleScoreForRender(module) {
  if (module?.availability === 'AUTH_UNAVAILABLE') return 0;
  const s = module?.score;
  return typeof s === 'number' ? s : 0;
}

function bandToPriority(band) {
  switch (band) {
    case 'danger':  return 'high';
    case 'warning': return 'medium';
    default:        return 'low';
  }
}

// "May 2, 2026" — Intl with explicit en-US locale (Q6).
function formatScanDate(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(d);
  } catch {
    return 'Unknown';
  }
}

// First 8 chars of UUID, uppercased: 'a1b2c3d4-...' → 'A1B2C3D4' (Q7).
function shortReportId(uuid) {
  if (typeof uuid !== 'string') return 'UNKNOWN';
  return uuid.slice(0, 8).toUpperCase();
}

// HTML-escape values that originate from third-party data (artist names,
// issue text, etc.). Static template copy is trusted; only filled values
// pass through this. Required even though canonical issue strings are
// engine-generated — defense in depth against future scrubbing changes.
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Placeholder builder ──────────────────────────────────────────────────────
// Builds the full {placeholder: filled-value} map for one canonical payload.
// All values are HTML-escaped here; template fill is plain string replace.
function buildPlaceholders(scanId, payload) {
  const subject   = payload.subject   || {};
  const score     = payload.score     || {};
  const platforms = payload.platforms || {};
  const modules   = payload.modules   || {};
  const issues    = Array.isArray(payload.issues) ? payload.issues : [];

  const map = {
    // Cover
    artist_name: esc(subject.artistName || 'Unknown Artist'),
    scan_date:   esc(formatScanDate(payload.scannedAt)),
    report_id:   esc(shortReportId(scanId)),
    // Score
    score:       esc(score.overall ?? 0),
  };

  // ── Issue counts (severity bucketing) ──
  let highCount = 0, medCount = 0, lowCount = 0;
  for (const issue of issues) {
    const b = severityBucket(issue.severity);
    if (b === 'high')   highCount++;
    else if (b === 'medium') medCount++;
    else lowCount++;
  }
  map.high_risk_count   = String(highCount);
  map.medium_risk_count = String(medCount);
  map.low_risk_count    = String(lowCount);

  // ── Top 3 issues — pad missing slots so {{...}} never leaks. ──
  for (let i = 0; i < 3; i++) {
    const n = i + 1;
    const issue = issues[i];
    if (issue) {
      const bucket = severityBucket(issue.severity);
      map[`issue_${n}_title`]   = esc(issue.title || 'Issue detected');
      map[`issue_${n}_risk`]    = esc(bucket);
      map[`issue_${n}_meaning`] = esc(issue.detail || 'N/A');
      map[`issue_${n}_impact`]  = esc(impactString(bucket));
    } else {
      map[`issue_${n}_title`]   = 'No additional issue detected';
      map[`issue_${n}_risk`]    = 'low';
      map[`issue_${n}_meaning`] = 'N/A';
      map[`issue_${n}_impact`]  = '';
    }
  }

  // ── Platforms. PRO always 'Unknown' / 'unknown' per brief. ──
  const pSpot  = platformDisplay(platforms.spotify?.availability);
  const pApple = platformDisplay(platforms.appleMusic?.availability);
  const pYT    = platformDisplay(platforms.youtube?.availability);
  map.platform_spotify        = esc(pSpot.label);
  map.platform_spotify_status = esc(pSpot.cls);
  map.platform_apple          = esc(pApple.label);
  map.platform_apple_status   = esc(pApple.cls);
  map.platform_youtube        = esc(pYT.label);
  map.platform_youtube_status = esc(pYT.cls);
  map.platform_pro            = 'Unknown';
  map.platform_pro_status     = 'unknown';

  // ── Modules. Template surfaces 4 of 6: metadata, coverage→"platform",
  //    publishing, youtube→"ugc". duplicates+sync still feed Action Plan. ──
  const tplToCanonical = {
    metadata:   'metadata',
    platform:   'coverage',
    publishing: 'publishing',
    ugc:        'youtube',
  };
  for (const [tplKey, canonKey] of Object.entries(tplToCanonical)) {
    const m = modules[canonKey];
    map[`module_${tplKey}`]      = String(moduleScoreForRender(m));
    map[`module_${tplKey}_band`] = moduleBand(m);
  }

  // ── Action plan — 3 lowest-scoring canonical modules → action library. ──
  const allModules = ['metadata', 'coverage', 'publishing', 'youtube', 'duplicates', 'sync'];
  const ranked = allModules
    .map(key => ({
      key,
      score: moduleScoreForRender(modules[key]),  // AUTH_UNAVAILABLE → 0
      band:  moduleBand(modules[key]),
    }))
    .sort((a, b) => a.score - b.score);  // ascending — lowest first

  for (let i = 0; i < 3; i++) {
    const n = i + 1;
    const pick = ranked[i];
    const lib  = pick && ACTION_LIBRARY[pick.key];
    if (lib) {
      map[`action_${n}_title`]       = esc(lib.title);
      map[`action_${n}_priority`]    = esc(bandToPriority(pick.band));
      map[`action_${n}_instruction`] = esc(lib.instruction);
    } else {
      map[`action_${n}_title`]       = 'N/A';
      map[`action_${n}_priority`]    = 'low';
      map[`action_${n}_instruction`] = 'N/A';
    }
  }

  return map;
}

// ── Template fill ────────────────────────────────────────────────────────────
// Plain {{key}} replace — no expressions, no conditionals. The builder
// guarantees every placeholder is filled; unmatched would surface visibly.
function fillTemplate(template, map) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '';
  });
}

// ── PDFShift ─────────────────────────────────────────────────────────────────
// v3 API: POST { source: <html> }. Auth is HTTP Basic with 'api' as the
// username and the API key as the password (PDFShift's documented scheme).
// use_print:true activates the template's @media print stylesheet (light
// theme, page breaks, page-counter footers).
async function renderViaPdfShift(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) throw new Error('PDFSHIFT_API_KEY not configured');

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const resp = await fetch(PDFSHIFT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      source:    html,
      use_print: true,
      format:    'Letter',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`PDFShift ${resp.status}: ${errText.slice(0, 500) || resp.statusText}`);
  }

  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ── Storage upload ───────────────────────────────────────────────────────────
async function uploadPdf(supabase, scanId, pdfBuffer) {
  const path = `${scanId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert:      true,
    });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) throw new Error('Storage upload succeeded but public URL missing');
  return pub.publicUrl;
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function renderAuditPdf(scanId) {
  if (!scanId || typeof scanId !== 'string') {
    throw new Error('renderAuditPdf: scanId required');
  }

  const supabase = getSupabase();

  // Load row
  const { data: row, error: loadErr } = await supabase
    .from('audit_scans')
    .select('id, payload, pdf_status, pdf_url, pdf_attempts')
    .eq('id', scanId)
    .single();
  if (loadErr || !row) {
    throw new Error(`audit_scans row not found for scanId ${scanId}: ${loadErr?.message || 'no row'}`);
  }

  // Idempotent short-circuit — already rendered.
  if (row.pdf_status === 'ready' && row.pdf_url) {
    return {
      scanId,
      pdfUrl:          row.pdf_url,
      pdfStatus:       'ready',
      alreadyRendered: true,
    };
  }

  // Mark rendering + bump attempts.
  const nextAttempts = (row.pdf_attempts || 0) + 1;
  const { error: markErr } = await supabase
    .from('audit_scans')
    .update({
      pdf_status:   'rendering',
      pdf_attempts: nextAttempts,
      pdf_error:    null,
    })
    .eq('id', scanId);
  if (markErr) throw new Error(`audit_scans mark-rendering failed: ${markErr.message}`);

  try {
    const template = await readFile(TEMPLATE_PATH, 'utf8');
    const map      = buildPlaceholders(scanId, row.payload || {});
    const html     = fillTemplate(template, map);
    const pdfBuf   = await renderViaPdfShift(html);
    const pdfUrl   = await uploadPdf(supabase, scanId, pdfBuf);

    const { error: doneErr } = await supabase
      .from('audit_scans')
      .update({
        pdf_status:      'ready',
        pdf_url:         pdfUrl,
        pdf_rendered_at: new Date().toISOString(),
        pdf_error:       null,
      })
      .eq('id', scanId);
    if (doneErr) throw new Error(`audit_scans finalize failed: ${doneErr.message}`);

    return {
      scanId,
      pdfUrl,
      pdfStatus:       'ready',
      alreadyRendered: false,
    };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 2000);
    await supabase
      .from('audit_scans')
      .update({ pdf_status: 'failed', pdf_error: msg })
      .eq('id', scanId);
    throw err;
  }
}
