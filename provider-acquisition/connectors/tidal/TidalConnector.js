// TidalConnector — Phase 4.0 TIDAL Connector™
//
// Constitutional implementation of ProviderConnector for TIDAL API v2.
// Mirrors the SpotifyConnector/DeezerConnector pattern — Phase 2.2 is the reference.
//
// Constitutional role: Independent Streaming Verification Authority™
//   TIDAL is a major streaming platform. Its evidence independently confirms
//   an artist's presence on a premium-tier streaming service and strengthens
//   the completeness of Royaltē's platform coverage intelligence.
//
// Constitutional constraint: "What did TIDAL return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
// It NEVER communicates with any Royaltē product (Mission Control, Audit, etc.).
//
// Authentication: OAuth 2.1 client credentials.
//   TIDAL_CLIENT_ID + TIDAL_CLIENT_SECRET env vars required.
//
// Acquisition flow (orchestrated by tidal-pal-acquisition.js):
//   A. ARTIST_IDENTITY — searchResults/{query}/relationships/artists (identity-lock by name)
//                        then /artists/{id}?include=profileArt for full detail + images
//   B. ALBUMS          — /artists/{id}/relationships/albums (requires tidalArtistId from A)
//   B. TRACKS          — /artists/{id}/relationships/tracks (collapseBy=FINGERPRINT required)
//
// TIDAL API v2 response format: JSON:API.
//   All responses carry `data` (ID references) + `included` (full attribute objects).
//   Attribute objects shape: { id, type, attributes: { name, popularity, ... } }
//
// VERIFIED API contract (2026-07-11):
//   Base:    https://openapi.tidal.com/v2
//   Search:  GET /searchResults/{query}/relationships/artists?countryCode=US&include=artists
//   Artist:  GET /artists/{id}?countryCode=US&include=profileArt
//   Albums:  GET /artists/{id}/relationships/albums?countryCode=US&include=albums
//   Tracks:  GET /artists/{id}/relationships/tracks?countryCode=US&collapseBy=FINGERPRINT&include=tracks
//
//   Black Alternative verified: id=4972312, 4 albums, 4 tracks, ISRC=QT6622698063 confirmed
//
// Provider trust: 85 — premium streaming platform with OAuth auth gate
//
// Authority: Royaltē Master Constitution — Phase 4.0 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }       from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }             from '../../health/healthStates.js';
import { createHealthSignal }      from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract }  from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }           from '../../trust/trustConfig.js';

import { getTidalClientToken }      from './tidal-auth.js';
import { tidalGet, TIDAL_API_BASE } from './tidal-http.js';
import { TIDAL_CAPABILITIES }       from './tidal-capabilities.js';

export const PROVIDER_NAME        = 'tidal';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v2';

const TIDAL_DEFAULT_TRUST = 85;
const DEFAULT_COUNTRY     = 'US';

// Identity-lock: normalize for exact name comparison
const norm = s => (s ?? '').toLowerCase().trim();

export class TidalConnector extends ProviderConnector {
  #config    = null;
  #token     = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config) {
    const hasCredentials   = config?.clientId && config?.clientSecret;
    const hasInjectedToken = !!config?.tokenGenerator;
    if (!hasCredentials && !hasInjectedToken) {
      throw new TypeError('TidalConnector.initialize: clientId + clientSecret required');
    }

