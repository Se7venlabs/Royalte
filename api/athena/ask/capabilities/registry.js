// ATHENA Capability Registry™ — ATHENA™ Phase 3E, Knowledge Layer™
//
// Self-registering per-domain context modules. Each capability file calls
// registerCapability() at module load time; capabilities/index.js imports
// all 11 -- importing that one file registers everything. Reused by both
// the Reasoning Engine (deterministic exit) and the Context Builder (AI
// exit) -- the single data-access layer serving both, so the only
// difference between the two exits is whether an LLM is consulted, never
// which data layer is queried.
//
// Capability shape: { name, buildContext(rawInputs), provideEvidence(rawInputs),
// provideConfidence(rawInputs), provideCitations(rawInputs),
// advertiseAvailability(rawInputs) }.

const capabilities = new Map(); // name -> capability

export function registerCapability(capability) {
  if (!capability || typeof capability.name !== 'string' || !capability.name) {
    throw new Error('registerCapability requires a capability with a string `name`');
  }
  capabilities.set(capability.name, capability);
}

export function getCapabilities() {
  return [...capabilities.values()];
}

export function getCapability(name) {
  return capabilities.get(name) || null;
}

// Test/diagnostic only.
export function _resetForTests() {
  capabilities.clear();
}
