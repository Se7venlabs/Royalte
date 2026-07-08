// ─────────────────────────────────────────────────────────────────────
//  Royaltē Best Verified Release™ Selection Engine  (v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    assembleCatalogIntelligence()
//        ↓ platforms.appleMusic.details.albums[]
//    selectBestVerifiedRelease()  ◀── THIS MODULE
//        ↓ bestVerifiedRelease
//    Catalog Intelligence output
//        ↓
//    Mission Control™ · Best Verified Release™ card
//
//  Purity invariants:
//    - Pure function of (albums, artistName).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - Never imports from platform-specific modules.
//    - Board-locked scoring weights MUST NOT be changed without a
//      formal Board Review; all weights are exported named constants
//      so the Board can audit them without reading the algorithm.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape:
//
//    {
//      artwork:           string|null,   // 300×300 Apple Music album artwork URL
//      artistName:        string,        // verified performing artist
//      releaseTitle:      string,        // album / EP / single title
//      releaseType:       'Album'|'EP'|'Single',
//      releaseDate:       string|null,   // ISO date from Apple Music
//      verificationScore: number,        // 0–40 (confidence sub-score)
//      selectionScore:    number,        // 0–100 total
//      reasonSelected:    string,        // human-readable debug sentence
//    }
//    or null when no eligible releases exist.
//
// ─────────────────────────────────────────────────────────────────────

export const BVR_ENGINE_VERSION = '1.0.0';

// ── Board-locked scoring weights ─────────────────────────────────────
// Change these values only through a formal Board Review and amendment.

export const BVR_VERIFICATION_WEIGHTS = Object.freeze({
  FULL:    40,   // id + url + name all present
  PARTIAL: 20,   // id + name (url absent)
  MINIMAL:  5,   // name only
  NONE:     0,   // no identifying fields
});

export const BVR_METADATA_WEIGHT_PER_FIELD = 5;   // 4 fields × 5 = 20 max
// Fields evaluated: name · trackCount · releaseDate · artwork

export const BVR_ARTWORK_WEIGHT = 10;

export const BVR_RELEASE_TYPE_WEIGHTS = Object.freeze({
  ALBUM:  15,
  EP:     10,
  SINGLE:  5,
});

export const BVR_STREAMING_WEIGHT = 10;   // Apple Music canonical presence

export const BVR_RECENCY_WEIGHTS = Object.freeze({
  RECENT:      5,   // ≤ 2 years
  MODERATE:    2,   // 3–5 years
  ESTABLISHED: 0,   // > 5 years
});

export const BVR_RECENCY_RECENT_YEARS   = 2;
export const BVR_RECENCY_MODERATE_YEARS = 5;

// ── Release classification (mirrors catalog-intelligence classifyAppleAlbums) ──
function classifyType(trackCount) {
  const tc = typeof trackCount === 'number' && trackCount > 0 ? trackCount : 7;
  if (tc === 1) return 'Single';
  if (tc <= 6)  return 'EP';
  return 'Album';
}

// ── Verify each field that contributes to the verification confidence score ──
function deriveVerificationScore(album) {
  const hasId   = typeof album.id === 'string' && album.id.length > 0;
  const hasUrl  = typeof album.url === 'string' && album.url.length > 0;
  const hasName = typeof album.name === 'string' && album.name.trim().length > 0;

  if (hasId && hasUrl && hasName) return BVR_VERIFICATION_WEIGHTS.FULL;
  if (hasId && hasName)           return BVR_VERIFICATION_WEIGHTS.PARTIAL;
  if (hasName)                    return BVR_VERIFICATION_WEIGHTS.MINIMAL;
  return BVR_VERIFICATION_WEIGHTS.NONE;
}

// ── Metadata completeness: 4 fields × 5 pts ──
function deriveMetadataScore(album) {
  const fields = [
    typeof album.name      === 'string' && album.name.trim().length > 0,
    typeof album.trackCount === 'number' && album.trackCount > 0,
    typeof album.releaseDate === 'string' && album.releaseDate.length > 0,
    typeof album.artwork    === 'string' && album.artwork.length > 0,
  ];
  return fields.filter(Boolean).length * BVR_METADATA_WEIGHT_PER_FIELD;
}

// ── Recency bonus ──
function deriveRecencyScore(releaseDate, currentYear) {
  if (typeof releaseDate !== 'string') return BVR_RECENCY_WEIGHTS.ESTABLISHED;
  const year = new Date(releaseDate).getFullYear();
  if (!year || year < 1900) return BVR_RECENCY_WEIGHTS.ESTABLISHED;
  const age = currentYear - year;
  if (age <= BVR_RECENCY_RECENT_YEARS)   return BVR_RECENCY_WEIGHTS.RECENT;
  if (age <= BVR_RECENCY_MODERATE_YEARS) return BVR_RECENCY_WEIGHTS.MODERATE;
  return BVR_RECENCY_WEIGHTS.ESTABLISHED;
}

