// YouTubeConnector — Phase 3.6 (YouTube)
//
// Constitutional implementation of ProviderConnector for YouTube Data API v3.
// Mirrors the AppleMusicConnector pattern exactly — Phase 2.2 is the reference.
//
// Constitutional constraint: "What did YouTube return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// YouTube specifics:
//   • Auth: API key in query param (key={YOUTUBE_API_KEY})
//   • No OAuth required for public channel data
//   • Quota-based: 10,000 units/day free tier; search=100 units, channels=1 unit
//   • Provider trust: 85 (Google-verified; high quality for Official Artist Channel data)
//
// Authentication guard: if YOUTUBE_API_KEY absent, authenticate() returns AUTH_FAILED
// and acquire() returns empty contracts — AUTH_UNAVAILABLE, not a coverage gap.
//
// Capabilities:
//   ARTIST_IDENTITY  — search.list: identify Official Artist Channel by name
//   COLLECTION_DATA  — channels.list: statistics, snippet, topicDetails,
//                      brandingSettings, contentDetails
//
// Authority: Royaltē Master Constitution — Phase 3.6 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }       from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }             from '../../health/healthStates.js';
import { createHealthSignal }      from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract }  from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }           from '../../trust/trustConfig.js';

import { youtubeGet, YOUTUBE_API_BASE } from './youtube-http.js';
import { YOUTUBE_CAPABILITIES }         from './youtube-capabilities.js';

export const PROVIDER_NAME        = 'youtube';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v3';

// Governance-set trust value for YouTube.
// Google-verified Official Artist Channel data; authoritative identity signal.
const YOUTUBE_DEFAULT_TRUST = 85;

export class YouTubeConnector extends ProviderConnector {
  #config    = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    const apiKey = config.apiKey ?? config.YOUTUBE_API_KEY ?? null;

    if (!apiKey) {
      this.#config = null;
      return;
    }

    this.#config = {
      apiKey,
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
    };

    this.#fetchOpts = {
      apiKey,
      fetchFn:    this.#config.fetchFn,
      timeoutMs:  this.#config.timeoutMs,
      maxRetries: this.#config.maxRetries,
      baseUrl:    YOUTUBE_API_BASE,
    };
  }

  async authenticate() {
    if (!this.#config) {
      return this.#authResult(HealthState.AUTH_FAILED, 'API key missing or not initialized');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      YOUTUBE_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#fetchOpts) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'API key missing' });
    }
    // Lightweight health probe: single channel lookup for a known stable channel
    const result = await youtubeGet(
      '/channels?part=id&id=UCNIVS2qwAFBi7qCiTSdkQtg&maxResults=1',
      this.#fetchOpts
    );
    if (result.ok) {
      return createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME });
    }
    return createHealthSignal({
      state:    result.healthState ?? HealthState.MAINTENANCE,
      provider: PROVIDER_NAME,
      detail:   result.error ?? `HTTP ${result.status}`,
    });
  }

  async acquire(evidenceRequest) {
    if (!this.#config) {
      return this.#emptyContract(evidenceRequest, HealthState.AUTH_FAILED, 'API key missing');
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
    this.#config    = null;
    this.#fetchOpts = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
        return this.#fetchChannelIdentity(subjectRef);

      case Capability.COLLECTION_DATA:
        return this.#fetchChannelData(subjectRef);

      default:
        return {
          payload:      null,
          rawText:      '',
          health:       createHealthSignal({ state: HealthState.PARTIAL_RESPONSE, provider: PROVIDER_NAME,
                          detail: `evidence type "${evidenceType}" not supported by ${PROVIDER_NAME}` }),
          completeness: 'empty',
        };
    }
  }

  // ── Acquisition methods ─────────────────────────────────────────────────────

  // ARTIST_IDENTITY: search for Official Artist Channel by artist name.
  //   If channelId already known → lightweight search confirmation can be skipped;
  //   subjectRef.channelId triggers a direct channels.list snippet lookup.
  //   Otherwise → search.list?q={name}&type=channel&maxResults=10
  async #fetchChannelIdentity(subjectRef) {
    if (!subjectRef?.artistName && !subjectRef?.channelId) {
      return this.#missingRef('artistName or channelId');
    }

    if (subjectRef.channelId) {
      // Direct lookup via known channelId (e.g. from Identity Graph)
      return this.#get(
        `/channels?part=snippet&id=${encodeURIComponent(subjectRef.channelId)}&maxResults=1`
      );
    }

    const q = encodeURIComponent(subjectRef.artistName);
    return this.#get(`/search?part=snippet&q=${q}&type=channel&maxResults=10`);
  }

  // COLLECTION_DATA: full channel details — statistics, topic detection, branding.
  //   Requires subjectRef.channelId resolved from ARTIST_IDENTITY step.
  async #fetchChannelData(subjectRef) {
    if (!subjectRef?.channelId) return this.#missingRef('channelId');
    const id = encodeURIComponent(subjectRef.channelId);
    return this.#get(
      `/channels?part=snippet,statistics,topicDetails,brandingSettings,contentDetails&id=${id}&maxResults=1`
    );
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await youtubeGet(path, this.#fetchOpts ?? {});

    if (!result.ok) {
      return {
        payload:      null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({
                        state:    result.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME,
                        detail:   result.error ?? `HTTP ${result.status}`,
                      }),
        completeness: 'empty',
      };
    }

    const data     = result.data;
    const schemaOk = data !== null && typeof data === 'object';

    return {
      payload:      data,
      rawText:      result.rawText,
      health:       createHealthSignal({
                      state:    schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail:   schemaOk ? null : 'response body was not valid JSON object',
                    }),
      completeness: schemaOk ? 'full' : 'partial',
    };
  }

  // ── Evidence Contract assembly ───────────────────────────────────────────────

  #buildContract({ acquisitionId, correlationId, evidenceRequest, payload, rawText, health, completeness }) {
    return createEvidenceContract({
      acquisitionId,
      correlationId,
      requestId:            evidenceRequest.requestId,
      provider:             PROVIDER_NAME,
      providerVersion:      PROVIDER_API_VERSION,
      connectorVersion:     CONNECTOR_VERSION,
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? YOUTUBE_DEFAULT_TRUST,
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
      credentials: this.#config ? { apiKey: '[redacted]' } : null,
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
