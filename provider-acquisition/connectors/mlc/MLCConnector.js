// MLCConnector — Phase 3.6 (The MLC)
//
// Constitutional implementation of ProviderConnector for The MLC Public Search API.
// https://public-api.themlc.com/api/doc
//
// Constitutional constraint: "What did The MLC return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// MLC specifics:
//   Auth: POST /oauth/token (username + password) → idToken (Bearer JWT)
//   Token is per-session; re-acquired on each connector activation.
//   Provider trust: 95 — The MLC is the statutory US mechanical licensing authority.
//
// Authentication guard: if MLC_USERNAME or MLC_PASSWORD absent, authenticate()
// returns AUTH_FAILED and acquire() returns empty contracts — AUTH_UNAVAILABLE,
// not a coverage gap.
//
// Capabilities:
//   ISRC       — POST /search/recordings: recordings by artist/ISRC → mlcSongCodes
//                (API does not require auth; connector requires credentials to be set)
//   PUBLISHING — POST /works: full work details by mlcSongCode
//                (publishers, writers, ISWC, AKAs, artists)
//
// API field note — MLC casing inconsistency:
//   /search/recordings response uses `mlcsongCode` (lowercase 's')
//   /works request and response use `mlcSongCode` (uppercase 'S')
//   The connector surfaces the raw API shape; EvidenceBridge consumers handle this.
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

import { mlcPost, MLC_API_BASE } from './mlc-http.js';
import { MLC_CAPABILITIES }      from './mlc-capabilities.js';

export const PROVIDER_NAME        = 'mlc';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = 'v1';

// Governance-set trust value. The MLC is the statutory US mechanical licensing
// authority established under the Music Modernization Act — highest publishing trust.
const MLC_DEFAULT_TRUST = 95;

export class MLCConnector extends ProviderConnector {
  #credentials = null;  // { username, password }
  #fetchOpts   = null;  // shared HTTP options (no idToken — auth is per-session)
  #idToken     = null;  // JWT obtained during authenticate()

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    const username = config.username ?? config.MLC_USERNAME ?? null;
    const password = config.password ?? config.MLC_PASSWORD ?? null;

    if (!username || !password) {
      this.#credentials = null;
      this.#fetchOpts   = null;
      return;
    }

    this.#credentials = { username, password };
    this.#fetchOpts   = {
      fetchFn:    config.fetchFn   ?? globalThis.fetch,
      timeoutMs:  config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
      baseUrl:    MLC_API_BASE,
    };
    this.#idToken = null;
  }

  // authenticate() makes a real network call to obtain the MLC idToken.
  // Unlike other connectors where authenticate() is a local credential check,
  // MLC uses a username/password OAuth flow that requires a /oauth/token round-trip.
  async authenticate() {
    if (!this.#credentials || !this.#fetchOpts) {
      return this.#authResult(HealthState.AUTH_FAILED, 'username or password missing');
    }

    const result = await mlcPost('/oauth/token', {
      username: this.#credentials.username,
      password: this.#credentials.password,
    }, { ...this.#fetchOpts, idToken: null });

    if (!result.ok) {
      const state = result.healthState === 'AUTH_FAILED'
        ? HealthState.AUTH_FAILED
        : HealthState.UNAVAILABLE;
      return this.#authResult(state, result.error ?? `token fetch failed (HTTP ${result.status})`);
    }

    const idToken = result.data?.idToken ?? null;
    if (!idToken) {
      return this.#authResult(HealthState.AUTH_FAILED, 'token response missing idToken field');
    }

    this.#idToken = idToken;
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      MLC_CAPABILITIES,
    });
  }

  async reportHealth() {
    if (!this.#idToken) {
      return createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
        detail: 'no active session — call authenticate() first' });
    }
    // Lightweight health probe: search for a known stable recording
    const result = await mlcPost('/search/recordings', { artist: 'Ed Sheeran', title: 'Shape of You' },
      { ...this.#fetchOpts, idToken: this.#idToken });
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
    if (!this.#credentials) {
      return this.#emptyContract(evidenceRequest, HealthState.AUTH_FAILED, 'credentials missing');
    }
    if (!this.#idToken) {
      return this.#emptyContract(evidenceRequest, HealthState.AUTH_FAILED,
        'no active session — authenticate() must succeed before acquire()');
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
    this.#idToken     = null;
  }

  // ── Evidence dispatch ───────────────────────────────────���───────────────────

  async #dispatchAcquire(evidenceType, subjectRef) {
    switch (evidenceType) {
      case Capability.ISRC:
        return this.#fetchRecordings(subjectRef);

      case Capability.PUBLISHING:
        return this.#fetchWorks(subjectRef);

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

  // ISRC: POST /search/recordings
  //   Finds recordings registered with The MLC for this artist (or by ISRC).
  //   Returns raw Recording array: [{ id, title, artist, isrc, mlcsongCode, labels }]
  //   Note: mlcsongCode has lowercase 's' in the API response.
  //   Endpoint does not require auth per API spec, but connector requires active session.
  async #fetchRecordings(subjectRef) {
    if (!subjectRef?.artistName && !subjectRef?.isrc) {
      return this.#missingRef('artistName or isrc');
    }

    const body = {};
    if (subjectRef.artistName) body.artist = subjectRef.artistName;
    if (subjectRef.isrc)       body.isrc   = subjectRef.isrc;
    if (subjectRef.title)      body.title  = subjectRef.title;

    return this.#post('/search/recordings', body);
  }

  // PUBLISHING: POST /works
  //   Full work details for a list of MLC song codes.
  //   Request: [{ mlcsongCode }] — lowercase 's' in request body.
  //   Returns raw Work array: [{ primaryTitle, mlcSongCode, iswc, writers, publishers, akas, artists }]
  //   Note: mlcSongCode has uppercase 'S' in the response.
  async #fetchWorks(subjectRef) {
    const codes = Array.isArray(subjectRef?.mlcSongCodes) ? subjectRef.mlcSongCodes : [];
    if (codes.length === 0) return this.#missingRef('mlcSongCodes (non-empty array)');

    // API request uses lowercase mlcsongCode (matches /search/recordings response field)
    const body = codes.map(code => ({ mlcsongCode: code }));
    return this.#post('/works', body);
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #post(path, body) {
    const opts   = { ...this.#fetchOpts, idToken: this.#idToken };
    const result = await mlcPost(path, body, opts);

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
    const schemaOk = data !== null && (Array.isArray(data) || typeof data === 'object');

    return {
      payload:      data,
      rawText:      result.rawText,
      health:       createHealthSignal({
                      state:    schemaOk ? HealthState.AVAILABLE : HealthState.SCHEMA_CHANGED,
                      provider: PROVIDER_NAME,
                      detail:   schemaOk ? null : 'response body was not a valid JSON object or array',
                    }),
      completeness: schemaOk ? (Array.isArray(data) && data.length === 0 ? 'partial' : 'full') : 'partial',
    };
  }

  // ── Evidence Contract assembly ────────────────────────────��──────────────────

  #buildContract({ acquisitionId, correlationId, evidenceRequest, payload, rawText, health, completeness }) {
    return createEvidenceContract({
      acquisitionId,
      correlationId,
      requestId:            evidenceRequest.requestId,
      provider:             PROVIDER_NAME,
      providerVersion:      PROVIDER_API_VERSION,
      connectorVersion:     CONNECTOR_VERSION,
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? MLC_DEFAULT_TRUST,
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
      credentials: this.#credentials ? { username: '[redacted]' } : null,
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
