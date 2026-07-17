// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — DistributionEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when contributing
// to distribution intelligence. This contract covers where an artist's
// catalog is available globally.
//
// Evidence fields describe raw availability data returned by a provider.
// Canonical distribution resolution (global footprint scoring, market ranking)
// is not performed at this layer.
//
// ─────────────────────────────────────────────────────────────────────────────

export const DISTRIBUTION_CONTRACT = Object.freeze({
  contractId:   'DistributionEvidence',
  displayName:  'Distribution Evidence',
  category:     'Distribution',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing where an artist\'s catalog is available: storefronts, markets, territories.',

  evidenceFields: Object.freeze([
    {
      id:          'marketCount',
      displayName: 'Market Count',
      dataType:    'number',
      required:    false,
      description: 'Number of distinct markets or storefronts where this artist\'s catalog is available according to this provider.',
    },
    {
      id:          'markets',
      displayName: 'Markets',
      dataType:    'array',
      required:    false,
      description: 'List of market or storefront codes where the artist\'s catalog is available.',
    },
    {
      id:          'availabilityMap',
      displayName: 'Availability Map',
      dataType:    'object',
      required:    false,
      description: 'Per-market availability map as returned by this provider (market code → boolean or object).',
    },
    {
      id:          'unavailableMarkets',
      displayName: 'Unavailable Markets',
      dataType:    'array',
      required:    false,
      description: 'Markets where the catalog has been explicitly restricted or removed.',
    },
    {
      id:          'primaryMarket',
      displayName: 'Primary Market',
      dataType:    'string',
      required:    false,
      description: 'The primary market this provider associates with the artist (e.g. home country).',
    },
    {
      id:          'globalAvailabilityStatus',
      displayName: 'Global Availability Status',
      dataType:    'string',
      required:    false,
      description: 'Provider\'s summary availability classification (e.g. WIDE, MODERATE, LIMITED, MINIMAL).',
    },
    // Phase 5.2 — Territory Intelligence Engine™ reconciled output fields.
    // Additive only (Board decision 6): the six fields above are unchanged.
    // These represent the Engine's per-territory five-state reconciliation
    // (AVAILABLE/UNAVAILABLE/UNKNOWN/NOT_EVALUATED/ERROR), not raw
    // per-provider evidence — evidence itself is preserved inside
    // territoryStates rather than collapsed away (Board Decision 2).
    {
      id:          'territoryStates',
      displayName: 'Territory States',
      dataType:    'array',
      required:    false,
      description: 'Per-territory reconciled state from the Territory Intelligence Engine: { code, name, state, confidence, evidence[] }. evidence[] preserves each contributing provider\'s raw observation, acquisition status, timestamp, source, and reason code.',
    },
    {
      id:          'territorySummary',
      displayName: 'Territory Summary',
      dataType:    'object',
      required:    false,
      description: 'Aggregate counts by state across all evaluated territories: { available, unavailable, unknown, notEvaluated, error }.',
    },
    {
      id:          'territoryProvidersContributing',
      displayName: 'Territory Providers Contributing',
      dataType:    'array',
      required:    false,
      description: 'Providers whose evidence contributed to the reconciled territory states (Apple-only in Phase 5.2; provider-general by design).',
    },
  ]),
});
