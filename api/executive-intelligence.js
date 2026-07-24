// POST /api/executive-intelligence
//
// ATHENA™ Phase 2 — the sole wiring point between the live client-side
// royalte_workspace_context (built by public/js/runtime-context-mapper.js,
// exposed to workspaces via public/js/mc-workspace-context.js) and the
// server-side ATHENA Executive Intelligence Pipeline™ (api/athena/pipeline.js).
//
// This endpoint contains NO business logic of its own. It is transport only:
// receive the already-built workspace context, run the already-built and
// already-tested Phase 1 pipeline (Adapter -> Engine -> Executive
// Intelligence Object), return the result. The pipeline itself runs
// server-side because api/athena/* uses node:crypto (randomUUID), which has
// no browser equivalent without a bundler -- this repo has none (CLAUDE.md).
//
// ATHENA™ Phase 3A adds the archive write step (Bearer-authenticated callers
// only — see api/_lib/executive-brief-archive.js). This endpoint remains
// usable without authentication for Executive Intelligence generation itself
// (today's anonymous-use behavior is unchanged); an absent/invalid Bearer
// token simply means the result is not archived. This endpoint intentionally
// never becomes an archive READER — that is api/executive-brief-archive.js,
// a separate, always-authenticated file, per explicit Board instruction.
//
// Request:
//   Content-Type: application/json
//   Authorization: Bearer <user_access_token>   (optional — enables archiving)
//   Body: { workspaceContext: <royalte_workspace_context v1.1> }
//
// Response:
//   200 { executiveIntelligence: <ExecutiveIntelligenceObject>, archived, archiveError? }
//   200 { executiveIntelligence: null, reason: <string> }   -- honest,
//        structural "not enough data" case (e.g. a near-empty scan) --
//        not a server error, so 200 rather than 4xx/5xx.
//   400 — missing/malformed body
//   405 — wrong method
//   500 — unexpected internal error

import { createClient } from '@supabase/supabase-js';
import { runExecutiveIntelligencePipeline } from './athena/pipeline.js';
import { archiveExecutiveBrief } from './_lib/executive-brief-archive.js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Resolves the caller's artist_profile_id from a Bearer token, if present.
// Never throws — an absent, malformed, or invalid token simply resolves to
// null (anonymous), which the caller uses to skip archiving. This endpoint
// must keep working for anonymous scans exactly as it does today.
async function resolveArtistProfileId(req, supabase) {
  if (!supabase) return null;
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch (_err) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const workspaceContext = body.workspaceContext;

  if (typeof workspaceContext !== 'object' || workspaceContext === null || Array.isArray(workspaceContext)) {
    return res.status(400).json({ error: 'workspaceContext object required' });
  }

  let executiveIntelligence;
  try {
    executiveIntelligence = runExecutiveIntelligencePipeline(workspaceContext);
  } catch (err) {
    if (err && err.code === 'INVALID_INPUT') {
      // Real, honest precondition failure (assertInputValid: no domain
      // resolved to SUCCESS) -- not a server error. The client renders a
      // graceful "insufficient data" state rather than treating this as a
      // fetch failure.
      return res.status(200).json({ executiveIntelligence: null, reason: err.message });
    }
    console.error('[executive-intelligence] pipeline threw:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }

  // Archive step (Phase 3A). Anonymous scans (no resolvable
  // artist_profile_id) are never archived — see
  // governance/ATHENA_PHASE3A_EXECUTIVE_BRIEF_ARCHIVE_ARCHITECTURE.md,
  // Amendment 1. A persistence failure never blocks the response — the
  // generated Executive Intelligence Object is always returned; `archived`
  // and `archiveError` tell the caller honestly whether it was saved.
  const supabase = getAdminClient();
  const artistProfileId = await resolveArtistProfileId(req, supabase);

  let archiveResult = { archived: false, archiveError: 'anonymous scan — not archived' };
  if (artistProfileId) {
    archiveResult = await archiveExecutiveBrief({ eio: executiveIntelligence, artistProfileId, supabase });
  }

  // If a rare id collision forced a regenerated executiveBriefId (see
  // api/_lib/executive-brief-archive.js), the archived identity is
  // authoritative — reflect it back so the client never displays a stale id.
  if (archiveResult.archived && archiveResult.executiveBriefId !== executiveIntelligence.executiveBriefId) {
    executiveIntelligence = { ...executiveIntelligence, executiveBriefId: archiveResult.executiveBriefId };
  }

  return res.status(200).json({
    executiveIntelligence,
    archived: archiveResult.archived,
    ...(archiveResult.archived ? { archiveIntegrityHash: archiveResult.archiveIntegrityHash } : { archiveError: archiveResult.archiveError }),
  });
}
