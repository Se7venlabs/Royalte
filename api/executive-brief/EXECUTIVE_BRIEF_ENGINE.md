# Executive Brief™ Engine

**Sprint 11 — Canonical Intelligence Platform™**
**Status:** Board-locked v1.0 — 2026-07-12

---

## Constitutional Mission

> The Executive Brief™ Engine answers one question:
>
> **How should Royaltē present executive intelligence in a complete, professional, actionable report?**

The Executive Brief™ Engine is the publishing layer of the Canonical Intelligence Platform™.

- It **assembles** platform intelligence.
- It **formats** executive reports.
- It **publishes** a single, deterministic Executive Brief™.
- It **never** determines canonical truth.
- It **never** performs evidence resolution.
- It **never** performs AI reasoning.

One Platform. One Executive Brief. Many Delivery Formats.

---

## Architecture

```
Evidence Books™
        ↓
Evidence Connectors™
        ↓
Evidence Registry™         (Sprint 3)
        ↓
Normalization Engine™      (Sprint 4)
        ↓
Resolution Engine™         (Sprint 5)
        ↓
Canonical Intelligence Domains™   (Sprint 6)
        ↓
Scan Orchestrator™         (Sprint 7)
        ↓
Monitoring & Change Detection™    (Sprint 8)
        ↓
Mission Control Data API™         (Sprint 9)
        ↓
ATHENA™ Intelligence Engine       (Sprint 10)
        ↓ ← Executive Brief™ Engine consumes from here
Executive Brief™ Engine           (Sprint 11)
        ↓
Mission Control™ / Email / PDF / API
```

**Constitutional Constraint:** The Executive Brief™ Engine must never import from `api/evidence`, `api/registry`, `api/normalization`, `api/resolution`, `api/orchestrator`, `api/monitoring`, or `api/athena` directly. All intelligence arrives as function parameters.

---

## Inputs

`assembleExecutiveBrief(apiResponses, athenaReport)` accepts:

```js
// Mission Control Data API™ response map (Sprint 9)
const apiResponses = {
  identity:         identityResponse,
  musicRights:      musicRightsResponse,
  catalog:          catalogResponse,
  distribution:     distributionResponse,
  monitoring:       monitoringResponse,
  systemOperations: systemOperationsResponse,
};

// ATHENA™ report (Sprint 10)
const athenaReport = ATHENA_ENGINE.analyze(apiResponses);

const brief = assembleExecutiveBrief(apiResponses, athenaReport);
```

The engine extracts `response.data` only from `SUCCESS` responses. All other statuses produce graceful UNAVAILABLE sections.

---

## Outputs

`assembleExecutiveBrief` returns a deep-frozen `ExecutiveBrief`:

```js
{
  briefId:       uuid,
  version:       '1.0.0',
  generatedAt:   ISO8601,
  summary:       ExecutiveSummary,
  metrics:       ExecutiveMetrics,
  timeline:      Timeline,
  recommendations: ExecutiveRecommendations,
  sections:      Section[9],
  engineVersion: EXECUTIVE_BRIEF_ENGINE_VERSION,
}
```

All nested objects are deep-frozen. No consumer may mutate the brief.

---

## Assembly Pipeline

The assembler runs in this sequence, ensuring each component has what it needs:

```
1. buildExecutiveMetrics(apiResponses, athenaReport)
2. buildTimeline(apiResponses, athenaReport)
3. buildExecutiveSummary(apiResponses, athenaReport, metrics, timeline)
4. buildExecutiveRecommendations(athenaReport)
5. buildAllSections(apiResponses, athenaReport, recommendations)
6. compose brief → deep-freeze → return
```

---

## Executive Summary™

The summary surfaces the top-level executive view:

| Field | Source |
|---|---|
| `overallHealth` | ATHENA™ healthSummary.overallLevel |
| `executiveScore` | 100 − riskScore (higher = better) |
| `riskScore` | ATHENA™ riskAnalysis.riskScore |
| `topPriorities` | URGENT + HIGH recommendations, top 5 |
| `highestRisks` | CRITICAL + HIGH risks, top 5 |
| `biggestOpportunities` | URGENT + HIGH opportunities, top 3 |
| `latestSignificantChanges` | monitoring timeline, top 5 (newest-first) |

---

## Sections

Nine immutable sections in canonical order:

