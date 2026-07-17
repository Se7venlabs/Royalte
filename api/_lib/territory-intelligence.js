// ─────────────────────────────────────────────────────────────────────
//  Royaltē Territory Intelligence Engine™ — Phase 5.2
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    PAL Evidence Contracts (Capability.AVAILABILITY / Capability.TERRITORIES)
//        ↓
//    Territory Intelligence Engine™  ◀── THIS MODULE — sole authoritative
//        ↓                              source of territory intelligence
//    Global Music Footprint™ (consumer)
//        ↓
//    Mission Control™ · Global Music Footprint Card
//
//  Board-ratified architecture (Phase 5.2 Implementation Decree):
//    - PAL is the sole acquisition layer: this module consumes raw
//      EvidencePackage[] only, never calls a provider API, never
//      duplicates connector logic.
//    - Apple Music is the sole territory-acquisition provider for
//      Phase 5.2. The reconciliation policy below is provider-general
//      by design so a future phase can add Spotify/Deezer without
//      re-architecture — it operates over a generic "observations per
//      territory, per provider" shape, not an Apple-specific one.
//    - Five-state model (AVAILABLE / UNAVAILABLE / UNKNOWN /
//      NOT_EVALUATED / ERROR) with one binding invariant: missing
//      evidence, unsupported capability, provider omission, timeout, or
//      acquisition failure must NEVER be converted into UNAVAILABLE.
//
//  Purity invariants (same constitutional shape as every other RIE
//  assembler — assembleGlobalMusicFootprint, assembleCatalogIntelligence, etc.):
//    - Pure function of evidencePackages.
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//
// ─────────────────────────────────────────────────────────────────────

import { ALL_APPLE_STOREFRONTS, getCountryName, normalizeStorefrontCode }
  from '../../lib/territory/canonical-territory-vocabulary.js';
import { Capability } from '../../provider-acquisition/capability/capabilityVocabulary.js';

export const TERRITORY_INTELLIGENCE_VERSION = '1.0.0';

const APPLE_PROVIDER = 'apple_music';

