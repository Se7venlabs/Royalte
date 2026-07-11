# Canonical Intelligence Platform(tm) -- Evidence Contracts

**Status:** ACTIVE
**Sprint:** 2 -- Evidence Contracts(tm)
**Branch:** `feat/canonical-registry-sprint1`

---

## Overview

Evidence Contracts are the constitutional contract language spoken between
every provider connector and the Canonical Intelligence Platform. Every
connector produces evidence that conforms to a contract. No connector may
invent its own output structure.

Providers no longer define the platform. Providers only contribute evidence.

---

## Architecture

```
Evidence Books(tm)
      |
      v
Evidence Connectors(tm)
      |
      v
Evidence Contracts(tm)       <-- this layer
      |
      v
Evidence Registry(tm)        (Sprint 3)
      |
      v
Normalization(tm)             (Sprint 4)
      |
      v
Resolution(tm)               (Sprint 5)
      |
      v
Canonical Registry(tm)       (Sprint 1 -- complete)
```

---

## Evidence Lifecycle

Every piece of provider data passes through this lifecycle:

1. **Connector** queries a provider and receives a raw response.
2. **Connector** wraps the raw response and its parsed evidence in an **Evidence Envelope**.
3. **Evidence validation** is run against the contract declared by the evidence.
4. The **Evidence Envelope** (with validation result attached) is passed to the Evidence Registry.
5. Downstream layers (Normalization, Resolution) consume only the `parsedEvidence` inside the envelope.
6. The `rawPayload` is retained in the envelope for auditability.

---

## Evidence Statuses

Constitutional enums for the evidence lifecycle. Defined in `types.js`.

| Status | Meaning |
|---|---|
| `UNKNOWN` | Not yet evaluated |
| `FOUND` | Provider returned a match |
| `NOT_FOUND` | Provider was queried; no match exists (a real coverage gap) |
| `UNVERIFIED` | Provider returned data but confidence is insufficient to confirm |
| `CONFLICT` | Provider data conflicts with another source |
| `ERROR` | Connector encountered an error (network, auth, API failure) |
| `MANUAL_OVERRIDE` | A human manually supplied or corrected this evidence |

**`NOT_FOUND` is not `ERROR`.** `NOT_FOUND` means the artist genuinely has no presence
on that provider. `ERROR` means the connector could not determine presence. Downstream
consumers treat these differently.

---

## Evidence Confidence

Constitutional enums for per-evidence trust. Defined in `types.js`.

| Level | Meaning |
|---|---|
| `UNKNOWN` | Not assessed |
| `LOW` | Source is weakly reliable or partially matching |
| `MEDIUM` | Source is generally reliable; not cross-verified |
| `HIGH` | Source is strongly reliable; provider trust >= 80 |
| `VERIFIED` | Cross-verified via ISRC or equivalent canonical identifier |

**Evidence confidence is not canonical confidence.** Canonical confidence is
computed by the Resolution Engine from multiple evidence inputs. Evidence
confidence is the per-provider trust rating at the point of collection.

---

## Evidence Categories

Each Evidence Contract belongs to exactly one category.
Categories align with the six Canonical Domains from Sprint 1.

| Category | Canonical Domain | Covers |
|---|---|---|
| `Identity` | Identity(tm) | Who the artist is across platforms |
| `Rights` | Music Rights(tm) | Publishing, neighboring rights, master rights |
| `Catalog` | Catalog(tm) | What the artist has released |
| `Distribution` | Distribution Availability(tm) | Where the catalog is available |
| `Monitoring` | Monitoring(tm) | Change detection and temporal signals |
| `Operations` | System Operations(tm) | Connector health and platform diagnostics |

---

## Evidence Contracts

Six canonical Evidence Contracts are defined in `api/evidence/contracts/`.

### ArtistIdentityEvidence (`contracts/identity.js`)

Covers: artist name, provider ID, profile URL, image, genres, verification status,
external cross-reference IDs (MBID, ISNI, IPI), country.

Required evidence fields: `artistName`, `artistId`

### MusicRightsEvidence (`contracts/rights.js`)

Covers: PRO name and membership ID, publisher name and IPI, record label,
distributor, ISWCs, works list, registration status, rights territory.

No required evidence fields (rights data is always optional -- absence is meaningful).

### CatalogEvidence (`contracts/catalog.js`)

Covers: release, track, album, EP, and single counts; raw releases and tracks
arrays; ISRCs; primary release; latest release.

No required evidence fields (catalog depth varies by provider).

### DistributionEvidence (`contracts/distribution.js`)

Covers: market count, markets array, availability map, unavailable markets,
primary market, global availability status.

No required evidence fields (distribution data varies by provider).

### MonitoringEvidence (`contracts/monitoring.js`)

Covers: scan timestamp, previous scan ID, changes detected flag, change count,
change details, data checksum, activity signals.

Required evidence field: `scanTimestamp`

### SystemOperationsEvidence (`contracts/operations.js`)

Covers: response time, HTTP status, API quota remaining, raw data size, parsing
errors, retry count, auth method, connector health status.

No required evidence fields (all operational fields are diagnostic).

---

## Base Evidence Contract

Every evidence package must carry these metadata fields regardless of category.
Defined in `contracts/base.js`.

