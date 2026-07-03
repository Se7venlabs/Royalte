// LastFmConnector — Phase 3.6 Provider Expansion 09
//
// Constitutional implementation of ProviderConnector for Last.fm.
//
// Constitutional role: Community Intelligence Authority™
//   Last.fm provides community evidence: listener counts, play counts,
//   community tags, similar artists, top tracks, top albums, and artist
//   biography. This evidence is constitutionally distinct from commercial
//   streaming (Apple Music, Spotify, Deezer) — it represents community
//   listening behavior, not commercial streaming totals.
//
// Constitutional constraint: "What did Last.fm return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// Community evidence remains independent. Last.fm listeners ≠ streaming plays.
// Future Community Intelligence™ will consume this evidence.
//
// Authentication: API key passed as query parameter.
//   initialize({ apiKey }) stores the key.
//   authenticate() validates the key is present; returns AUTH_FAILED if missing.
//   AUTH_FAILED for missing key is NOT a coverage gap — credentials are not configured.
//
// Acquisition flow (orchestrated by lastfm-pal-acquisition.js):
//   A. ARTIST_IDENTITY — artist.getinfo (soft identity-lock; preserves full response)
//      (same response also carries PERFORMANCE_DATA, GENRES, ARTWORK)
//   B. TRACKS + ALBUMS (parallel) — artist.gettoptracks, artist.gettopalbums
//
// Provider trust: 75 — well-established community music database; community-maintained,
//   not commercial/official source.
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

import { lastfmGet, LASTFM_API_BASE } from './lastfm-http.js';
import { LASTFM_CAPABILITIES }         from './lastfm-capabilities.js';

export const PROVIDER_NAME        = 'lastfm';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v2';  // Last.fm API v2.0

// Governance-set trust value. Last.fm is a community music database.
const LASTFM_DEFAULT_TRUST = 75;

// Soft identity-lock: normalise for case-insensitive name comparison.
// Last.fm returns a single artist per request; if name differs significantly,
// flag as PARTIAL_RESPONSE but preserve raw evidence (do not discard).
const norm = s => (s ?? '').toLowerCase().trim();

export class LastFmConnector extends ProviderConnector {
  #apiKey    = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    this.#apiKey = config.apiKey ?? null;
    this.#fetchOpts = {
      apiKey:     this.#apiKey,
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 10_000,
      maxRetries: config.maxRetries ?? 3,
      baseUrl:    LASTFM_API_BASE,
    };
  }

  // API key required. AUTH_FAILED if key is not configured.
  // AUTH_FAILED for missing key is NOT a coverage gap — it means credentials are not provisioned.
  // The HealthState enum uses AUTH_FAILED for both rejected credentials and missing credentials.
  async authenticate() {
    if (!this.#fetchOpts) {
      return this.#authResult(HealthState.AUTH_FAILED, 'not initialized — call initialize() first');
    }
    if (!this.#apiKey) {
      return this.#authResult(HealthState.AUTH_FAILED, 'LASTFM_API_KEY not configured');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      LASTFM_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#fetchOpts) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'not initialized' });
    }
    if (!this.#apiKey) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'LASTFM_API_KEY not configured' });
    }
    const result = await lastfmGet('artist.getinfo',
      { artist: 'Ed Sheeran' },
      { ...this.#fetchOpts, maxRetries: 1 },
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
    const acquisitionId = randomUUID();
    const correlationId = evidenceRequest.context?.correlationId ?? randomUUID();

    if (!this.#fetchOpts) {
      return this.#emptyContract(evidenceRequest, acquisitionId, correlationId,
        HealthState.AUTH_FAILED, 'not initialized');
    }
    if (!this.#apiKey) {
      return this.#emptyContract(evidenceRequest, acquisitionId, correlationId,
        HealthState.AUTH_FAILED, 'LASTFM_API_KEY not configured');
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
    this.#apiKey    = null;
    this.#fetchOpts = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
      case Capability.PERFORMANCE_DATA:
      case Capability.GENRES:
      case Capability.ARTWORK:
        return this.#fetchArtistInfo(subjectRef);

      case Capability.TRACKS:
        return this.#fetchTopTracks(subjectRef);

      case Capability.ALBUMS:
        return this.#fetchTopAlbums(subjectRef);

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

  // ARTIST_IDENTITY: artist.getinfo — returns full artist object.
  // Contains: name, url, stats (listeners/playcount), tags, similar artists, bio, images.
  // Soft identity-lock: if returned name differs from requested, marks PARTIAL_RESPONSE
  // but preserves raw evidence (Last.fm may return corrected capitalization).
  async #fetchArtistInfo(subjectRef) {
    if (!subjectRef?.artistName) return this.#missingRef('artistName');

    const result = await lastfmGet(
      'artist.getinfo',
      { artist: subjectRef.artistName },
      this.#fetchOpts,
    );

    if (!result.ok) {
      return {
        payload:      null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({ state: result.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME, detail: result.error ?? `HTTP ${result.status}` }),
        completeness: 'empty',
      };
    }

    const artist = result.data?.artist;
    if (!artist || typeof artist !== 'object') {
      return {
        payload:      null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({ state: HealthState.SCHEMA_CHANGED,
                        provider: PROVIDER_NAME, detail: 'artist.getinfo response missing artist object' }),
        completeness: 'empty',
      };
    }

    // Soft identity-lock — preserve evidence even on name mismatch (capitalization differences common)
    const nameMatches = norm(artist.name) === norm(subjectRef.artistName);
    const health = nameMatches
      ? createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME })
      : createHealthSignal({ state: HealthState.PARTIAL_RESPONSE, provider: PROVIDER_NAME,
          detail: `soft identity-lock: returned "${artist.name}" for requested "${subjectRef.artistName}" — evidence preserved` });

    return {
      payload:      artist,
      rawText:      result.rawText,
      health,
      completeness: 'full',
    };
  }

  // TRACKS: artist.gettoptracks — top 10 tracks with individual play counts.
  async #fetchTopTracks(subjectRef) {
    if (!subjectRef?.artistName) return this.#missingRef('artistName');
    const result = await lastfmGet(
      'artist.gettoptracks',
      { artist: subjectRef.artistName, limit: '10' },
      this.#fetchOpts,
    );
    return this.#wrapResult(result, r => r.data?.toptracks);
  }

  // ALBUMS: artist.gettopalbums — top 10 albums with play counts.
  async #fetchTopAlbums(subjectRef) {
    if (!subjectRef?.artistName) return this.#missingRef('artistName');
    const result = await lastfmGet(
      'artist.gettopalbums',
      { artist: subjectRef.artistName, limit: '10' },
      this.#fetchOpts,
    );
    return this.#wrapResult(result, r => r.data?.topalbums);
  }

  // ── HTTP result wrapper ───────────────────────────────────────────────────────

  #wrapResult(result, payloadExtract) {
    if (!result.ok) {
      return {
        payload:      null,
        rawText:      result.rawText ?? '',
        health:       createHealthSignal({ state: result.healthState ?? HealthState.UNAVAILABLE,
                        provider: PROVIDER_NAME, detail: result.error ?? `HTTP ${result.status}` }),
        completeness: 'empty',
      };
    }

    const payload  = payloadExtract(result);
    const schemaOk = payload !== null && payload !== undefined && typeof payload === 'object';

    return {
      payload:      payload ?? null,
      rawText:      result.rawText,
      health:       createHealthSignal({
                      state:    schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail:   schemaOk ? null : 'unexpected response shape',
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? LASTFM_DEFAULT_TRUST,
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
      credentials: { apiKey: this.#apiKey ? '[configured]' : null },
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
