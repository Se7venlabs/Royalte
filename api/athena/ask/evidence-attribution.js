// Evidence Attribution™ — ATHENA™ Phase 3E, Intelligence Layer™
//
// Tags every fact with its origin, reusing the sourceType/sourceId pattern
// already in api/athena/recommendations.js. An answer is never fabricated:
// every fact either carries a recognized source or is explicitly marked
// Unknown -- never silently dropped or silently trusted.

const VALID_SOURCE_TYPES = Object.freeze([
  'Canonical Domain', 'Executive Brief', 'Executive Memory', 'Monitoring Event',
  'User Confirmation', 'Evidence Registry', 'Unknown',
]);

// attributeEvidence(evidenceList, {evidenceConfidence}) -> normalized list.
//
// Confidence Model Evolution™ seam (Board directive): Phase 3E keeps the
// single HIGH/MEDIUM/LOW/INSUFFICIENT_DATA value exposed on the Response
// Contract, but each evidence record here keeps evidence-quality
// (evidenceConfidence) and reasoning-certainty (reasoningConfidence, unused
// today) as distinct internal fields -- so a future split into
// Evidence/Reasoning/Recommendation Confidence doesn't require restructuring
// this file, only exposing what's already tracked separately.
export function attributeEvidence(evidenceList = [], { evidenceConfidence = 'MEDIUM' } = {}) {
  return evidenceList.map(item => ({
    fact: item.fact,
    sourceType: VALID_SOURCE_TYPES.includes(item.sourceType) ? item.sourceType : 'Unknown',
    sourceId: item.sourceId ?? null,
    evidenceConfidence,
    reasoningConfidence: null,
  }));
}

const CONFIDENCE_ORDER = Object.freeze(['INSUFFICIENT_DATA', 'LOW', 'MEDIUM', 'HIGH']);

// deriveOverallConfidence(confidenceLevels) -> the single worst (least
// confident) signal among the Capability Registry's per-capability
// confidence values -- an answer is only as trustworthy as its weakest
// piece of evidence.
export function deriveOverallConfidence(confidenceLevels = []) {
  if (!Array.isArray(confidenceLevels) || confidenceLevels.length === 0) return 'INSUFFICIENT_DATA';
  return confidenceLevels.reduce((worst, level) => {
    const li = CONFIDENCE_ORDER.indexOf(level);
    const wi = CONFIDENCE_ORDER.indexOf(worst);
    if (li === -1) return worst;
    if (wi === -1) return level;
    return li < wi ? level : worst;
  }, 'HIGH');
}

export { VALID_SOURCE_TYPES };
