// GET /api/executive-history-summary
//
// Executive History Summary™ — ATHENA™ Phase 3B (Amendment 2). Authenticated
// read endpoint; thin wrapper over api/_lib/executive-history-summary.js,
// which computes everything live from the shared archive reader. No caching,
// no secondary storage.

import { createClient } from '@supabase/supabase-js';
import { getExecutiveHistorySummary } from './_lib/executive-history-summary.js';

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

  try {
    const summary = await getExecutiveHistorySummary(supabase, user.id);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('[executive-history-summary] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
