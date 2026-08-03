// /api/playbook-actions
//
// Playbook Action Engine™ — Phase 4A, Executive Actions™. Thin transport +
// auth + eligibility verification over api/_lib/playbook-action-store.js
// (which owns all state) and the Playbook Registry (api/playbooks/, which
// owns all content). This endpoint contains no lifecycle logic of its own.
//
// Executive Change Request 1 — the authoritative evidence chain is always:
//   Canonical Runtime™ -> Mission Control Runtime Context™ ->
//   Playbook Action Engine™ -> Presentation Layer
// This endpoint fetches the artist's latest real scan server-side
// (audit_scans, scoped to the Bearer-authenticated caller) and builds the
// same royalte_workspace_context shape the client would, via
// runtime-context-mapper.js's documented Node usage. Any workspaceContext
// the client sends is used for presentation only, never as the eligibility
// authority — every eligibility/start/verify decision is recomputed here
// from canonical server-side evidence.
//
// GET  -- lists the artist's own playbook_actions rows (every status except
//         archived by default; ?status=archived to see archived ones, or
//         ?includeArchived=1 for everything). Enriched with each row's real
//         step list and Executive Action Number display string. Also
//         returns Executive Dashboard Metrics™ counts (backend only, no UI
//         yet -- Executive Change Request 9).
//
// POST {action: 'checkEligibility'} -- recomputes eligibility from the
//   artist's real latest scan; persists a 'recommended' row for any newly-
//   eligible playbook (Executive Change Request 10 -- a recommendation is
//   permanent Executive History™, not an ephemeral computed list); returns
//   the artist's full current item list (same enriched shape as GET).
//
// POST {action: 'start', playbookId} -- re-verifies eligibility server-side
//   before starting/resuming.
//
// POST {action: 'advance'|'complete'|'archive', actionId, ...} -- pure
//   state-machine calls into the store.
//
// POST {action: 'verify', actionId} -- re-checks the artist's real latest
//   scan against the same isEligible() the playbook was triggered by. If
//   the underlying issue is no longer present, moves the row to
//   verified -> completed; otherwise leaves it in waiting_verification with
//   an informational history entry. This is Evidence First™ made real —
//   never a self-report, always fresh canonical evidence.
//
// artistProfileId is never read from the request body -- always the
// Bearer-authenticated caller's own auth.uid(), matching every other
// Phase 3/4 endpoint.

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import {
  recommendPlaybook, startPlaybook, advancePlaybookStep, completePlaybook,
  verifyPlaybook, archivePlaybook, listPlaybookActions, getPlaybookHistory, getPlaybookCounts,
} from './_lib/playbook-action-store.js';
import { getPlaybook, getAllPlaybooks } from './playbooks/definitions/index.js';

const require = createRequire(import.meta.url);
// runtime-context-mapper.js explicitly documents dual browser/Node usage
// (see its own header) -- this is the same, single transformation from a
// raw scan payload to royalte_workspace_context every workspace page uses
// client-side, reused here server-side so eligibility is computed from the
// same canonical shape, never a second parallel derivation.
const { buildWorkspaceRuntimeContext } = require('../public/js/runtime-context-mapper.js');

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

// buildCanonicalRawInputs -- Executive Change Request 1. Fetches the
// artist's own latest real scan (never a client-supplied one) and builds
// the canonical royalte_workspace_context shape server-side. Returns {}
// (never null/throws) when no scan exists yet -- every isEligible()/
// evidenceConfidence() function already treats missing evidence as
// INSUFFICIENT_DATA/not-eligible, the correct honest degradation.
async function buildCanonicalRawInputs(supabase, artistProfileId) {
  try {
    const { data: scanRow, error } = await supabase
      .from('audit_scans')
      .select('payload')
      .eq('user_id', artistProfileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !scanRow || !scanRow.payload) return {};
    return buildWorkspaceRuntimeContext(scanRow.payload, null, null) || {};
  } catch (err) {
    console.error('[playbook-actions] buildCanonicalRawInputs failed:', err?.message || err);
    return {};
  }
}

