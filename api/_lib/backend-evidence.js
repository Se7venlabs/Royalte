// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Backend Evidence™ — Normalization Assembler
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position (Board Option 3, Phase 2 Recovery, 2026-07-20):
//
//    Scan Engine
//        ↓
//    api/_lib/backend-evidence.js  (Normalization — structural relocation only)
//        ↓ Canonical Backend Evidence: musicbrainzAvailability,
//        ↓   discogsAvailability, lastfmAvailability, scannedAt
//    Backend Intelligence™ (business logic: service labels, APIs
//                            Responding count, connectedCount, summaryLabel)
//        ↓
//    Mission Control™ · Backend Intelligence card
//
//  This module performs STRUCTURAL NORMALIZATION ONLY: relocates the
//  four backend-relevant fields out of provider-namespaced paths
//  (canonical.platforms.<provider>.availability, canonical.scannedAt)
//  into one flat, backend-domain-scoped object. It never resolves a
//  BACKEND_STATE value, never derives a label, never counts anything --
//  Backend Intelligence retains sole ownership of all of that.
//
//  Same pattern as api/_lib/catalog-evidence.js (Catalog Intelligence
//  recovery). A sibling canonical object, not a CIO section: the CIO
//  is unchanged, no business logic moves into it, and this module
//  does not become a second copy of provider payloads -- it carries
//  only the four scalar values this domain needs, nothing else.
//
//  MLC's state is deliberately NOT part of this evidence object --
//  Backend Intelligence reads it from the already-assembled Publishing
//  Intelligence domain object (publishingIntelligence.registrations.
//  mlcRegistration), which is correct composition (reading a downstream
//  intelligence object), not a canonical bypass.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      musicbrainzAvailability: string|null,  // PLATFORM_AVAILABILITY value
//      discogsAvailability:     string|null,
//      lastfmAvailability:      string|null,
//      scannedAt:                string|null,  // ISO timestamp
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

// assembleBackendEvidence(canonical) — sole entrypoint. Never throws.
export function assembleBackendEvidence(canonical) {
  const safe = (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) ? canonical : {};
  const platforms = safe.platforms;

  return deepFreeze({
    musicbrainzAvailability: platforms?.musicbrainz?.availability ?? null,
    discogsAvailability:     platforms?.discogs?.availability     ?? null,
    lastfmAvailability:      platforms?.lastfm?.availability      ?? null,
    scannedAt:                typeof safe.scannedAt === 'string' ? safe.scannedAt : null,
  });
}
