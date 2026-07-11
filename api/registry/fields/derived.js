// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Derived / PROVISIONAL Fields
// ─────────────────────────────────────────────────────────────────────────────
//
// PROVISIONAL STATUS — these fields are pending the Board's Derived Intelligence
// policy ratification. They are NOT part of the canonical field registry and
// are NOT included in ALL_FIELDS or subject to standard domain validation.
//
// These fields are loaded separately as REGISTRY.provisionalFields and accessed
// via getProvisionalField(id) — never via getField().
//
// Domain assignment is deliberately omitted until ratification.
// Do not assign a permanent domain without an explicit Board directive.
//
// ─────────────────────────────────────────────────────────────────────────────

export const DERIVED_FIELDS = Object.freeze([
  {
    id:               'executive.health_score',
    canonicalName:    'health_score',
    displayName:      'Health Score',
    parentObject:     'HealthIndicator',
    domain:           null,
    description:      'Royaltē Health Score™ (0–100) computed by the Health Engine from a weighted intelligence report. Higher is healthier.',
    dataType:         'number',
    required:         false,
    defaultValue:     null,
    validationRule:   '0–100 inclusive',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['HealthIntelligence', 'ExecutiveBrief', 'MissionControl'],
    version:          '1.0.0',
    status:           'PROVISIONAL',
  },
  {
    id:               'executive.health_grade',
    canonicalName:    'health_grade',
    displayName:      'Health Grade',
    parentObject:     'HealthIndicator',
    domain:           null,
    description:      'Letter grade derived from the Health Score: A+ | A | B | C | D | F.',
    dataType:         'enum',
    required:         false,
    defaultValue:     null,
    validationRule:   'A+|A|B|C|D|F',
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['HealthIntelligence', 'ExecutiveBrief', 'MissionControl'],
    version:          '1.0.0',
    status:           'PROVISIONAL',
  },
  {
    id:               'executive.priority_actions',
    canonicalName:    'priority_actions',
    displayName:      'Priority Actions',
    parentObject:     'ExecutiveInsight',
    domain:           null,
    description:      'Ordered list of recommended actions surfaced from the Intelligence Engine\'s recommendations.',
    dataType:         'array',
    required:         false,
    defaultValue:     null,
    validationRule:   null,
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['ExecutiveBrief', 'MissionControl'],
    version:          '1.0.0',
    status:           'PROVISIONAL',
  },
  {
    id:               'executive.ai_insight',
    canonicalName:    'ai_insight',
    displayName:      'AI Insight',
    parentObject:     'ExecutiveInsight',
    domain:           null,
    description:      'ATHENA™-generated natural language insight summarizing the artist\'s current music ecosystem health.',
    dataType:         'string',
    required:         false,
    defaultValue:     null,
    validationRule:   null,
    resolutionPolicy: 'DERIVED',
    confidencePolicy: 'STATIC',
    sourcePriority:   [],
    consumers:        ['ExecutiveBrief', 'MissionControl', 'AIInsights'],
    version:          '1.0.0',
    status:           'PROVISIONAL',
  },
]);
