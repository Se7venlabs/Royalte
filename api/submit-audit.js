// Royaltē — /api/submit-audit.js
// MODULE 2: Audit Request Insert
//
// PURPOSE: Receive form submission from the landing page and insert a new
//          record into the Supabase `audit_requests` table with status = 'pending'.
//
// CALLED BY: public/adjustments.html → submitForm()
// PATTERN: Mirrors Supabase client setup from api/territory-scan.js
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { renderAuditPdf } from '../lib/render-audit-pdf.js';

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[submit-audit] Supabase credentials not configured');
  return createClient(url, key);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF render + email pipeline (introduced for v1.0.0 audit_scans flow).
//
// Render timing: lazy here (vs eager in /api/audit) — the user only gets
// a PDF when they hand over an email. submit-audit awaits the render +
// email synchronously, then returns.
//
// Retry policy: 1 retry max, enforced via audit_scans.pdf_attempts. The
// renderer increments attempts internally on each call, so once attempts
// hits 2 we stop. Cap is global (across submit-audit invocations), not
// per-invocation — protects against runaway PDFShift cost if a user
// re-submits the form for the same scanId multiple times.
//
// Soft-fail: on render or send failure, audit_requests is marked 'failed'
// with an error_message but the HTTP response still returns success so
// the user sees "we'll email you shortly" UX. Errors live in logs.
// ─────────────────────────────────────────────────────────────────────────────
const PDF_ATTEMPT_CAP = 2;

function escHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderWithRetryCap(scanId, supabase) {
  // Pre-flight: short-circuit on already-ready, refuse if cap hit.
  const { data: row, error } = await supabase
    .from('audit_scans')
    .select('pdf_status, pdf_url, pdf_attempts')
    .eq('id', scanId)
    .single();
  if (error || !row) {
    throw new Error(`audit_scans row not found for scanId ${scanId}: ${error?.message || 'no row'}`);
  }
  if (row.pdf_status === 'ready' && row.pdf_url) {
    return { pdfUrl: row.pdf_url, alreadyRendered: true };
  }
  if ((row.pdf_attempts || 0) >= PDF_ATTEMPT_CAP) {
    throw new Error(`render cap reached (${row.pdf_attempts} attempts) — not retrying`);
  }

  try {
    return await renderAuditPdf(scanId);
  } catch (firstErr) {
    // Re-check cap before deciding to retry. renderAuditPdf bumps attempts
    // internally on failure, so we may already be at the cap.
    const { data: row2 } = await supabase
      .from('audit_scans')
      .select('pdf_attempts')
      .eq('id', scanId)
      .single();
    if (!row2 || (row2.pdf_attempts || 0) >= PDF_ATTEMPT_CAP) {
      throw firstErr;
    }
    return await renderAuditPdf(scanId);
  }
}

