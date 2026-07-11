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
//   objectClass — 'Business' | 'Platform' | 'Derived'  (see OBJECT_CLASSES in types.js)
//   description — one sentence defining the business concept
//   version     — object schema version
//   status      — ACTIVE | DEPRECATED | RESERVED
//
// Object classification:
//   Business — core music-industry entities that exist independently of the platform
//   Platform — Royaltē infrastructure objects created and managed by the platform itself
//   Derived  — computed or intelligence-generated objects; depend on other data
//
// ─────────────────────────────────────────────────────────────────────────────

export const CANONICAL_OBJECTS = Object.freeze([

  // ── Business Objects ──────────────────────────────────────────────────────
  // Core music-industry entities that exist independently of the Royaltē platform.

  {
    id:          'Artist',
    objectClass: 'Business',
    description: 'A musical artist, group, or project whose catalog and rights Royaltē monitors.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Release',
    objectClass: 'Business',
    description: 'A commercial music release (album, EP, or single) associated with an artist.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Track',
    objectClass: 'Business',
    description: 'A single audio file within a release as it appears on a digital platform.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Recording',
    objectClass: 'Business',
    description: 'The master recording of a musical performance, identified by ISRC.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Work',
    objectClass: 'Business',
    description: 'The underlying musical composition (melody and lyrics), identified by ISWC.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Contributor',
    objectClass: 'Business',
    description: 'A person who contributed to a recording or work — performer, songwriter, or producer.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Organization',
    objectClass: 'Business',
    description: 'Any legal entity in the music industry: label, publisher, distributor, or rights body.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Publisher',
    objectClass: 'Business',
    description: 'The music publisher that administers composition rights for an artist\'s catalog.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'PublishingAdministrator',
    objectClass: 'Business',
    description: 'An entity that administers publishing rights on behalf of a publisher or songwriter.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Distributor',
    objectClass: 'Business',
    description: 'The digital distributor responsible for delivering an artist\'s catalog to platforms.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'RecordLabel',
    objectClass: 'Business',
    description: 'The record label that holds the master recording rights for an artist.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'PRO',
    objectClass: 'Business',
    description: 'A Performing Rights Organization that collects and distributes performance royalties.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'RightsOrganization',
    objectClass: 'Business',
    description: 'A collective management organization administering neighboring rights, mechanical royalties, or digital licensing.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Platform',
    objectClass: 'Business',
    description: 'A digital music service where an artist\'s catalog is licensed, distributed, or streamed.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Country',
    objectClass: 'Business',
    description: 'A sovereign nation in which an artist\'s catalog may be distributed or monetized.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Territory',
    objectClass: 'Business',
    description: 'A defined licensing territory that may span one or more countries.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },

  // ── Platform Objects ──────────────────────────────────────────────────────
  // Royaltē infrastructure objects created and managed by the platform itself.

  {
    id:          'EvidenceSource',
    objectClass: 'Platform',
    description: 'A single provider or API that supplies raw evidence about an artist or their catalog.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'EvidencePackage',
    objectClass: 'Platform',
    description: 'The normalized evidence bundle assembled from one or more EvidenceSources for a single scan.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Scan',
    objectClass: 'Platform',
    description: 'A point-in-time snapshot of an artist\'s music ecosystem produced by the Royaltē scan engine.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'CanonicalField',
    objectClass: 'Platform',
    description: 'A registry entry describing one canonical piece of intelligence Royaltē tracks.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },

  // ── Derived Objects ───────────────────────────────────────────────────────
  // Computed or intelligence-generated objects; depend on other canonical data.
  // These are not primary business entities — they are outputs of the
  // intelligence layer. Field ownership for Derived objects is subject to
  // the Derived Intelligence policy (pending Board ratification).

  {
    id:          'ChangeEvent',
    objectClass: 'Derived',
    description: 'A detected change in an artist\'s data between two consecutive scans.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'Alert',
    objectClass: 'Derived',
    description: 'A notification triggered by a ChangeEvent that meets a configured alert threshold.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'MonitoringEvent',
    objectClass: 'Derived',
    description: 'A scheduled or triggered monitoring action applied to an artist\'s profile.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'ExecutiveInsight',
    objectClass: 'Derived',
    description: 'A synthesized intelligence statement surfaced to an artist or their team via Mission Control.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'BusinessRisk',
    objectClass: 'Derived',
    description: 'An identified gap or exposure in an artist\'s music ecosystem that requires action.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
  {
    id:          'HealthIndicator',
    objectClass: 'Derived',
    description: 'A scored signal within a specific domain that contributes to the overall Health Score.',
    version:     '1.0.0',
    status:      'ACTIVE',
  },
]);

// Stable set for O(1) validation — derived from CANONICAL_OBJECTS once at load time.
export const VALID_OBJECT_IDS = new Set(CANONICAL_OBJECTS.map((o) => o.id));
