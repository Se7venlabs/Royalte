# Evidence Resolution Engine™ — Sprint 5

**Status:** Board-Ratified  
**Sprint:** Sprint 5 — Evidence Resolution Engine™  
**Constitutional Principle:** Resolution is the first constitutional layer permitted to establish canonical truth.

---

## Position in Pipeline

```
Provider Connectors
    ↓ Evidence Contract™
Evidence Registry™       (Sprint 3 — immutable vault)
    ↓ Normalization Engine™
Normalized Records™      (Sprint 4 — provider-neutral)
    ↓ Resolution Engine™
Resolution Records™      (Sprint 5 — canonical truth)
    ↓
Canonical Intelligence Domains → Mission Control™
```

---

## Constitutional Laws

1. **Resolution Engine is the FIRST layer permitted to select canonical truth.** All upstream layers are forbidden from selecting, preferring, or ranking provider values.
2. **Every canonical selection is backed by a Resolution Policy.** No provider ordering exists outside the Policy Registry.
3. **Resolution Records are immutable.** Once produced, they are never modified.
4. **Every selection is auditable via Field Provenance.** The engine never selects without recording why.
5. **The engine never throws.** Errors are returned in the manifest, not thrown to callers.
6. **Resolution is deterministic and replayable.** Same inputs always produce same outputs.
7. **The engine never mutates Normalized Records.** Inputs are consumed read-only.
8. **Conflicts are never hidden.** Disagreeing providers are recorded in Field Provenance and the Resolution Manifest.

---

## Architecture

### Resolution Policy Registry

Policies are registered at startup. Each policy covers a specific field and defines:

- `policyId` — unique identifier
- `field` — the field name this policy resolves (or `DEFAULT` for fallback)
- `providerOrder` — ordered list of provider IDs (highest trust first)
- `resolutionRule` — `POLICY_PRIORITY`, `CONSENSUS`, or `FIRST_AVAILABLE`
- `category` — intelligence category (IDENTITY, CATALOG, IDENTIFIERS, etc.)
- `status` — `ACTIVE`, `DEPRECATED`, or `RESERVED`

**No provider ordering may exist outside the policy registry.** This is a constitutional mandate.

### Resolution Rules

| Rule | Description |
|---|---|
| `POLICY_PRIORITY` | Select value from the highest-priority provider in the policy's `providerOrder` |
| `CONSENSUS` | Only resolve if all providers with data agree; otherwise warn and return null |
| `FIRST_AVAILABLE` | Select the first non-null value from the policy's priority order |

### Confidence Engine™

Confidence is calculated deterministically from:

1. **Provider Priority Score** — rank 0 = 1.00, rank 1 = 0.92, rank 2 = 0.84, rank 3 = 0.76, rank 4 = 0.68, deeper ranks decay to minimum 0.50
2. **Agreement Multiplier** — ALL_AGREE = 1.00, PARTIAL = 0.90, CONFLICT = 0.80, SINGLE = 0.85, NO_DATA = 0.00

Final confidence = `priorityScore × agreementMultiplier`, clamped to [0.0, 1.0].

| Level | Threshold |
|---|---|
| HIGH | >= 0.85 |
| MEDIUM | >= 0.65 |
| LOW | >= 0.40 |
| UNCERTAIN | < 0.40 |

### Conflict Detection™

Conflict detection compares all non-null values from the provider map:

| Conflict Type | Meaning |
|---|---|
| `ALL_AGREE` | All providers with data have identical values |
| `PARTIAL_AGREEMENT` | Multiple providers agree; at least one disagrees |
| `CONFLICT` | No two providers agree |
| `SINGLE_SOURCE` | Only one provider has data |
| `NO_DATA` | All providers have null values for this field |

---

## Output Artifacts

### Resolution Record™

```
resolutionRecordId     — UUID
normalizedRecordIds    — IDs of all input Normalized Records
resolvedField          — field name resolved
canonicalValue         — selected canonical value
confidence             — 0.0–1.0
confidenceLevel        — HIGH / MEDIUM / LOW / UNCERTAIN
selectedProvider       — provider whose value was selected
selectedRule           — POLICY_PRIORITY / CONSENSUS / FIRST_AVAILABLE
resolutionPolicyId     — policy that governed this resolution
provenanceId           — links to Field Provenance record
resolutionManifestId   — links to Resolution Manifest
conflictType           — conflict classification
engineVersion          — resolution engine version
createdAt              — ISO timestamp
```

### Field Provenance™

```
provenanceId           — UUID
resolvedField          — field name
canonicalValue         — selected value
selectedProvider       — who contributed the selected value
supportingProviders    — providers that agreed with the selection
conflictingProviders   — providers that disagreed
resolutionRule         — rule applied
resolutionPolicyId     — policy used
confidence             — final confidence score
confidenceLevel        — HIGH / MEDIUM / LOW / UNCERTAIN
normalizedRecordIds    — all input record IDs
conflictType           — conflict classification
timestamp              — ISO timestamp
engineVersion          — engine version
```

### Resolution Manifest™

```
manifestId                — UUID
resolvedField             — field name
inputNormalizedRecordIds  — all input record IDs
policyId                  — policy used
policyName                — human-readable policy name
resolutionRule            — rule applied
conflictRecord            — full conflict detection output
confidenceCalculation     — inputs + outputs of confidence computation
outputResolutionRecordId  — cross-link to Resolution Record
outputProvenanceId        — cross-link to Field Provenance
processingTime            — milliseconds
warnings                  — non-fatal advisory notices
errors                    — structural errors (if any)
engineVersion             — engine version
createdAt                 — ISO timestamp
```

---

## Public API

```js
import { RESOLUTION_ENGINE } from './api/resolution/index.js';

// Resolve a single field across multiple Normalized Records
const { success, resolutionRecord, manifest, provenance } =
  RESOLUTION_ENGINE.resolveField(normalizedRecords, 'artistName');

// Resolve specific fields
const { results } =
  RESOLUTION_ENGINE.resolveManyFields(normalizedRecords, ['artistName', 'genre', 'isrc']);

// Resolve all evidence fields from a set of Normalized Records
const { results } =
  RESOLUTION_ENGINE.resolveAllFields(normalizedRecords);
```

---

## DO NOT BUILD (Sprint 5 Boundary)

- No Mission Control wiring
- No workspace rendering
- No ATHENA™ analysis
- No Executive Brief generation
- No Missing Field reporting
- No Monitoring logic
- No Change Detection
- No UI of any kind

All of the above require separate Board briefs.

---

## Default Policies (Sprint 5)

| Field | Policy Priority |
|---|---|
| `artistName` | apple-music → spotify → tidal → musicbrainz → discogs → deezer |
| `artistId` | apple-music → spotify → musicbrainz → tidal → deezer |
| `recordLabel` | musicbrainz → discogs → apple-music → spotify → tidal |
| `genre` | apple-music → spotify → musicbrainz → discogs |
| `releaseDate` | musicbrainz → apple-music → spotify → discogs → tidal |
| `trackCount` | apple-music → spotify → musicbrainz |
| `isrc` | apple-music → spotify → musicbrainz → tidal |
| `upc` | apple-music → spotify → musicbrainz |
| `sourceUrl` | apple-music → spotify → tidal → deezer → musicbrainz |
| `DEFAULT` | apple-music → spotify → tidal → musicbrainz → discogs → deezer |

All policy modifications require a Board brief.
