// Royaltē — V5 Phase 2: Founding Artist reservation endpoint.
//
// POST /api/founding-artist/reserve  body: { email }
//
// Pre-Stripe intent capture. Records that an email wants Founding Artist
// Access — does NOT grant entitlement, flip founding_artist, or change tier.
// Block C wires real activation post-Stripe.
//
// - Optional session: if a valid Supabase bearer token is present, the
//   reservation is linked to that user_id.
// - Idempotent: upsert on the UNIQUE email. An anonymous re-submission never
//   nulls out a previously-linked user_id.
// - Rate-limited per IP (reuses api/_lib/rate-limit.js).

import { createClient } from '@supabase/supabase-js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from '../_lib/rate-limit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    // ── Anti-abuse: blocked-IP check + per-IP rate limit ──
    // Both helpers fail-open on Supabase errors (documented policy in
    // api/_lib/rate-limit.js). Reservations are low-frequency — modest caps.
    const clientIp = extractIp(req);
    const blocked = await checkBlocked(clientIp);
    if (blocked.blocked) {
      const retryAfter = Math.max(1, Math.ceil((new Date(blocked.expiresAt).getTime() - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: 'blocked', retryAfter });
    }
    const limit = await checkRateLimit(clientIp, 'reserve', {
      burst: { max: 3 },
      hour:  { max: 15 },
      day:   { max: 30 },
    });
    if (!limit.allowed) {
      await recordViolation(clientIp, 'reserve', limit.reason);
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: limit.reason, retryAfter: limit.retryAfter });
    }

    // ── Validate email ──
    const body = (typeof req.body === 'object' && req.body) ? req.body : {};
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    // ── Supabase service-role client (the table has no INSERT policy) ──
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[reserve] Supabase env not configured');
      return res.status(500).json({ error: 'supabase_not_configured' });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Optional session — link the reservation to a user when present ──
    let userId = null;
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const { data: userData } = await supabase.auth.getUser(token);
        userId = userData?.user?.id ?? null;
      } catch (e) {
        // Invalid/expired token — treat as anonymous, do not fail the reserve.
        console.warn('[reserve] getUser failed, proceeding anonymous:', e.message);
      }
    }

    // ── Already reserved? (for the response flag) ──
    const { data: existing, error: selErr } = await supabase
      .from('founding_artist_reservations')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (selErr) {
      console.error('[reserve] lookup failed:', selErr.message);
      return res.status(500).json({ error: 'reservation_lookup_failed' });
    }
    const alreadyReserved = !!existing;

    // ── Upsert on email ──
    // user_id is included only when we have one. Omitting it on an anonymous
    // re-submission means the ON CONFLICT update does not touch user_id —
    // a previously-linked user_id survives (the brief's COALESCE intent).
    const row = { email };
    if (userId) row.user_id = userId;
    const { error: upErr } = await supabase
      .from('founding_artist_reservations')
      .upsert(row, { onConflict: 'email' });
    if (upErr) {
      console.error('[reserve] upsert failed:', upErr.message);
      return res.status(500).json({ error: 'reservation_failed' });
    }

    return res.status(200).json({ success: true, alreadyReserved });
  } catch (err) {
    console.error('[reserve] unexpected error:', err);
    return res.status(500).json({ error: 'unexpected' });
  }
}
