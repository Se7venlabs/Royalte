// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — ArtistIdentityEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when contributing
// to artist identity. This contract covers WHO an artist is across platforms.
//
// Every field in `evidenceFields` describes provider-contributed raw evidence.
// These are NOT canonical fields. Canonical field resolution happens later
// in the Resolution Engine using inputs from one or more identity evidence packages.
//
// ─────────────────────────────────────────────────────────────────────────────

export const ARTIST_IDENTITY_CONTRACT = Object.freeze({
  contractId:   'ArtistIdentityEvidence',
  displayName:  'Artist Identity Evidence',
  category:     'Identity',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing who an artist is: name, platform ID, profile URL, image, genres, and cross-reference identifiers.',

  evidenceFields: Object.freeze([
    {
      id:          'artistName',
      displayName: 'Artist Name',
      dataType:    'string',
      required:    true,
      description: 'The artist\'s name as returned by this provider.',
    },
    {
      id:          'artistId',
      displayName: 'Provider Artist ID',
      dataType:    'string',
      required:    true,
      description: 'The provider\'s own stable identifier for this artist (e.g. Apple catalog ID, Spotify artist URI).',
    },
    {
      id:          'profileUrl',
      displayName: 'Profile URL',
      dataType:    'url',
      required:    false,
      description: 'The artist\'s profile or page URL on this provider\'s platform.',
    },
    {
      id:          'imageUrl',
      displayName: 'Image URL',
      dataType:    'url',
      required:    false,
      description: 'High-resolution artist image URL returned by this provider.',
    },
    {
      id:          'genres',
      displayName: 'Genres',
      dataType:    'array',
      required:    false,
      description: 'Genre tags associated with this artist as returned by this provider.',
    },
    {
      id:          'isVerified',
      displayName: 'Is Verified',
      dataType:    'boolean',
      required:    false,
      description: 'Whether the artist has a verified or official status on this provider\'s platform.',
    },
    {
      id:          'externalIds',
      displayName: 'External IDs',
      dataType:    'object',
      required:    false,
      description: 'Known cross-reference identifiers returned by this provider (e.g. MBID, ISNI, IPI).',
    },
    {
      id:          'country',
      displayName: 'Country',
      dataType:    'string',
      required:    false,
      description: 'Country or region associated with this artist according to this provider.',
    },
  ]),
});
