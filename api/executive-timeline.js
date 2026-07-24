// GET /api/executive-timeline
//
// Executive Timeline™ — ATHENA™ Phase 3B. Authenticated read endpoint; thin
// wrapper over api/_lib/executive-timeline.js, which reads exclusively
// through the shared archive reader (api/_lib/executive-brief-archive-reader.js).
//
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N (bounds how many
// archived briefs' events are included; default 20 briefs, same cap as the
// archive read endpoint).

import { createClient } from '@supabase/supabase-js';
import { buildExecutiveTimeline } from './_lib/executive-timeline.js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const q = req.query || {};

  try {
    const timeline = await buildExecutiveTimeline(supabase, user.id, { from: q.from, to: q.to, limit: q.limit });
    return res.status(200).json(timeline);
  } catch (err) {
    console.error('[executive-timeline] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
