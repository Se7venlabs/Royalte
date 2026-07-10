// POST /api/save-music-rights-profile
//
// Persists the Music Rights Profile™ for the authenticated artist.
// Called by public/onboarding.html on "Complete Profile" and on "Skip for Now".
//
// On "Skip for Now" the client sends { skipped: true } — we set
// onboarding_completed_at without writing a profile object so the gate
// never fires again while leaving music_rights_profile null.
//
// Request:
//   Authorization: Bearer <user_access_token>
//   Content-Type: application/json
//   Body: { profile: object } | { skipped: true }
//
// Response:
//   200 { ok: true }
//   400 — missing/malformed body
//   401 — Bearer token missing or invalid
//   405 — wrong method
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

  // ── Authenticate ─────────────────────────────────────────────────────────────
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // ── Validate body ─────────────────────────────────────────────────────────────
  const body = req.body || {};
  const isSkip = body.skipped === true;
  const profile = body.profile;

  if (!isSkip && (typeof profile !== 'object' || profile === null || Array.isArray(profile))) {
    return res.status(400).json({ error: 'profile object required' });
  }

  // ── Upsert ────────────────────────────────────────────────────────────────────
  const updatePayload = {
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!isSkip) {
    updatePayload.music_rights_profile = {
      version: '1.0',
      completed_at: new Date().toISOString(),
      ...profile,
    };
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (updateErr) {
    console.error('[save-music-rights-profile] update failed:', updateErr.message);
    return res.status(500).json({ error: 'Save failed', detail: updateErr.message });
  }

  return res.status(200).json({ ok: true });
}
