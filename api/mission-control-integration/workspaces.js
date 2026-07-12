// Canonical Intelligence Platform™ -- Mission Control™ Workspace Registry
// Defines the 10 MC workspaces, their required API endpoints, and the
// canonical key mappings between snake_case endpoint IDs and camelCase
// response keys used in apiResponses maps.

export const WORKSPACE_IDS = Object.freeze({
  IDENTITY:        'identity',
  MUSIC_RIGHTS:    'music_rights',
  CATALOG:         'catalog',
  DISTRIBUTION:    'distribution',
  MONITORING:      'monitoring',
  BACKEND:         'backend',
  HEALTH:          'health',
  OVERVIEW:        'overview',
  ATHENA:          'athena',
  EXECUTIVE_BRIEF: 'executive_brief',
});

export const WORKSPACE_STATUS = Object.freeze({
  POPULATED:   'POPULATED',
  PARTIAL:     'PARTIAL',
  UNAVAILABLE: 'UNAVAILABLE',
});

// Maps MC API snake_case endpoint IDs to camelCase apiResponses keys.
export const ENDPOINT_ID_TO_RESPONSE_KEY = Object.freeze({
  identity:           'identity',
  music_rights:       'musicRights',
  catalog:            'catalog',
  distribution:       'distribution',
  monitoring:         'monitoring',
  system_operations:  'systemOperations',
  executive_overview: 'executiveOverview',
});

// Inverse mapping for lookups by response key.
export const RESPONSE_KEY_TO_ENDPOINT_ID = Object.freeze({
  identity:         'identity',
  musicRights:      'music_rights',
  catalog:          'catalog',
  distribution:     'distribution',
  monitoring:       'monitoring',
  systemOperations: 'system_operations',
  executiveOverview: 'executive_overview',
});

// requiredResponseKeys: the camelCase keys read from apiResponses.
// dataSource: identifies the canonical data provider.
export const WORKSPACE_REGISTRY = Object.freeze({
  identity: Object.freeze({
    workspaceId:           'identity',
    name:                  'Identity Intelligence™',
    requiredResponseKeys:  Object.freeze(['identity']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  music_rights: Object.freeze({
    workspaceId:           'music_rights',
    name:                  'Publishing Intelligence™',
    requiredResponseKeys:  Object.freeze(['musicRights']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  catalog: Object.freeze({
    workspaceId:           'catalog',
    name:                  'Catalog Intelligence™',
    requiredResponseKeys:  Object.freeze(['catalog']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  distribution: Object.freeze({
    workspaceId:           'distribution',
    name:                  'Global Distribution™',
    requiredResponseKeys:  Object.freeze(['distribution']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  monitoring: Object.freeze({
    workspaceId:           'monitoring',
    name:                  'Monitoring™',
    requiredResponseKeys:  Object.freeze(['monitoring']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  backend: Object.freeze({
    workspaceId:           'backend',
    name:                  'Backend Verification™',
    requiredResponseKeys:  Object.freeze(['identity', 'musicRights', 'catalog', 'distribution', 'monitoring', 'systemOperations']),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'mission_control_api_v1',
  }),
  health: Object.freeze({
    workspaceId:           'health',
    name:                  'Health Intelligence™',
    requiredResponseKeys:  Object.freeze(['identity', 'musicRights', 'catalog', 'distribution', 'monitoring', 'systemOperations']),
    optionalResponseKeys:  Object.freeze(['executiveOverview']),
    dataSource:            'mission_control_api_v1',
  }),
  overview: Object.freeze({
    workspaceId:           'overview',
    name:                  'Executive Overview™',
    requiredResponseKeys:  Object.freeze(['executiveOverview']),
    optionalResponseKeys:  Object.freeze(['identity']),
    dataSource:            'mission_control_api_v1',
  }),
  athena: Object.freeze({
    workspaceId:           'athena',
    name:                  'ATHENA™',
    requiredResponseKeys:  Object.freeze([]),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'athena_engine_v1',
  }),
  executive_brief: Object.freeze({
    workspaceId:           'executive_brief',
    name:                  'Executive Brief™',
    requiredResponseKeys:  Object.freeze([]),
    optionalResponseKeys:  Object.freeze([]),
    dataSource:            'executive_brief_engine_v1',
  }),
});

export const VALID_WORKSPACE_IDS = Object.freeze(new Set(Object.keys(WORKSPACE_REGISTRY)));
