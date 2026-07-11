# Normalization Engine™
## Canonical Intelligence Platform™ — Sprint 4

---

## Mission

The Normalization Engine converts provider-specific evidence into a common, provider-neutral language before canonical truth is established.

**The engine never determines which provider is correct. It only standardizes evidence.**

---

## Pipeline Position

```
Provider Connector
       ↓
Evidence Contract™
       ↓
Evidence Envelope™
       ↓
Evidence Registry™
       ↓
Normalization Engine™   ← this module
       ↓
Evidence Resolution Engine™  (Sprint 5)
       ↓
Canonical Registry™
       ↓
Canonical Intelligence Domains™
       ↓
Mission Control™
```

---

## Architecture

```
api/normalization/
  index.js              Public API singleton + createNormalizationEngine factory
  version.js            Engine version (NORMALIZATION_ENGINE_VERSION)
  types.js              NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES, error codes
  registry.js           Rule registry (createNormalizationRegistry)
  pipeline.js           Core normalization pipeline (normalizeParsedEvidence, normalizeRegistryRecord, normalizeEnvelope, normalizeMany)
  validate.js           Input/output validation (validateRule, validateNormalizedOutput, validateReport)
  report.js             Normalization Report factory (createNormalizationReport)
  transformers.js       Pure transform primitives (no imports, no state)
  normalizers/
    text.js             TEXT category rules (TXT-001 through TXT-007)
    identity.js         IDENTITY category rules (IDENT-001, IDENT-002)
    identifiers.js      IDENTIFIERS category rules (ID-001, ID-002)
    urls.js             URLS category rules (URL-001)
    dates.js            DATES category rules (DAT-001)
    location.js         LOCATION category rules (LOC-001, LOC-002)
    booleans.js         BOOLEAN category rules (BOOL-001)
    numeric.js          NUMERIC category rules (NUM-001, NUM-002)
```

---

## Normalization Principles

1. **Deterministic** — the same input always produces the same output.
2. **Repeatable** — running normalization twice produces identical results.
3. **Auditable** — every transformation is recorded in the Normalization Report.
4. **Versioned** — every rule has a version; the engine has a version; every report carries the engine version.
5. **Stateless** — no mutable global state. Two engine instances with identical registries produce identical output.
6. **Replayable** — rules are idempotent. Normalizing already-normalized output produces no further changes.

---

## What Normalization Does

The engine may normalize:

| Concern | Examples |
|---------|---------|
| Whitespace | trim, collapse internal spaces |
| Unicode | NFC normalization |
| Quotes | curly quotes → straight quotes |
| Apostrophes | typographic apostrophes → ASCII apostrophe |
| Empty values | `""` / `"   "` → `null` |
| Undefined values | `undefined` → `null` |
| Artist names | trim + collapse + NFC + quotes |
| Platform IDs | trim |
| ISRC format | `USRC17607839` → `US-RC1-76-07839` |
| UPC/EAN format | 12-digit → 13-digit EAN-13 |
| URLs | lowercase scheme + host, remove trailing slash |
| Dates | full datetime → `YYYY-MM-DD` |
| Country codes | `us` → `US` (ISO 3166-1 alpha-2) |
| Language codes | `EN` → `en` (ISO 639-1) |
| Boolean strings | `"true"` → `true` |
| Numeric strings | `"42"` → `42` |
| Negative integers | `-1` → `null` (canonical absent-value) |

## What Normalization Never Does

The engine must **never**:

- Choose the best artist name
- Choose the canonical genre
- Rank providers
- Assign confidence scores
- Resolve conflicts between providers
- Select a canonical identifier
- Pick a preferred label, publisher, or territory

These decisions belong exclusively to the **Resolution Engine (Sprint 5)**.

---

## Normalization Pipeline

Each call to `normalizeRegistryRecord` or `normalizeEnvelope` flows through:

```
Input
  ↓
Stage 1: Validation
  - Input must be a non-null object
  - If invalid: return { success: false, normalizedEvidence: null, report: ... }

Stage 2: Rule Selection
  - For each field, determine which active rules apply
  - Rules are selected by inputType match + optional fieldPatterns
  - TEXT rules (STRING inputType) apply to all string values

Stage 3: Transformation
  - Apply selected rules in order (TEXT first, then type-specific)
  - Each rule is applied only if ruleAppliesTo(rule, currentValue, fieldName) is true
  - Rules that change the value are recorded in rulesApplied
  - Rule execution errors are caught and recorded in report.errors (never thrown)

Stage 4: Output Validation
  - normalizedEvidence must be a non-null object

Stage 5: Normalization Report
  - Immutable report produced
  - Contains: reportId, normalizedAt, engineVersion, contractId, providerId,
              rulesApplied, rulesSkipped, warnings, errors, inputFieldCount,
              transformedFieldCount, success
```

---

## Normalization Scope

The pipeline normalizes:

- `parsedEvidence.evidence.*` — all provider-contributed contract-specific fields
- `parsedEvidence.sourceUrl` — URL normalization
- `parsedEvidence.retrievedAt` — date normalization

The pipeline does **not** normalize:

