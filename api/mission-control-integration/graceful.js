// Canonical Intelligence Platform™ -- Mission Control™ Integration Graceful Layer
// Workspace status computation and UNAVAILABLE fallback factory.
// Every binding is non-throwing; missing data produces UNAVAILABLE workspace objects.

import { WORKSPACE_REGISTRY, WORKSPACE_STATUS } from './workspaces.js';

export function isResponseAvailable(apiResponses, responseKey) {
  return apiResponses?.[responseKey]?.status === 'SUCCESS';
}

export function getResponseStatus(apiResponses, responseKey) {
  return apiResponses?.[responseKey]?.status ?? 'NOT_PROVIDED';
}

export function computeWorkspaceStatus(workspaceId, apiResponses) {
  const def = WORKSPACE_REGISTRY[workspaceId];
  if (!def) return WORKSPACE_STATUS.UNAVAILABLE;

  // Workspaces with no required response keys (athena, executive_brief) are
  // always POPULATED — their data arrives as direct parameters.
  if (def.requiredResponseKeys.length === 0) return WORKSPACE_STATUS.POPULATED;

  const availableCount = def.requiredResponseKeys
    .filter(k => isResponseAvailable(apiResponses, k))
    .length;

  if (availableCount === def.requiredResponseKeys.length) return WORKSPACE_STATUS.POPULATED;
  if (availableCount > 0)                                  return WORKSPACE_STATUS.PARTIAL;
  return WORKSPACE_STATUS.UNAVAILABLE;
}

export function makeUnavailableWorkspace(workspaceId, reason = 'No SUCCESS response available') {
  return Object.freeze({
    workspaceId,
    status:      WORKSPACE_STATUS.UNAVAILABLE,
    data:        Object.freeze({}),
    generatedAt: new Date().toISOString(),
    reason,
  });
}

export function makeWorkspaceBound(workspaceId, data, status = WORKSPACE_STATUS.POPULATED, dataSource = 'mission_control_api_v1') {
  return Object.freeze({
    workspaceId,
    status,
    data:        Object.freeze(data || {}),
    dataSource,
    generatedAt: new Date().toISOString(),
  });
}
