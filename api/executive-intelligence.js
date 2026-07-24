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
// Request:
//   Content-Type: application/json
//   Body: { workspaceContext: <royalte_workspace_context v1.1> }
//
// Response:
//   200 { executiveIntelligence: <ExecutiveIntelligenceObject> }
//   200 { executiveIntelligence: null, reason: <string> }   -- honest,
//        structural "not enough data" case (e.g. a near-empty scan) --
//        not a server error, so 200 rather than 4xx/5xx.
//   400 — missing/malformed body
//   405 — wrong method
//   500 — unexpected internal error

import { runExecutiveIntelligencePipeline } from './athena/pipeline.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const workspaceContext = body.workspaceContext;

  if (typeof workspaceContext !== 'object' || workspaceContext === null || Array.isArray(workspaceContext)) {
    return res.status(400).json({ error: 'workspaceContext object required' });
  }

  try {
    const executiveIntelligence = runExecutiveIntelligencePipeline(workspaceContext);
    return res.status(200).json({ executiveIntelligence });
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
}
