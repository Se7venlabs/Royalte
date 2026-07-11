// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — MonitoringEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when contributing
// to monitoring intelligence. This contract covers change detection,
// scan history, and trend data returned by a provider.
//
// Evidence fields describe raw temporal data from a provider.
// Canonical monitoring resolution (change classification, alert generation)
// is not performed at this layer.
//
// ─────────────────────────────────────────────────────────────────────────────

export const MONITORING_CONTRACT = Object.freeze({
  contractId:   'MonitoringEvidence',
  displayName:  'Monitoring Evidence',
  category:     'Monitoring',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing change detection, activity, and temporal signals for an artist from a given provider.',

  evidenceFields: Object.freeze([
    {
      id:          'scanTimestamp',
      displayName: 'Scan Timestamp',
      dataType:    'date',
      required:    true,
      description: 'ISO 8601 timestamp of when this monitoring snapshot was taken.',
    },
    {
      id:          'previousScanId',
      displayName: 'Previous Scan ID',
      dataType:    'string',
      required:    false,
      description: 'Scan ID of the immediately preceding scan for this artist, used for change comparison.',
    },
    {
      id:          'changesDetected',
      displayName: 'Changes Detected',
      dataType:    'boolean',
      required:    false,
      description: 'Whether this provider\'s evidence differs from its equivalent in the previous scan.',
    },
    {
      id:          'changeCount',
      displayName: 'Change Count',
      dataType:    'number',
      required:    false,
      description: 'Number of distinct data points that changed between this scan and the previous scan.',
    },
    {
      id:          'changeDetails',
      displayName: 'Change Details',
      dataType:    'array',
      required:    false,
      description: 'Structured list of detected changes, each describing what field changed and what the old and new values were.',
    },
    {
      id:          'dataChecksum',
      displayName: 'Data Checksum',
      dataType:    'string',
      required:    false,
      description: 'A checksum or hash of this provider\'s evidence payload used to detect changes efficiently.',
    },
    {
      id:          'activitySignals',
      displayName: 'Activity Signals',
      dataType:    'object',
      required:    false,
      description: 'Provider-specific activity indicators (e.g. listener counts, chart positions, recent plays).',
    },
  ]),
});
