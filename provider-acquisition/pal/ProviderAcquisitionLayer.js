// ProviderAcquisitionLayer — Phase 2.3
//
// The constitutional boundary between the external provider world and the
// Royaltē Intelligence Engine. Its sole responsibility: acquire evidence.
//
// Constitutional constraints (Royaltē Master Constitution v1.3, PAL §2):
//   NEVER normalize, reconcile, compare, score, or interpret provider data.
//   NEVER communicate with RIE, Mission Control, Audit, or any Royaltē product.
//   NEVER expose product APIs.
//   ALWAYS remain completely provider-agnostic.
//
// The PAL answers only: "Here is what the providers said."

import { ProviderRegistry }        from '../registry/ProviderRegistry.js';
import { ConnectorLifecycle, Stage } from '../connector/lifecycle.js';
import { createAcquisitionReport }  from './AcquisitionReport.js';

export class ProviderAcquisitionLayer {
  #registry;
  #lifecycles = new Map();   // providerName → ConnectorLifecycle

  /**
   * @param {{ registry?: ProviderRegistry }} options — injectable for testing
   */
  constructor({ registry } = {}) {
    this.#registry = registry ?? new ProviderRegistry();
  }

  // ── Connector management ──────────────────────────────────────────────────

  /**
   * Register a connector with the PAL.
   * Runs lifecycle steps: initialize → register.
   * Returns the providerName after registration.
   */
  async registerConnector(connector, config) {
    const lifecycle = new ConnectorLifecycle(connector, this.#registry);
    await lifecycle.initialize(config);
    await lifecycle.register();
    const providerName = lifecycle.providerName;
    this.#lifecycles.set(providerName, lifecycle);
    return providerName;
  }

  /**
   * Authenticate a previously registered connector.
   * Lifecycle stage: REGISTERED → AUTHENTICATED (or FAILED).
   */
  async authenticateConnector(providerName) {
    return this.#lc(providerName).authenticate();
  }

  /**
   * Run health + capability check on an authenticated connector.
   * Lifecycle stage: AUTHENTICATED → READY.
   */
  async checkConnectorHealth(providerName) {
    return this.#lc(providerName).checkHealthAndCapabilities();
  }

  /**
   * Full activation sequence in one call:
   * registerConnector → authenticateConnector → checkConnectorHealth → READY.
   * Returns providerName.
   */
  async activateConnector(connector, config) {
    const providerName = await this.registerConnector(connector, config);
    await this.authenticateConnector(providerName);
    await this.checkConnectorHealth(providerName);
    return providerName;
  }

  // ── Evidence acquisition ──────────────────────────────────────────────────

  /**
   * Request evidence from a READY connector.
   * Returns an AcquisitionReport containing the unmodified Evidence Contract.
   * The PAL never inspects or transforms the contract payload.
   */
  async acquire(providerName, evidenceRequest) {
    const startMs  = Date.now();
    const contract = await this.#lc(providerName).acquire(evidenceRequest);
    const elapsedMs = Date.now() - startMs;

    return createAcquisitionReport({
      providerName,
      requestId: evidenceRequest.requestId,
      contract,
      elapsedMs,
    });
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /** Returns all registered connector registry entries (copies). */
  listConnectors() {
    return this.#registry.listAll();
  }

  /** Returns the registry entry for a named connector, or null. */
  getConnectorEntry(providerName) {
    return this.#registry.lookup(providerName);
  }

  /** Returns the current lifecycle stage for a named connector. */
  getConnectorStage(providerName) {
    return this.#lc(providerName).stage;
  }

  /** Returns the last health signal recorded by a named connector's lifecycle. */
  getConnectorHealth(providerName) {
    return this.#lc(providerName).lastHealth;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Shut down a single named connector. */
  async shutdownConnector(providerName) {
    await this.#lc(providerName).shutdown();
  }

  /**
   * Shut down all registered connectors.
   * Errors are isolated and collected — PAL never throws on shutdown.
   * Returns an array of { provider, error } for any connectors that failed.
   */
  async shutdown() {
    const errors = [];
    for (const [name, lc] of this.#lifecycles) {
      try {
        if (lc.stage !== Stage.SHUTDOWN) await lc.shutdown();
      } catch (err) {
        errors.push({ provider: name, error: err.message });
      }
    }
    this.#lifecycles.clear();
    return errors;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  #lc(providerName) {
    const lc = this.#lifecycles.get(providerName);
    if (!lc) {
      throw new Error(`ProviderAcquisitionLayer: no connector registered for "${providerName}"`);
    }
    return lc;
  }
}
