// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — System Operations™ Domain Fields
// ─────────────────────────────────────────────────────────────────────────────
//
// System Operations™ owns ONLY platform operational data:
//   - Evidence completeness (how much data was collected)
//   - Connector status (which providers responded)
//   - Registry integrity (validation pass/fail)
//   - Verification coverage (how many providers were reached)
//   - Scan integrity (data quality indicators)
//   - Provider availability (which connectors are live)
//   - Infrastructure health (platform self-diagnostics)
//
// This domain does NOT own:
//   - Artist identity data (→ Identity™)
//   - Catalog data (→ Catalog™)
//   - Publishing or rights data (→ Music Rights™)
//   - Executive or health intelligence (→ derived.js, PROVISIONAL)
//
// Field IDs use the "ops." prefix.
//
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_OPS_FIELDS = Object.freeze([
  {
    id:               'ops.evidence_completeness',
    canonicalName:    'evidence_completeness',
    displayName:      'Evidence Completeness',
    parentObject:     'EvidencePackage',
    domain:           'System Operations',
    description:      'Percentage of expected evidence fields populated in this scan (0–100).',
    dataType:         'percent',
    required:         false,
    defaultValue:     0,
    validationRule:   '0–100 inclusive',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence', 'MissionControl'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.connector_status',
    canonicalName:    'connector_status',
    displayName:      'Connector Status',
    parentObject:     'EvidenceSource',
    domain:           'System Operations',
    description:      'Per-connector response status map for this scan (provider → OK | ERROR | TIMEOUT | NOT_ATTEMPTED).',
    dataType:         'object',
    required:         false,
    defaultValue:     null,
    validationRule:   null,
    resolutionPolicy: 'MOST_RECENT',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence', 'MissionControl'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.registry_integrity',
    canonicalName:    'registry_integrity',
    displayName:      'Registry Integrity',
    parentObject:     'Scan',
    domain:           'System Operations',
    description:      'Whether the Canonical Field Registry passed all validation rules at scan startup: PASS | FAIL.',
    dataType:         'enum',
    required:         false,
    defaultValue:     'PASS',
    validationRule:   'PASS|FAIL',
    resolutionPolicy: 'MOST_RECENT',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.verification_coverage',
    canonicalName:    'verification_coverage',
    displayName:      'Verification Coverage',
    parentObject:     'Scan',
    domain:           'System Operations',
    description:      'Number of identity providers successfully reached in this scan (regardless of VERIFIED status).',
    dataType:         'number',
    required:         false,
    defaultValue:     0,
    validationRule:   'non-negative integer',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence', 'MissionControl'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.scan_integrity',
    canonicalName:    'scan_integrity',
    displayName:      'Scan Integrity',
    parentObject:     'Scan',
    domain:           'System Operations',
    description:      'Overall data-quality flag for this scan: FULL | PARTIAL | DEGRADED.',
    dataType:         'enum',
    required:         false,
    defaultValue:     'FULL',
    validationRule:   'FULL|PARTIAL|DEGRADED',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence', 'HealthEngine', 'MissionControl'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.provider_availability',
    canonicalName:    'provider_availability',
    displayName:      'Provider Availability',
    parentObject:     'EvidenceSource',
    domain:           'System Operations',
    description:      'Map of currently live/available evidence providers (provider → true | false).',
    dataType:         'object',
    required:         false,
    defaultValue:     null,
    validationRule:   null,
    resolutionPolicy: 'MOST_RECENT',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
  {
    id:               'ops.infrastructure_health',
    canonicalName:    'infrastructure_health',
    displayName:      'Infrastructure Health',
    parentObject:     'Scan',
    domain:           'System Operations',
    description:      'Platform-level health indicator for the scan engine and its dependencies: HEALTHY | DEGRADED | CRITICAL.',
    dataType:         'enum',
    required:         false,
    defaultValue:     'HEALTHY',
    validationRule:   'HEALTHY|DEGRADED|CRITICAL',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['SystemOperationsIntelligence', 'MissionControl'],
    version:          '1.0.0',
    status:           'ACTIVE',
  },
]);
