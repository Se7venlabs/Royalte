# ATHENA™ Intelligence Engine

**Sprint 10 — Canonical Intelligence Platform™**
**Status:** Board-locked v1.0 — 2026-07-12

---

## Constitutional Mission

> ATHENA™ answers one question:
>
> **What does Royaltē's Canonical Intelligence mean, and what should happen next?**

ATHENA™ is the Executive Intelligence Layer.

- It **consumes** deterministic Canonical Intelligence.
- It **never** determines canonical truth.
- It **never** modifies canonical truth.
- It **never** replaces constitutional business rules.

ATHENA interprets the outputs of the Canonical Intelligence Platform™ and provides executive guidance.

---

## Architecture

```
Evidence Books(tm)
        ↓
Evidence Connectors(tm)
        ↓
Evidence Registry(tm)      (Sprint 3)
        ↓
Normalization Engine(tm)   (Sprint 4)
        ↓
Resolution Engine(tm)      (Sprint 5)
        ↓
Canonical Intelligence Domains(tm)  (Sprint 6)
        ↓
Scan Orchestrator(tm)      (Sprint 7)
        ↓
Monitoring & Change Detection(tm)   (Sprint 8)
        ↓
Mission Control Data API(tm)        (Sprint 9)
        ↓ ← ATHENA consumes ONLY through this layer
ATHENA(tm) Intelligence Engine      (Sprint 10)
        ↓
Executive Brief(tm)
        ↓
Mission Control(tm)
```

**Constitutional Constraint:** ATHENA must never import from `api/monitoring/`, `api/resolution/`, `api/normalization/`, `api/orchestrator/`, `api/registry/`, or `api/evidence/` directly. All Canonical Intelligence arrives through Mission Control Data API™ response envelopes.

---

## Inputs

ATHENA™ accepts a map of Mission Control Data API™ response objects:

```js
const apiResponses = {
  identity:         identityResponse,         // endpoint: 'identity'
  musicRights:      musicRightsResponse,       // endpoint: 'music_rights'
  catalog:          catalogResponse,           // endpoint: 'catalog'
  distribution:     distributionResponse,      // endpoint: 'distribution'
  monitoring:       monitoringResponse,        // endpoint: 'monitoring'
  systemOperations: systemOperationsResponse,  // endpoint: 'system_operations'
  // executiveOverview is optional
};

const report = ATHENA_ENGINE.analyze(apiResponses);
```

Each response is a frozen Mission Control Data API™ envelope with:
- `apiVersion: 'v1'`
- `status: 'SUCCESS' | 'NOT_FOUND' | 'ERROR'`
- `data: { ... domain-specific fields ... }`

ATHENA extracts `response.data` only from `SUCCESS` responses. All other statuses produce empty data (graceful degradation).

---

## Outputs

`ATHENA_ENGINE.analyze(apiResponses)` returns a deep-frozen `AthenaReport`:

```js
{
  athenaReportId:    uuid,
  timestamp:         ISO8601,
  executiveAnalysis: ExecutiveAnalysis,
  riskAnalysis:      RiskAnalysis,
  opportunityAnalysis: OpportunityAnalysis,
  recommendations:   Recommendation[],
  context:           ConversationContext,
  engineVersion:     ATHENA_ENGINE_VERSION,
}
```

All nested objects are deep-frozen. No consumer may mutate ATHENA output.

---

## Executive Analysis™

`executiveAnalysis` contains the top-level executive view:

```js
{
  analysisId:      uuid,
  analysisType:    'executive_analysis',
  artistId:        string | null,
  scanId:          string | null,
  timestamp:       ISO8601,
  businessContext: {
    artistId, artistName, verified, providerCount,
    coverageSummary, publisherKnown, proAffiliated, releaseCount,
  },
  healthSummary: {
    overallLevel,    // 'STRONG' | 'GOOD' | 'MODERATE' | 'WEAK' | 'CRITICAL'
    riskScore,       // 0–100
    riskLevel,       // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL'
    domainStatuses,  // { identity, rights, catalog, distribution, monitoring, systemOperations }
    criticalIssues,
    highIssues,
    totalOpportunities,
  },
  domainInsights: DomainInsight[],
  engineVersion:  ATHENA_ENGINE_VERSION,
}
```

---

## Risk Analysis™

`riskAnalysis` identifies all business-level risks across 6 categories:

| Category | Examples |
|---|---|
| `business` | No artist identity, identity not verified |
| `rights` | No publisher, no PRO affiliation, no ISWC |
| `catalog` | ISRC coverage below threshold, no label |
| `distribution` | No active distributor, low DSP coverage |
| `monitoring` | Critical/high-severity canonical changes detected |
| `operational` | Scan not complete |

