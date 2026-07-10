// RIE Layer 2 — Evidence Validator
// Phase 2.4 — validates incoming EvidencePackages before any intelligence processing.
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8 (Layer 2, Step 2)
// Board Authorization: Phase 2.4 (2026-07-01)
//
// An EvidencePackage is the RIE's constitutional input boundary from the PAL:
//   { evidenceType: string, contract: EvidenceContract }
//
// Why EvidencePackage instead of raw EvidenceContract?
// The Evidence Contract is framework-level and provider-agnostic — it carries
// no evidenceType declaration (what kind of evidence the contract holds). Only
// the orchestrator that issued the acquisition request knows the evidence type.
// EvidencePackage adds that declaration at the RIE boundary without modifying
// the locked Phase 2.1 Evidence Contract schema.
//
// Validation is structural only — field presence and type checks.
// The RIE validates completeness semantics (completeness: 'full' | 'partial' | 'empty')
// during assembly, not here.

// Phase 2.1 canonical required fields on a certified Evidence Contract.
const REQUIRED_CONTRACT_FIELDS = Object.freeze([
  'evidenceId',
  'acquisitionId',
  'correlationId',
  'requestId',
  'provider',
  'providerVersion',
  'connectorVersion',
  'providerTrust',
  'capabilityProfileRef',
  'acquiredAt',
  'health',
  'completeness',
  'payload',
  'payloadChecksum',
  'rawResponseHash',
]);

/**
 * Validate a single EvidencePackage.
 *
 * @param {{ evidenceType: string, contract: object }} pkg
 * @returns {{ valid: boolean, reason: string | null }}
 */
export function validateEvidencePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    return { valid: false, reason: 'package must be a non-null object' };
  }
  if (typeof pkg.evidenceType !== 'string' || !pkg.evidenceType.trim()) {
    return { valid: false, reason: 'evidenceType must be a non-empty string' };
  }
  if (!pkg.contract || typeof pkg.contract !== 'object') {
    return { valid: false, reason: 'contract must be a non-null object' };
  }

  const missing = REQUIRED_CONTRACT_FIELDS.filter(f => !(f in pkg.contract));
  if (missing.length > 0) {
    return { valid: false, reason: `contract missing required fields: ${missing.join(', ')}` };
  }

  return { valid: true, reason: null };
}

/**
 * Validate an array of EvidencePackages.
 *
 * @param {Array} packages
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEvidencePackages(packages) {
  if (!Array.isArray(packages)) {
    return { valid: false, errors: ['evidencePackages must be an array'] };
  }
  if (packages.length === 0) {
    return { valid: false, errors: ['evidencePackages must not be empty'] };
  }

  const errors = [];
  packages.forEach((pkg, i) => {
    const { valid, reason } = validateEvidencePackage(pkg);
    if (!valid) errors.push(`packages[${i}]: ${reason}`);
  });

  return { valid: errors.length === 0, errors };
}
