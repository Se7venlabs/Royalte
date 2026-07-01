// ProviderConnector — abstract Connector contract — PAL Technical Design v3 §1 / Phase 2.1 §1
//
// Constitutional constraint: this interface is constitutionally "dumb."
// No method normalizes, scores, reconciles, enriches, or interprets evidence.
// acquire() returns what one provider said. It never decides what is true.
// Every method that can fail returns a structured result (health signal) — never a raw provider throw.
//
// Naming: "Connector" locked per Phase 2.1 Board directive.
// No concrete provider implements this in Phase 2.1.

export class ProviderConnector {
  // One-time setup from injected config. No network calls.
  async initialize(_config) {
    throw new Error(`${this.constructor.name}: initialize(config) not implemented`);
  }

  // Acquire/refresh credentials. Failure → { health: ProviderHealthSignal, credentials: null }.
  // Never throws a raw provider error upward.
  async authenticate() {
    throw new Error(`${this.constructor.name}: authenticate() not implemented`);
  }

  // Return this connector's declared CapabilityProfile (static — no network required).
  async discoverCapabilities() {
    throw new Error(`${this.constructor.name}: discoverCapabilities() not implemented`);
  }

  // Current health state. No side effects.
  async reportHealth() {
    throw new Error(`${this.constructor.name}: reportHealth() not implemented`);
  }

  // Fetch raw evidence for one EvidenceRequest. Returns EvidenceContract.
  // Raw evidence only — never reconcile, score, or interpret.
  async acquire(_evidenceRequest) {
    throw new Error(`${this.constructor.name}: acquire(evidenceRequest) not implemented`);
  }

  // Connector version + provider API version.
  getVersion() {
    throw new Error(`${this.constructor.name}: getVersion() not implemented`);
  }

  // Release resources, close connections.
  async shutdown() {
    throw new Error(`${this.constructor.name}: shutdown() not implemented`);
  }
}
