// AudioDBConnector — Phase 3.6 Provider Expansion 08
//
// Constitutional implementation of ProviderConnector for TheAudioDB.
// Mirrors the DeezerConnector pattern — credential-free public API.
//
// Constitutional role: Artist & Media Intelligence Authority™
//   TheAudioDB provides rich artist presentation evidence: biographies, logos,
//   artwork, fan art, banners, social links, discography, and music videos.
//   This evidence enriches future Artist Intelligence™ and Brand Intelligence™.
//
// Constitutional constraint: "What did TheAudioDB return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// Authentication: TheAudioDB public API (key '2') requires no credentials.
//   authenticate() confirms readiness without a network call.
//
// API key note: The path prefix '/api/v1/json/2/' embeds the public API key ('2').
//   This is TheAudioDB's free-tier access pattern — no separate Authorization header.
//
// Acquisition flow (orchestrated by audiodb-pal-acquisition.js):
//   A. ARTIST_IDENTITY — search by name (identity-lock) → full artist object
//      (includes artwork, genres, social links — all from same search.php response)
//   B. COLLECTION_DATA — artist discography
//   B. VIDEOS          — music videos (parallel with B; requires audiodbArtistId from A)
//
// Provider trust: 70 — community-maintained media database; high value for artist
//   presentation evidence; not a primary business-authority source.
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

import { audiodbGet, AUDIODB_API_BASE } from './audiodb-http.js';
import { AUDIODB_CAPABILITIES }         from './audiodb-capabilities.js';

export const PROVIDER_NAME        = 'audiodb';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v2';  // TheAudioDB free public API key path prefix

// Governance-set trust value. TheAudioDB is a community-maintained media database.
const AUDIODB_DEFAULT_TRUST = 70;

// Identity-lock: normalise for exact name comparison
const norm = s => (s ?? '').toLowerCase().trim();

export class AudioDBConnector extends ProviderConnector {
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    this.#fetchOpts = {
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
      baseUrl:    AUDIODB_API_BASE,
      userAgent:  config.userAgent ?? 'RoyalteAudit/1.0 (audit@royalte.ai)',
    };
  }

  // TheAudioDB public API requires no credentials.
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
      capabilities:      AUDIODB_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#fetchOpts) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'not initialized' });
    }
    const result = await audiodbGet('/search.php?s=Ed+Sheeran', {
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
      case Capability.ARTWORK:
      case Capability.GENRES:
      case Capability.SOCIAL_LINKS:
        return this.#fetchArtistProfile(subjectRef);

      case Capability.COLLECTION_DATA:
        return this.#fetchDiscography(subjectRef);

      case Capability.VIDEOS:
        return this.#fetchMusicVideos(subjectRef);

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

  // ARTIST_IDENTITY: search by name + identity-lock on exact strArtist match.
  // Payload: the matched artist object (full — biography, artwork, social, genres, etc.).
  async #fetchArtistProfile(subjectRef) {
    if (!subjectRef?.artistName && !subjectRef?.audiodbArtistId) {
      return this.#missingRef('artistName or audiodbArtistId');
    }

    // Direct path — artist ID already known
    if (subjectRef.audiodbArtistId) {
      return this.#get(`/artist.php?i=${encodeURIComponent(subjectRef.audiodbArtistId)}`);
    }

    // Search path — identity-lock on exact strArtist name
    const query  = encodeURIComponent(subjectRef.artistName);
    const search = await audiodbGet(`/search.php?s=${query}`, this.#fetchOpts);

    if (!search.ok) {
      return {
        payload:      null,
        rawText:      search.rawText ?? '',
        health:       createHealthSignal({ state: search.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME, detail: search.error ?? `HTTP ${search.status}` }),
        completeness: 'empty',
      };
    }

    const candidates = Array.isArray(search.data?.artists) ? search.data.artists : [];
    const match = candidates.find(a => norm(a.strArtist) === norm(subjectRef.artistName));

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

    // Return the matched artist object as the payload (already full from search.php)
    const rawText = search.rawText ?? '';
    return {
      payload:      match,
      rawText,
      health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME }),
      completeness: 'full',
    };
  }

  // COLLECTION_DATA: artist discography — requires artist name (search-based endpoint)
  async #fetchDiscography(subjectRef) {
    if (!subjectRef?.artistName) return this.#missingRef('artistName');
    const query = encodeURIComponent(subjectRef.artistName);
    return this.#get(`/discography.php?s=${query}`);
  }

  // VIDEOS: music videos by artist ID
  async #fetchMusicVideos(subjectRef) {
    if (!subjectRef?.audiodbArtistId) return this.#missingRef('audiodbArtistId');
    return this.#get(`/mvid.php?i=${encodeURIComponent(subjectRef.audiodbArtistId)}`);
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await audiodbGet(path, this.#fetchOpts);

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
                      state:    schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail:   schemaOk ? null : 'response body was not a valid JSON object',
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? AUDIODB_DEFAULT_TRUST,
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
      credentials: null,   // TheAudioDB free API has no credentials
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