// ── Five-state model (Board-ratified) ───────────────────────────────────────
export const TerritoryState = Object.freeze({
  AVAILABLE:     'AVAILABLE',
  UNAVAILABLE:   'UNAVAILABLE',
  UNKNOWN:       'UNKNOWN',
  NOT_EVALUATED: 'NOT_EVALUATED',
  ERROR:         'ERROR',
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// ── Evidence extraction (Apple-specific — the only provider wired in Phase 5.2) ──
//
// Finds the Apple Capability.AVAILABILITY (or Capability.TERRITORIES, treated
// interchangeably here exactly as EvidenceBridge.js's translateTerritories()
// already does) evidence package, and classifies each per-storefront raw
// result into a single-provider observation. Distinguishes a genuine,
// confirmed-empty catalog result (UNAVAILABLE) from a request-level failure
// (ERROR) — the raw payload shape is { storefronts: { [code]: { data: [...] } | { error } } }
// per AppleMusicConnector#fetchGlobalStorefrontAvailability.
function classifyAppleStorefrontResult(result) {
  if (result && typeof result === 'object' && 'error' in result) {
    return { state: TerritoryState.ERROR, reasonCode: 'provider_request_failed', detail: String(result.error ?? 'unknown error') };
  }
  if (Array.isArray(result?.data)) {
    return result.data.length > 0
      ? { state: TerritoryState.AVAILABLE, reasonCode: 'catalog_match_found', detail: null }
      : { state: TerritoryState.UNAVAILABLE, reasonCode: 'catalog_match_absent', detail: null };
  }
  return { state: TerritoryState.UNKNOWN, reasonCode: 'unrecognized_response_shape', detail: null };
}

// Returns Map<storefrontCode, observation> for Apple, or null if no Apple
// AVAILABILITY/TERRITORIES evidence package is present at all (distinct from
// the package being present but reporting a failure — see below).
function extractAppleObservations(evidencePackages) {
  if (!Array.isArray(evidencePackages)) return { observations: null, acquisitionFailed: false, acquiredAt: null };

  const pkg = evidencePackages.find(
    p => p?.evidenceType === Capability.AVAILABILITY || p?.evidenceType === Capability.TERRITORIES
  );
  if (!pkg) return { observations: null, acquisitionFailed: false, acquiredAt: null };

  const contract = pkg.contract;
  const acquiredAt = contract?.acquiredAt ?? null;

  // The whole acquisition attempt failed (e.g. AUTH_FAILED, TIMEOUT at the
  // capability level) — every territory should reflect ERROR (an attempt
  // was made and failed), not NOT_EVALUATED (which means no attempt at all).
  if (contract?.health?.state !== 'AVAILABLE' || !contract?.payload?.storefronts) {
    return { observations: null, acquisitionFailed: true, acquiredAt };
  }

  const observations = new Map();
  for (const [code, result] of Object.entries(contract.payload.storefronts)) {
    const classified = classifyAppleStorefrontResult(result);
    observations.set(normalizeStorefrontCode(code), {
      provider:   APPLE_PROVIDER,
      state:      classified.state,
      reasonCode: classified.reasonCode,
      detail:     classified.detail,
      acquiredAt,
      source:     'AppleMusicConnector#fetchGlobalStorefrontAvailability',
    });
  }
  return { observations, acquisitionFailed: false, acquiredAt };
}

// ── Provider-general reconciliation policy (Board Decision 2, verbatim) ──────
//
// observations: array of { provider, state, reasonCode, detail, acquiredAt, source }
// for a single territory, contributed by however many providers evaluated it
// (exactly one — Apple — in Phase 5.2; designed for more).
function reconcileTerritoryState(observations) {
  if (!observations || observations.length === 0) return TerritoryState.NOT_EVALUATED;

  // AVAILABLE: one or more providers positively confirm availability.
  if (observations.some(o => o.state === TerritoryState.AVAILABLE)) return TerritoryState.AVAILABLE;

  // UNKNOWN takes precedence over a partial UNAVAILABLE consensus: if any
  // applicable provider's evidence is itself unsupported/incomplete/
  // unevaluated, the aggregate cannot honestly claim unavailability.
  if (observations.some(o => o.state === TerritoryState.UNKNOWN)) return TerritoryState.UNKNOWN;

  // UNAVAILABLE: every applicable AND successfully-evaluated provider
  // (i.e. excluding ERROR/timeout providers, which did not produce a valid
  // answer) positively confirms unavailability, and none confirm availability.
  const evaluated = observations.filter(
    o => o.state === TerritoryState.AVAILABLE || o.state === TerritoryState.UNAVAILABLE
  );
  if (evaluated.length > 0 && evaluated.every(o => o.state === TerritoryState.UNAVAILABLE)) {
    return TerritoryState.UNAVAILABLE;
  }

  // ERROR: evaluation failed and no other valid evidence established a result.
  if (observations.some(o => o.state === TerritoryState.ERROR)) return TerritoryState.ERROR;

  return TerritoryState.NOT_EVALUATED;
}

function deriveConfidence(state, observationCount) {
  if (state === TerritoryState.AVAILABLE || state === TerritoryState.UNAVAILABLE) {
    return observationCount > 1 ? 'Verified' : 'Partial';
  }
  return 'Unknown';
}

/**
 * Territory Intelligence Engine™ — reconciles per-territory evidence from
 * PAL evidence packages into one canonical, five-state territory model.
 *
 * @param {Array} evidencePackages — raw PAL EvidencePackage[] (same shape
 *   passed to every other RIE assembler). Apple-sourced only in Phase 5.2.
 * @returns {object} deep-frozen territory intelligence report
 */
export function assembleTerritoryIntelligence(evidencePackages) {
  try {
    const { observations: appleObservations, acquisitionFailed } = extractAppleObservations(evidencePackages);

    const territories = ALL_APPLE_STOREFRONTS.map(code => {
      let obsForTerritory;
      if (acquisitionFailed) {
        // Whole-capability failure: every territory reflects a failed attempt.
        obsForTerritory = [{
          provider: APPLE_PROVIDER, state: TerritoryState.ERROR,
          reasonCode: 'capability_acquisition_failed', detail: null,
          acquiredAt: null, source: 'AppleMusicConnector#fetchGlobalStorefrontAvailability',
        }];
      } else if (appleObservations) {
        const obs = appleObservations.get(code);
        obsForTerritory = obs ? [obs] : []; // absent from payload → NOT_EVALUATED for this code
      } else {
        obsForTerritory = []; // no Apple evidence package at all → NOT_EVALUATED
      }

      const state = reconcileTerritoryState(obsForTerritory);
      return {
        code,
        name: getCountryName(code),
        state,
        confidence: deriveConfidence(state, obsForTerritory.length),
        evidence: obsForTerritory,
      };
    });

    const summary = {
      available:    territories.filter(t => t.state === TerritoryState.AVAILABLE).length,
      unavailable:  territories.filter(t => t.state === TerritoryState.UNAVAILABLE).length,
      unknown:      territories.filter(t => t.state === TerritoryState.UNKNOWN).length,
      notEvaluated: territories.filter(t => t.state === TerritoryState.NOT_EVALUATED).length,
      error:        territories.filter(t => t.state === TerritoryState.ERROR).length,
    };

    return deepFreeze({
      _version: TERRITORY_INTELLIGENCE_VERSION,
      generatedAt: new Date().toISOString(),
      totalTerritoriesEvaluated: territories.length,
      providersContributing: acquisitionFailed || !appleObservations ? [] : [APPLE_PROVIDER],
      summary,
      territories,
    });
  } catch (err) {
    console.error('[territory-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      _version: TERRITORY_INTELLIGENCE_VERSION,
      generatedAt: new Date().toISOString(),
      totalTerritoriesEvaluated: 0,
      providersContributing: [],
      summary: { available: 0, unavailable: 0, unknown: 0, notEvaluated: 0, error: 0 },
      territories: [],
    });
  }
}
