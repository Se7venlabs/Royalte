// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Intelligence Object™ — Schema definition (Phase 4)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No assembly logic. No I/O. No mutation
//  of external state. The Assembly Engine lives at
//  api/_lib/cio-assembler.js.
//
//  Constitutional anchors:
//    - Canonical Payload V2 (constitution/CANONICAL_PAYLOAD_V2.md)
//      remains the wire format every external product consumes.
//      The CIO is Royaltē's INTERNAL intelligence object — never sent
//      on the wire in Phase 4.
//    - The Identity Graph owns relationships. The CIO summarises and
//      exposes intelligence; it must never duplicate graph storage.
//      Phase 4 sections therefore carry COUNTS and REFERENCES
//      (royalteId, writerIPI) — not embedded CompositionNode or
//      PublishingWork objects.
//
//  Phase 4 scope (Board-ratified, reduced from the original proposal):
//    Implemented sections:  identity · publishing · catalog · metadata · sources
//    Reserved sections:     monitoring · revenue   ({ reserved: true } only)
//    Envelope:              cioVersion · generatedAt · confidence
//
//  Phase 4 invariants (locked):
//    - confidence = 'UNKNOWN' on every freshly assembled CIO.
//    - Reserved sections expose ONLY { reserved: true }. No real fields.
//    - All count fields start at 0; all reference arrays start empty;
//      coverage/confidence aggregates start null or 'UNKNOWN'.
//    - The CIO becomes immutable once the Assembly Engine returns it
//      (deep-frozen). This file ships the unfrozen empty shell so the
//      Assembly Engine can populate it; the freeze happens at the
//      assembler boundary, not here.
// ─────────────────────────────────────────────────────────────────────

export const CIO_VERSION               = '1.0.0';
export const CIO_CONFIDENCE            = 'UNKNOWN';
export const CIO_ARTIST_CONFIDENCE     = 'UNKNOWN';
export const CIO_PUBLISHING_CONFIDENCE = 'UNKNOWN';
export const CIO_CATALOG_CONFIDENCE    = 'UNKNOWN';
export const CIO_METADATA_CONFIDENCE   = 'UNKNOWN';

// emptyCio: returns a freshly-constructed blank CIO shell with every
// required section present and every field at its locked Phase 4
// default. The returned object is mutable — the Assembly Engine
// populates it during a single pass, then deep-freezes the result.
// External callers should not mutate the shell directly; if you need a
// CIO, call assembleCio() and receive a frozen one.
export function emptyCio(artistName) {
  const canonicalArtistName =
    (typeof artistName === 'string' && artistName.trim() !== '')
      ? artistName.trim()
      : null;

  return {
    cioVersion:  CIO_VERSION,
    generatedAt: new Date().toISOString(),
    confidence:  CIO_CONFIDENCE,

    // ── identity (summary — what Royaltē knows about who this is) ──
    identity: {
      canonicalArtistName,
      externalProfiles: [],          // [{ provider, profileId, verified }]
      artistConfidence: CIO_ARTIST_CONFIDENCE,
    },

    // ── publishing (summary — COUNTS + REFERENCES; never embedded
    //    PublishingWork or CompositionNode objects, per Board rule
    //    "Identity Graph owns relationships; CIO owns intelligence") ─
    publishing: {
      worksCount:           0,
      workRoyalteIds:       [],      // string[]   (references into the graph)
      writerCount:          0,
      writerIPIs:           [],      // string[]   (canonical writer identifiers)
      publisherCount:       0,
      publishingConfidence: CIO_PUBLISHING_CONFIDENCE,
    },

    // ── catalog (summary — top-level counts derived from the scan) ──
    catalog: {
      releasesCount:     null,
      catalogAgeYears:   null,
      catalogConfidence: CIO_CATALOG_CONFIDENCE,
    },

    // ── metadata (summary — flag count only in Phase 4) ────────────
    metadata: {
      flagCount:          0,
      metadataConfidence: CIO_METADATA_CONFIDENCE,
    },

    // ── sources (append-only attribution; every observation logged) ─
    sources: {
      sources: [],                   // [{ provider, confidence, observedAt, rawReference }]
    },

    // ── Reserved sections (Phase 4 placeholders, no implementation) ─
    monitoring: { reserved: true },
    revenue:    { reserved: true },
  };
}
