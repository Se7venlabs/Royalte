// ProviderRegistry — authoritative provider directory — Phase 2.1 §2 / PAL Design §2
//
// Directory only. Never ranks, selects, scores, or decides which provider to use.
// Selection logic belongs to the RIE (future phase). The registry is the state-of-record
// for what providers exist, what they declare, and whether they are enabled.

export class ProviderRegistry {
  #entries = new Map();

  // Register a provider. Overwrites if already registered (re-registration on restart).
  register(entry) {
    if (!entry?.name) throw new TypeError('ProviderRegistry.register: entry.name is required');
    this.#entries.set(entry.name, { ...entry });
  }

  // Returns a shallow copy of the entry, or null if not found.
  lookup(name) {
    return this.#entries.has(name) ? { ...this.#entries.get(name) } : null;
  }

  // Update health state for a registered provider.
  updateHealth(name, healthState) {
    const entry = this.#entries.get(name);
    if (!entry) throw new Error(`ProviderRegistry.updateHealth: provider "${name}" not registered`);
    entry.healthState = healthState;
  }

  // Update implementation status for a registered provider.
  updateStatus(name, implementationStatus) {
    const entry = this.#entries.get(name);
    if (!entry) throw new Error(`ProviderRegistry.updateStatus: provider "${name}" not registered`);
    entry.implementationStatus = implementationStatus;
  }

  isEnabled(name) {
    const entry = this.#entries.get(name);
    return entry ? entry.enabled : false;
  }

  // Returns shallow copies of all entries.
  listAll() {
    return [...this.#entries.values()].map(e => ({ ...e }));
  }

  get size() {
    return this.#entries.size;
  }
}
