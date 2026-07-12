// Canonical Intelligence Platform™ -- Mission Control™ Integration Layer
// Sprint 12 — executive presentation binding.
// Connects every MC workspace to live platform intelligence through the
// Mission Control Data API™. Never generates intelligence. Never resolves
// intelligence. Never imports from platform engines directly.
//
// CONSTITUTIONAL CONSTRAINT: All intelligence arrives as function parameters.
// Never imports from api/evidence, api/registry, api/normalization,
// api/resolution, api/orchestrator, api/monitoring, or api/athena directly.

import { MC_INTEGRATION_VERSION }              from './version.js';
import { bindWorkspace, bindAllWorkspaces }     from './binding.js';
import { validateWorkspaceBinding, validateAllBindings } from './validate.js';
import { computeWorkspaceStatus, isResponseAvailable } from './graceful.js';

export function createMcIntegrationLayer() {
  return Object.freeze({
    bindWorkspace:     (workspaceId, apiResponses, athenaReport, executiveBrief) =>
                         bindWorkspace(workspaceId, apiResponses, athenaReport, executiveBrief),
    bindAllWorkspaces: (apiResponses, athenaReport, executiveBrief) =>
                         bindAllWorkspaces(apiResponses, athenaReport, executiveBrief),
    validate:          (binding)  => validateWorkspaceBinding(binding),
    validateAll:       (bindings) => validateAllBindings(bindings),
    workspaceStatus:   (workspaceId, apiResponses) =>
                         computeWorkspaceStatus(workspaceId, apiResponses),
    isEndpointAvailable: (apiResponses, key) =>
                         isResponseAvailable(apiResponses, key),
    version:           MC_INTEGRATION_VERSION,
  });
}

export const MC_INTEGRATION = createMcIntegrationLayer();

// ─── Re-exports ──────────────────────────────────────────────────────────────
export { MC_INTEGRATION_VERSION }                                             from './version.js';
export {
  WORKSPACE_IDS, WORKSPACE_STATUS, WORKSPACE_REGISTRY, VALID_WORKSPACE_IDS,
  ENDPOINT_ID_TO_RESPONSE_KEY, RESPONSE_KEY_TO_ENDPOINT_ID,
}                                                                              from './workspaces.js';
export { bindWorkspace, bindAllWorkspaces }                                    from './binding.js';
export {
  computeWorkspaceStatus, isResponseAvailable, getResponseStatus,
  makeUnavailableWorkspace, makeWorkspaceBound,
}                                                                              from './graceful.js';
export {
  transformIdentity, transformMusicRights, transformCatalog,
  transformDistribution, transformMonitoring,
  transformBackend, transformHealth, transformOverview,
  transformAthena, transformExecutiveBrief,
}                                                                              from './transformers.js';
export {
  validateWorkspaceBinding, validateAllBindings,
  assertWorkspacePopulated, validateNoDirectPlatformImports,
}                                                                              from './validate.js';
