// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Canonical Object Registry™
// ─────────────────────────────────────────────────────────────────────────────
//
// The master list of every business object Royaltē understands.
// Every canonical field belongs to exactly one of these objects.
// Nothing in the platform exists outside an object.
//
// Object shape:
//   id          — stable PascalCase identifier; permanent; never changes
//   description — one sentence defining the business concept
//   version     — object schema version
//   status      — ACTIVE | DEPRECATED | RESERVED
//
// ─────────────────────────────────────────────────────────────────────────────

export const CANONICAL_OBJECTS = Object.freeze([
  {
    id:          'Artist',
    description: 'A musical artist, group, or project whose catalog and rights Royaltē monitors.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Release',
    description: 'A commercial music release (album, EP, or single) associated with an artist.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Track',
    description: 'A single audio file within a release as it appears on a digital platform.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Recording',
    description: 'The master recording of a musical performance, identified by ISRC.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Work',
    description: 'The underlying musical composition (melody and lyrics), identified by ISWC.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Contributor',
    description: 'A person who contributed to a recording or work — performer, songwriter, or producer.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Organization',
    description: 'Any legal entity in the music industry: label, publisher, distributor, or rights body.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Publisher',
    description: 'The music publisher that administers composition rights for an artist\'s catalog.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'PublishingAdministrator',
    description: 'An entity that administers publishing rights on behalf of a publisher or songwriter.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Distributor',
    description: 'The digital distributor responsible for delivering an artist\'s catalog to platforms.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'RecordLabel',
    description: 'The record label that holds the master recording rights for an artist.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'PRO',
    description: 'A Performing Rights Organization that collects and distributes performance royalties.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'RightsOrganization',
    description: 'A collective management organization administering neighboring rights, mechanical royalties, or digital licensing.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Platform',
    description: 'A digital music service where an artist\'s catalog is licensed, distributed, or streamed.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Country',
    description: 'A sovereign nation in which an artist\'s catalog may be distributed or monetized.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Territory',
    description: 'A defined licensing territory that may span one or more countries.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'EvidenceSource',
    description: 'A single provider or API that supplies raw evidence about an artist or their catalog.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'EvidencePackage',
    description: 'The normalized evidence bundle assembled from one or more EvidenceSources for a single scan.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Scan',
    description: 'A point-in-time snapshot of an artist\'s music ecosystem produced by the Royaltē scan engine.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'CanonicalField',
    description: 'A registry entry describing one canonical piece of intelligence Royaltē tracks.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'ChangeEvent',
    description: 'A detected change in an artist\'s data between two consecutive scans.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Alert',
    description: 'A notification triggered by a ChangeEvent that meets a configured alert threshold.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'MonitoringEvent',
    description: 'A scheduled or triggered monitoring action applied to an artist\'s profile.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'ExecutiveInsight',
    description: 'A synthesized intelligence statement surfaced to an artist or their team via Mission Control.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'BusinessRisk',
    description: 'An identified gap or exposure in an artist\'s music ecosystem that requires action.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'HealthIndicator',
    description: 'A scored signal within a specific domain that contributes to the overall Health Score.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
]);

// Stable set for O(1) validation — derived from CANONICAL_OBJECTS once at load time.
export const VALID_OBJECT_IDS = new Set(CANONICAL_OBJECTS.map((o) => o.id));
