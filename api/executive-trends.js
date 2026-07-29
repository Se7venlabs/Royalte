// GET /api/executive-trends
//
// Cross-Scan Trend Intelligence™ — ATHENA™ Phase 3B. Authenticated read
// endpoint; thin wrapper over api/_lib/executive-trend-detection.js. See
// that module's header for the stated endpoint-comparison methodology.
//
// Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=N bound the window of
// archived briefs compared (oldest vs. newest within the window).

import { createClient } from '@supabase/supabase-js';
import { listBriefs } from './_lib/executive-brief-archive-reader.js';
import { detectDomainTrends } from './_lib/executive-trend-detection.js';

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
    const briefs = await listBriefs(supabase, user.id, { from: q.from, to: q.to, limit: q.limit, full: true, order: 'asc' });

    // Phase 3D — fetch the real audit_scans rows for the window's first/last
    // brief, same best-effort pattern as api/executive-comparison.js: a
    // missing/purged scan row degrades to canonicalDomains: null, never
    // blocks the existing risk-count trend detection below.
    let scanPayloads = null;
    if (briefs.length >= 2) {
      const first = briefs[0], last = briefs[briefs.length - 1];
      if (first.scan_id && last.scan_id) {
        const { data: scanRows, error: scanErr } = await supabase
          .from('audit_scans')
          .select('id, payload, schema_version')
          .in('id', [first.scan_id, last.scan_id]);
        if (!scanErr && Array.isArray(scanRows) && scanRows.length === 2) {
          const byId = Object.fromEntries(scanRows.map(r => [r.id, r]));
          const firstScan = byId[first.scan_id], lastScan = byId[last.scan_id];
          if (firstScan && lastScan) {
            scanPayloads = {
              first: { payload: firstScan.payload, schemaVersion: firstScan.schema_version },
              last:  { payload: lastScan.payload,  schemaVersion: lastScan.schema_version },
            };
          }
        }
      }
    }

    const trends = detectDomainTrends(briefs, { scanPayloads });
    return res.status(200).json(trends);
  } catch (err) {
    console.error('[executive-trends] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
