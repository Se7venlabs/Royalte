// ACRCloudAIDetectionConnector — Phase 5.0
//
// Constitutional implementation of ProviderConnector for ACRCloud's AI Music
// Detection product (File Scanning, engine 5).
// https://docs.acrcloud.com/faq/ai-music-detection
//
// Constitutional constraint: "Was this recording likely AI-generated?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence
// Contract. It NEVER communicates with any Royaltē product (Mission Control,
// Audit, ATHENA, etc.) and never converts ACRCloud's probabilities into a
// Royaltē judgment — that is ATHENA's responsibility, not this connector's.
//
// Completely separate from ACRCloudConnector (../acrcloud/), which answers
// "what recording is this?" via a different ACRCloud product (Identify API,
// HMAC-signed, synchronous single request). This connector uses File
// Scanning (Bearer-token console auth, asynchronous submit-and-poll).
//
// Provisioning dependency: requires a pre-existing File Scanning container
// configured with engine 5 (AI Music Detection). This connector does NOT
// create, configure, or delete containers — that is account provisioning,
// performed once outside the Provider Acquisition Layer, not a per-scan
// acquisition responsibility. If containerId/token/region are not all
// supplied, initialize() fails into a credential-less state — no implicit
// fallback, no partial-credential operation.
//
// Processing model: File Scanning is asynchronous. #submitAndPoll() submits
// the audio source, then polls the file-status endpoint within a bounded
// budget (interval × maxAttempts, capped by totalTimeoutMs). If the provider
// hasn't finished by the time the budget is exhausted, this connector
// returns a truthful TIMEOUT health state — never infinite polling — while
// preserving whatever the last provider response actually was.
//
// Live verification note: no ACRCloud credentials (Identify or File
// Scanning) exist in this environment. This connector is grounded in
// ACRCloud's official documentation (docs.acrcloud.com), verified live via
// direct fetch during design, not training-data assumptions — but has never
// been round-tripped against a real File Scanning container. See README.md
// "Known Limitations."
//
// Authority: Royaltē Master Constitution — Phase 5.0 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }       from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }             from '../../health/healthStates.js';
import { createHealthSignal }      from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract }  from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }           from '../../trust/trustConfig.js';

import { acrFsGet, acrFsSubmitFile } from './acr-ai-http.js';
import { ACR_AI_DETECTION_CAPABILITIES } from './acr-ai-capabilities.js';

export const PROVIDER_NAME        = 'acrcloud_ai_detection';
export const CONNECTOR_VERSION    = '1.0';
// ACRCloud's Console API family (File Scanning included) does not expose an
// explicit version segment in its endpoint paths, unlike the Identify API's
// /v1/identify. This is a nominal designation, not a provider-documented value.
export const PROVIDER_API_VERSION = 'v1';

const CONTAINER_HOST = 'https://api-v2.acrcloud.com'; // global — container CRUD/retrieve
const VALID_REGIONS   = Object.freeze(['eu-west-1', 'us-west-2', 'ap-southeast-1']);

// Governance-set trust value. Same provider/infrastructure as the sibling
// Audio Recognition connector (trust 80) — this reflects provider
// reliability, not per-detection model confidence, which is already carried
// per-item in the raw payload's ai_probability field.
const ACR_AI_DEFAULT_TRUST = 80;

// Bounded polling defaults — overridable via config. Never infinite.
const DEFAULT_POLL_INTERVAL_MS   = 2_000;
const DEFAULT_POLL_MAX_ATTEMPTS  = 10;
const DEFAULT_POLL_TIMEOUT_MS    = 30_000;

export class ACRCloudAIDetectionConnector extends ProviderConnector {
  #credentials = null; // { token, containerId, region }
  #fetchOpts   = null;
  #urls        = null; // { containerBase, filesBase }
  #pollConfig  = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    const token       = config.token       ?? config.ACR_FS_TOKEN        ?? null;
    const containerId = config.containerId ?? config.ACR_FS_CONTAINER_ID ?? null;
    const region       = config.region      ?? config.ACR_FS_REGION       ?? null;

    // All three required together — no implicit fallback for any of them.
    // A guessed-wrong region silently targets the wrong regional host and
    // every request would fail; a missing containerId has nothing to submit
    // to. Fail into a credential-less state rather than operate partially.
    if (!token || !containerId || !region || !VALID_REGIONS.includes(region)) {
      this.#credentials = null;
      this.#fetchOpts   = null;
      this.#urls        = null;
      this.#pollConfig  = null;
      return;
    }