// Strips a Playbook Definition's function fields for transport -- the
// client renders content, it never re-executes isEligible/evidenceConfidence/
// explainRecommendation itself (those stay server-owned per Canonical
// Ownership™).
function definitionSummary(definition) {
  const { isEligible, evidenceConfidence, explainRecommendation, ...rest } = definition;
  return rest;
}

// enrichWithSteps -- attaches each row's real step list (Steps remain owned
// by the Playbook Registry -- this store never persists step content) so
// the client can render an accurate checklist and determine the real next
// stepId, never a guessed one.
function enrichWithSteps(item) {
  const definition = getPlaybook(item.playbook_id);
  const steps = definition ? definition.steps.map(s => ({ stepId: s.stepId, stepNumber: s.stepNumber, title: s.title, instructions: s.instructions })) : [];
  return { ...item, steps };
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
    const items = q.includeArchived || q.status
      ? (result.items || [])
      : (result.items || []).filter(i => i.status !== 'archived');
    const countsResult = await getPlaybookCounts({ supabase, artistProfileId: user.id });
    return res.status(200).json({ items: items.map(enrichWithSteps), counts: countsResult.counts });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === 'checkEligibility') {
      const rawInputs = await buildCanonicalRawInputs(supabase, user.id);
      const definitions = getAllPlaybooks();
      for (const def of definitions) {
        if (def.isEligible(rawInputs)) {
          await recommendPlaybook({
            supabase, artistProfileId: user.id,
            playbookId: def.playbookId, playbookVersion: def.playbookVersion, definitionSchema: def.definitionSchema,
            totalSteps: def.steps.length, evidenceConfidence: def.evidenceConfidence(rawInputs),
          });
        }
      }
      const listResult = await listPlaybookActions({ supabase, artistProfileId: user.id });
      const items = (listResult.items || []).filter(i => i.status !== 'archived');
      const countsResult = await getPlaybookCounts({ supabase, artistProfileId: user.id });
      return res.status(200).json({ items: items.map(enrichWithSteps), counts: countsResult.counts });
    }

    if (action === 'start') {
      const definition = getPlaybook(body.playbookId);
      if (!definition) {
        return res.status(400).json({ error: `unknown playbookId: ${body.playbookId}` });
      }
      const rawInputs = await buildCanonicalRawInputs(supabase, user.id);
      if (!definition.isEligible(rawInputs)) {
        return res.status(400).json({ error: 'playbook is not eligible given the artist\'s current canonical evidence' });
      }
      const result = await startPlaybook({
        supabase,
        artistProfileId: user.id,
        playbookId: definition.playbookId,
        playbookVersion: definition.playbookVersion,
        definitionSchema: definition.definitionSchema,
        totalSteps: definition.steps.length,
        evidenceConfidence: definition.evidenceConfidence(rawInputs),
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

    if (action === 'verify') {
      const listResult = await listPlaybookActions({ supabase, artistProfileId: user.id, status: 'waiting_verification' });
      const row = (listResult.items || []).find(i => i.id === body.actionId);
      if (!row) {
        return res.status(400).json({ error: 'playbook action not found, not owned by caller, or not awaiting verification' });
      }
      const definition = getPlaybook(row.playbook_id);
      if (!definition) {
        return res.status(400).json({ error: `unknown playbookId: ${row.playbook_id}` });
      }
      const rawInputs = await buildCanonicalRawInputs(supabase, user.id);
      const stillEligible = definition.isEligible(rawInputs);
      const result = await verifyPlaybook({
        supabase, artistProfileId: user.id, actionId: body.actionId,
        resolved: !stillEligible, evidenceConfidence: definition.evidenceConfidence(rawInputs),
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    if (action === 'archive') {
      const result = await archivePlaybook({ supabase, artistProfileId: user.id, actionId: body.actionId });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    if (action === 'history') {
      const result = await getPlaybookHistory({ supabase, artistProfileId: user.id, actionId: body.actionId });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'action must be one of: checkEligibility, start, advance, complete, verify, archive, history' });
  } catch (err) {
    console.error('[playbook-actions] unexpected error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
