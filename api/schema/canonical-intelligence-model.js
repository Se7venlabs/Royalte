// Royaltē Canonical Intelligence Model™ (CIM)
//
// The single artifact produced by the Royaltē Intelligence Engine (RIE)
// and consumed by every Layer 3 product.
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board authorization: Phase 1 (2026-07-01)
//
// §8.2 defines the canonical intelligence objects. Every product reads
// from this model. No product writes to it. No product re-derives it.
//
// "No Product Owns Intelligence." — RIE Operating System Rebuild Brief
//
// Phase 3.7 Board Extension: 'recording' added as §8.2.13 (2026-07-02).

export const CIM_VERSION = '1.0.0';

// The §8.2 canonical intelligence objects (order is constitutional).
// Phase 3.7 extended from 12 → 13 with Board authorization (2026-07-02).
export const CIM_OBJECTS = Object.freeze([
  'identity',        // artist identity across all providers
  'health',          // Music Backend Health Score™ + grade + category breakdown
  'globalFootprint', // territorial and platform reach
  'catalog',         // catalog depth, release structure, metadata completeness
  'verification',    // backend registration status (MusicBrainz, Discogs, etc.)
  'metadata',        // metadata quality signals
  'publishing',      // publishing registrations, writers, IPIs, ISWCs
  'opportunities',   // identified improvement opportunities from the rule engine
  'actions',         // prioritized executive action items
  'aiInsight',       // Royaltē AI™ narrative and priority observation
  'revenueSignals',  // Revenue Signals™ — reserved for future module
  'scanAuthority',   // scan provenance: version, timestamp, anchor, subject
  'recording',       // Recording Intelligence™ — ISRC certification, confidence, canonical recordings
]);

// emptyCIM: factory for a blank CIM before the RIE populates it.
// All §8.2 objects are present but null — certifyCIM will reject any
// CIM where a required key is entirely absent.
export function emptyCIM() {
  return {
    _cimVersion:     CIM_VERSION,
    identity:        null,
    health:          null,
    globalFootprint: null,
    catalog:         null,
    verification:    null,
    metadata:        null,
    publishing:      null,
    opportunities:   null,
    actions:         null,
    aiInsight:       null,
    revenueSignals:  null,
    scanAuthority:   null,
    recording:       null,  // §8.2.13 — Phase 3.7 Board Extension
  };
}

// validateCIM: structural check used by the certifier and tests.
// Returns { valid: boolean, missing: string[] }.
// A present-but-null value is valid — the RIE emits null when a
// provider did not supply enough evidence to populate an object.
// A missing key (not in the object at all) is invalid.
export function validateCIM(cim) {
  if (!cim || typeof cim !== 'object') {
    return { valid: false, missing: CIM_OBJECTS.slice() };
  }
  const missing = CIM_OBJECTS.filter(k => !(k in cim));
  return { valid: missing.length === 0, missing };
}