// ── Score one candidate release ──
function scoreAlbum(album, currentYear) {
  if (!album || typeof album !== 'object') return null;

  const verificationScore = deriveVerificationScore(album);
  if (verificationScore === BVR_VERIFICATION_WEIGHTS.NONE) return null; // not eligible

  const metadataScore = deriveMetadataScore(album);
  const artworkScore  = album.artwork ? BVR_ARTWORK_WEIGHT : 0;
  const releaseType   = classifyType(album.trackCount);
  const typeScore     = BVR_RELEASE_TYPE_WEIGHTS[releaseType.toUpperCase()];
  const recencyScore  = deriveRecencyScore(album.releaseDate, currentYear);

  // All Apple albums sourced from the API carry Apple Music presence (+10).
  const streamingScore = BVR_STREAMING_WEIGHT;

  const selectionScore = verificationScore + metadataScore + artworkScore +
                         typeScore + streamingScore + recencyScore;

  return {
    album,
    releaseType,
    verificationScore,
    metadataScore,
    artworkScore,
    typeScore,
    recencyScore,
    selectionScore,
  };
}

// ── Tiebreaker comparator ──
const TYPE_ORDER = Object.freeze({ Album: 3, EP: 2, Single: 1 });

function compareScored(a, b) {
  // 1. Total score
  if (b.selectionScore !== a.selectionScore) return b.selectionScore - a.selectionScore;
  // 2. Verification confidence
  if (b.verificationScore !== a.verificationScore) return b.verificationScore - a.verificationScore;
  // 3. Metadata completeness
  if (b.metadataScore !== a.metadataScore) return b.metadataScore - a.metadataScore;
  // 4. Release type preference
  if (TYPE_ORDER[b.releaseType] !== TYPE_ORDER[a.releaseType]) {
    return TYPE_ORDER[b.releaseType] - TYPE_ORDER[a.releaseType];
  }
  // 5. More recent
  const bYear = b.album.releaseDate ? new Date(b.album.releaseDate).getTime() : 0;
  const aYear = a.album.releaseDate ? new Date(a.album.releaseDate).getTime() : 0;
  return bYear - aYear;
}

// ── Build the reason string ──
function buildReason(scored, candidateCount) {
  const parts = [];
  if (scored.artworkScore > 0) parts.push('artwork present');
  if (scored.recencyScore >= BVR_RECENCY_WEIGHTS.RECENT) parts.push('recent release');
  else if (scored.recencyScore >= BVR_RECENCY_WEIGHTS.MODERATE) parts.push('established release');
  if (candidateCount === 1) parts.push('only eligible release');

  const detail = parts.length ? ` (${parts.join(', ')})` : '';
  return `${scored.releaseType} — score ${scored.selectionScore}/100${detail}; evaluated ${candidateCount} candidate${candidateCount !== 1 ? 's' : ''}`;
}

// ── Public entrypoint ─────────────────────────────────────────────────
//
// selectBestVerifiedRelease(albums, artistName)
//
// albums     — platforms.appleMusic.details.albums[] from canonical payload
// artistName — payload.subject.artistName or cio.identity.name
//
// Returns a deep-frozen BestVerifiedRelease object, or null when
// no eligible releases exist.
//
export function selectBestVerifiedRelease(albums, artistName) {
  try {
    if (!Array.isArray(albums) || albums.length === 0) return null;

    const currentYear = new Date().getFullYear();
    const safe = typeof artistName === 'string' && artistName.trim() ? artistName.trim() : '';

    const scored = albums
      .map((a) => scoreAlbum(a, currentYear))
      .filter(Boolean);

    if (scored.length === 0) return null;

    scored.sort(compareScored);
    const best = scored[0];

    const name = typeof best.album.name === 'string' ? best.album.name.trim() : '';
    if (!name) return null;

    return Object.freeze({
      artwork:           typeof best.album.artwork === 'string' ? best.album.artwork : null,
      artistName:        safe,
      releaseTitle:      name,
      releaseType:       best.releaseType,
      releaseDate:       typeof best.album.releaseDate === 'string' ? best.album.releaseDate : null,
      verificationScore: best.verificationScore,
      selectionScore:    best.selectionScore,
      reasonSelected:    buildReason(best, scored.length),
    });
  } catch (err) {
    return null;
  }
}
