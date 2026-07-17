// MusicBrainzConnector — Phase 3.8
//
// Constitutional implementation of ProviderConnector for MusicBrainz.
// Mirrors the AppleMusicConnector and SpotifyConnector patterns exactly.
// Phase 2.2 (Apple) is the constitutional reference implementation.
//
// Constitutional constraint: "What did MusicBrainz return?"
// This connector NEVER normalizes, reconciles, scores, interprets, or computes.
// It acquires raw evidence and packages it in the constitutional Evidence Contract.
//
// MusicBrainz specifics:
//   • No authentication — open API; User-Agent header required (see mb-http.js)
//   • authenticate() is a no-op that returns AVAILABLE immediately
//   • Rate limit: ~1 req/sec — handled by mb-http.js retry logic
//   • Provider trust: 80 (community-maintained; high quality, not commercial)
//
// Authority: Royaltē Master Constitution v1.3 — Phase 3.8 Board Authorization

import { randomUUID } from 'node:crypto';

import { ProviderConnector }      from '../../connector/ProviderConnector.js';
import { createCapabilityProfile } from '../../capability/CapabilityProfile.js';
import { Capability, VOCABULARY_VERSION } from '../../capability/capabilityVocabulary.js';
import { HealthState }            from '../../health/healthStates.js';
import { createHealthSignal }     from '../../health/ProviderHealthSignal.js';
import { createEvidenceContract } from '../../evidence/EvidenceContract.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../evidence/integrity.js';
import { getTrustValue }          from '../../trust/trustConfig.js';

import { mbGet, MB_API_BASE }    from './mb-http.js';
import { MB_CAPABILITIES }       from './mb-capabilities.js';

export const PROVIDER_NAME        = 'musicbrainz';
export const CONNECTOR_VERSION    = '1.0';
export const PROVIDER_API_VERSION = '2';

// MusicBrainz governance-set trust value (no credentials = community trust)
const MB_DEFAULT_TRUST = 80;

// ── Artist search exact-match normalization ───────────────────────────────────
const normName = s => (typeof s === 'string' ? s.toLowerCase().trim() : '');

export class MusicBrainzConnector extends ProviderConnector {
  #config    = null;
  #fetchOpts = null;

  // ── ProviderConnector interface ─────────────────────────────────────────────

