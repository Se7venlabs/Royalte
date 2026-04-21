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
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[submit-audit] Supabase credentials not configured');
  return createClient(url, key);
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
  } = req.body || {};

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

  // ── ABUSE PROTECTION (rate limits before any DB writes) ──
  const ip = extractIp(req);

  const blockStatus = await checkBlocked(ip);
  if (blockStatus.blocked) {
    const retryAfter = Math.max(1, Math.ceil((new Date(blockStatus.expiresAt).getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  }

  // Soft rollout: 10/hr submits (tighten to 5/hr after 48h log review)
  const rl = await checkRateLimit(ip, 'submit-audit', {
    burst: { max: 2 },   // 2 submits per 10-second window
    hour:  { max: 10 },  // rollout value — tighten to 5 after review
    day:   { max: 20 },  // rollout value — tighten to 10 after review
  });
  if (!rl.allowed) {
    res.setHeader('Retry-After', rl.retryAfter || 60);
    recordViolation(ip, 'submit-audit', rl.reason).catch(() => {});
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter || 60 });
  }

  // ── SUPABASE INSERT ───────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    // ── PER-EMAIL SOFT LOCK ──
    // Prevent duplicate audits for the same email if one is:
    //   - pending
    //   - processing
    //   - completed within the last 7 days
    // Friendly response (not a hard block) — directs users to email for re-scans.
    const normalizedEmail = email.trim().toLowerCase();
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 3600 * 1000)).toISOString();
    const { data: existingRows, error: lockErr } = await supabase
      .from('audit_requests')
      .select('id, status, created_at, source_url, artist_name')
      .eq('email', normalizedEmail)
      .or(`status.eq.pending,status.eq.processing,and(status.eq.completed,created_at.gte.${sevenDaysAgo})`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (lockErr) {
      console.warn('[submit-audit] per-email lock check failed (allowing):', lockErr.message);
      // Fail-open: if the lock query itself errors, proceed with insert
    } else if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      console.log('[submit-audit] 🛑 Duplicate suppressed | email:', normalizedEmail, '| existing id:', existing.id, '| status:', existing.status);
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'You already have an audit in progress or recently completed. Email info@royalte.ai if you need a fresh re-scan.',
        existing_id: existing.id,
        existing_status: existing.status,
      });
    }

    const insertPayload = {
      source_url:  source_url.trim(),
      artist_name: artist_name.trim(),
      email:       normalizedEmail,
      url_type:    url_type || null,
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

    // ── TRIGGER BACKGROUND PROCESSING (fire-and-forget) ───────────────────
    // Resolve the absolute URL because serverless functions can't call themselves
    // with a relative path. We read the host from the incoming request headers.
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      if (host) {
        const triggerUrl = `${proto}://${host}/api/process-audit`;
        // Do NOT await — we want the response to return to the user immediately.
        // Vercel keeps the container alive long enough for the TCP handshake.
        const triggerHeaders = { 'Content-Type': 'application/json' };
        if (process.env.INTERNAL_API_SECRET) {
          triggerHeaders['x-internal-secret'] = process.env.INTERNAL_API_SECRET;
        }
        fetch(triggerUrl, {
          method: 'POST',
          headers: triggerHeaders,
          body: JSON.stringify({ id: data.id }),
        }).catch(err => {
          console.warn('[submit-audit] process-audit trigger failed (non-blocking):', err.message);
        });
        console.log('[submit-audit] 🔔 Triggered process-audit for id:', data.id);
      } else {
        console.warn('[submit-audit] No host header — cannot trigger process-audit');
      }
    } catch (triggerErr) {
      console.warn('[submit-audit] Trigger dispatch threw (non-blocking):', triggerErr.message);
    }

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
