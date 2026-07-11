# Canonical Intelligence Platform™ — Registry Architecture

**Status:** ACTIVE  
**Sprint:** 1A — Ownership Corrections  
**Branch:** `feat/canonical-registry-sprint1`

---

## Overview

The Canonical Field Registry is the single source of truth for every piece of intelligence Royaltē tracks about an artist. Every canonical field belongs to exactly one **Owning Domain**. No field may exist outside the registry.

---

## Canonical Domains (own fields)

Six domains own all canonical fields. Each domain answers one distinct question about the artist.

| Domain | Prefix | Question answered |
|--------|--------|-------------------|
| **Identity™** | `identity.*`, `backend.*` | Who is this artist, and where are they verified? |
| **Music Rights™** | `rights.*` | Who controls this artist's compositions and masters? |
| **Catalog™** | `catalog.*`, `backend.catalog_match_rate` | What has this artist released? |
| **Distribution Availability™** | `distribution.*` | Where is this catalog available globally? |
| **System Operations™** | `ops.*` | Is the platform operating correctly for this scan? |
| **Monitoring™** | `monitoring.*` | How has this artist's data changed over time? |

### Domain ownership rules

- Every canonical field belongs to **exactly one domain**.
- Domain assignment reflects **information ownership**, not data source.
- A field's **ID prefix may differ from its domain** when stability requires it (e.g. `backend.apple_verified` has domain `Identity™` — see Stable Field IDs below).

---

## Consumer Workspaces (never own fields)

Consumer Workspaces read canonical intelligence. They never own fields and never appear as a field's `domain` value. This is a constitutional rule enforced by the validation engine at startup.

| Workspace | Role |
|-----------|------|
| **Health Intelligence™** | Aggregates signals into the Royaltē Health Score™ |
| **Backend Intelligence™** | Surfaces operational and verification data |
| **ATHENA™** | AI-generated executive insights |
| **Executive Overview™** | Mission Control landing page |
| **Executive Brief™** | Synthesized narrative for artist teams |
| **AI Insights™** | ATHENA-driven recommendation workspace |

---

## Object Classification

Every Canonical Object has an `objectClass` of one of three values:

| Class | Definition | Examples |
|-------|-----------|---------|
| **Business** | Core music-industry entities that exist independent of Royaltē | Artist, Release, Track, Recording, Work, Publisher, Distributor |
| **Platform** | Royaltē infrastructure objects created and managed by the platform | EvidenceSource, EvidencePackage, Scan, CanonicalField |
| **Derived** | Computed or intelligence-generated outputs; depend on other canonical data | ChangeEvent, Alert, HealthIndicator, ExecutiveInsight, BusinessRisk |

---

## Provisional Fields

**Provisional fields** are executive intelligence outputs (`executive.*`) that are pending the Board's Derived Intelligence policy ratification. They are **not** canonical fields and are **not** included in `REGISTRY.fields` or subject to standard domain validation.

Provisional fields are governed by a dedicated validation layer (`validateProvisionalFields`) enforcing:

- Unique IDs within the provisional set
- Unique canonical names within the provisional set
- Valid parent objects
- Valid data types
- `status: 'PROVISIONAL'`
- `domain: null` (no permanent domain assigned)
- At least one consumer
- No ID collision with any canonical field

Access via `getProvisionalField(id)`. Never via `getField()`.

**Current provisional fields:** `executive.health_score`, `executive.health_grade`, `executive.priority_actions`, `executive.ai_insight`

---

## Stable Field IDs

Field IDs are **permanent**. They never change once ratified, even when domain ownership is corrected. This preserves backward compatibility across all consumers.

Two groups of fields carry `backend.` prefixes for historical stability, even though their domain ownership has moved:

| Field ID | Domain | Reason for prefix mismatch |
|----------|--------|---------------------------|
| `backend.apple_verified` | Identity™ | Domain corrected in Sprint 1A; ID frozen for stability |
| `backend.spotify_verified` | Identity™ | Same |
| `backend.youtube_verified` | Identity™ | Same |
| `backend.deezer_verified` | Identity™ | Same |
| `backend.tidal_verified` | Identity™ | Same |
| `backend.musicbrainz_verified` | Identity™ | Same |
| `backend.discogs_verified` | Identity™ | Same |
| `backend.catalog_match_rate` | Catalog™ | Domain corrected in Sprint 1A; ID frozen for stability |

**Constitutional rule:** field IDs are stable identifiers. A field ID is changed only when it violates a constitutional principle and a Board directive explicitly authorizes it.

---

## Registry Validation

The registry is validated at startup by two independent validation functions:

### `validateRegistry(objects, fields)`
Enforces 10 rules over canonical objects and fields:
1. Unique field IDs
2. Unique canonical names within parent object
3. Unique ownership (parentObject × canonicalName)
4. Missing validation rules (warning)
5. Missing consumers (warning)
6. Valid data types
7. Known parent objects
8. Known domains (null not allowed for canonical fields)
9. Consumer workspaces may never own fields
10. `objectClass` must be Business, Platform, or Derived

### `validateProvisionalFields(provisionalFields, canonicalFields)`
Governs the isolated provisional field set (8 rules — P1 through P8).

A non-empty `errors` array from either function causes the loader to throw. **A broken registry is a broken platform — nothing runs.**

---

## Registry Loader — Public API

All registry access goes through `api/registry/index.js`. No module may import raw field arrays directly for runtime use.

```
getField(id)                  → canonical field | undefined
getProvisionalField(id)       → provisional field | undefined
getFieldsByDomain(domain)     → canonical field[]
getFieldsByObject(parentObject) → canonical field[]

REGISTRY.version              → REGISTRY_VERSION
REGISTRY.objects              → all Canonical Objects
REGISTRY.fields               → all canonical fields (ALL_FIELDS)
REGISTRY.fieldsByDomain       → { domain → field[] }
REGISTRY.fieldsByObject       → { parentObject → field[] }
REGISTRY.provisionalFields    → provisional fields (DERIVED_FIELDS)
```

---

*Royaltē Canonical Intelligence Platform™ — Registry Architecture Document*  
*Sprint 1A — Board Architectural Corrections — feat/canonical-registry-sprint1*