- System identifiers: `contractId`, `contractVersion`, `provider`, `providerVersion`, `connectorVersion`, `scanId`, `artistId`
- Status enums: `confidence`, `evidenceStatus`
- Registry metadata: `evidenceEnvelopeId`, `registryRecordId`, `recordStatus`, etc.

---

## Rule Registry

Every normalization rule must be registered before the engine may apply it.

Each rule defines:

| Field | Description |
|-------|-------------|
| `ruleId` | Stable identifier (e.g. `TXT-001`) |
| `ruleName` | Human-readable name |
| `inputType` | What value type this rule targets (from `NORMALIZER_INPUT_TYPES`) |
| `outputType` | What value type the rule produces |
| `version` | Semver string |
| `category` | From `NORMALIZATION_CATEGORIES` |
| `description` | Plain-language description |
| `example` | `{ input, output }` — used for idempotency validation at registration |
| `status` | `ACTIVE` / `DEPRECATED` / `RESERVED` |
| `normalize` | Pure function `(value) => normalizedValue` |
| `fieldPatterns` | Optional array of RegExps limiting the rule to matching field names |

Rules are validated and idempotency-checked at registration. A non-idempotent rule throws at startup.

---

## Normalization Report™

Every normalization operation produces an immutable `NormalizationReport`:

```js
{
  reportId:              string,    // UUID v4
  normalizedAt:          string,    // ISO 8601
  engineVersion:         string,    // e.g. "1.0.0"
  sourceEnvelopeId:      string|null,
  evidenceEnvelopeId:    string|null,
  contractId:            string|null,
  providerId:            string|null,
  rulesApplied:          Array<{ ruleId, ruleName, field, inputValue, outputValue }>,
  rulesSkipped:          Array<{ ruleId, ruleName, reason }>,
  warnings:              string[],
  errors:                Array<{ ruleId, field, error }>,
  inputFieldCount:       number,
  transformedFieldCount: number,
  success:               boolean,
}
```

The report is audit metadata. It is never persisted by the Normalization Engine itself — that is the responsibility of the caller or a future audit layer.

---

## Rule Versioning

Every normalizer has:

| Field | Source |
|-------|--------|
| `ruleId` | Stable string ID (e.g. `TXT-001`) |
| `version` | Semver (e.g. `1.0.0`) |
| `status` | `ACTIVE`, `DEPRECATED`, or `RESERVED` |

Engine version: `NORMALIZATION_ENGINE_VERSION.version` (exported from `index.js`).

When a rule changes behavior, its version is incremented and the old version is deprecated (not deleted). The report records which rule version was active at normalization time via the engine version.

---

## Replay Model

The Normalization Engine is designed for replay:

1. **Registry records are never modified.** The engine reads immutable Evidence Registry records and produces new normalized output. The input is never mutated.
2. **Normalization is idempotent.** Every rule is validated for idempotency at registration. `normalize(normalize(x)) === normalize(x)` for all example inputs.
3. **Same input → same output.** Given the same registry state and input, normalization always produces identical output.
4. **Replay by re-running.** To re-normalize after a rule change: load the same Registry records, run the updated engine, compare reports.

---

## Adapter Interface

The engine does not prescribe a storage adapter. The `normalizeParsedEvidence` / `normalizeRegistryRecord` / `normalizeEnvelope` functions are pure:

- Input: a parsedEvidence object, a Sprint 3 Registry Record, or a Sprint 2 Envelope
- Output: `{ success, normalizedEvidence, report }`
- No database access
- No network access
- No file I/O

Integration with persistence is the caller's responsibility.

---

## Public API

```js
import {
  NORMALIZATION_ENGINE,               // singleton engine (default registry)
  normalizeRegistryRecord,            // normalize a Sprint 3 registry record
  normalizeEnvelope,                  // normalize a Sprint 2 evidence envelope
  normalizeParsedEvidence,            // normalize a parsedEvidence object directly
  normalizeMany,                      // normalize an array of registry records
  createNormalizationEngine,          // factory: engine backed by a custom registry
  createNormalizationRegistry,        // factory: empty rule registry
  NORMALIZATION_ENGINE_VERSION,
  NORMALIZATION_CATEGORIES,
  RULE_STATUSES,
  NORMALIZER_INPUT_TYPES,
  ALL_RULES,
  TEXT_RULES, IDENTITY_RULES, IDENTIFIER_RULES,
  URL_RULES, DATE_RULES, LOCATION_RULES,
  BOOLEAN_RULES, NUMERIC_RULES,
} from './api/normalization/index.js';
```

---

## Future Resolution Integration

Sprint 5 (Evidence Resolution Engine™) will consume the output of this engine.

The expected integration point:

```
normalizedEvidence   →   Resolution Engine
                            - receives normalized records from multiple providers
                            - applies resolution policies
                            - selects canonical values
                            - produces Canonical Registry entries
```

The Normalization Engine never participates in resolution decisions. Its output is provider-attributed normalized evidence — the Resolution Engine decides which normalized value is canonical.

---

## Constitutional Guarantee

> The Normalization Engine prepares evidence. It never establishes truth.
>
> If a normalization decision would require choosing one provider over another, stop.
> That decision belongs to the Resolution Engine in Sprint 5.

Verified by tests 71–73 (Constitutional Boundaries section).
