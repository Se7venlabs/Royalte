// /api/opportunity-actions
//
// Executive Opportunity Engine™ — Phase 4B. Thin transport + auth over
// api/_lib/opportunity-store.js (owns all persisted ranking state) and
// api/_lib/opportunity-engine.js (owns the ranking math, via the store).
// This endpoint contains no ranking logic of its own — mirrors
// api/playbook-actions.js's own shape exactly.
//
// GET  -- reads the artist's last-persisted Executive Roadmap™
//         (opportunity_scores), grouped Do Now/Do Next/Do Later + Quick
//         Wins, plus Executive Dashboard™ metrics. Never recomputes.
//
// POST {action: 'computeRoadmap'} -- fetches the artist's own real
//   playbook_actions rows, recomputes+persists their Opportunity Scores,
//   and returns the fresh Roadmap. The only write trigger — explicit,
//   caller-initiated, same restraint as verifyPlaybook() not being an
//   automatic scan hook.
//
// POST {action: 'history', actionId} -- an action's full score/rank
//   history (Opportunity History™), each event pre-labeled.
//
// artistProfileId is never read from the request body -- always the
// Bearer-authenticated caller's own auth.uid(), matching every other
// Phase 3/4 endpoint.

import { createClient } from '@supabase/supabase-js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import { listPlaybookActions } from './_lib/playbook-action-store.js';
import {
  recomputeOpportunityRoadmap, getOpportunityRoadmap, getOpportunityHistory, getOpportunityDashboardMetrics,
} from './_lib/opportunity-store.js';

const RATE_LIMITS = { burst: { max: 4 }, hour: { max: 60 }, day: { max: 300 } };
const ENDPOINT_KEY = 'opportunity-actions';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function resolveUser(req, supabase) {
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ip = extractIp(req);
  const blocked = await checkBlocked(ip);
  if (blocked.blocked) {
    return res.status(429).json({ error: 'Too many requests', reason: 'blocked' });
  }
  const rateResult = await checkRateLimit(ip, ENDPOINT_KEY, RATE_LIMITS);
  if (!rateResult.allowed) {
    await recordViolation(ip, ENDPOINT_KEY, rateResult.reason);
    return res.status(429).json({ error: 'Too many requests', reason: rateResult.reason, retryAfter: rateResult.retryAfter });
  }

  const user = await resolveUser(req, supabase);
  if (!user) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  if (req.method === 'GET') {
    const roadmapResult = await getOpportunityRoadmap({ supabase, artistProfileId: user.id });
    if (!roadmapResult.ok) return res.status(400).json({ error: roadmapResult.error });
    const metricsResult = await getOpportunityDashboardMetrics({ supabase, artistProfileId: user.id });
    return res.status(200).json({ roadmap: roadmapResult.roadmap, counts: roadmapResult.counts, metrics: metricsResult.metrics });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === 'computeRoadmap') {
      const listResult = await listPlaybookActions({ supabase, artistProfileId: user.id });
      if (!listResult.ok) return res.status(400).json({ error: listResult.error });
      const result = await recomputeOpportunityRoadmap({ supabase, artistProfileId: user.id, actions: listResult.items });
      if (!result.ok) return res.status(400).json({ error: result.error });
      const metricsResult = await getOpportunityDashboardMetrics({ supabase, artistProfileId: user.id });
      return res.status(200).json({ roadmap: result.roadmap, counts: result.counts, metrics: metricsResult.metrics });
    }

    if (action === 'history') {
      const result = await getOpportunityHistory({ supabase, artistProfileId: user.id, actionId: body.actionId });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'action must be one of: computeRoadmap, history' });
  } catch (err) {
    console.error('[opportunity-actions] unexpected error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
