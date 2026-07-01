// RegistryEntry — one provider's record in the registry — Phase 2.1 §2.1
// Seven fields. Not frozen — registry updates healthState and implementationStatus over time.

const VALID_STATUS = new Set(['planned', 'scaffolded', 'implemented', 'certified']);

export function createRegistryEntry({
  name,
  version,
  capabilityProfile,
  trustValue,
  healthState,
  enabled = true,
  implementationStatus = 'implemented',
} = {}) {
  if (!name)             throw new TypeError('RegistryEntry: name is required');
  if (!version)          throw new TypeError('RegistryEntry: version is required');
  if (!capabilityProfile) throw new TypeError('RegistryEntry: capabilityProfile is required');
  if (trustValue == null) throw new TypeError('RegistryEntry: trustValue is required');
  if (!healthState)      throw new TypeError('RegistryEntry: healthState is required');
  if (!VALID_STATUS.has(implementationStatus)) {
    throw new Error(
      `RegistryEntry: invalid implementationStatus "${implementationStatus}". ` +
      `Must be: ${[...VALID_STATUS].join(' | ')}`
    );
  }

  return {
    name,
    version,
    capabilityProfile,
    trustValue,
    healthState,
    enabled,
    implementationStatus,
  };
}
