// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Intelligence Object™ — Schema definition (Phase 4)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No assembly logic. No I/O. No mutation
//  of external state. The Assembly Engine lives at
//  api/_lib/cio-assembler.js.
//
// ─────────────────────────────────────────────────────────────────────
//  Royaltē Canonical Identity Object™ — authoritative schema
//    (cio.identity sub-object) — Source of Truth
// ─────────────────────────────────────────────────────────────────────
//
//  The Canonical Identity Object is the SINGLE place where Royaltē
//  records what is known about an artist's identity. Every downstream
//  surface — Intelligence Engine rules, Health Engine, Mission Control,
//  Executive Brief — reads identity FROM HERE, never from a provider
//  adapter directly. This sub-object IS the Royaltē Identity Object
//  referenced by the Constitution; constitution/CANONICAL_IDENTITY_OBJECT.md
//  is a pointer to this file.
//
//  Field reference (current Phase 1 / Stage 2B shape):
//
//    canonicalArtistName : string | null
//      Display-canonical artist name. Apple-resolved name wins when
//      input was an Apple URL (identity-lock 2026-06-05); otherwise
//      caller-provided or Spotify-derived. Set by the Assembly Engine.
//
//    externalProfiles : Array<{ provider, profileId, verified }>
//      Authoritative DSP profile references. One entry per provider
//      per profile ID. Today populated only from the scan's source
//      platform; future adapters APPEND, they never replace prior
//      entries (enrich-don't-replace rule).
//        provider  : 'spotify' | 'apple' | 'youtube' | ...
//        profileId : string  (Spotify/Apple/YouTube artist ID)
//        verified  : boolean  (see STAGE 3 FLAG below)
//
//    artistConfidence : 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
//      Confidence in the identity record as a whole. Default 'UNKNOWN'.
//      Real values arrive when the Phase 5 rule library promotes them.
//
//    appleUrl : string | null
//      Apple Music artist URL. Populated by the Assembly Engine from
//      scanPayload.platforms.appleMusic.details.artistUrl when the
//      Apple Adapter (api/_lib/identity/apple.js) found the artist —
//      regardless of whether the scan started from Spotify or Apple.
//
//    artwork : string | null
//      Apple Music artist artwork URL (600×600). Populated by the
//      Assembly Engine from scanPayload.platforms.appleMusic.details.artwork,
//      which is sourced from the Apple Adapter's artworkUrl. Apple is
//      the canonical artwork source.
//
//    storefront : string | null
//      Apple regional storefront code (e.g. 'us', 'gb', 'jp') the
//      Apple Adapter resolved against. Populated by the Assembly
//      Engine from scanPayload.source.storefront. Used by future
//      Apple lookups to maintain regional consistency.
//
//  Provider ownership (which adapter populates which field):
//    Apple Adapter (api/_lib/identity/apple.js):
//      → canonicalArtistName (when input is Apple)
//      → externalProfiles[provider='apple']
//      → appleUrl, artwork, storefront
//    Spotify resolution (in api/_lib/run-scan.js):
//      → canonicalArtistName (when input is Spotify)
//      → externalProfiles[provider='spotify']
//    Future YouTube / SoundCloud / etc. adapters:
//      → APPEND additional externalProfiles entries
//      → MAY add provider-specific fields in a future schema bump,
//        BUT MUST coexist with Apple fields, not replace them
//
//  Invariants (load-bearing — do not break):
//    1. ENRICH-DON'T-REPLACE — new provider data appends to
//       externalProfiles; never overwrites a prior entry.
//    2. SEPARATION — identity holds identity ONLY. No catalog data
//       (releasesCount, catalogAgeYears) and no publishing data
//       (worksCount, ISRC, IPI, royalteId) lives here. Those have
//       their own sections (cio.catalog, cio.publishing).
//    3. APPLE IS CANONICAL — when conflicts arise between Apple and
//       Spotify on identity fields, Apple wins.
//
//  STAGE 3 FLAG — externalProfiles[].verified is currently hardcoded
//    to `true` in api/_lib/cio-assembler.js (buildExternalProfileFromScan).
//    The real 4-state mapping (Verified / Action Required / Not Found /
//    Unable to Confirm — where AUTH_UNAVAILABLE → Unable to Confirm,
//    never Not Found) lives in Phase 5 rules under
//    api/rules/identity-rules.js. Stage 3 of Phase 1 wires the real
//    verification status through. Until then, treat verified=true as
//    "this provider returned data," not "the artist confirmed ownership."
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

    // ── identity (Royaltē Canonical Identity Object — see header) ──
    identity: {
      canonicalArtistName,
      externalProfiles: [],          // [{ provider, profileId, verified }]
      artistConfidence: CIO_ARTIST_CONFIDENCE,
      // Apple-canonical identity fields. Populated by the Assembly
      // Engine from the scan payload when the Apple Adapter resolved
      // the artist. null when Apple data is unavailable.
      appleUrl:   null,              // string | null  — Apple artist page URL
      artwork:    null,              // string | null  — 600x600 artwork URL
      storefront: null,              // string | null  — Apple regional storefront code
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
