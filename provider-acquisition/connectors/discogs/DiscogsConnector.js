// DiscogsConnector — Phase 3.6
//
// Constitutional implementation of ProviderConnector for Discogs.
// Mirrors the AppleMusicConnector and SpotifyConnector patterns exactly.
// Phase 2.2 (Apple) is the constitutional reference implementation.
//
// Constitutional constraint: "What did Discogs return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// Discogs specifics:
//   • Auth: consumer key + secret in Authorization header (no OAuth token required for public data)
//   • User-Agent header required per Discogs ToS
//   • Rate limit: 240 req/min authenticated — 429 signals excess
//   • Provider trust: 75 (community-maintained; high quality for physical catalog)
//
// Authentication guard: if DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET are absent,
// authenticate() returns AUTH_FAILED and acquire() returns empty contracts.
// This preserves the constitutional AUTH_UNAVAILABLE semantic — missing credentials
// do not count as a coverage gap.
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

import { discogsGet, DISCOGS_API_BASE } from './discogs-http.js';
import { DISCOGS_CAPABILITIES }         from './discogs-capabilities.js';

export const PROVIDER_NAME        = 'discogs';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v2';

// Governance-set trust value for Discogs.
// Community-maintained; authoritative for physical catalog.
const DISCOGS_DEFAULT_TRUST = 75;

// Exact-name match normalization
const normName = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');

export class DiscogsConnector extends ProviderConnector {
  #config    = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    const key    = config.consumerKey    ?? config.DISCOGS_CONSUMER_KEY    ?? null;
    const secret = config.consumerSecret ?? config.DISCOGS_CONSUMER_SECRET ?? null;

    if (!key || !secret) {
      // Store null config; authenticate() will return AUTH_FAILED
      this.#config = null;
      return;
    }

    this.#config = {
      consumerKey:    key,
      consumerSecret: secret,
      userAgent:      config.userAgent ?? null,
      fetchFn:        config.fetchFn   ?? globalThis.fetch,
      timeoutMs:      config.timeoutMs ?? 15_000,
      maxRetries:     config.maxRetries ?? 3,
    };

    this.#fetchOpts = {
      consumerKey:    this.#config.consumerKey,
      consumerSecret: this.#config.consumerSecret,
      fetchFn:        this.#config.fetchFn,
      timeoutMs:      this.#config.timeoutMs,
      maxRetries:     this.#config.maxRetries,
      baseUrl:        DISCOGS_API_BASE,
      ...(this.#config.userAgent ? { userAgent: this.#config.userAgent } : {}),
    };
  }

  async authenticate() {
    if (!this.#config) {
      return this.#authResult(HealthState.AUTH_FAILED, 'credentials missing or not initialized');
    }
    // Discogs key+secret auth requires no token exchange — credentials are verified by HTTP call.
    // Treat initialized-with-credentials as AVAILABLE; first real request will surface 401 if bad.
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      DISCOGS_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#fetchOpts) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'credentials missing' });
    }
    const result = await discogsGet('/database/search?q=test&type=artist&per_page=1', this.#fetchOpts);
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
    this.#config    = null;
    this.#fetchOpts = null;
  }

  // ── Evidence dispatch ───────────────────────────────────────────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ARTIST_IDENTITY:
        return this.#fetchArtistIdentity(subjectRef);

      case Capability.RELEASES:
        return subjectRef?.discogsReleaseId
          ? this.#fetchReleaseDetail(subjectRef)
          : this.#fetchArtistReleases(subjectRef);

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

  // ARTIST_IDENTITY:
  //   If discogsArtistId present → GET /artists/{id} (full profile)
  //   Otherwise → GET /database/search?q={name}&type=artist&per_page=5 (identity-lock)
  async #fetchArtistIdentity(subjectRef) {
    if (subjectRef?.discogsArtistId) {
      return this.#get(`/artists/${encodeURIComponent(subjectRef.discogsArtistId)}`);
    }
    if (!subjectRef?.artistName) return this.#missingRef('artistName or discogsArtistId');
    const q = encodeURIComponent(subjectRef.artistName);
    return this.#get(`/database/search?q=${q}&type=artist&per_page=5`);
  }

  // RELEASES:
  //   GET /artists/{id}/releases?per_page=100&sort=year&sort_order=asc
  //   Requires discogsArtistId extracted from ARTIST_IDENTITY step.
  //   Returns all releases with embedded labels, formats, catalog numbers.
  async #fetchArtistReleases(subjectRef) {
    if (!subjectRef?.discogsArtistId) return this.#missingRef('discogsArtistId');
    const id = encodeURIComponent(subjectRef.discogsArtistId);
    return this.#get(`/artists/${id}/releases?per_page=100&sort=year&sort_order=asc`);
  }

  // RELEASE DETAIL: full release resource for a known Discogs release ID.
  // Reuses a release ID already obtained from #fetchArtistReleases — no new
  // artist-resolution workflow. Returns the raw release object unfiltered:
  // labels, formats, genres, styles, tracklist, country, released, notes,
  // images, videos, identifiers, companies, extraartists (credits),
  // community (want/have/rating), num_for_sale, lowest_price, master_id,
  // master_url, and any other field Discogs returns all pass through
  // untouched (constitutional constraint: this connector never selects or
  // normalizes fields).
  async #fetchReleaseDetail(subjectRef) {
    if (!subjectRef?.discogsReleaseId) return this.#missingRef('discogsReleaseId');
    return this.#get(`/releases/${encodeURIComponent(subjectRef.discogsReleaseId)}`);
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await discogsGet(path, this.#fetchOpts ?? {});

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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? DISCOGS_DEFAULT_TRUST,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:           new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:  computePayloadChecksum(payload),
      rawResponseHash:  computeRawResponseHash(rawText ?? ''),
    });
  }

  // ── Empty contract helper ────────────────────────────────────────────────────

  #emptyContract(evidenceRequest, state, detail) {
    const acquisitionId = randomUUID();
    const correlationId = evidenceRequest.context?.correlationId ?? randomUUID();
    return this.#buildContract({
      acquisitionId,
      correlationId,
      evidenceRequest,
      payload:      null,
      rawText:      '',
      health:       createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      completeness: 'empty',
    });
  }

  // ── Auth result helper ────────────────────────────────────────────────────────

  #authResult(state, detail) {
    return {
      health:      createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      credentials: this.#config ? { consumerKey: this.#config.consumerKey } : null,
    };
  }

  // ── Missing ref helper ────────────────────────────────────────────────────────

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
