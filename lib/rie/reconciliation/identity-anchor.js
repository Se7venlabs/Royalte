// RIE Layer 2 — Step 3: Reconcile — Identity Anchor Rule
//
// Constitutional authority: Royaltē Master Constitution v1.3 §3.6
// Board Decision 2026-07-01:
//   "Apple's role as identity anchor becomes an explicit, governed
//    reconciliation rule inside the RIE — not a wiring privilege."
//
// Apple Music is the Royaltē canonical identity anchor.
// Spotify is the verification and social metrics authority.
//
// This function is the governed implementation of that constitutional
// principle. It previously existed as implicit wiring in scan/product
// code. It now lives here, is explicitly named, and is testable.
//
// When multi-provider evidence is available, the fields resolved below
// follow documented provider authority. Any future change to which
// provider anchors identity requires an amendment to this file — not
// a search-and-replace across product code.
//
// Conflict resolution record is included in the returned object so
// downstream consumers (and the scanAuthority CIM object) can trace
// why a given value was chosen.

// applyIdentityAnchor
//
// providerEvidence: the raw provider evidence map from the acquisition
//   layer. In Phase 1 this is the AuditResponse platforms section.
//   Phase 2 will pass raw PAL adapter outputs.
//
// Returns a reconciled identity evidence object with an audit trail.
export function applyIdentityAnchor(providerEvidence) {
  const apple   = providerEvidence?.appleMusic   || {};
  const spotify = providerEvidence?.spotify       || {};

  // Apple anchors these fields (canonical identity authority)
  const canonicalName  = apple.artistName  || spotify.artistName || null;
  const artistId       = apple.artistId    || null;
  const primaryGenres  = apple.genres?.length ? apple.genres : (spotify.genres || []);
  const artworkUrl     = apple.artworkUrl  || null;
  const profileUrl     = apple.profileUrl  || spotify.profileUrl || null;

  // Spotify anchors these fields (social metrics authority)
  const followersCount = spotify.followers  ?? null;
  const popularity     = spotify.popularity ?? null;
  const spotifyId      = spotify.artistId   || null;
  const spotifyUrl     = spotify.profileUrl || null;

  return {
    canonicalName,
    artistId,
    spotifyId,
    primaryGenres,
    artworkUrl,
    followersCount,
    popularity,
    profileUrl,
    spotifyUrl,
    _anchor: {
      provider:  'apple',
      rule:      'identity-anchor-v1',
      authority: {
        canonicalName:  canonicalName  ? 'apple'   : 'none',
        artistId:       artistId       ? 'apple'   : 'none',
        primaryGenres:  primaryGenres.length ? (apple.genres?.length ? 'apple' : 'spotify') : 'none',
        followersCount: followersCount !== null ? 'spotify' : 'none',
        popularity:     popularity     !== null ? 'spotify' : 'none',
      },
    },
  };
}
