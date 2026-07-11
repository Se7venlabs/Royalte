// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — SystemOperationsEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when reporting
// its own operational state. This contract covers connector health,
// response quality, and platform infrastructure signals.
//
// Unlike other contracts, SystemOperationsEvidence is produced by the
// connector itself — not derived from provider data. It describes HOW
// the evidence was retrieved, not WHAT was found.
//
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_OPERATIONS_CONTRACT = Object.freeze({
  contractId:   'SystemOperationsEvidence',
  displayName:  'System Operations Evidence',
  category:     'Operations',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing the operational state of a connector: response health, latency, quota, and parsing integrity.',

  evidenceFields: Object.freeze([
    {
      id:          'responseTimeMs',
      displayName: 'Response Time (ms)',
      dataType:    'number',
      required:    false,
      description: 'Round-trip response time in milliseconds for the provider API call.',
    },
    {
      id:          'httpStatus',
      displayName: 'HTTP Status',
      dataType:    'number',
      required:    false,
      description: 'HTTP status code returned by the provider API.',
    },
    {
      id:          'apiQuotaRemaining',
      displayName: 'API Quota Remaining',
      dataType:    'number',
      required:    false,
      description: 'Remaining API call quota for this provider as of this scan, if reported.',
    },
    {
      id:          'rawDataSize',
      displayName: 'Raw Data Size (bytes)',
      dataType:    'number',
      required:    false,
      description: 'Size of the raw provider response payload in bytes.',
    },
    {
      id:          'parsingErrors',
      displayName: 'Parsing Errors',
      dataType:    'array',
      required:    false,
      description: 'List of non-fatal parsing errors encountered while transforming the provider response.',
    },
    {
      id:          'retryCount',
      displayName: 'Retry Count',
      dataType:    'number',
      required:    false,
      description: 'Number of retry attempts made before a successful (or final failed) response.',
    },
    {
      id:          'authMethod',
      displayName: 'Auth Method',
      dataType:    'string',
      required:    false,
      description: 'Authentication method used for this provider call (e.g. JWT, OAUTH2, API_KEY).',
    },
    {
      id:          'connectorHealthStatus',
      displayName: 'Connector Health Status',
      dataType:    'string',
      required:    false,
      description: 'Self-reported health of the connector: HEALTHY | DEGRADED | FAILED.',
    },
  ]),
});