    this.#credentials = { token, containerId, region };
    this.#fetchOpts   = {
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
    };
    this.#urls = {
      containerBase: CONTAINER_HOST,
      filesBase:     `https://api-${region}.acrcloud.com/api/fs-containers/${encodeURIComponent(containerId)}/files`,
    };
    this.#pollConfig = {
      intervalMs:     config.pollIntervalMs    ?? DEFAULT_POLL_INTERVAL_MS,
      maxAttempts:    config.pollMaxAttempts   ?? DEFAULT_POLL_MAX_ATTEMPTS,
      totalTimeoutMs: config.pollTotalTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
    };
  }

  // No login endpoint exists for File Scanning's Bearer token — it is a
  // static, console-generated credential. authenticate() confirms all
  // required configuration is present; real auth failures (bad token, wrong
  // container) only surface on the first real request, via 401/403.
  async authenticate() {
    if (!this.#credentials) {
      return this.#authResult(HealthState.AUTH_FAILED, 'token, containerId, and a valid region are all required');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      ACR_AI_DETECTION_CAPABILITIES,
    });
  }

  // Read-only container retrieval — verifies Bearer token validity and
  // container reachability without submitting any audio, per Board directive.
  async reportHealth() {
    if (!this.#credentials) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no credentials — initialize() with token/containerId/region first' });
    }

    const url    = `${this.#urls.containerBase}/api/fs-containers/${encodeURIComponent(this.#credentials.containerId)}`;
    const result = await acrFsGet(url, this.#credentials.token, { ...this.#fetchOpts, maxRetries: 1 });

    if (result.ok) {
      return createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME });
    }
    return createHealthSignal({
      state:    result.healthState ?? HealthState.UNAVAILABLE,
      provider: PROVIDER_NAME,
      detail:   result.error ?? `HTTP ${result.status}`,
    });
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
    this.#urls        = null;
    this.#pollConfig  = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.AI_MUSIC_DETECTION:
        return this.#submitAndPoll(subjectRef);

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

  // ── Acquisition ──────────────────────────────────────────────────────────────

  // Only input types whose full request AND response shape is verified
  // against ACRCloud's official documentation are implemented. ACRCloud's
  // docs also list "platforms" and "isrc" as valid data_type values, but do
  // not fully specify which field carries the reference value for those
  // modes — not implemented here per Board directive: do not claim support
  // for an input type until its behavior is verified, not guessed.
  #buildSubmission(subjectRef) {
    if (subjectRef?.audioSample) {
      return { fields: { data_type: 'audio', name: subjectRef.name ?? 'audio-sample' }, file: subjectRef.audioSample };
    }
    if (subjectRef?.fingerprint) {
      return { fields: { data_type: 'fingerprint', name: subjectRef.name ?? 'fingerprint-sample' }, file: subjectRef.fingerprint };
    }
    if (subjectRef?.audioUrl) {
      return { fields: { data_type: 'audio_url', url: subjectRef.audioUrl, name: subjectRef.name ?? subjectRef.audioUrl }, file: null };
    }
    return { error: 'audioSample, fingerprint, or audioUrl' };
  }

  // AI_MUSIC_DETECTION: submit the audio source to File Scanning, then poll
  // the file-status endpoint within a bounded budget. Never polls
  // indefinitely — returns TIMEOUT with the last known provider response
  // preserved if the budget is exhausted before the provider finishes.
  async #submitAndPoll(subjectRef) {
    const submission = this.#buildSubmission(subjectRef);
    if (submission.error) return this.#missingRef(submission.error);

    const submitResult = await acrFsSubmitFile(
      this.#urls.filesBase, this.#credentials.token, submission.fields, submission.file, this.#fetchOpts
    );

    if (!submitResult.ok) {
      return {
        payload:      null,
        rawText:      submitResult.rawText ?? '',
        health:       createHealthSignal({
                        state:    submitResult.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME,
                        detail:   submitResult.error ?? `HTTP ${submitResult.status}`,
                      }),
        completeness: 'empty',
      };
    }

    const fileId = submitResult.data?.id ?? null;
    if (!fileId) {
      return {
        payload:      submitResult.data,
        rawText:      submitResult.rawText,
        health:       createHealthSignal({
                        state:    HealthState.SCHEMA_CHANGED,
                        provider: PROVIDER_NAME,
                        detail:   'submission response did not include a file id',
                      }),
        completeness: 'partial',
      };
    }

    return this.#pollUntilResolved(fileId, submitResult);
  }

  async #pollUntilResolved(fileId, submitResult) {
    const { intervalMs, maxAttempts, totalTimeoutMs } = this.#pollConfig;
    const deadline  = Date.now() + totalTimeoutMs;
    const pollUrl   = `${this.#urls.filesBase}/${encodeURIComponent(fileId)}`;
    let lastResult  = submitResult;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() >= deadline) break;
      await sleep(intervalMs);

      const pollResult = await acrFsGet(pollUrl, this.#credentials.token, this.#fetchOpts);
      if (!pollResult.ok) {
        // Transient poll failure — keep the last good response and keep
        // trying within the remaining budget rather than failing outright.
        continue;
      }
      lastResult = pollResult;

      const state = pollResult.data?.state;
      if (state === 1) {
        return {
          payload:      pollResult.data,
          rawText:      pollResult.rawText,
          health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME }),
          completeness: 'full',
        };
      }
      if (state === -1) {
        return {
          payload:      pollResult.data,
          rawText:      pollResult.rawText,
          health:       createHealthSignal({
                          state:    HealthState.PARTIAL_RESPONSE,
                          provider: PROVIDER_NAME,
                          detail:   'provider reported a scan error (state -1)',
                        }),
          completeness: 'partial',
        };
      }
      // state === 0 (still processing) — loop continues within budget
    }

    // Budget exhausted — truthful TIMEOUT, preserving whatever the last
    // provider response actually was (never fabricated).
    return {
      payload:      lastResult.data ?? null,
      rawText:      lastResult.rawText ?? '',
      health:       createHealthSignal({
                      state:    HealthState.TIMEOUT,
                      provider: PROVIDER_NAME,
                      detail:   'polling budget exhausted before the provider completed processing',
                    }),
      completeness: 'partial',
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? ACR_AI_DEFAULT_TRUST,
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
      credentials: this.#credentials ? { mode: 'bearer', value: '[redacted]' } : null,
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