    this.#config = {
      clientId:       config.clientId       ?? '',
      clientSecret:   config.clientSecret   ?? '',
      countryCode:    config.countryCode    ?? DEFAULT_COUNTRY,
      tokenGenerator: config.tokenGenerator ?? null,
      fetchFn:        config.fetchFn        ?? globalThis.fetch,
      timeoutMs:      config.timeoutMs      ?? 10_000,
      maxRetries:     config.maxRetries     ?? 3,
    };

    this.#fetchOpts = {
      fetchFn:    this.#config.fetchFn,
      timeoutMs:  this.#config.timeoutMs,
      maxRetries: this.#config.maxRetries,
      baseUrl:    TIDAL_API_BASE,
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
      capabilities:      TIDAL_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#token) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no token — authenticate() required before reportHealth()' });
    }
    // Lightweight probe: search for a known stable artist
    const query  = encodeURIComponent('Ed Sheeran');
    const cc     = encodeURIComponent(this.#config?.countryCode ?? DEFAULT_COUNTRY);
    const result = await tidalGet(
      `/searchResults/${query}/relationships/artists?countryCode=${cc}&include=artists`,
      this.#token,
      { ...this.#fetchOpts, maxRetries: 1 }
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

    if (!this.#token) {
      return this.#buildContract({
        acquisitionId, correlationId, evidenceRequest,
        payload: null, rawText: '',
        health:  createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
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
    this.#token     = null;
    this.#config    = null;
    this.#fetchOpts = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
      case Capability.ARTWORK:
        return this.#fetchArtistIdentity(subjectRef);

      case Capability.ALBUMS:
      case Capability.RELEASES:
        return this.#fetchArtistAlbums(subjectRef);

      case Capability.TRACKS:
      case Capability.ISRC:
        return this.#fetchArtistTracks(subjectRef);

      default:
        return {
          payload: null, rawText: '',
          health:  createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                     provider: PROVIDER_NAME,
                     detail:   `evidence type "${evidenceType}" not supported by ${PROVIDER_NAME}` }),
          completeness: 'empty',
        };
    }
  }

  // ── Acquisition methods ─────────────────────────────────────────────────────

  // ARTIST_IDENTITY: search by name (identity-lock), then fetch full detail with images.
  //
  // Step 1: GET /searchResults/{query}/relationships/artists?countryCode=US&include=artists
  //   Response: { data: [{ id, type }...], included: [{ id, type, attributes: { name, popularity, externalLinks } }...] }
  //   Identity-lock: exact name match in included[].attributes.name
  //
  // Step 2: GET /artists/{id}?countryCode=US&include=profileArt
  //   Response: { data: { id, type, attributes: { name, popularity, externalLinks } },
  //              included: [{ id, type (artworks), attributes: { files: [{ href, meta: { width, height } }...] } }...] }
  async #fetchArtistIdentity(subjectRef) {
    if (!subjectRef?.artistName && !subjectRef?.tidalArtistId) {
      return this.#missingRef('artistName or tidalArtistId');
    }

    // Direct path — artist ID already known
    if (subjectRef.tidalArtistId) {
      return this.#get(`/artists/${encodeURIComponent(subjectRef.tidalArtistId)}?countryCode=${this.#cc()}&include=profileArt`);
    }

    // Search path — identity-lock on exact artist name
    const query  = encodeURIComponent(subjectRef.artistName);
    const search = await tidalGet(
      `/searchResults/${query}/relationships/artists?countryCode=${this.#cc()}&include=artists`,
      this.#token,
      this.#fetchOpts
    );

    if (!search.ok) {
      return {
        payload: null, rawText: search.rawText ?? '',
        health:  createHealthSignal({ state: search.healthState ?? HealthState.UNAVAILABLE,
                   provider: PROVIDER_NAME, detail: search.error ?? `HTTP ${search.status}` }),
        completeness: 'empty',
      };
    }

    // Candidates are in included[].attributes — full objects returned when include=artists
    const included   = Array.isArray(search.data?.included) ? search.data.included : [];
    const candidates = included.filter(item => item?.type === 'artists');

    const match = candidates.find(a => norm(a.attributes?.name) === norm(subjectRef.artistName));
    if (!match) {
      return {
        payload: null, rawText: search.rawText ?? '',
        health:  createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                   provider: PROVIDER_NAME,
                   detail:   `identity-lock: no exact match for "${subjectRef.artistName}" among ${candidates.length} TIDAL candidates` }),
        completeness: 'empty',
      };
    }

    // Fetch full artist detail including profileArt
    const detail = await tidalGet(
      `/artists/${encodeURIComponent(match.id)}?countryCode=${this.#cc()}&include=profileArt`,
      this.#token,
      this.#fetchOpts
    );

    if (detail.ok && detail.data) {
      // Merge search-match attributes into the detail response payload
      // so downstream has all fields in one object
      const detailData = detail.data?.data ?? {};
      const payload    = {
        id:         detailData.id          ?? match.id,
        name:       detailData.attributes?.name        ?? match.attributes?.name,
        popularity: detailData.attributes?.popularity  ?? match.attributes?.popularity,
        url:        this.#extractUrl(detailData.attributes?.externalLinks ?? match.attributes?.externalLinks),
        images:     this.#extractImages(detail.data?.included ?? []),
      };
      return {
        payload,
        rawText:      detail.rawText,
        health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME }),
        completeness: 'full',
      };
    }

    // Fall back to search-match object if detail fetch fails
    const payload = {
      id:         match.id,
      name:       match.attributes?.name,
      popularity: match.attributes?.popularity,
      url:        this.#extractUrl(match.attributes?.externalLinks),
      images:     [],
    };
    return {
      payload,
      rawText:      search.rawText ?? '',
      health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME,
                      detail: 'using search result — artist detail fetch failed' }),
      completeness: 'partial',
    };
  }

  // ALBUMS: discography for a known TIDAL artist ID.
  // GET /artists/{id}/relationships/albums?countryCode=US&include=albums
  // Response: { data: [{ id, type }...], included: [{ id, type, attributes: { title, releaseDate, barcodeId } }...] }
  async #fetchArtistAlbums(subjectRef) {
    if (!subjectRef?.tidalArtistId) return this.#missingRef('tidalArtistId');
    return this.#get(
      `/artists/${encodeURIComponent(subjectRef.tidalArtistId)}/relationships/albums?countryCode=${this.#cc()}&include=albums`
    );
  }

  // TRACKS: tracks for a known TIDAL artist ID.
  // GET /artists/{id}/relationships/tracks?countryCode=US&collapseBy=FINGERPRINT&include=tracks
  // Response: { data: [{ id, type }...], included: [{ id, type, attributes: { title, isrc, duration, explicit } }...] }
  // NOTE: collapseBy=FINGERPRINT is required by the TIDAL API; omitting it returns HTTP 400.
  async #fetchArtistTracks(subjectRef) {
    if (!subjectRef?.tidalArtistId) return this.#missingRef('tidalArtistId');
    return this.#get(
      `/artists/${encodeURIComponent(subjectRef.tidalArtistId)}/relationships/tracks?countryCode=${this.#cc()}&collapseBy=FINGERPRINT&include=tracks`
    );
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await tidalGet(path, this.#token, this.#fetchOpts);
    if (!result.ok) {
      return {
        payload: null, rawText: result.rawText ?? '',
        health:  createHealthSignal({ state: result.healthState ?? HealthState.UNAVAILABLE,
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
                      detail:   schemaOk ? null : 'response body was not a valid JSON object' }),
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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? TIDAL_DEFAULT_TRUST,
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
    return getTidalClientToken(
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

  // ── Response helpers ──────────────────────────────────────────────────────────

  // Extract TIDAL browse URL from externalLinks array.
  // Shape: [{ href: 'https://tidal.com/browse/artist/...', meta: { type: 'TIDAL_SHARING' } }]
  #extractUrl(externalLinks) {
    if (!Array.isArray(externalLinks)) return null;
    return externalLinks.find(l => l.meta?.type === 'TIDAL_SHARING')?.href ?? externalLinks[0]?.href ?? null;
  }

  // Extract image URLs from an included artworks array.
  // Shape: [{ id, type: 'artworks', attributes: { files: [{ href, meta: { width, height } }...] } }]
  // Returns the largest image file href.
  #extractImages(included) {
    const artworks = included.filter(item => item?.type === 'artworks');
    const files    = artworks.flatMap(a => Array.isArray(a.attributes?.files) ? a.attributes.files : []);
    if (files.length === 0) return [];
    // Sort by width descending, return all files
    return files.sort((a, b) => (b.meta?.width ?? 0) - (a.meta?.width ?? 0));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  #cc() {
    return encodeURIComponent(this.#config?.countryCode ?? DEFAULT_COUNTRY);
  }

  #missingRef(field) {
    return {
      payload: null, rawText: '',
      health:  createHealthSignal({ state: HealthState.PARTIAL_RESPONSE,
                 provider: PROVIDER_NAME,
                 detail:   `subjectRef.${field} required for this evidence type` }),
      completeness: 'empty',
    };
  }
}
