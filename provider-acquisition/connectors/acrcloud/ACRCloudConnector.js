// ACRCloudConnector — Phase 3.9 (ACRCloud Audio Recognition Connector™ v1)
//
// Constitutional implementation of ProviderConnector for the ACRCloud Identify API.
// https://docs.acrcloud.com/reference/identification-api
//
// Constitutional constraint: "What recording is this?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
// It NEVER communicates with any Royaltē product (Mission Control, Audit, etc.).
//
// Scope (Board-approved v1 — Audio Recognition Connector™ only):
//   AUDIO_RECOGNITION — POST /v1/identify, data_type "audio" or "fingerprint".
// Explicitly out of scope for this connector (Board Directive, Phase 3.9):
//   AI-generated music detection, human-vs-AI classification, AI probability
//   scoring, AI model identification, stem-level AI detection, AI disclosure
//   or policy logic. Reserved for a separate ACRCloud AI Detection Connector™,
//   independently testable, certifiable, and replaceable.
// Also out of scope (see Board Discovery Report): Metadata API, Bucket/Custom
// Files API, Broadcast Monitoring API — different auth model and/or
// asynchronous/webhook shape incompatible with acquire()'s synchronous contract.
//
// ACRCloud specifics:
//   Auth: HMAC-SHA1 request signing per request (access_key + access_secret).
//     There is no login/token endpoint — every request is independently signed,
//     so authenticate() is a local credential-presence check, not a network call.
//     Real auth failures (wrong key, bad signature) only surface lazily, on the
//     first acquire() — via ACRCloud status codes 3001 / 3014.
//   Host: per-project, assigned at ACRCloud console project creation
//     (e.g. identify-eu-west-1.acrcloud.com). Never a fixed constant — always
//     supplied by the caller via config.host / ACR_HOST.
//   Provider trust: 80 (governance default) — ACRCloud is a commercial
//     recognition engine, not a rights registry. Its isrc field is a
//     third-party best-guess tag, not a statutory source — same trust tier as
//     MusicBrainz, well below MLC's 95.
//
// Authentication guard: if accessKey, accessSecret, or host is absent,
// authenticate() returns AUTH_FAILED and acquire() returns empty contracts —
// AUTH_UNAVAILABLE, not a coverage gap.
//
// Authority: Royaltē Master Constitution — Phase 3.9 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }       from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }             from '../../health/healthStates.js';
import { createHealthSignal }      from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract }  from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }           from '../../trust/trustConfig.js';

import { buildSignedFields } from './acr-auth.js';
import { acrIdentify }       from './acr-http.js';
import { ACR_CAPABILITIES }  from './acr-capabilities.js';

export const PROVIDER_NAME        = 'acrcloud';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v1';

// Governance-set trust value. ACRCloud is a commercial audio-recognition
// engine — corroborating evidence, not a rights-registry source of truth.
const ACR_DEFAULT_TRUST = 80;

const IDENTIFY_PATH = '/v1/identify';

export class ACRCloudConnector extends ProviderConnector {
  #credentials = null;  // { accessKey, accessSecret, host }
  #fetchOpts   = null;  // shared HTTP options (fetchFn, timeoutMs, maxRetries)

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    const accessKey    = config.accessKey    ?? config.ACR_ACCESS_KEY    ?? null;
    const accessSecret = config.accessSecret ?? config.ACR_ACCESS_SECRET ?? null;
    const host         = config.host         ?? config.ACR_HOST         ?? null;

    if (!accessKey || !accessSecret || !host) {
      this.#credentials = null;
      this.#fetchOpts   = null;
      return;
    }

