// GET /api/executive-comparison?ids=EB-...,EB-...
//
// Executive Comparison™ — ATHENA™ Phase 3B. Authenticated read endpoint;
// thin wrapper over api/_lib/executive-comparison.js. Fetches exactly two
// archived briefs (owned by the caller) through the shared archive reader
// and returns a field-by-field diff — never a re-computed intelligence
// object, never a new persistence write.

import { createClient } from '@supabase/supabase-js';
import { getBriefsForComparison } from './_lib/executive-brief-archive-reader.js';
import { compareExecutiveBriefs } from './_lib/executive-comparison.js';

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
  if (!q.ids) {
    return res.status(400).json({ error: 'ids query param required: ?ids=EB-...,EB-...' });
  }
  const ids = String(q.ids).split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length !== 2) {
    return res.status(400).json({ error: 'ids must contain exactly two Executive Brief IDs' });
  }

  try {
    const briefs = await getBriefsForComparison(supabase, user.id, ids);
    if (!briefs) {
      return res.status(404).json({ error: 'One or both briefs not found' });
    }
    // Order chronologically (before -> after) regardless of the order the
    // caller listed the two ids in.
    const [briefA, briefB] = briefs;
    const [before, after] = new Date(briefA.generated_at) <= new Date(briefB.generated_at)
      ? [briefA, briefB] : [briefB, briefA];

    // Phase 3D — fetch the two real audit_scans rows (payload + generated
    // schema_version column) via the scan_id already FK'd on each archive
    // row, so compareExecutiveBriefs can add real per-field canonicalDomains
    // comparisons. Best-effort: a missing/purged scan row degrades to
    // canonicalDomains: null (see buildCanonicalDomains), never blocks the
    // existing risk/opportunity-count comparison this endpoint already returns.
    let scanPayloads = null;
    if (before.scan_id && after.scan_id) {
      const { data: scanRows, error: scanErr } = await supabase
        .from('audit_scans')
        .select('id, payload, schema_version')
        .in('id', [before.scan_id, after.scan_id]);
      if (!scanErr && Array.isArray(scanRows) && scanRows.length === 2) {
        const byId = Object.fromEntries(scanRows.map(r => [r.id, r]));
        const beforeScan = byId[before.scan_id];
        const afterScan  = byId[after.scan_id];
        if (beforeScan && afterScan) {
          scanPayloads = {
            before: { payload: beforeScan.payload, schemaVersion: beforeScan.schema_version },
            after:  { payload: afterScan.payload,  schemaVersion: afterScan.schema_version },
          };
        }
      }
    }

    const comparison = compareExecutiveBriefs(before, after, { scanPayloads });
    return res.status(200).json({ comparison });
  } catch (err) {
    console.error('[executive-comparison] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
