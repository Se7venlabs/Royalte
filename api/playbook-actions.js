// /api/playbook-actions
//
// Playbook Action Engine™ — Phase 4A, Executive Actions™. Thin transport +
// auth + eligibility verification over api/_lib/playbook-action-store.js
// (which owns all state) and the Playbook Registry (api/playbooks/, which
// owns all content). This endpoint contains no lifecycle logic of its own.
//
// GET  -- lists the artist's own playbook_actions rows (started/in_progress/
//         completed/archived). Pure DB read, no eligibility computation.
//
// POST {action: 'checkEligibility', workspaceContext} -- returns which
//   registered playbooks are eligible to start, with real evidenceConfidence,
//   computed server-side from the supplied context via each definition's
//   own pure isEligible()/evidenceConfidence() functions -- never trusts a
//   client-asserted eligibility claim, always recomputes it. Excludes
//   playbooks the artist has already started/completed (non-archived).
//
// POST {action: 'start', playbookId, workspaceContext} -- re-verifies
//   eligibility server-side before starting (never trusts the client to
//   have only called this when eligible).
//
// POST {action: 'advance'|'complete'|'archive', actionId, ...} -- routes
//   directly to the store; no evidence context needed, pure state machine.
//
// artistProfileId is never read from the request body -- always the
// Bearer-authenticated caller's own auth.uid(), matching every other
// Phase 3/4 endpoint.

import { createClient } from '@supabase/supabase-js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import {
  startPlaybook, advancePlaybookStep, completePlaybook, archivePlaybook, listPlaybookActions,
} from './_lib/playbook-action-store.js';
import { getPlaybook, getAllPlaybooks } from './playbooks/definitions/index.js';

const RATE_LIMITS = { burst: { max: 4 }, hour: { max: 60 }, day: { max: 300 } };
const ENDPOINT_KEY = 'playbook-actions';

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

// Strips a Playbook Definition's function fields for transport -- the
// client renders content, it never re-executes isEligible/evidenceConfidence
// itself (those stay server-owned per Canonical Ownership™).
function definitionSummary(definition) {
  const { isEligible, evidenceConfidence, ...rest } = definition;
  return rest;
}

async function checkEligibility(supabase, userId, workspaceContext) {
  const rawInputs = workspaceContext && typeof workspaceContext === 'object' ? workspaceContext : {};
  const [allDefinitions, existingResult] = await Promise.all([
    Promise.resolve(getAllPlaybooks()),
    listPlaybookActions({ supabase, artistProfileId: userId }),
  ]);
  const startedIds = new Set((existingResult.items || []).filter(i => i.status !== 'archived').map(i => i.playbook_id));

  return allDefinitions
    .filter(def => !startedIds.has(def.playbookId))
    .filter(def => def.isEligible(rawInputs))
    .map(def => ({
      ...definitionSummary(def),
      evidenceConfidence: def.evidenceConfidence(rawInputs),
    }));
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
    const q = req.query || {};
    const result = await listPlaybookActions({ supabase, artistProfileId: user.id, status: q.status || null });
    // Enrich each row with its Playbook Definition's real step list (Steps
    // remain owned by the Playbook Registry -- this store never persists
    // step content) so the client can render an accurate checklist and
    // determine the real next stepId, never a guessed/derived one.
    const items = (result.items || []).map(item => {
      const definition = getPlaybook(item.playbook_id);
      const steps = definition ? definition.steps.map(s => ({ stepId: s.stepId, stepNumber: s.stepNumber, title: s.title, instructions: s.instructions })) : [];
      return { ...item, steps };
    });
    return res.status(200).json({ items });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === 'checkEligibility') {
      const eligible = await checkEligibility(supabase, user.id, body.workspaceContext);
      return res.status(200).json({ eligible });
    }

    if (action === 'start') {
      const definition = getPlaybook(body.playbookId);
      if (!definition) {
        return res.status(400).json({ error: `unknown playbookId: ${body.playbookId}` });
      }
      const rawInputs = body.workspaceContext && typeof body.workspaceContext === 'object' ? body.workspaceContext : {};
      if (!definition.isEligible(rawInputs)) {
        return res.status(400).json({ error: 'playbook is not eligible given the supplied evidence' });
      }
      const result = await startPlaybook({
        supabase,
        artistProfileId: user.id,
        playbookId: definition.playbookId,
        playbookVersion: definition.playbookVersion,
        definitionSchema: definition.definitionSchema,
        totalSteps: definition.steps.length,
        evidenceConfidence: definition.evidenceConfidence(rawInputs),
        recommendationSource: body.recommendationSource || null,
        supportingEvidence: body.supportingEvidence || null,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    if (action === 'advance') {
      const result = await advancePlaybookStep({
        supabase, artistProfileId: user.id, actionId: body.actionId, stepId: body.stepId, note: body.note || null,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    if (action === 'complete') {
      const result = await completePlaybook({
        supabase, artistProfileId: user.id, actionId: body.actionId, completionOutcome: body.completionOutcome,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    if (action === 'archive') {
      const result = await archivePlaybook({ supabase, artistProfileId: user.id, actionId: body.actionId });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: "action must be one of: checkEligibility, start, advance, complete, archive" });
  } catch (err) {
    console.error('[playbook-actions] unexpected error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
