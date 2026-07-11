// TEMPORARY INTERNAL ADMIN ENDPOINT — DELETE AFTER USE
//
// One-time use: Board Reset Directive 2026-07-11 — Black Alternative MRP update.
// Called once from the fix/scan-genres-top-track-isrc branch deploy.
// Must be deleted in the same PR that completes the reset.
//
// POST /api/internal/board-reset-mrp
// Authorization: Bearer 39d31f04-d84c-4958-88c3-00d0517a9ee7
// Body: { "email": "darryl.west@gmail.com" }

import { createClient } from '@supabase/supabase-js';

const ONE_TIME_TOKEN = '39d31f04-d84c-4958-88c3-00d0517a9ee7';

const BOARD_VERIFIED_MRP = {
  meta: {
    version: '1.0',
    source: 'Executive Board Reset Directive 2026-07-11',
  },
  performing_rights: {
    pro: 'SOCAN',
    soundexchange: 'Yes',
  },
  publishing: {
    publishing_admin: 'TuneCore Publishing',
    mlc: 'Registered',
  },
  recording: {
    record_label: 'Own Label',
    label_name: 'Castle Park Studioz',
  },
  distribution: {
    distributor: 'TuneCore',
  },
  songwriter: {},
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (bearer !== ONE_TIME_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = req.body?.email;
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) return res.status(500).json({ error: listErr.message });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: `No user with email: ${email}` });

  const now = new Date().toISOString();
  const mrp = { ...BOARD_VERIFIED_MRP, meta: { ...BOARD_VERIFIED_MRP.meta, completed_at: now, last_updated_at: now } };

  const { error: writeErr } = await supabase
    .from('profiles')
    .update({ music_rights_profile: mrp, onboarding_completed_at: now, updated_at: now })
    .eq('id', user.id);

  if (writeErr) return res.status(500).json({ error: writeErr.message });

  const { data: verify } = await supabase
    .from('profiles')
    .select('music_rights_profile')
    .eq('id', user.id)
    .single();

  return res.status(200).json({
    ok: true,
    userId: user.id,
    stored: verify?.music_rights_profile,
  });
}
