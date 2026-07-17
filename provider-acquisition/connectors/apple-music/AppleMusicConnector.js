// AppleMusicConnector — Phase 2.2
//
// Constitutional reference implementation of ProviderConnector for Apple Music.
// Every future provider connector follows this same engineering pattern.
//
// Constitutional constraint: "What did Apple Music say?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
// It NEVER communicates with any Royaltē product (Mission Control, Audit, etc.).
//
// Authority: Royaltē Master Constitution v1.3 — Phase 2.2 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }     from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }           from '../../health/healthStates.js';
import { createHealthSignal }    from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract } from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }         from '../../trust/trustConfig.js';

import { generateAppleToken }       from './apple-auth.js';
import { appleGet, APPLE_API_BASE } from './apple-http.js';
import { APPLE_MUSIC_CAPABILITIES } from './apple-capabilities.js';
// Phase 5.2 — storefront lists now sourced from the canonical territory
// vocabulary (Board decision: one canonical vocabulary, no per-file copies).
// Verified byte-identical to the prior local declaration before this
// migration — see Phase 5.2 completion report for the diff proof.
import { ALL_APPLE_STOREFRONTS, BIG6_STOREFRONTS } from '../../../lib/territory/canonical-territory-vocabulary.js';

export const PROVIDER_NAME        = 'apple_music';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v1';

const GLOBAL_SF_WAVE_SIZE = 50;

// Health probe — lightweight endpoint to verify API connectivity
const HEALTH_PROBE_PATH = '/storefronts/us';

