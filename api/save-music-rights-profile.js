// POST /api/save-music-rights-profile
//
// Persists the Music Rights Profile™ for the authenticated artist.
// Called by public/onboarding.html after the artist answers the 2 required questions.
// The profile is required — there is no skip path.
//
// Artist-supplied groups (onboarding):
//   performing_rights: { pro, soundexchange }
//
// Intelligence-auto-populated groups (future, added post-scan by intelligence engines):
//   recording:    { record_label, label_name }       — from Apple Music catalog
//   distribution: { distributor, distributor_other } — inferred from Apple Music
//   publishing:   { publishing_admin, publisher }    — from MLC works
//
// The client sends only the groups it has. This endpoint wraps them with the
// meta block before writing. Future intelligence groups merge in separately.
//
// Request:
//   Authorization: Bearer <user_access_token>
//   Content-Type: application/json
//   Body: { profile: { performing_rights: { pro, soundexchange } } }
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
  const profile = body.profile;

  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
    return res.status(400).json({ error: 'profile object required' });
  }

  // ── Upsert ────────────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  // Wrap the client-supplied groups with the meta block.
  // At onboarding: profile = { performing_rights: { pro, soundexchange } }
  // Intelligence engines merge additional groups post-scan.
  const updatePayload = {
    onboarding_completed_at: now,
    updated_at: now,
    music_rights_profile: {
      meta: {
        version:          '1.0',
        completed_at:     now,
        last_updated_at:  now,
      },
      ...profile,
    },
  };

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
