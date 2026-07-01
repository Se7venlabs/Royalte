// Mock Connector — reference implementation for conformance testing — Phase 2.1 §1.3
//
// TEST-ONLY. Never imported by any production path.
// Exercises interface hard cases: auth failure, partial response, schema-changed, deprecated.

import { randomUUID } from 'node:crypto';
import { ProviderConnector } from '../connector/ProviderConnector.js';
import { Capability, VOCABULARY_VERSION } from '../capability/capabilityVocabulary.js';
import { createCapabilityProfile } from '../capability/CapabilityProfile.js';
import { HealthState } from '../health/healthStates.js';
import { createHealthSignal } from '../health/ProviderHealthSignal.js';
import { createEvidenceContract } from '../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../evidence/integrity.js';

export const MOCK_PROVIDER_NAME = 'mock_connector';

// Supported scenarios: 'success' | 'auth_failure' | 'partial' | 'schema_changed' | 'deprecated'
export class MockConnector extends ProviderConnector {
  #scenario;
  #config = {};

  constructor(scenario = 'success') {
    super();
    this.#scenario = scenario;
  }

  async initialize(config) {
    this.#config = config ?? {};
  }

  async authenticate() {
    if (this.#scenario === 'auth_failure') {
      return {
        health: createHealthSignal({
          state:    HealthState.AUTH_FAILED,
          provider: MOCK_PROVIDER_NAME,
          detail:   'mock auth failure: invalid credentials',
        }),
        credentials: null,
      };
    }
    return {
      health: createHealthSignal({ state: HealthState.AVAILABLE, provider: MOCK_PROVIDER_NAME }),
      credentials: { token: 'mock-bearer-token' },
    };
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities: [Capability.ARTIST_IDENTITY, Capability.RELEASES, Capability.TRACKS],
    });
  }

  async reportHealth() {
    const state = this.#scenario === 'deprecated' ? HealthState.DEPRECATED : HealthState.AVAILABLE;
    return createHealthSignal({ state, provider: MOCK_PROVIDER_NAME });
  }

  async acquire(evidenceRequest) {
    // payload is opaque — the framework never defines or reads its internal shape.
    const payload = { mock: true, requestedRef: evidenceRequest.subjectRef };
    const rawResponse = JSON.stringify({ source: MOCK_PROVIDER_NAME, data: payload });

    const completeness = this.#scenario === 'partial' ? 'partial' : 'full';
    const health = this.#scenario === 'schema_changed'
      ? createHealthSignal({ state: HealthState.SCHEMA_CHANGED, provider: MOCK_PROVIDER_NAME, detail: 'mock schema change detected' })
      : createHealthSignal({ state: HealthState.AVAILABLE, provider: MOCK_PROVIDER_NAME });

    return createEvidenceContract({
      acquisitionId:       randomUUID(),
      correlationId:       evidenceRequest.context?.correlationId ?? randomUUID(),
      requestId:           evidenceRequest.requestId,
      provider:            MOCK_PROVIDER_NAME,
      providerVersion:     '1.0',
      connectorVersion:    '1.0',
      providerTrust:       this.#config.trustValue ?? 80,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:          new Date().toISOString(),
      health,
      completeness,
      payload,
      providerFields:      { mock_native_id: 'mn-001', mock_raw_field: 'some-provider-value' },
      payloadChecksum:     computePayloadChecksum(payload),
      rawResponseHash:     computeRawResponseHash(rawResponse),
    });
  }

  getVersion() {
    return {
      provider:          MOCK_PROVIDER_NAME,
      connectorVersion:  '1.0',
      providerApiVersion: '1.0',
    };
  }

  async shutdown() {
    this.#config = {};
  }
}