async function sendAuditEmail({ to, artistName, pdfUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const resend = new Resend(apiKey);
  const safeArtist = escHtml(artistName || 'your music');
  const safeUrl    = escHtml(pdfUrl);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;color:#1a0d2e;line-height:1.5;">
      <h2 style="color:#8a5cff;font-size:22px;margin:0 0 16px 0;">Your Royaltē Audit is Ready</h2>
      <p>Hi,</p>
      <p>The audit for <strong>${safeArtist}</strong> is complete.</p>
      <p style="margin:20px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#8a5cff,#e040c8);color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:600;">Download Your Audit (PDF)</a>
      </p>
      <p style="color:#666;font-size:13px;">If the button doesn't work, copy this link:<br><a href="${safeUrl}" style="color:#8a5cff;word-break:break-all;">${safeUrl}</a></p>
      <p>Questions? Just reply to this email.</p>
      <p style="color:#999;font-size:12px;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">— The Royaltē Team</p>
    </div>
  `;

  const result = await resend.emails.send({
    from:    'Royaltē <info@royalte.ai>',
    to:      [to],
    subject: 'Your Royaltē Audit',
    html,
  });
  if (result.error) {
    const detail = result.error.message || JSON.stringify(result.error);
    throw new Error(`Resend send failed: ${detail}`);
  }
  return result.data?.id || null;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── CORS headers (landing page same-origin on Vercel, but safe to include)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── PARSE BODY ────────────────────────────────────────────────────────────
  const {
    source_url,
    artist_name,
    email,
    url_type,
    scanId,
  } = req.body || {};

  if (!scanId || typeof scanId !== 'string' || scanId.length === 0) {
    return res.status(400).json({
      error: 'scan_id required',
      detail: 'No saved scan to process. Please run a scan first.'
    });
  }

  // ── VALIDATION ────────────────────────────────────────────────────────────
  const missing = [];
  if (!source_url)  missing.push('source_url');
  if (!artist_name) missing.push('artist_name');
  if (!email)       missing.push('email');

  if (missing.length > 0) {
    console.error('[submit-audit] Missing required fields:', missing.join(', '));
    return res.status(400).json({
      error: 'Missing required fields',
      missing,
    });
  }

  // Basic email sanity check
  if (!email.includes('@')) {
    console.error('[submit-audit] Invalid email:', email);
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // ── SUPABASE INSERT ───────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    const insertPayload = {
      source_url:  source_url.trim(),
      artist_name: artist_name.trim(),
      email:       email.trim().toLowerCase(),
      url_type:    url_type || null,
      scan_id:     scanId || null,
      status:      'pending',
    };

    console.log('[submit-audit] Inserting audit request:', {
      artist_name: insertPayload.artist_name,
      email:       insertPayload.email,
      url_type:    insertPayload.url_type,
      source_url:  insertPayload.source_url,
    });

    const { data, error } = await supabase
      .from('audit_requests')
      .insert(insertPayload)
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[submit-audit] Supabase insert error:', error.message, '| code:', error.code);
      return res.status(500).json({
        error: 'Database insert failed',
        detail: error.message,
      });
    }

    // ── SUCCESS ───────────────────────────────────────────────────────────
    console.log('[submit-audit] ✅ Inserted audit_request id:', data.id, '| status:', data.status, '| created_at:', data.created_at);

    // ── PDF RENDER + EMAIL (lazy, synchronous, 1 retry max) ─────────────────
    // Soft-fail throughout: any failure here updates audit_requests to
    // 'failed' but the response below still returns success — users see
    // "we'll email you shortly" UX and Resend retries can run out-of-band.
    // Skips entirely when scanId is absent (degraded Apple path returns
    // null scanId from /api/audit; legacy submissions don't include it).
    if (scanId) {
      let pdfUrl    = null;
      let renderErr = null;

      try {
        const result = await renderWithRetryCap(scanId, supabase);
        pdfUrl = result.pdfUrl;
      } catch (err) {
        renderErr = err;
        console.warn('[submit-audit] PDF render failed | scanId:', scanId, '| err:', err.message);
      }

      if (pdfUrl) {
        try {
          const emailId = await sendAuditEmail({
            to:         insertPayload.email,
            artistName: insertPayload.artist_name,
            pdfUrl,
          });
          console.log('[submit-audit] ✓ Audit email sent | id:', data.id, '| resend:', emailId);

          // Advance audit_requests since we delivered. Failure here is
          // non-blocking — the email is already out the door.
          try {
            await supabase
              .from('audit_requests')
              .update({
                status:        'completed',
                processed_at:  new Date().toISOString(),
                error_message: null,
              })
              .eq('id', data.id);
          } catch (updErr) {
            console.warn('[submit-audit] audit_requests completion update failed (non-blocking):', updErr.message);
          }
        } catch (sendErr) {
          console.error('[submit-audit] Resend send failed | id:', data.id, '| err:', sendErr.message);
          try {
            await supabase
              .from('audit_requests')
              .update({
                status:        'failed',
                error_message: `Email send failed: ${sendErr.message}`.slice(0, 2000),
                processed_at:  new Date().toISOString(),
              })
              .eq('id', data.id);
          } catch (_) { /* best effort */ }
        }
      } else if (renderErr) {
        // Render failed (caps hit or PDFShift errored). Record on the
        // audit_requests row but keep user-facing success.
        try {
          await supabase
            .from('audit_requests')
            .update({
              status:        'failed',
              error_message: `PDF render failed: ${renderErr.message}`.slice(0, 2000),
              processed_at:  new Date().toISOString(),
            })
            .eq('id', data.id);
        } catch (_) { /* best effort */ }
      }
    }
    // ── END PDF RENDER + EMAIL ──────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      id:         data.id,
      status:     data.status,
      created_at: data.created_at,
    });

  } catch (err) {
    console.error('[submit-audit] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
