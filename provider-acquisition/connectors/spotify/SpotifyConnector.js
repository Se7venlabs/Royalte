// SpotifyConnector — Phase 3.6
//
// Constitutional implementation of ProviderConnector for Spotify.
// Mirrors the AppleMusicConnector pattern exactly — Phase 2.2 is the reference.
//
// Constitutional constraint: "What did Spotify say?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
// It NEVER communicates with any Royaltē product (Mission Control, Audit, etc.).
//
// Authority: Royaltē Master Constitution v1.3 — Phase 3.6 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }      from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }            from '../../health/healthStates.js';
import { createHealthSignal }     from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract } from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }          from '../../trust/trustConfig.js';

import { getSpotifyClientToken }         from './spotify-auth.js';
import { spotifyGet, SPOTIFY_API_BASE }  from './spotify-http.js';
import { SPOTIFY_CAPABILITIES }          from './spotify-capabilities.js';

export const PROVIDER_NAME        = 'spotify';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v1';

// Health probe — lightweight endpoint to verify API connectivity.
// /markets requires an elevated API access tier and returns 403 under
// standard Development Mode client-credentials apps (live-verified 2026-07-17)
// — a known-stable track lookup works under every access tier instead.
const HEALTH_PROBE_PATH = '/tracks/7qiZfU4dY1lWllzX7mPBI3'; // "Shape of You" — Ed Sheeran

export class SpotifyConnector extends ProviderConnector {
  #config    = null;
  #token     = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config) {
    const hasCredentials = config?.clientId && config?.clientSecret;
    const hasInjectedToken = !!config?.tokenGenerator;
    if (!hasCredentials && !hasInjectedToken) {
      throw new TypeError('SpotifyConnector.initialize: clientId + clientSecret required');
    }

    this.#config = {
      clientId:      config.clientId      ?? '',
      clientSecret:  config.clientSecret  ?? '',
      market:        config.market        ?? 'US',
      tokenGenerator: config.tokenGenerator ?? null,
      fetchFn:       config.fetchFn       ?? globalThis.fetch,
      timeoutMs:     config.timeoutMs     ?? 10_000,
      maxRetries:    config.maxRetries    ?? 3,
    };

    this.#fetchOpts = {
      fetchFn:    this.#config.fetchFn,
      timeoutMs:  this.#config.timeoutMs,
      maxRetries: this.#config.maxRetries,
      baseUrl:    SPOTIFY_API_BASE,
    };
  }

  async authenticate() {
    if (!this.#config) {
      return this.#authResult(HealthState.AUTH_FAILED, 'not initialized', null);
    }

    try {
      const token = await this.#acquireToken();
      this.#token = token;
      return this.#authResult(HealthState.AVAILABLE, null, token);
    } catch (err) {
      this.#token = null;
      return this.#authResult(HealthState.AUTH_FAILED, err.message, null);
    }
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      SPOTIFY_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#token) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no token — authenticate() required before reportHealth()' });
    }

    const result = await spotifyGet(HEALTH_PROBE_PATH, this.#token, {
      ...this.#fetchOpts,
      maxRetries: 1,
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

    if (!this.#token) {
      return this.#buildContract({
        acquisitionId, correlationId, evidenceRequest,
        payload:      null,
        rawText:      '',
        health:       createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
                        detail: 'not authenticated' }),
        completeness: 'empty',
      });
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
    this.#token    = null;
    this.#config   = null;
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
        return this.#fetchArtistTopTracks(subjectRef);

      case Capability.ISRC:
        return this.#fetchByISRC(subjectRef);

      case Capability.AVAILABILITY:
        return this.#fetchAvailability(subjectRef);

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

  // ── Acquisition methods — return raw Spotify API response ────────────────────

  async #fetchArtistIdentity(subjectRef) {
    if (!subjectRef.spotifyArtistId) return this.#missingRef('spotifyArtistId');
    return this.#get(`/artists/${subjectRef.spotifyArtistId}`);
  }

  async #fetchArtistAlbums(subjectRef) {
    if (!subjectRef.spotifyArtistId) return this.#missingRef('spotifyArtistId');
    const market = encodeURIComponent(subjectRef.market ?? this.#config?.market ?? 'US');
    return this.#get(
      `/artists/${subjectRef.spotifyArtistId}/albums?limit=50&include_groups=album,single,appears_on&market=${market}`
    );
  }

  async #fetchArtistTopTracks(subjectRef) {
    if (!subjectRef.spotifyArtistId) return this.#missingRef('spotifyArtistId');
    const market = encodeURIComponent(subjectRef.market ?? this.#config?.market ?? 'US');
    return this.#get(`/artists/${subjectRef.spotifyArtistId}/top-tracks?market=${market}`);
  }

  async #fetchByISRC(subjectRef) {
    if (!subjectRef.isrc) return this.#missingRef('isrc');
    return this.#get(
      `/search?q=isrc:${encodeURIComponent(subjectRef.isrc)}&type=track&limit=1`
    );
  }

  // AVAILABILITY: per-market playback check via the market query param.
  // Spotify removed the bulk available_markets field from track/album
  // responses (live-verified 2026-07-17: absent from both /tracks/{id} and
  // /albums/{id} under Development Mode client-credentials access; /markets
  // itself returns 403). ?market={code} still works and returns is_playable
  // for that single market — one country per call, same shape as TIDAL's
  // existing AVAILABILITY implementation in this PAL. This connector does
  // not synthesize or reconstruct a bulk list; it returns exactly what
  // Spotify's current API exposes.
  async #fetchAvailability(subjectRef) {
    if (!subjectRef?.market) return this.#missingRef('market');
    const market = encodeURIComponent(subjectRef.market);

    if (subjectRef.spotifyTrackId) {
      return this.#get(`/tracks/${encodeURIComponent(subjectRef.spotifyTrackId)}?market=${market}`);
    }
    if (subjectRef.spotifyAlbumId) {
      return this.#get(`/albums/${encodeURIComponent(subjectRef.spotifyAlbumId)}?market=${market}`);
    }
    return this.#missingRef('spotifyTrackId or spotifyAlbumId');
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await spotifyGet(path, this.#token, this.#fetchOpts);

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
      health:       createHealthSignal({ state: schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail:   schemaOk ? null : 'response body was not valid JSON object' }),
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? 90,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:           new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:  computePayloadChecksum(payload),
      rawResponseHash:  computeRawResponseHash(rawText ?? ''),
    });
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────────

  async #acquireToken() {
    if (this.#config.tokenGenerator) {
      return this.#config.tokenGenerator(this.#config);
    }
    return getSpotifyClientToken(
      { clientId: this.#config.clientId, clientSecret: this.#config.clientSecret },
      this.#config.fetchFn
    );
  }

  #authResult(state, detail, token) {
    return {
      health:      createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      credentials: token ? { token } : null,
    };
  }

  // ── Partial-result helper ────────────────────────────────────────────────────

  #missingRef(field) {
    return {
      payload:      null,
      rawText:      '',
      health:       createHealthSignal({ state: HealthState.PARTIAL_RESPONSE, provider: PROVIDER_NAME,
                      detail: `subjectRef.${field} required for this evidence type` }),
      completeness: 'empty',
    };
  }
}
