# Mission Control™ Integration Layer

**Sprint 12 — Canonical Intelligence Platform™**
**Status:** Board-locked v1.0 — 2026-07-12

---

## Constitutional Mission

> Mission Control™ answers one question:
>
> **How does Royaltē present Canonical Intelligence through a unified executive workspace?**

Mission Control™ is the executive presentation layer.

- It **consumes** platform intelligence.
- It **never** generates intelligence.
- It **never** resolves intelligence.
- It **never** performs AI reasoning.
- It **presents** executive information.

---

## Architecture

```
Mission Control™ (presentation)
        ↓
Mission Control™ Integration Layer     (Sprint 12)
        ↓
Mission Control Data API™              (Sprint 9)  ←── sole data gateway
        ↓
Executive Brief™ Engine                (Sprint 11)
        ↓
ATHENA™ Intelligence Engine            (Sprint 10)
        ↓
Canonical Intelligence Platform™       (Sprints 1–8)
```

**Constitutional Constraint:** The Integration Layer must never import from `api/evidence`, `api/registry`, `api/normalization`, `api/resolution`, `api/orchestrator`, `api/monitoring`, or `api/athena` directly. All intelligence arrives as function parameters (`apiResponses`, `athenaReport`, `executiveBrief`).

---

## Workspace Mapping

Ten Mission Control™ workspaces are wired to the platform:

| Workspace ID | Name | Required Endpoint Keys | Data Source |
|---|---|---|---|
| `identity` | Identity Intelligence™ | `identity` | Mission Control Data API™ |
| `music_rights` | Publishing Intelligence™ | `musicRights` | Mission Control Data API™ |
| `catalog` | Catalog Intelligence™ | `catalog` | Mission Control Data API™ |
| `distribution` | Global Distribution™ | `distribution` | Mission Control Data API™ |
| `monitoring` | Monitoring™ | `monitoring` | Mission Control Data API™ |
| `backend` | Backend Verification™ | all 6 domain keys | Mission Control Data API™ |
| `health` | Health Intelligence™ | all 6 domain keys | Mission Control Data API™ + ATHENA™ |
| `overview` | Executive Overview™ | `executiveOverview` | Mission Control Data API™ + ATHENA™ |
| `athena` | ATHENA™ | — (direct parameter) | ATHENA™ Engine |
| `executive_brief` | Executive Brief™ | — (direct parameter) | Executive Brief™ Engine |

---

## API Dependencies

```js
// Primary entry point
const bindings = bindAllWorkspaces(apiResponses, athenaReport, executiveBrief);

// Individual workspace
const identityData = bindWorkspace('identity', apiResponses);
const athenaData   = bindWorkspace('athena',   {}, athenaReport);
const briefData    = bindWorkspace('executive_brief', {}, null, executiveBrief);
```

**`apiResponses`** is the response map from Mission Control Data API™:
```js
{
  identity:          identityResponse,
  musicRights:       musicRightsResponse,
  catalog:           catalogResponse,
  distribution:      distributionResponse,
  monitoring:        monitoringResponse,
  systemOperations:  systemOperationsResponse,
  executiveOverview: executiveOverviewResponse,  // optional
}
```

---

## Consumer Responsibilities

Each workspace receives a frozen `WorkspaceBinding`:

```js
{
  workspaceId: string,
  status:      'POPULATED' | 'PARTIAL' | 'UNAVAILABLE',
  data:        object,        // workspace-specific, deep-frozen
  dataSource:  string,        // 'mission_control_api_v1' | 'athena_engine_v1' | ...
  generatedAt: ISO8601,
}
```

**Workspace status:**
- `POPULATED` — all required endpoint data is available
- `PARTIAL` — some required endpoint data is available
- `UNAVAILABLE` — no required data is available; `data` is `{}`

**Consumer rules:**
- Check `status` before rendering. Show a graceful empty state for `UNAVAILABLE`.
- Never access platform engines directly to supplement unavailable data.
- Never perform calculations or business logic on workspace data.

---

## Endpoint Key Mapping

The MC Data API uses snake_case endpoint IDs; `apiResponses` maps use camelCase:

| Endpoint ID | Response Key |
|---|---|
| `identity` | `identity` |
| `music_rights` | `musicRights` |
| `catalog` | `catalog` |
| `distribution` | `distribution` |
| `monitoring` | `monitoring` |
| `system_operations` | `systemOperations` |
| `executive_overview` | `executiveOverview` |

---

## Integration Architecture

### Health Intelligence™

Assembles from all 6 domain endpoints. If ATHENA™ is provided:
- `overallHealth` and `domainStatuses` come from `athenaReport.executiveAnalysis.healthSummary`
- `executiveScore = 100 − riskScore`

Without ATHENA™: `overallHealth` defaults to `'UNKNOWN'`; domain availability flags still populate.

### Backend Verification™

Operational dashboard only. Displays:
- `evidenceCompleteness` — per-endpoint SUCCESS/UNAVAILABLE status
- `connectorHealth` — `{ activeConnectors, totalConnectors, healthPercentage }`
- `registryHealth` — scan ID and completion status
- `providerAvailability` — identity verification summary
- `monitoringHealth` — alert counts
- `overallStatus` — HEALTHY / DEGRADED / UNAVAILABLE

Backend Verification performs no calculations. All values are direct observations from API response statuses.

### ATHENA™ Workspace

Display-only consumer of the ATHENA™ report. Surfaces:
- `healthSummary`, `riskScore`, `riskLevel`
- `criticalRisks[]`, `highRisks[]`, `opportunities[]`, `recommendations[]`
- `urgentCount`, `highCount`, `totalRecommendations`

No AI execution occurs in the workspace.

### Executive Brief™ Workspace

Presents the assembled brief from Sprint 11. The workspace never assembles its own report. All sections, metrics, timeline, and recommendations are surfaced as-is from the brief.

---

## Validation

```js
// Validate a single workspace binding
const { valid, errors } = validateWorkspaceBinding(binding);

// Validate all workspace bindings together
const { valid, errors } = validateAllBindings(bindings);

// Check constitutional compliance (no forbidden platform imports)
const { valid, violations } = validateNoDirectPlatformImports(sourceCode, fileName);
```

---

## Future Expansion

New workspaces are added by:
1. Adding an entry to `WORKSPACE_REGISTRY` in `workspaces.js`
2. Adding a transformer in `transformers.js`
3. Adding a binder function in `binding.js` and registering it in `BINDERS`
4. No changes to `index.js`, `validate.js`, or `graceful.js` required

---

## File Map

| File | Role |
|---|---|
| `version.js` | `MC_INTEGRATION_VERSION` |
| `workspaces.js` | `WORKSPACE_REGISTRY`, `WORKSPACE_IDS`, `WORKSPACE_STATUS`, `ENDPOINT_ID_TO_RESPONSE_KEY`, `VALID_WORKSPACE_IDS` |
| `graceful.js` | Status computation, `makeUnavailableWorkspace`, `makeWorkspaceBound`, `isResponseAvailable` |
| `transformers.js` | Per-workspace data extraction from API response envelopes |
| `binding.js` | `bindWorkspace`, `bindAllWorkspaces` — sole binding entrypoint |
| `validate.js` | `validateWorkspaceBinding`, `validateAllBindings`, `validateNoDirectPlatformImports` |
| `index.js` | `createMcIntegrationLayer` factory + `MC_INTEGRATION` singleton + full re-exports |
| `MISSION_CONTROL_INTEGRATION.md` | This document |

Tests: `tests/mission-control-integration-test.mjs`
