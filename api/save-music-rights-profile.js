// POST /api/save-music-rights-profile
//
// Persists the Music Rights Profile™ for the authenticated artist.
// Called by public/onboarding.html after the artist completes all 7 sections.
// The profile is required — there is no skip path.
//
// The stored JSONB shape is:
//   {
//     meta:              { version, completed_at, last_updated_at }
//     performing_rights: { pro, soundexchange }
//     publishing:        { publishing_admin, publisher }
//     distribution:      { distributor, distributor_other }
//     recording:         { record_label, label_name }
//     songwriter:        { songwriter_status }
//   }
//
// The client (onboarding.html) assembles the grouped structure and sends it
// as body.profile. This endpoint wraps it with the meta block before writing.
//
// Request:
//   Authorization: Bearer <user_access_token>
//   Content-Type: application/json
//   Body: { profile: object }
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
  // profile is expected to be pre-structured by the client:
  //   { performing_rights, publishing, distribution, recording, songwriter }
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
