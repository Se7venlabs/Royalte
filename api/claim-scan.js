// POST /api/claim-scan
//
// Claims anonymous audit_scans rows for the authenticated user's session.
// Uses the service-role key server-side — the migrate_anonymous_scans function
// is only executable by service_role; browser callers cannot invoke it directly.
//
// Request:
//   Authorization: Bearer <user_access_token>
//   Content-Type: application/json
//   Body: { session_id: string }
//
// Response:
//   200 { claimed: number, scanId: string | null }
//     claimed  — rows updated (0 = already owned or nothing matched)
//     scanId   — most recently claimed scan's id (null if claimed = 0)
//   400 — session_id missing
//   401 — Bearer token missing or invalid
//   500 — DB error

import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // ── Authenticate ───────────────────────────────────────────────────────────
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // ── Validate body ──────────────────────────────────────────────────────────
  const sessionId = (req.body && typeof req.body.session_id === 'string')
    ? req.body.session_id.trim()
    : null;
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id required' });
  }

  // ── Claim: UPDATE audit_scans where session_id matches and unclaimed ────────
  // Equivalent to migrate_anonymous_scans(sessionId, user.id) but executed
  // server-side with the service-role key, which bypasses the GRANT restriction.
  const { error: updateErr, count } = await supabase
    .from('audit_scans')
    .update({ user_id: user.id }, { count: 'exact' })
    .eq('session_id', sessionId)
    .is('user_id', null);

  if (updateErr) {
    console.error('[claim-scan] update failed:', updateErr.message);
    return res.status(500).json({ error: 'Claim failed', detail: updateErr.message });
  }

  const claimed = typeof count === 'number' ? count : 0;

  // ── Return the most recently owned scan for this session ───────────────────
  // Runs regardless of claimed count — handles already-claimed scans on
  // re-login (idempotent) and returns the scan the client should load.
  const { data: rows } = await supabase
    .from('audit_scans')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const scanId = rows?.[0]?.id || null;

  return res.status(200).json({ claimed, scanId });
}
