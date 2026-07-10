// ProviderHealthSignal — PAL Technical Design v3 §4
// Classification uses transport/shape facts only — never content meaning.
// Health is a first-class output of the PAL, not a side effect.

import { HealthState } from './healthStates.js';

const VALID_STATES = new Set(Object.values(HealthState));

export function createHealthSignal({
  state,
  provider,
  detail = null,
  timestamp = new Date().toISOString(),
} = {}) {
  if (!VALID_STATES.has(state)) {
    throw new Error(
      `ProviderHealthSignal: invalid state "${state}". Valid: ${[...VALID_STATES].join(', ')}`
    );
  }
  if (!provider) throw new TypeError('ProviderHealthSignal: provider is required');

  return Object.freeze({
    state,
    provider,
    detail,     // structural/transport context only — never payload meaning
    timestamp,
  });
}

export function isAvailable(signal) {
  return signal.state === HealthState.AVAILABLE;
}
