// DeezerConnector — Phase 3.6 Provider Expansion 07
//
// Constitutional implementation of ProviderConnector for the Deezer Public API.
// Mirrors the SpotifyConnector/DiscogsConnector pattern — Phase 3.6 reference implementations.
//
// Constitutional role: Streaming Verification Authority™
//   Deezer is Royaltē's first independent streaming verification source.
//   Its evidence strengthens future resilience and enables Verification Intelligence™.
//
// Constitutional constraint: "What did Deezer return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// Authentication: Deezer's public API requires no credentials.
//   authenticate() confirms readiness without a network call.
//   No API key. No OAuth. No token refresh required.
//
// Acquisition flow (orchestrated by deezer-pal-acquisition.js):
//   A. ARTIST_IDENTITY — search by name (identity-lock), then fetch artist detail
//   B. ALBUMS          — fetch full discography (requires deezerArtistId from A)
//   B. TRACKS          — fetch top 50 tracks incl. ISRC (requires deezerArtistId from A)
//
// Provider trust: 80 — independent streaming authority (governance decision, never computed)
//
// Authority: Royaltē Master Constitution v1.3 — Phase 3.6 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }       from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }             from '../../health/healthStates.js';
import { createHealthSignal }      from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract }  from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }           from '../../trust/trustConfig.js';

import { deezerGet, DEEZER_API_BASE } from './deezer-http.js';
import { DEEZER_CAPABILITIES }        from './deezer-capabilities.js';

export const PROVIDER_NAME        = 'deezer';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v1';

// Governance-set trust value. Deezer is an independent streaming verification authority.
const DEEZER_DEFAULT_TRUST = 80;

// Identity-lock: normalise for exact name comparison
const norm = s => s.toLowerCase().trim();

export class DeezerConnector extends ProviderConnector {
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    this.#fetchOpts = {
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
      baseUrl:    DEEZER_API_BASE,
    };
  }

  // Deezer public API requires no credentials.
  // authenticate() confirms the connector is ready without a network call.
  async authenticate() {
    if (!this.#fetchOpts) {
      return this.#authResult(HealthState.AUTH_FAILED, 'not initialized — call initialize() first');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      DEEZER_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#fetchOpts) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'not initialized' });
    }
    // Lightweight probe: search for a known stable artist
    const result = await deezerGet('/search/artist?q=Ed+Sheeran&limit=1', {
      ...this.#fetchOpts, maxRetries: 1,
    });
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
    const acquisitionId = randomUUID();
    const correlationId = evidenceRequest.context?.correlationId ?? randomUUID();

    if (!this.#fetchOpts) {
      return this.#emptyContract(evidenceRequest, acquisitionId, correlationId,
        HealthState.AUTH_FAILED, 'not initialized');
    }

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
    this.#fetchOpts = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
      case Capability.GENRES:
      case Capability.ARTWORK:
        return this.#fetchArtistIdentity(subjectRef);

      case Capability.ALBUMS:
      case Capability.RELEASES:
        return this.#fetchArtistAlbums(subjectRef);

      case Capability.TRACKS:
      case Capability.ISRC:
        return this.#fetchArtistTopTracks(subjectRef);

      default:
        return {
          payload:      null,
          rawText:      '',
          health:       createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                          provider: PROVIDER_NAME,
                          detail:   `evidence type "${evidenceType}" not supported by ${PROVIDER_NAME}` }),
          completeness: 'empty',
        };
    }
  }

  // ── Acquisition methods ─────────────────────────────────────────────────────

  // ARTIST_IDENTITY: search + identity-lock + artist detail fetch
  //
  // If deezerArtistId is pre-known (from a prior ARTIST_IDENTITY call) it is used
  // directly. Otherwise, a search is performed and identity-lock applied.
  async #fetchArtistIdentity(subjectRef) {
    if (!subjectRef?.artistName && !subjectRef?.deezerArtistId) {
      return this.#missingRef('artistName or deezerArtistId');
    }

    // Direct path — artist ID already known
    if (subjectRef.deezerArtistId) {
      return this.#get(`/artist/${encodeURIComponent(subjectRef.deezerArtistId)}`);
    }

    // Search path — identity-lock on exact artist name
    const query  = encodeURIComponent(subjectRef.artistName);
    const search = await deezerGet(`/search/artist?q=${query}&limit=10`, this.#fetchOpts);

    if (!search.ok) {
      return {
        payload:      null,
        rawText:      search.rawText ?? '',
        health:       createHealthSignal({ state: search.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME, detail: search.error ?? `HTTP ${search.status}` }),
        completeness: 'empty',
      };
    }

    const candidates = Array.isArray(search.data?.data) ? search.data.data : [];
    const match = candidates.find(a => norm(a.name ?? '') === norm(subjectRef.artistName));

    if (!match) {
      return {
        payload:      null,
        rawText:      search.rawText ?? '',
        health:       createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                        provider: PROVIDER_NAME,
                        detail:   `identity-lock: no exact match for "${subjectRef.artistName}" among ${candidates.length} candidates` }),
        completeness: 'empty',
      };
    }

    // Fetch full artist detail
    return this.#get(`/artist/${encodeURIComponent(match.id)}`);
  }

  // ALBUMS: full discography for a known Deezer artist ID
  async #fetchArtistAlbums(subjectRef) {
    if (!subjectRef?.deezerArtistId) return this.#missingRef('deezerArtistId');
    return this.#get(`/artist/${encodeURIComponent(subjectRef.deezerArtistId)}/albums?limit=50`);
  }

  // TRACKS: top 50 tracks — includes isrc field per track where available
  async #fetchArtistTopTracks(subjectRef) {
    if (!subjectRef?.deezerArtistId) return this.#missingRef('deezerArtistId');
    return this.#get(`/artist/${encodeURIComponent(subjectRef.deezerArtistId)}/top?limit=50`);
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await deezerGet(path, this.#fetchOpts);

    if (!result.ok) {
      return {
        payload:      null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({ state: result.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME, detail: result.error ?? `HTTP ${result.status}` }),
        completeness: 'empty',
      };
    }

    const data     = result.data;
    const schemaOk = data !== null && typeof data === 'object';

    return {
      payload:      data,
      rawText:      result.rawText,
      health:       createHealthSignal({
                      state:  schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail: schemaOk ? null : 'response body was not a valid JSON object',
                    }),
      completeness: schemaOk ? 'full' : 'partial',
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? DEEZER_DEFAULT_TRUST,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:           new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:  computePayloadChecksum(payload),
      rawResponseHash:  computeRawResponseHash(rawText ?? ''),
    });
  }

  #emptyContract(evidenceRequest, acquisitionId, correlationId, state, detail) {
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
      credentials: null,   // Deezer has no credentials
    };
  }

  #missingRef(field) {
    return {
      payload:      null,
      rawText:      '',
      health:       createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                      provider: PROVIDER_NAME,
                      detail:   `subjectRef.${field} required for this evidence type` }),
      completeness: 'empty',
    };
  }
}