| # | Type | Title | Source |
|---|---|---|---|
| 1 | `identity_intelligence` | Identity Intelligence™ | `apiResponses.identity` |
| 2 | `music_rights` | Music Rights™ | `apiResponses.musicRights` |
| 3 | `catalog` | Catalog™ | `apiResponses.catalog` |
| 4 | `distribution` | Distribution™ | `apiResponses.distribution` |
| 5 | `monitoring` | Monitoring™ | `apiResponses.monitoring` |
| 6 | `system_operations` | System Operations™ | `apiResponses.systemOperations` |
| 7 | `athena` | ATHENA™ Intelligence | `athenaReport` |
| 8 | `recommendations` | Executive Recommendations™ | `executiveRecommendations` |
| 9 | `appendix` | Appendix™ | metadata + scan context |

**Section Status:**
- `COMPLETE` — data available and SUCCESS
- `PARTIAL` — data available but attention required (e.g., critical monitoring alerts)
- `UNAVAILABLE` — no SUCCESS response for this domain

---

## Executive Metrics™

Structured metrics across 6 domains:

```js
{
  identity:     { verificationCoverage, providerCount, verifiedProviders, hasIpi, hasIsni },
  rights:       { publisherKnown, proAffiliated, iswcRegistered },
  catalog:      { releaseCount, isrcCoverage, hasLabel },
  distribution: { hasDistributor, dspCoverage, activeStore },
  monitoring:   { totalChanges, criticalAlerts, highAlerts, totalAlerts },
  executive:    { riskScore, riskLevel, overallHealth, executiveScore, totalRecommendations, urgentRecommendations, highRecommendations },
}
```

---

## Timeline™

Events and alerts from monitoring, sorted:
- **Events:** newest-first (by `timestamp` or `detectedAt`)
- **Alerts:** by severity (CRITICAL → HIGH → MEDIUM → LOW → INFORMATIONAL), then newest-first

---

## Formatting Engine™

`formatBrief(brief, format)` supports:

| Format | Status | Notes |
|---|---|---|
| `json` | ACTIVE | Deterministic JSON with sorted keys |
| `pdf` | FUTURE | Reserved for a future release |
| `html` | FUTURE | Reserved for a future release |
| `email` | FUTURE | Reserved for a future release |
| `api` | FUTURE | Reserved for a future release |

JSON output uses a sorted-key replacer for deterministic serialization.

---

## Versioning

- Current version: `executive-brief-engine-v1`
- `engineVersion` is present on all brief outputs
- No breaking changes to output shape without a new Board brief and version bump

---

## Future Export Strategy

Future formats (PDF, HTML, Email, API) extend `formatting.js` and are activated by adding an `implemented: true` handler to `FORMAT_REGISTRY`. No changes to the assembler, sections, or summary pipeline are required.

---

## Consumers

| Consumer | Entry Point |
|---|---|
| Mission Control™ | `assembleExecutiveBrief(apiResponses, athenaReport)` |
| Email Delivery | `formatBrief(brief, 'email')` (future) |
| PDF Generation | `formatBrief(brief, 'pdf')` (future) |
| External API | `formatBrief(brief, 'api')` (future) |

---

## File Map

| File | Role |
|---|---|
| `version.js` | `EXECUTIVE_BRIEF_ENGINE_VERSION` |
| `formatting.js` | `formatBrief` — Formatting Engine™; FORMAT_TYPES, FORMAT_REGISTRY |
| `metrics.js` | `buildExecutiveMetrics` — 6-domain executive metrics |
| `timeline.js` | `buildTimeline` — sorted events + alerts from monitoring |
| `summary.js` | `buildExecutiveSummary` — Executive Summary™ |
| `recommendations.js` | `buildExecutiveRecommendations` — grouped by priority |
| `sections.js` | `buildAllSections` + 9 individual section builders; SECTION_TYPES, SECTION_ORDER, SECTION_STATUS |
| `assembler.js` | `assembleExecutiveBrief` — sole assembly entrypoint |
| `validate.js` | `validateBrief`, `validateSummary`, `validateSections`, `validateTimeline`, `validateRecommendationReferences`, `validateFormatting` |
| `index.js` | `createExecutiveBriefEngine` factory + `EXECUTIVE_BRIEF_ENGINE` singleton + full re-exports |
| `EXECUTIVE_BRIEF_ENGINE.md` | This document |

Tests: `tests/executive-brief-test.mjs`
