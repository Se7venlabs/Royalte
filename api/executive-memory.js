// GET /api/executive-memory
//
// Executive Memory™ (foundation) — ATHENA™ Phase 3B. Authenticated read
// endpoint; thin wrapper over api/_lib/executive-memory.js. See that
// module's header for the explicit, disclosed scope boundary: recurring and
// resolved issues are derived from real archive history; Goals, Dismissed
// Recommendations, and Milestones are honestly `available: false` (they
// need a new writable store, out of this phase's scope).

import { createClient } from '@supabase/supabase-js';
import { buildExecutiveMemory } from './_lib/executive-memory.js';

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
    const memory = await buildExecutiveMemory(supabase, user.id, { limit: q.limit });
    return res.status(200).json(memory);
  } catch (err) {
    console.error('[executive-memory] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