  async initialize(config = {}) {
    // No credentials required. Config may carry optional fetch overrides for testing.
    this.#config = {
      userAgent: config.userAgent ?? null,
      fetchFn:   config.fetchFn   ?? globalThis.fetch,
      timeoutMs: config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
    };
    this.#fetchOpts = {
      fetchFn:    this.#config.fetchFn,
      timeoutMs:  this.#config.timeoutMs,
      maxRetries: this.#config.maxRetries,
      baseUrl:    MB_API_BASE,
      ...(this.#config.userAgent ? { userAgent: this.#config.userAgent } : {}),
    };
  }

  async authenticate() {
    // MusicBrainz requires no authentication.
    // Return AVAILABLE immediately — connector is always ready once initialized.
    if (!this.#config) {
      return this.#authResult(HealthState.AUTH_FAILED, 'not initialized');
    }
    return this.#authResult(HealthState.AVAILABLE, null);
  }

  async discoverCapabilities() {
    return createCapabilityProfile({
      vocabularyVersion: VOCABULARY_VERSION,
      capabilities:      MB_CAPABILITIES,
    });
  }

  async reportHealth() {
    // Health probe: lightweight endpoint that confirms API connectivity.
    const result = await mbGet('/artist?query=test&limit=1', this.#fetchOpts ?? {});
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
      return this.#buildContract({
        acquisitionId:   randomUUID(),
        correlationId:   evidenceRequest.context?.correlationId ?? randomUUID(),
        evidenceRequest,
        payload:         null,
        rawText:         '',
        health:          createHealthSignal({ state: HealthState.AUTH_FAILED, provider: PROVIDER_NAME,
                           detail: 'not initialized' }),
        completeness:    'empty',
      });
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

      case Capability.TRACKS:
        return this.#fetchRecordings(subjectRef);

      case Capability.RELEASES:
        return this.#fetchReleaseGroups(subjectRef);

      case Capability.ISRC:
        return this.#fetchByISRC(subjectRef);

      case Capability.PUBLISHING:
        return this.#fetchWorks(subjectRef);

      case Capability.SONGWRITERS:
        return this.#fetchWorkRelationships(subjectRef);

      case Capability.CONTRIBUTORS:
        return this.#fetchRecordingRelationships(subjectRef);

      case Capability.LABELS:
        return this.#fetchReleaseDetail(subjectRef);

      case Capability.SOCIAL_LINKS:
        return this.#fetchArtistRelationships(subjectRef);

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

  // ── Acquisition methods ───────────────────────────────────────────────────────

  // ARTIST_IDENTITY: if mbid present → direct lookup with aliases+tags
  //                  otherwise → fuzzy search by artist name (exact-match enforced)
  async #fetchArtistIdentity(subjectRef) {
    if (subjectRef?.mbid) {
      return this.#get(`/artist/${encodeURIComponent(subjectRef.mbid)}?inc=aliases+tags`);
    }
    if (!subjectRef?.artistName) return this.#missingRef('artistName or mbid');
    const query = encodeURIComponent(`artist:"${subjectRef.artistName}"`);
    return this.#get(`/artist?query=${query}&limit=5&inc=aliases+tags`);
  }

  // TRACKS: recordings by artist MBID with ISRCs
  // MusicBrainz: GET /recording?artist={mbid}&inc=isrcs&limit=100
  async #fetchRecordings(subjectRef) {
    if (!subjectRef?.mbid) return this.#missingRef('mbid');
    return this.#get(`/recording?artist=${encodeURIComponent(subjectRef.mbid)}&inc=isrcs&limit=100`);
  }

  // RELEASES: release groups by artist MBID
  // MusicBrainz: GET /release-group?artist={mbid}&type=album|single|ep&limit=50
  async #fetchReleaseGroups(subjectRef) {
    if (!subjectRef?.mbid) return this.#missingRef('mbid');
    return this.#get(
      `/release-group?artist=${encodeURIComponent(subjectRef.mbid)}&type=album|single|ep&limit=50`
    );
  }

  // ISRC: recording lookup by ISRC
  // MusicBrainz: GET /recording?isrc={isrc}
  async #fetchByISRC(subjectRef) {
    if (!subjectRef?.isrc) return this.#missingRef('isrc');
    return this.#get(`/recording?isrc=${encodeURIComponent(subjectRef.isrc)}`);
  }

  // WORKS: every work (composition) associated with the artist, via browse.
  // Reuses subjectRef.mbid already resolved via ARTIST_IDENTITY — no new
  // discovery. Each work already carries ISWC and PRO/CMO registration IDs
  // (ASCAP, SACEM, GEMA, JASRAC, etc.) in its attributes array.
  // MusicBrainz: GET /work?artist={mbid}&limit=100
  async #fetchWorks(subjectRef) {
    if (!subjectRef?.mbid) return this.#missingRef('mbid');
    return this.#get(`/work?artist=${encodeURIComponent(subjectRef.mbid)}&limit=100`);
  }

  // WORK RELATIONSHIPS: writer/composer/lyricist credits for a known work.
  // Reuses a work MBID already obtained from #fetchWorks — no new discovery.
  // MusicBrainz: GET /work/{mbid}?inc=artist-rels+work-rels+url-rels
  async #fetchWorkRelationships(subjectRef) {
    if (!subjectRef?.workMbid) return this.#missingRef('workMbid');
    return this.#get(
      `/work/${encodeURIComponent(subjectRef.workMbid)}?inc=artist-rels+work-rels+url-rels`
    );
  }

  // RECORDING RELATIONSHIPS: performer/producer/engineer credits for a known
  // recording. Reuses a recording MBID already obtained from
  // #fetchRecordings — no new discovery.
  // MusicBrainz: GET /recording/{mbid}?inc=artist-rels+work-rels
  async #fetchRecordingRelationships(subjectRef) {
    if (!subjectRef?.recordingMbid) return this.#missingRef('recordingMbid');
    return this.#get(
      `/recording/${encodeURIComponent(subjectRef.recordingMbid)}?inc=artist-rels+work-rels`
    );
  }

  // RELEASE DETAIL: complete release metadata for a known release MBID —
  // country, release events, labels, catalog number, barcode, language,
  // script, status, packaging, and any other field MusicBrainz returns.
  // MusicBrainz: GET /release/{mbid}?inc=labels
  async #fetchReleaseDetail(subjectRef) {
    if (!subjectRef?.releaseMbid) return this.#missingRef('releaseMbid');
    return this.#get(`/release/${encodeURIComponent(subjectRef.releaseMbid)}?inc=labels`);
  }

  // ARTIST RELATIONSHIPS: band members, associated artists, and URL
  // relationships (official site, Discogs, Wikidata, Bandcamp, social,
  // streaming links). Reuses subjectRef.mbid already resolved via
  // ARTIST_IDENTITY — no new discovery.
  // MusicBrainz: GET /artist/{mbid}?inc=artist-rels+url-rels
  async #fetchArtistRelationships(subjectRef) {
    if (!subjectRef?.mbid) return this.#missingRef('mbid');
    return this.#get(
      `/artist/${encodeURIComponent(subjectRef.mbid)}?inc=artist-rels+url-rels`
    );
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────────

  async #get(path) {
    const result = await mbGet(path, this.#fetchOpts ?? {});

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
      providerTrust:        getTrustValue(PROVIDER_NAME) ?? MB_DEFAULT_TRUST,
      capabilityProfileRef: VOCABULARY_VERSION,
      acquiredAt:           new Date().toISOString(),
      health,
      completeness,
      payload,
      payloadChecksum:  computePayloadChecksum(payload),
      rawResponseHash:  computeRawResponseHash(rawText ?? ''),
    });
  }

  // ── Auth result helper ────────────────────────────────────────────────────────

  #authResult(state, detail) {
    return {
      health:      createHealthSignal({ state, provider: PROVIDER_NAME, detail }),
      credentials: null,  // MusicBrainz: no credentials
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
