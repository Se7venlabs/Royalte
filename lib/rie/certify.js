// RIE Layer 2 — Step 7: Certify
//
// The final RIE step. Stamps the assembled CIM as canonical, versioned,
// and consumable by Layer 3 products. Deep-freezes the output so no
// product can mutate the intelligence it receives.
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
//   "The RIE emits exactly one artifact: the Canonical Intelligence Model."
//
// certifyCIM throws if any §8.2 object key is absent from the input.
// The RIE must emit null for objects it cannot populate — never omit
// the key. A null value is valid. A missing key is a contract violation.

import { CIM_VERSION, validateCIM } from '../../api/schema/canonical-intelligence-model.js';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// certifyCIM
//
// cim:     the populated CIM object from assembleCIM()
// options:
//   generatedAt  string  ISO timestamp (injectable for deterministic tests)
//
// Returns a deep-frozen certified CIM.
// Throws if any §8.2 object key is missing.
export function certifyCIM(cim, options = {}) {
  const { valid, missing } = validateCIM(cim);
  if (!valid) {
    throw new Error(
      `[rie/certify] CIM is missing required §8.2 objects: ${missing.join(', ')}. ` +
      'The RIE must emit null for unpopulated objects — never omit the key.',
    );
  }

  const certified = {
    ...cim,
    _cimVersion:  CIM_VERSION,
    _certified:   true,
    _certifiedAt: options.generatedAt || new Date().toISOString(),
  };

  return deepFreeze(certified);
}
