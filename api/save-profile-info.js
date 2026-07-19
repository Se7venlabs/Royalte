// POST /api/save-profile-info
//
// Persists Settings™ → Profile Information for the authenticated artist.
// Sibling endpoint to api/save-music-rights-profile.js — same auth pattern,
// same admin-client pattern — but a plain field-level update against
// public.profiles rather than the music_rights_profile JSONB blob.
//
// Editable fields (all optional per request — only provided keys are
// updated): display_name, country, reporting_timezone, preferred_language,
// artist_url_slug, preferences (whole-object write, see below).
//
// email is intentionally NOT editable here — email changes go through
// Supabase Auth's own updateUser() flow (identity verification), not a
// direct profiles-table write. Artist Name is not editable here either —
// it is Scan/CIO-derived, not a Settings-owned field (see
// governance/ARTIST_PROFILE_CARD_SETTINGS_SCHEMA.md).
//
// preferences is saved as a whole object per request (Settings →
// Preferences/Privacy save the full toggle set together, not field-by-field)
// — the same merge discipline as music_rights_profile, but the merge happens
// client-side before this call, not here.
//
// requestDeletion: true sets deletion_requested_at to the server's own
// clock (never client-supplied) and does nothing else — no cascade delete.
// Actual account deletion is a manual, support-handled process for this
// Build Pass.
//
// Request:
//   Authorization: Bearer <user_access_token>
//   Content-Type: application/json
//   Body: { profile: { display_name?, country?, reporting_timezone?, preferred_language?, artist_url_slug?, preferences? }, requestDeletion?: true }
//
// Response:
//   200 { ok: true }
//   400 — missing/malformed body, or no editable fields present
//   401 — Bearer token missing or invalid
//   405 — wrong method
//   409 — artist_url_slug already taken by another user
//   500 — DB error

import { createClient } from '@supabase/supabase-js';

const EDITABLE_FIELDS = ['display_name', 'country', 'reporting_timezone', 'preferred_language', 'artist_url_slug'];

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = req.body || {};
  const profile = body.profile || {};
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
    return res.status(400).json({ error: 'profile object required' });
  }
  if (body.requestDeletion !== undefined && body.requestDeletion !== true) {
    return res.status(400).json({ error: 'requestDeletion must be true or omitted' });
  }

  const updatePayload = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(profile, field)) {
      const value = profile[field];
      // Allow explicit null (clearing a field) or a non-empty trimmed string.
      if (value === null) {
        updatePayload[field] = null;
      } else if (isNonEmptyString(value)) {
        updatePayload[field] = value.trim();
      } else {
        return res.status(400).json({ error: `Invalid value for ${field}` });
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(profile, 'preferences')) {
    const prefs = profile.preferences;
    if (prefs !== null && (typeof prefs !== 'object' || Array.isArray(prefs))) {
      return res.status(400).json({ error: 'Invalid value for preferences' });
    }
    updatePayload.preferences = prefs;
  }

  if (body.requestDeletion === true) {
    updatePayload.deletion_requested_at = new Date().toISOString();
  }

  if (Object.keys(updatePayload).length === 1) {
    // Only updated_at present — no editable field was actually sent.
    return res.status(400).json({ error: 'No editable fields provided' });
  }

  if (updatePayload.artist_url_slug) {
    const { data: existing, error: slugErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('artist_url_slug', updatePayload.artist_url_slug)
      .neq('id', user.id)
      .maybeSingle();
    if (slugErr) {
      console.error('[save-profile-info] slug check failed:', slugErr.message);
      return res.status(500).json({ error: 'Save failed', detail: slugErr.message });
    }
    if (existing) {
      return res.status(409).json({ error: 'That artist URL is already taken' });
    }
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', user.id);

  if (updateErr) {
    console.error('[save-profile-info] update failed:', updateErr.message);
    return res.status(500).json({ error: 'Save failed', detail: updateErr.message });
  }

  return res.status(200).json({ ok: true });
}
