// Shared builder for the 8 Capability Registry™ modules backed by Phase 3D's
// Canonical Domain Fingerprints™ (identity/publishing/catalog/health/backend/
// media/globalFootprint/monitoring). Not itself a capability -- never
// registered -- just the common plumbing each of those 8 thin files calls,
// avoiding 8x duplicated boilerplate around the same extract/compare/label
// pattern. Reuses DOMAIN_FINGERPRINTS and compareDomain directly, per the
// plan's "no layer duplicates another."

import { DOMAIN_FINGERPRINTS, compareDomain, canonicalDomainLabel } from '../../../_lib/canonical-domain-fingerprints.js';

// fingerprintKey is the lookup key into DOMAIN_FINGERPRINTS/canonicalDomainLabel
// (Phase 3D's internal domain key, e.g. 'footprint'). `name` is the
// Capability Registry's exposed name, matched against question-classifier.js's
// domain keys (e.g. 'globalFootprint') -- defaults to fingerprintKey when
// they're the same, only 'footprint' -> 'globalFootprint' differs today.
export function makeFingerprintCapability(fingerprintKey, { name = fingerprintKey, workspace }) {
  const fp = DOMAIN_FINGERPRINTS[fingerprintKey];
  const label = canonicalDomainLabel(fingerprintKey);
  const domainKey = fingerprintKey;

  function buildContext(rawInputs) {
    const extracted = fp ? fp.extract(rawInputs.scanPayload || null) : { available: false };
    if (!extracted || !extracted.available) {
      return { available: false, summary: `${label} data is not available from the current scan.`, data: null, comparison: null };
    }
    let comparison = null;
    if (rawInputs.previousScanPayload) {
      const schemaCompatible = !!rawInputs.schemaVersion &&
        rawInputs.schemaVersion === rawInputs.previousSchemaVersion;
      comparison = compareDomain(domainKey, rawInputs.previousScanPayload, rawInputs.scanPayload, { schemaCompatible });
    }
    return {
      available: true,
      summary: comparison ? comparison.detail : `${label}: current scan data available.`,
      data: extracted,
      comparison,
    };
  }

  return {
    name,
    advertiseAvailability(rawInputs) {
      return buildContext(rawInputs).available;
    },
    buildContext,
    provideEvidence(rawInputs) {
      const ctx = buildContext(rawInputs);
      if (!ctx.available) return [];
      return [{ fact: ctx.summary, sourceType: 'Canonical Domain', sourceId: domainKey }];
    },
    provideConfidence(rawInputs) {
      return buildContext(rawInputs).available ? 'HIGH' : 'INSUFFICIENT_DATA';
    },
    provideCitations(rawInputs) {
      const ctx = buildContext(rawInputs);
      if (!ctx.available) return [];
      return [{ label, workspace }];
    },
  };
}
