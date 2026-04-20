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

  // ── SUPABASE INSERT ───────────────────────────────────────────────────────
  try {
    const supabase = getSupabase();

    const insertPayload = {
      source_url:  source_url.trim(),
      artist_name: artist_name.trim(),
      email:       email.trim().toLowerCase(),
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
        fetch(triggerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
