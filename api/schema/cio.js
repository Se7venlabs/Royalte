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
//  STAGE 3 NOTE — externalProfiles[].verified is hardcoded `true` in
//    api/_lib/cio-assembler.js (buildExternalProfileFromScan). It
//    represents profile existence only — provider returned data,
//    not artist-confirmed ownership. The true four-state mapping
//    (Verified / Action Required / Not Found / Unable to Confirm —
//    where AUTH_UNAVAILABLE → Unable to Confirm, never Not Found)
//    is NOT computed here. It lives in:
//      • api/rules/identity-rules.js   — provider-specific rules
//      • api/_lib/identity-intelligence.js — Identity Intelligence™
//                                            assembler (Phase 3B)
//    and reads from cio.observations.providers (NOT cio.identity).
//
// ─────────────────────────────────────────────────────────────────────
//  Royaltē CIO Observations™ — provider-availability section
//    (cio.observations sub-object — Phase 3B addition)
// ─────────────────────────────────────────────────────────────────────
//
//  Identity remains identity. Observations remain observations.
//
//  Constitutional ruling (Board, 2026-06-17, Phase 3 D2): provider
//  availability does NOT belong on cio.identity. The Identity Object
//  was locked LEAN in Phase 2B and stays that way. Per-provider scan
//  results live in a separate sibling section so the Rule Library and
//  the Identity Intelligence™ assembler can read them without
//  conflating identity-the-record with observations-of-providers.
//
//  Shape:
//
//    observations: {
//      providers: {
//        apple:   { availability, details } | null,
//        spotify: { availability, details } | null,
//        youtube: { availability, details } | null,
//      },
//    }
//
//  Field reference:
//
//    providers.<key>.availability : string
//      Mirrors PLATFORM_AVAILABILITY from api/schema/auditResponse.js:
//        'VERIFIED'         — provider returned a confirmed result
//        'NOT_FOUND'        — provider looked, found nothing
//        'AUTH_UNAVAILABLE' — provider API key/auth not available
//        'ERROR'            — provider call threw
//      MUST never be substituted (AUTH_UNAVAILABLE is never NOT_FOUND).
//
//    providers.<key>.details : object | null
//      Provider-specific normalised detail payload, mirrored from
//      scanPayload.platforms.<key>.details. Shape varies by provider
//      and is governed by api/schema/auditResponse.js — the CIO
//      schema does NOT redefine provider detail shapes.
//
//    providers.<key> = null
//      Means "no observation present in the scan payload." The
//      Identity Intelligence™ assembler treats this as
//      ⏳ Unable to Confirm — NEVER ❌ Not Found.
//
//  Reserved provider keys: only 'apple', 'spotify', 'youtube' are
//  populated in Phase 3. Amazon Music is deferred per Board D1 and
//  is intentionally NOT a key here — adding it now would imply a
//  scan ran when none did. Future Adapter Expansion Phase introduces
//  it; until then Amazon must not appear in this object.
//
//  Invariants:
//    1. The CIO Assembly Engine populates these entries by COPYING
//       from scanPayload.platforms.<key>; it never invents or
//       synthesises availability values.
//    2. Provider observations are independent of cio.identity. Rules
//       never read cio.identity.<provider-specific-field> as a proxy
//       for availability.
//    3. AUTH_UNAVAILABLE and ERROR resolve downstream to "Unable to
//       Confirm." They MUST NOT collapse to "Not Found." This is a
//       constitutional rule, enforced by the Identity Intelligence™
//       assembler and its test suite.
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
// Phase 6C — Canonical Catalog Model™ version constant. All consumers that
// need to verify the catalog model shape they're reading import this.
export const CIO_CATALOG_MODEL_VERSION = '1.0.0';

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

    // ── catalog ──────────────────────────────────────────────────────
    // Phase 4 legacy summary fields (preserved for backward compatibility):
    //   releasesCount, catalogAgeYears, catalogConfidence
    //
    // Phase 6C addition: a single reference to the Canonical Catalog Model™.
    // The CIO references catalog facts; it never duplicates them.
    // All new consumers read catalog facts from catalogModel directly.
    // "One Truth → Many Consumers" (Board directive 2026-06-20).
    catalog: {
      releasesCount:     null,
      catalogAgeYears:   null,
      catalogConfidence: CIO_CATALOG_CONFIDENCE,
      catalogModel:      null,              // Canonical Catalog Model™ reference | null
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

    // ── observations (per-provider availability; Board D2, Phase 3B
    //    + Phase 5B D3 publishingSources sibling) ─────────────────────
    //    See doc-block at top of file. Populated by the Assembly Engine
    //    by COPYING scanPayload.platforms.<key> (identity providers) and
    //    publishingSourceObservations (publishing data sources). null =
    //    no observation present → downstream resolves to Unable to
    //    Confirm, NEVER Not Found.
    //
    //    Per Phase 5B Board D3: provider observations live OUTSIDE
    //    cio.publishing (which stays lean — counts + references only).
    //    Publishing-source observations are recorded here as a sibling
    //    of providers so the constitutional separation is the same as
    //    Identity Intelligence™.
    observations: {
      providers: {
        apple:   null,                // { availability, details } | null
        spotify: null,                // { availability, details } | null
        youtube: null,                // { availability, details } | null
      },
      // Publishing source observations (Phase 5B Board D3). One entry
      // per publishing data backend that participated in this scan.
      // For v1.0 (Board D1) the only source is MLC. Future SOCAN /
      // ASCAP / BMI / CISAC / MusicBrainz Publishing adapters slot in
      // alongside without disturbing this shape.
      publishingSources: {
        mlc: null,                    // { availability, details } | null
      },
    },

    // ── Reserved sections (Phase 4 placeholders, no implementation) ─
    monitoring: { reserved: true },
    revenue:    { reserved: true },
  };
}
