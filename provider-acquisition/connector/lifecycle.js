// ConnectorLifecycle — lifecycle orchestration — Phase 2.1 §7 / PAL Design §2
//
// Enforces the canonical provider sequence:
//   Initialize → Register → Authenticate → CheckHealthAndCapabilities → [Acquire]* → Shutdown
//
// Constitutional constraint: this orchestrator is also constitutionally "dumb."
// It drives the sequence and updates health state; it never interprets evidence.

import { HealthState } from '../health/healthStates.js';
import { createRegistryEntry } from '../registry/RegistryEntry.js';
import { getTrustValue } from '../trust/trustConfig.js';

export const Stage = Object.freeze({
  CREATED:       'CREATED',
  INITIALIZED:   'INITIALIZED',
  REGISTERED:    'REGISTERED',
  AUTHENTICATED: 'AUTHENTICATED',
  READY:         'READY',
  FAILED:        'FAILED',
  SHUTDOWN:      'SHUTDOWN',
});

export class ConnectorLifecycle {
  #connector;
  #registry;
  #stage = Stage.CREATED;
  #providerName = null;
  #lastHealth = null;

  constructor(connector, registry) {
    if (!connector) throw new TypeError('ConnectorLifecycle: connector is required');
    if (!registry)  throw new TypeError('ConnectorLifecycle: registry is required');
    this.#connector = connector;
    this.#registry  = registry;
  }

  get stage()        { return this.#stage; }
  get lastHealth()   { return this.#lastHealth; }
  get providerName() { return this.#providerName; }

  #require(validStages, methodName) {
    if (!validStages.includes(this.#stage)) {
      throw new Error(
        `ConnectorLifecycle.${methodName}(): invalid stage "${this.#stage}". ` +
        `Required: ${validStages.join(' | ')}`
      );
    }
  }

  // Step 1: one-time setup, no network calls.
  async initialize(config) {
    this.#require([Stage.CREATED], 'initialize');
    await this.#connector.initialize(config);
    this.#stage = Stage.INITIALIZED;
  }

  // Step 2: publish identity, version, capability profile, and trust → Registry.
  async register() {
    this.#require([Stage.INITIALIZED], 'register');
    const version = this.#connector.getVersion();
    const capabilityProfile = await this.#connector.discoverCapabilities();
    this.#providerName = version.provider;

    const trustValue = getTrustValue(this.#providerName) ?? 0;
    const entry = createRegistryEntry({
      name:                 this.#providerName,
      version,
      capabilityProfile,
      trustValue,
      healthState:          HealthState.AVAILABLE,
      enabled:              true,
      implementationStatus: 'implemented',
    });
    this.#registry.register(entry);
    this.#stage = Stage.REGISTERED;
  }

  // Step 3: acquire/refresh credentials. Auth failure → FAILED stage + AUTH_FAILED health in registry.
  async authenticate() {
    this.#require([Stage.REGISTERED], 'authenticate');
    const result = await this.#connector.authenticate();
    this.#lastHealth = result.health;
    this.#registry.updateHealth(this.#providerName, result.health.state);
    if (result.health.state === HealthState.AUTH_FAILED) {
      this.#stage = Stage.FAILED;
    } else {
      this.#stage = Stage.AUTHENTICATED;
    }
    return result;
  }

  // Steps 4+5: health check + capability confirmation. Transitions to READY.
  async checkHealthAndCapabilities() {
    this.#require([Stage.AUTHENTICATED], 'checkHealthAndCapabilities');
    const health = await this.#connector.reportHealth();
    this.#lastHealth = health;
    this.#registry.updateHealth(this.#providerName, health.state);
    // Capabilities were captured at registration. Health is reported and recorded;
    // the framework does not gate on health state — that is the RIE's judgment.
    this.#stage = Stage.READY;
    return health;
  }

  // Acquire evidence. Requires READY. Stays READY after completion (repeated calls allowed).
  async acquire(evidenceRequest) {
    this.#require([Stage.READY], 'acquire');
    const contract = await this.#connector.acquire(evidenceRequest);
    this.#lastHealth = contract.health;
    this.#registry.updateHealth(this.#providerName, contract.health.state);
    return contract;
  }

  // Shutdown from any post-CREATED state. Idempotent if already SHUTDOWN.
  async shutdown() {
    if (this.#stage === Stage.CREATED) {
      throw new Error('ConnectorLifecycle.shutdown(): cannot shutdown before initialize()');
    }
    if (this.#stage === Stage.SHUTDOWN) return;
    await this.#connector.shutdown();
    this.#stage = Stage.SHUTDOWN;
  }
}
