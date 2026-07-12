// Canonical Intelligence Platform™ -- Mission Control™ Workspace Binding
// bindWorkspace(workspaceId, apiResponses, athenaReport, executiveBrief)
// is the sole entry point for workspace data binding.
// bindAllWorkspaces() populates all 10 workspaces in a single call.
// No business logic. No calculations. No intelligence generation.

import { WORKSPACE_REGISTRY, WORKSPACE_STATUS, VALID_WORKSPACE_IDS } from './workspaces.js';
import {
  computeWorkspaceStatus,
  makeUnavailableWorkspace,
  makeWorkspaceBound,
} from './graceful.js';
import {
  transformIdentity, transformMusicRights, transformCatalog,
  transformDistribution, transformMonitoring,
  transformBackend, transformHealth, transformOverview,
  transformAthena, transformExecutiveBrief,
} from './transformers.js';

function bindIdentity(apiResponses) {
  const status = computeWorkspaceStatus('identity', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('identity');
  const data = transformIdentity(apiResponses);
  return makeWorkspaceBound('identity', data, status);
}

function bindMusicRights(apiResponses) {
  const status = computeWorkspaceStatus('music_rights', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('music_rights');
  const data = transformMusicRights(apiResponses);
  return makeWorkspaceBound('music_rights', data, status);
}

function bindCatalog(apiResponses) {
  const status = computeWorkspaceStatus('catalog', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('catalog');
  const data = transformCatalog(apiResponses);
  return makeWorkspaceBound('catalog', data, status);
}

function bindDistribution(apiResponses) {
  const status = computeWorkspaceStatus('distribution', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('distribution');
  const data = transformDistribution(apiResponses);
  return makeWorkspaceBound('distribution', data, status);
}

function bindMonitoring(apiResponses) {
  const status = computeWorkspaceStatus('monitoring', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('monitoring');
  const data = transformMonitoring(apiResponses);
  return makeWorkspaceBound('monitoring', data, status);
}

function bindBackend(apiResponses) {
  const status = computeWorkspaceStatus('backend', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('backend');
  const data = transformBackend(apiResponses);
  return makeWorkspaceBound('backend', data, status);
}

function bindHealth(apiResponses, athenaReport) {
  const status = computeWorkspaceStatus('health', apiResponses);
  const data   = transformHealth(apiResponses, athenaReport);
  return makeWorkspaceBound('health', data, status);
}

function bindOverview(apiResponses, athenaReport) {
  const status = computeWorkspaceStatus('overview', apiResponses);
  if (status === WORKSPACE_STATUS.UNAVAILABLE) return makeUnavailableWorkspace('overview');
  const data = transformOverview(apiResponses, athenaReport);
  return makeWorkspaceBound('overview', data, status);
}

function bindAthena(athenaReport) {
  if (!athenaReport) return makeUnavailableWorkspace('athena', 'No ATHENA™ report provided');
  const data = transformAthena(athenaReport);
  return makeWorkspaceBound('athena', data, WORKSPACE_STATUS.POPULATED, 'athena_engine_v1');
}

function bindExecutiveBrief(executiveBrief) {
  if (!executiveBrief) return makeUnavailableWorkspace('executive_brief', 'No Executive Brief™ provided');
  const data = transformExecutiveBrief(executiveBrief);
  return makeWorkspaceBound('executive_brief', data, WORKSPACE_STATUS.POPULATED, 'executive_brief_engine_v1');
}

const BINDERS = Object.freeze({
  identity:        (api, athena, brief) => bindIdentity(api),
  music_rights:    (api, athena, brief) => bindMusicRights(api),
  catalog:         (api, athena, brief) => bindCatalog(api),
  distribution:    (api, athena, brief) => bindDistribution(api),
  monitoring:      (api, athena, brief) => bindMonitoring(api),
  backend:         (api, athena, brief) => bindBackend(api),
  health:          (api, athena, brief) => bindHealth(api, athena),
  overview:        (api, athena, brief) => bindOverview(api, athena),
  athena:          (api, athena, brief) => bindAthena(athena),
  executive_brief: (api, athena, brief) => bindExecutiveBrief(brief),
});

export function bindWorkspace(workspaceId, apiResponses = {}, athenaReport = null, executiveBrief = null) {
  const binder = BINDERS[workspaceId];
  if (!binder) return makeUnavailableWorkspace(workspaceId, `Unknown workspace: ${workspaceId}`);
  try {
    return binder(apiResponses, athenaReport, executiveBrief);
  } catch (_err) {
    return makeUnavailableWorkspace(workspaceId, 'Binding error — graceful degradation applied');
  }
}

export function bindAllWorkspaces(apiResponses = {}, athenaReport = null, executiveBrief = null) {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(WORKSPACE_REGISTRY).map(wsId => [
        wsId,
        bindWorkspace(wsId, apiResponses, athenaReport, executiveBrief),
      ])
    )
  );
}
