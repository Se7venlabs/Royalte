// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Global Footprint Evidence™ — Normalization Assembler
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Board Option 3, Phase 2 Recovery, 2026-07-20):
//
//    Scan Engine
//        ↓
//    api/_lib/global-footprint-evidence.js  (Normalization — structural
//        ↓                                    relocation only)
//        ↓ Canonical Global Footprint Evidence: appleAvailability,
//        ↓   globalStorefrontAvailability (legacy fallback shape)
//    Global Music Footprint™ (business logic: status/confidence
//                              derivation, legacy fallback path)
//        ↓
//    Mission Control™ · Global Music Footprint Card
//
//  This module normalizes ONLY the two fields Global Music Footprint
//  still reads from canonicalForEnrichment: Apple's top-level
//  availability, and the legacy globalStorefrontAvailability shape
//  used solely as a fallback when the Territory Intelligence Engine™
//  has no output.
//
//  territoryIntelligence is explicitly OUT OF SCOPE for this module and
//  for the CIO-bypass finding this resolves. It is a separate, already-
//  correct parameter that reads raw PAL evidencePackages directly
//  (api/_lib/territory-intelligence.js) — a deliberate Board exception
//  documented in lib/rie/index.js since Phase 5.2, not a bypass pattern
//  to fix. Global Music Footprint's primary path (when Territory
//  Intelligence Engine output is present) does not use this evidence
//  object's globalStorefrontAvailability field at all; only the legacy
//  fallback path does.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      appleAvailability:            string,       // PLATFORM_AVAILABILITY value, defaults 'NOT_FOUND'
//      globalStorefrontAvailability: object|null,   // legacy shape: { available[], unavailable[], total }
//    }
// ─────────────────────────────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// assembleGlobalFootprintEvidence(canonical) — sole entrypoint. Never throws,
// including against a malformed input whose properties throw on access
// (e.g. a hostile getter) — matching the "never throws on any input"
// invariant every other assembler in this codebase upholds.
export function assembleGlobalFootprintEvidence(canonical) {
  try {
    const safe = (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) ? canonical : {};
    const appleMusic = safe.platforms?.appleMusic;
    const globalSf   = appleMusic?.details?.globalStorefrontAvailability;

    return deepFreeze({
      appleAvailability:            appleMusic?.availability ?? 'NOT_FOUND',
      globalStorefrontAvailability: (globalSf && typeof globalSf === 'object' && !Array.isArray(globalSf))
                                       ? globalSf
                                       : null,
    });
  } catch (err) {
    console.error('[global-footprint-evidence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({ appleAvailability: 'NOT_FOUND', globalStorefrontAvailability: null });
  }
}