export class AppleMusicConnector extends ProviderConnector {
  #config   = null;   // injected credentials + options
  #token    = null;   // current JWT
  #fetchOpts = null;  // http options forwarded to appleGet

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config) {
    const required = ['teamId', 'keyId', 'privateKey'];
    for (const key of required) {
      if (!config?.[key] && !config?.tokenGenerator) {
        throw new TypeError(`AppleMusicConnector.initialize: missing config.${key}`);
      }
    }

    this.#config = {
      teamId:           config.teamId ?? '',
      keyId:            config.keyId  ?? '',
      privateKey:       config.privateKey ?? '',
      defaultStorefront: config.defaultStorefront ?? 'us',
      // Dependency injection points for testing:
      tokenGenerator:   config.tokenGenerator ?? null,
      fetchFn:          config.fetchFn ?? globalThis.fetch,
      timeoutMs:        config.timeoutMs  ?? 10_000,
      maxRetries:       config.maxRetries ?? 3,
    };

    this.#fetchOpts = {
      fetchFn:    this.#config.fetchFn,
      timeoutMs:  this.#config.timeoutMs,
      maxRetries: this.#config.maxRetries,
      baseUrl:    APPLE_API_BASE,
    };
  }

  async authenticate() {
    if (!this.#config) {
      return this.#authResult(HealthState.AUTH_FAILED, 'not initialized', null);
    }

    try {
      const token = this.#mintToken();
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
      capabilities: APPLE_MUSIC_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#token) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no token — authenticate() required before reportHealth()' });
    }

    const result = await appleGet(HEALTH_PROBE_PATH, this.#token, {
      ...this.#fetchOpts,
      maxRetries: 1, // health probe: one retry only
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
    const sf = evidenceRequest.subjectRef?.storefront ?? this.#config?.defaultStorefront ?? 'us';

    if (!this.#token) {
      return this.#buildContract({
        acquisitionId, correlationId, evidenceRequest,
        payload:     null,
        rawText:     '',
        health:      createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
                       detail: 'not authenticated' }),
        completeness: 'empty',
      });
    }

    const { subjectRef, evidenceType } = evidenceRequest;
    const result = await this.#dispatchAcquire(evidenceType, subjectRef, sf);

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

  async #dispatchAcquire(evidenceType, subjectRef, sf) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
        return this.#fetchArtistIdentity(subjectRef, sf);

      case Capability.ALBUMS:
      case Capability.RELEASES:
        return this.#fetchArtistAlbums(subjectRef, sf);

      case Capability.TRACKS:
        return this.#fetchArtistTracks(subjectRef, sf);

      case Capability.ISRC:
        return this.#fetchByISRC(subjectRef, sf);

      case Capability.AVAILABILITY:
        // Global Music Footprint™ — all 167 storefronts, wave-based
        return this.#fetchGlobalStorefrontAvailability(subjectRef);

      case Capability.TERRITORIES:
        // BIG6 only — primary revenue markets
        return this.#fetchStorefrontAvailability(subjectRef, BIG6_STOREFRONTS);

      case Capability.ARTWORK:
        return this.#fetchArtwork(subjectRef, sf);

      case Capability.GENRES:
        return this.#fetchArtistIdentity(subjectRef, sf); // genres embedded in artist response

      case Capability.LABELS:
      case Capability.UPC:
        return this.#fetchAlbumData(subjectRef, sf);

      default:
        // Unsupported evidence type — PARTIAL_RESPONSE, empty payload
        return {
          payload:     null,
          rawText:     '',
          health:      createHealthSignal({ state: HealthState.PARTIAL_RESPONSE, provider: PROVIDER_NAME,
                         detail: `evidence type "${evidenceType}" not supported by ${PROVIDER_NAME}` }),
          completeness: 'empty',
        };
    }
  }

  // ── Acquisition methods — return raw Apple API response ─────────────────────

  async #fetchArtistIdentity(subjectRef, sf) {
    const path = subjectRef.appleArtistId
      ? `/catalog/${sf}/artists/${subjectRef.appleArtistId}`
      : subjectRef.artistName
        ? `/catalog/${sf}/search?term=${encodeURIComponent(subjectRef.artistName)}&types=artists&limit=5`
        : null;

    if (!path) return this.#missingRef('appleArtistId or artistName');
    return this.#get(path);
  }

  async #fetchArtistAlbums(subjectRef, sf) {
    if (!subjectRef.appleArtistId) return this.#missingRef('appleArtistId');
    return this.#get(`/catalog/${sf}/artists/${subjectRef.appleArtistId}/albums?limit=25`);
  }

  async #fetchArtistTracks(subjectRef, sf) {
    if (!subjectRef.appleArtistId) return this.#missingRef('appleArtistId');
    return this.#get(`/catalog/${sf}/artists/${subjectRef.appleArtistId}/songs?limit=25`);
  }

  async #fetchByISRC(subjectRef, sf) {
    if (!subjectRef.isrc) return this.#missingRef('isrc');
    return this.#get(`/catalog/${sf}/songs?filter[isrc]=${encodeURIComponent(subjectRef.isrc)}`);
  }

  async #fetchAlbumData(subjectRef, sf) {
    if (!subjectRef.appleAlbumId) return this.#missingRef('appleAlbumId');
    return this.#get(`/catalog/${sf}/albums/${subjectRef.appleAlbumId}`);
  }

  async #fetchArtwork(subjectRef, sf) {
    // Artwork is embedded in artist or album responses — fetch artist as the primary source
    return this.#fetchArtistIdentity(subjectRef, sf);
  }

  async #fetchStorefrontAvailability(subjectRef, storefronts) {
    if (!subjectRef.appleAlbumId) return this.#missingRef('appleAlbumId');

    // Fan out across storefronts in parallel; isolate each failure
    const idsParam = encodeURIComponent(subjectRef.appleAlbumId);
    const settled  = await Promise.allSettled(
      storefronts.map(sf =>
        appleGet(`/catalog/${sf}/albums?ids=${idsParam}`, this.#token, { ...this.#fetchOpts, maxRetries: 1 })
          .then(r => ({ sf, result: r }))
      )
    );

    const byStorefront = {};
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { sf, result } = s.value;
        byStorefront[sf] = result.ok ? result.data : { error: result.healthState };
      }
    }

    const payload  = { albumId: subjectRef.appleAlbumId, storefronts: byStorefront };
    const rawText  = JSON.stringify(payload);
    return {
      payload,
      rawText,
      health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME }),
      completeness: 'full',
    };
  }

  // Global Music Footprint™ availability — all 167 storefronts, wave-based fan-out.
  // AVAILABILITY evidence type. EvidenceBridge reads storefronts shape via storefrontIsAvailable().
  async #fetchGlobalStorefrontAvailability(subjectRef) {
    if (!subjectRef.appleAlbumId) return this.#missingRef('appleAlbumId');

    const idsParam = encodeURIComponent(subjectRef.appleAlbumId);
    const byStorefront = {};

    for (let i = 0; i < ALL_APPLE_STOREFRONTS.length; i += GLOBAL_SF_WAVE_SIZE) {
      const wave = ALL_APPLE_STOREFRONTS.slice(i, i + GLOBAL_SF_WAVE_SIZE);
      const settled = await Promise.allSettled(
        wave.map(sf =>
          appleGet(`/catalog/${sf}/albums?ids=${idsParam}`, this.#token, {
            ...this.#fetchOpts, maxRetries: 1,
          }).then(r => ({ sf, result: r }))
        )
      );
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          const { sf, result } = s.value;
          byStorefront[sf] = result.ok ? result.data : { error: result.healthState };
        }
      }
    }

    const payload = { albumId: subjectRef.appleAlbumId, storefronts: byStorefront };
    return {
      payload,
      rawText:      JSON.stringify(payload),
      health:       createHealthSignal({ state: HealthState.AVAILABLE, provider: PROVIDER_NAME }),
      completeness: 'full',
    };
  }

  // ── HTTP helper — wraps appleGet and classifies the response ─────────────────

  async #get(path) {
    const result = await appleGet(path, this.#token, this.#fetchOpts);

    if (!result.ok) {
      return {
        payload:     null,
        rawText:     result.rawText ?? '',
        health:      createHealthSignal({ state: result.healthState ?? HealthState.UNAVAILABLE,
                       provider: PROVIDER_NAME, detail: result.error ?? `HTTP ${result.status}` }),
        completeness: 'empty',
      };
    }

    // Detect schema changes: successful response but missing expected top-level structure
    const data        = result.data;
    const schemaOk    = data !== null && typeof data === 'object';
    const healthState = schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED;

    return {
      payload:     data,
      rawText:     result.rawText,
      health:      createHealthSignal({ state: healthState, provider: PROVIDER_NAME,
                     detail: schemaOk ? null : 'response body was not valid JSON object' }),
      completeness: schemaOk ? 'full' : 'partial',
    };
  }

  // ── Evidence Contract assembly ───────────────────────────────────────────────

  #buildContract({ acquisitionId, correlationId, evidenceRequest, payload, rawText, health, completeness }) {
    const version = this.getVersion();
    return createEvidenceContract({
      acquisitionId,
      correlationId,
      requestId:           evidenceRequest.requestId,
      provider:            PROVIDER_NAME,
      providerVersion:     PROVIDER_API_VERSION,
      connectorVersion:    CONNECTOR_VERSION,
      providerTrust:       getTrustValue(PROVIDER_NAME) ?? 100,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:          new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:     computePayloadChecksum(payload),
      rawResponseHash:     computeRawResponseHash(rawText ?? ''),
    });
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────────

  #mintToken() {
    if (this.#config.tokenGenerator) {
      return this.#config.tokenGenerator(this.#config);
    }
    return generateAppleToken({
      teamId:     this.#config.teamId,
      keyId:      this.#config.keyId,
      privateKey: this.#config.privateKey,
    });
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
      payload:     null,
      rawText:     '',
      health:      createHealthSignal({ state: HealthState.PARTIAL_RESPONSE, provider: PROVIDER_NAME,
                     detail: `subjectRef.${field} required for this evidence type` }),
      completeness: 'empty',
    };
  }
}
