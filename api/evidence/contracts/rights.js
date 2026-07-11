// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — MusicRightsEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when contributing
// to music rights intelligence. This contract covers publishing, neighboring
// rights, and master rights claims.
//
// Evidence fields describe raw provider-contributed rights data.
// Canonical rights resolution (ownership percentages, chain of title)
// is not performed at this layer.
//
// ─────────────────────────────────────────────────────────────────────────────

export const MUSIC_RIGHTS_CONTRACT = Object.freeze({
  contractId:   'MusicRightsEvidence',
  displayName:  'Music Rights Evidence',
  category:     'Rights',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing publishing, neighboring rights, and master rights claims associated with an artist or their works.',

  evidenceFields: Object.freeze([
    {
      id:          'proName',
      displayName: 'PRO Name',
      dataType:    'string',
      required:    false,
      description: 'Name of the Performing Rights Organization affiliated with this artist.',
    },
    {
      id:          'proMembershipId',
      displayName: 'PRO Membership ID',
      dataType:    'string',
      required:    false,
      description: 'The artist\'s membership or IPI number within the affiliated PRO.',
    },
    {
      id:          'publisherName',
      displayName: 'Publisher Name',
      dataType:    'string',
      required:    false,
      description: 'Name of the music publisher administering composition rights.',
    },
    {
      id:          'publisherIpi',
      displayName: 'Publisher IPI',
      dataType:    'string',
      required:    false,
      description: 'IPI base number of the publisher returned by this provider.',
    },
    {
      id:          'recordLabelName',
      displayName: 'Record Label Name',
      dataType:    'string',
      required:    false,
      description: 'Name of the record label holding master rights for this artist\'s catalog.',
    },
    {
      id:          'distributorName',
      displayName: 'Distributor Name',
      dataType:    'string',
      required:    false,
      description: 'Name of the digital distributor responsible for delivering this artist\'s catalog.',
    },
    {
      id:          'iswcs',
      displayName: 'ISWCs',
      dataType:    'array',
      required:    false,
      description: 'International Standard Musical Work Codes found for works by this artist.',
    },
    {
      id:          'works',
      displayName: 'Works',
      dataType:    'array',
      required:    false,
      description: 'List of musical works (compositions) found for this artist by this provider.',
    },
    {
      id:          'registrationStatus',
      displayName: 'Registration Status',
      dataType:    'string',
      required:    false,
      description: 'Registration or membership status of this artist with this rights provider.',
    },
    {
      id:          'rightsTerritory',
      displayName: 'Rights Territory',
      dataType:    'string',
      required:    false,
      description: 'Territory scope covered by this rights evidence (e.g. "US", "Worldwide").',
    },
  ]),
});