    this.#credentials = { accessKey, accessSecret, host };
    this.#fetchOpts   = {
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  // No network call: the Identify API has no login/token step. Every request
  // is independently HMAC-signed, so "authentication" here means "do we have
  // the three values required to sign a request" — not "did a login succeed."
  async authenticate() {
    if (!this.#credentials || !this.#fetchOpts) {
      return this.#authResult(HealthState.AUTH_FAILED, 'credentials missing');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      ACR_CAPABILITIES,
    });
  }

  // Lightweight connectivity + credential probe: signs and sends a minimal
  // Identify request with a near-empty sample. A "no match" (status.code
  // 1001) still proves the signature was accepted and the host is reachable —
  // it is treated as AVAILABLE, not an error. Only auth/transport failures
  // are reported as unhealthy.
  async reportHealth() {
    if (!this.#credentials) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no credentials — initialize() with accessKey/accessSecret/host first' });
    }

    const probeSample = Buffer.from([0]);
    const result = await this.#callIdentify('audio', probeSample, { maxRetries: 1 });

    if (result.health.state === HealthState.AVAILABLE || result.health.state === HealthState.PARTIAL_RESPONSE) {
      return createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME });
    }
    return result.health;
  }

  async acquire(evidenceRequest) {
    if (!this.#credentials) {
      return this.#emptyContract(evidenceRequest, HealthState.AUTH_FAILED, 'credentials missing');
    }

    const acquisitionId = randomUUID();
    const correlationId = evidenceRequest.context?.correlationId ?? randomUUID();
    const { subjectRef, evidenceType } = evidenceRequest;
    const result = await this.#dispatchAcquire(evidenceType, subjectRef);

    return this.#buildContract({ acquisitionId, correlationId, evidenceRequest, ...result });
  }

  getVersion() {
    return {
      provider:           PROVIDER_NAME,
      connectorVersion:   CONNECTOR_VERSION,
      providerApiVersion: PROVIDER_API_VERSION,
    };
  }

  async shutdown() {
    this.#credentials = null;
    this.#fetchOpts   = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.AUDIO_RECOGNITION:
        // subjectRef selects the input mode; both hit the same /v1/identify
        // endpoint with a different data_type — see acr-capabilities.js.
        // Precomputed fingerprint takes priority when both are present,
        // since it's the caller's more specific, bandwidth-cheaper intent.
        if (subjectRef?.fingerprint)  return this.#recognizeFingerprint(subjectRef);
        if (subjectRef?.audioSample)  return this.#recognizeAudio(subjectRef);
        return this.#missingRef('audioSample or fingerprint');

      default:
        return {
          payload:      null,
          rawText:      '',
          health:       createHealthSignal({
                          state:    HealthState.PARTIAL_RESPONSE,
                          provider: PROVIDER_NAME,
                          detail:   `evidence type "${evidenceType}" not supported by ${PROVIDER_NAME}`,
                        }),
          completeness: 'empty',
        };
    }
  }

  // ── Acquisition methods ─────────────────────────────────────────────────────

  // AUDIO_RECOGNITION (raw audio): identify a recording from an audio sample.
  // ACRCloud recommends samples under 15 seconds.
  async #recognizeAudio(subjectRef) {
    if (!subjectRef?.audioSample) return this.#missingRef('audioSample');
    return this.#callIdentify('audio', subjectRef.audioSample);
  }

  // AUDIO_RECOGNITION (precomputed fingerprint): identify a recording from a
  // fingerprint the caller already computed client-side — reduces bandwidth
  // versus sending raw audio, per ACRCloud's own guidance.
  async #recognizeFingerprint(subjectRef) {
    if (!subjectRef?.fingerprint) return this.#missingRef('fingerprint');
    return this.#callIdentify('fingerprint', subjectRef.fingerprint);
  }

  // ── HTTP helper — signs, sends, and classifies one Identify request ─────────

  async #callIdentify(dataType, sample, optsOverride = {}) {
    const { accessKey, accessSecret, host } = this.#credentials;
    const fields = buildSignedFields({ accessKey, accessSecret, dataType });
    const url    = `https://${host}${IDENTIFY_PATH}`;

    const result = await acrIdentify(url, fields, sample, { ...this.#fetchOpts, ...optsOverride });

    if (!result.ok) {
      return {
        payload:      result.acrStatusCode === 1001 ? result.data : null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({
                        state:    result.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME,
                        detail:   result.error ?? `ACRCloud status.code ${result.acrStatusCode}`,
                      }),
        completeness: 'empty',
      };
    }

    // status.code 0 (match) → full; status.code 1001 (no match) → empty,
    // but the raw envelope (including status.code itself) is still passed
    // through — "no match" is a definitive, well-formed answer, not missing data.
    const noMatch = result.acrStatusCode === 1001;

    return {
      payload:      result.data,
      rawText:      result.rawText,
      health:       createHealthSignal({
                      state:    noMatch ? HealthState.PARTIAL_RESPONSE : HealthState.AVAILABLE,
                      provider: PROVIDER_NAME,
                      detail:   noMatch ? 'no recognition result (ACRCloud status.code 1001)' : null,
                    }),
      completeness: noMatch ? 'empty' : 'full',
    };
  }

  // ── Evidence Contract assembly ────────────────────────────────────────────────

  #buildContract({ acquisitionId, correlationId, evidenceRequest, payload, rawText, health, completeness }) {
    return createEvidenceContract({
      acquisitionId,
      correlationId,
      requestId:            evidenceRequest.requestId,
      provider:             PROVIDER_NAME,
      providerVersion:      PROVIDER_API_VERSION,
      connectorVersion:     CONNECTOR_VERSION,
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? ACR_DEFAULT_TRUST,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:           new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:  computePayloadChecksum(payload),
      rawResponseHash:  computeRawResponseHash(rawText ?? ''),
    });
  }

  #emptyContract(evidenceRequest, state, detail) {
    const acquisitionId = randomUUID();
    const correlationId = evidenceRequest.context?.correlationId ?? randomUUID();
    return this.#buildContract({
      acquisitionId, correlationId, evidenceRequest,
      payload: null, rawText: '',
      health:       createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      completeness: 'empty',
    });
  }

  #authResult(state, detail) {
    return {
      health:      createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      credentials: this.#credentials ? { mode: 'hmac-sha1', value: '[redacted]' } : null,
    };
  }

  #missingRef(field) {
    return {
      payload:      null,
      rawText:      '',
      health:       createHealthSignal({
                      state:    HealthState.PARTIAL_RESPONSE,
                      provider: PROVIDER_NAME,
                      detail:   `subjectRef.${field} required for this evidence type`,
                    }),
      completeness: 'empty',
    };
  }
}
