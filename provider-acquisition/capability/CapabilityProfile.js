// CapabilityProfile — PAL Technical Design v3 §2.12
// A connector's self-declared functional coverage against the shared vocabulary.
// PAL exposes profiles; it never ranks or compares them. That is the RIE's role.

import { ALL_CAPABILITIES, VOCABULARY_VERSION } from './capabilityVocabulary.js';

export function createCapabilityProfile({ vocabularyVersion = VOCABULARY_VERSION, capabilities = [] } = {}) {
  const unknown = capabilities.filter(c => !ALL_CAPABILITIES.has(c));
  if (unknown.length > 0) {
    throw new Error(
      `CapabilityProfile: capabilities not in vocabulary v${vocabularyVersion}: ${unknown.join(', ')}`
    );
  }

  return Object.freeze({
    vocabularyVersion,
    capabilities: Object.freeze([...new Set(capabilities)]),
  });
}

export function hasCapability(profile, capability) {
  return profile.capabilities.includes(capability);
}
