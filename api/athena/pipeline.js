// Canonical Intelligence Platform(tm) -- ATHENA(tm) Executive Intelligence Pipeline
//
// Phase 1 (Canonical Executive Intelligence Object(tm)) orchestration.
// Sole entrypoint chaining: royalte_workspace_context -> ATHENA Adapter(tm)
// -> ATHENA_ENGINE -> Executive Intelligence Object(tm).
//
// Nothing else in the codebase should hand-roll this sequence -- one call,
// one place the chain can be changed. Neither the adapter nor the engine
// know this orchestrator exists (Option C isolation).
//
// NOT wired to any live caller in Phase 1 (per the brief's explicit stop
// point: architecture + adapter + schema + tests only, no UI/API wiring).

import { ATHENA_ENGINE }                    from './index.js';
import { assertInputValid }                 from './validate.js';
import { buildAthenaApiResponses, ADAPTER_VERSION } from './runtime-context-adapter.js';
import { buildExecutiveIntelligenceObject, EIO_VERSION } from './executive-intelligence-object.js';

export const PIPELINE_VERSION = Object.freeze({
  version:       '1.0.0',
  name:          'ATHENA Executive Intelligence Pipeline',
  effectiveDate: '2026-07-24',
});

// runExecutiveIntelligencePipeline(workspaceContext) -> ExecutiveIntelligenceObject
//
// Throws only on structurally invalid input (per ATHENA's own
// assertInputValid contract -- "at least one domain must resolve to
// SUCCESS"). A workspaceContext with zero usable domains genuinely cannot
// produce executive intelligence; that is a real precondition failure, not
// a case to paper over.
export function runExecutiveIntelligencePipeline(workspaceContext) {
  const apiResponses = buildAthenaApiResponses(workspaceContext);
  assertInputValid(apiResponses);

  const athenaReport = ATHENA_ENGINE.analyze(apiResponses);

  return buildExecutiveIntelligenceObject(athenaReport, apiResponses, {
    adapterVersion:  ADAPTER_VERSION.version,
    pipelineVersion:  PIPELINE_VERSION.version,
    runtimeContextVersion: (workspaceContext && workspaceContext.schemaVersion) || null,
  });
}

export { ADAPTER_VERSION, EIO_VERSION };
