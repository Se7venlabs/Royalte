// Provider Factory™ — ATHENA™ Phase 3E
//
// createAthenaProvider() reads process.env.ATHENA_PROVIDER (default
// 'placeholder'). The only file besides a provider's own implementation
// that ever names a specific provider key -- athena-service.js and
// everything upstream of it stay provider-ignorant.

import { placeholderProvider } from './providers/placeholder-provider.js';
import { assertValidProvider } from './provider-interface.js';

const PROVIDERS = Object.freeze({
  placeholder: placeholderProvider,
});

export function createAthenaProvider() {
  const requested = process.env.ATHENA_PROVIDER || 'placeholder';
  const provider = PROVIDERS[requested] || placeholderProvider;
  if (!PROVIDERS[requested]) {
    console.warn(`[provider-factory] unknown ATHENA_PROVIDER "${requested}" — falling back to placeholder`);
  }
  assertValidProvider(provider);
  return provider;
}

export { PROVIDERS };