Each `Risk` includes:
- `riskId`, `category`, `level` (CRITICAL/HIGH/MEDIUM/LOW/INFORMATIONAL)
- `title`, `description`, `affectedDomain`
- `supportingEvidence[]`, `confidence`, `recommendedAction`

`riskScore` (0–100) is derived from weighted risk counts. `riskLevel` is derived from `riskScore`.

---

## Opportunity Analysis™

`opportunityAnalysis` identifies improvement opportunities across 6 types:

| Type | Examples |
|---|---|
| `missing_registration` | No PRO, no ISWC registered |
| `metadata_improvement` | No biography, no genre |
| `distribution_opportunity` | Partial DSP coverage |
| `catalog_enhancement` | Incomplete ISRC assignment |
| `verification_opportunity` | No IPI, no ISNI |
| `growth_opportunity` | Catalog exists but distribution reach is low |

Each `Opportunity` includes:
- `opportunityId`, `type`, `title`, `description`, `affectedDomain`
- `potentialImpact`, `confidence`, `recommendedAction`, `priority`

---

## Recommendation Model™

`recommendations` is a sorted array of `Recommendation` objects:

```js
{
  recommendationId:   uuid,
  priority:           'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL',
  reason:             string,
  supportingEvidence: string[],
  affectedDomains:    string[],
  confidence:         ConfidenceResult,
  recommendedAction:  string,
  sourceType:         'risk' | 'opportunity',
  sourceId:           uuid,           // riskId or opportunityId
}
```

Recommendations are sorted by priority (URGENT first). Every recommendation traces back to a Risk or Opportunity via `sourceId`.

---

## Confidence Model™

Every Risk, Opportunity, and Recommendation includes a `ConfidenceResult`:

```js
{
  level:             'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA',
  score:             number,     // 0.0–1.0
  supportingDomains: string[],   // canonical domains that support this conclusion
  monitoringEvents:  number,     // monitoring events that corroborate
  executiveMetrics:  string[],   // executive metric keys that corroborate
  reasoning:         string,     // human-readable confidence explanation
}
```

Confidence is computed from: canonical domain count (50% weight), data completeness (30%), monitoring corroboration (10%), executive metrics (10%).

**ATHENA confidence is separate from Canonical confidence.**

---

## Conversation Context™

`context` maintains structured executive context for AI advisory sessions:

```js
{
  contextId:           uuid,
  createdAt:           ISO8601,
  updatedAt:           ISO8601,
  currentScan:         { scanId, artistId, timestamp } | null,
  historicalChanges:   ChangeEvent[],
  executivePriorities: string[],   // top URGENT + HIGH recommended actions
  outstandingRisks:    Risk[],     // CRITICAL + HIGH risks only
  openOpportunities:   Opportunity[],  // top 5 opportunities
}
```

Context is immutable. Use `updateContext(context, updates)` to produce a new version.

---

## Prompt Strategy

ATHENA validates all text inputs with `validatePromptSafety(text)` before processing:

- Detects prompt injection patterns (instruction override attempts, role markers)
- Enforces a 10,000-character length limit
- Returns `{ safe: boolean, reasons: string[] }`

---

## Consumers

| Consumer | Entry Point |
|---|---|
| Mission Control™ | `ATHENA_ENGINE.analyze(apiResponses)` |
| Executive Brief™ | `ATHENA_ENGINE.generateRiskAnalysis` + `generateRecommendations` |
| ATHENA™ Chat | `ATHENA_ENGINE.createContext` + `updateContext` + `validatePromptSafety` |

---

## Versioning

- Current version: `athena-engine-v1`
- `engineVersion` is present on all ATHENA outputs
- No breaking changes to output shape without a new Board brief and version bump

---

## File Map

| File | Role |
|---|---|
| `version.js` | `ATHENA_ENGINE_VERSION` |
| `types.js` | All type constants: risk levels/categories, opportunity types, recommendation priorities, confidence levels, context types, error codes |
| `confidence.js` | `computeConfidence`, `computeDomainDataCompleteness` — ATHENA Confidence Model™ |
| `insights.js` | `generateDomainInsights` — identity/rights/catalog/distribution/monitoring insights |
| `risk-analysis.js` | `generateRiskAnalysis` — 6-category risk identification and classification |
| `opportunities.js` | `generateOpportunityAnalysis` — 6-type opportunity identification |
| `recommendations.js` | `generateRecommendations` — sourced from risks + opportunities; sorted by priority |
| `analysis.js` | `generateExecutiveAnalysis` — business context, health summary, domain insights |
| `prompts.js` | `createConversationContext`, `updateContext`, `extractExecutivePriorities`, `buildExecutiveContext` |
| `validate.js` | Input, output, recommendation, confidence, context, and prompt safety validation |
| `index.js` | `createAthenaEngine` factory + `ATHENA_ENGINE` singleton + full re-exports |
| `ATHENA_ENGINE.md` | This document |

Tests: `tests/athena-engine-test.mjs`