| Field | Type | Required | Description |
|---|---|---|---|
| `contractId` | string | yes | Which contract this evidence satisfies |
| `provider` | string | yes | Provider ID from the Provider Registry |
| `providerVersion` | string | yes | Provider API version targeted |
| `connectorVersion` | string | yes | Connector semver version |
| `retrievedAt` | date | yes | ISO 8601 timestamp of retrieval |
| `scanId` | string | yes | Royalte Scan ID |
| `artistId` | string | yes | Royalte artist identifier |
| `confidence` | string | yes | Evidence confidence level |
| `rawReference` | string | yes | Raw response reference (may be null) |
| `sourceUrl` | url | yes | URL queried (may be null) |
| `evidenceStatus` | string | yes | Evidence lifecycle status |
| `contractVersion` | string | yes | Evidence Contract version |

---

## Evidence Envelope(tm)

The Evidence Envelope is the standard transport object passed between every
layer of the Canonical Intelligence Platform pipeline. Defined in `envelope.js`.

```
{
  envelopeId       -- unique envelope ID (generated by createEnvelope)
  metadata {
    envelopeVersion  -- '1.0.0'
    createdAt        -- ISO 8601 timestamp
  }
  provider {
    id               -- provider ID from Provider Registry
    version          -- provider API version
    displayName      -- provider display name
  }
  connector {
    id               -- connector identifier
    version          -- connector semver version
    executionId      -- unique execution run ID (optional)
  }
  contractId         -- the Evidence Contract parsedEvidence satisfies
  contractVersion    -- contract version
  rawPayload         -- unmodified provider response (null if not stored)
  parsedEvidence     -- validated evidence object conforming to the contract
  validation {
    valid            -- boolean
    errors           -- string[]
    warnings         -- string[]
    validatedAt      -- ISO 8601 timestamp
  }
  trace {
    scanId           -- Royalte Scan ID
    artistId         -- Royalte artist ID
    requestId        -- optional upstream request tracing ID
    correlationId    -- optional correlation ID
  }
  timestamps {
    requestedAt      -- when the provider was queried
    receivedAt       -- when the response was received (optional)
    parsedAt         -- when the response was parsed (optional)
    envelopedAt      -- when the envelope was assembled
  }
}
```

**`createEnvelope(params)` is the sole factory.** Connectors must not construct
envelope object literals directly.

**The Evidence Contract governs `parsedEvidence` only.** The `rawPayload` is
preserved untouched. Downstream layers consume only `parsedEvidence`.

---

## Provider Registry

All known evidence providers are registered in `providers.js`.
No connector or contract may hardcode provider names.

| Provider ID | Display Name | Category | Capabilities |
|---|---|---|---|
| `apple-music` | Apple Music | Streaming | Identity, Catalog, Distribution |
| `spotify` | Spotify | Streaming | Identity, Catalog, Distribution |
| `deezer` | Deezer | Streaming | Identity, Catalog, Distribution |
| `tidal` | TIDAL | Streaming | Identity, Catalog, Distribution |
| `youtube` | YouTube | Streaming | Identity, Monitoring |
| `musicbrainz` | MusicBrainz | Metadata | Identity, Catalog, Rights |
| `discogs` | Discogs | Metadata | Identity, Catalog, Rights |
| `the-audio-db` | TheAudioDB | Metadata | Identity, Catalog |
| `lastfm` | Last.fm | Metadata | Identity, Monitoring |
| `mlc` | MLC | Publishing | Rights |
| `socan` | SOCAN | Publishing | Rights |
| `ascap` | ASCAP | Publishing | Rights |
| `bmi` | BMI | Publishing | Rights |
| `sound-exchange` | SoundExchange | Rights | Rights |
| `artist-verified-profile` | Artist Verified Profile | Internal | Identity |
| `manual-override` | Manual Override | Internal | All categories |

---

## Contract Registry -- Public API

All access to contracts goes through `api/evidence/index.js`.

```js
import {
  getContract,
  listContracts,
  validateEvidence,
  validateEnvelope,
  createEnvelope,
  EVIDENCE_REGISTRY,
} from '../api/evidence/index.js';

// Get a contract by ID
const contract = getContract('ArtistIdentityEvidence');

// List all contracts
const all = listContracts();

// Validate an evidence object
const { valid, errors, warnings } = validateEvidence(evidenceObject);

// Create an Evidence Envelope
const envelope = createEnvelope({
  provider:        { id: 'apple-music', version: '1.0' },
  connector:       { id: 'apple-music-connector', version: '1.0.0' },
  contractId:      'ArtistIdentityEvidence',
  contractVersion: '1.0.0',
  rawPayload:      rawProviderResponse,
  parsedEvidence:  { artistName: 'Black Alternative', artistId: '505490272', ... },
  validation:      validateEvidence(evidenceObject),
  trace:           { scanId: 'scan_123', artistId: 'artist_456' },
  timestamps:      { requestedAt: new Date().toISOString(), envelopedAt: new Date().toISOString() },
});
```

---

## Future Connector Requirements

Every connector built in Sprint 3+ must:

1. Import its contract from the Contract Registry -- never from the contract file directly.
2. Populate all required base metadata fields.
3. Populate `evidenceStatus` accurately -- use `NOT_FOUND` (not `ERROR`) when the artist
   genuinely has no presence on that provider.
4. Populate `confidence` based on what was actually verified (ISRC cross-check = `VERIFIED`).
5. Wrap its output in an Evidence Envelope using `createEnvelope()`.
6. Run `validateEvidence()` before assembling the envelope and attach the result.
7. Never modify `rawPayload` after it is captured.
8. Never include canonical field names or UI properties in `parsedEvidence`.

---

*Royalte Canonical Intelligence Platform(tm) -- Evidence Contracts Documentation*
*Sprint 2 -- feat/canonical-registry-sprint1*
