# Mission Control Data API™

**Sprint 9 — Canonical Intelligence Platform™**
**Status:** Board-locked v1.0 — 2026-07-12

---

## Constitutional Mission

> The Mission Control Data API™ is the single constitutional gateway between the Canonical Intelligence Platform™ and every application built on top of it.
>
> **One Platform. One API. Many Consumers.**

No application may communicate directly with:
- Evidence Registry™
- Normalization Engine™
- Resolution Engine™
- Canonical Intelligence Domains™
- Monitoring Engine™

All access routes through the Mission Control Data API™.

---

## Architecture

```
Canonical Intelligence Platform(tm)  (Sprints 1–8)
    Evidence Registry | Normalization | Resolution |
    Canonical Domains | Scan Orchestrator | Monitoring
            |
            | (platform internals — never accessed directly)
            v
Mission Control Data API(tm)  (Sprint 9)
            |
    ┌───────┴──────────────────────┐
    │         consumers            │
    ├──────────────────────────────┤
    │ Mission Control(tm)          │
    │ Executive Intelligence(tm)   │
    │ ATHENA(tm)                   │
    │ Executive Brief(tm)          │
    │ Mobile Applications          │
    │ Partner Integrations         │
    └──────────────────────────────┘
```

---

## Endpoint Registry™

All public endpoints are registered at startup. Every registered endpoint includes:

| Field | Description |
|---|---|
| `endpointId` | Unique endpoint identifier (one of `API_ENDPOINTS`) |
| `version` | API version (`v1`) |
| `consumer` | Primary consumer type |
| `responseSchema` | Field contract for the response's `data` object |
| `status` | `ACTIVE`, `DEPRECATED`, or `RESERVED` |

### Registered Endpoints (v1)

| endpointId | Domain | Consumer | Status |
|---|---|---|---|
| `identity` | Canonical Artist Identity | mission_control | ACTIVE |
| `music_rights` | Music Rights & Publishing | mission_control | ACTIVE |
| `catalog` | Catalog Intelligence | mission_control | ACTIVE |
| `distribution` | Distribution Availability | mission_control | ACTIVE |
| `monitoring` | Monitoring & Change Detection | mission_control | ACTIVE |
| `system_operations` | System Operations | mission_control | ACTIVE |
| `executive_overview` | Executive Overview (all domains) | executive_intelligence | ACTIVE |

---

## Response Models™

Every API response is an immutable envelope:

```js
{
  apiVersion:  'v1',
  generatedAt: '2026-07-12T00:00:00.000Z',   // ISO 8601
  endpoint:    'identity',
  status:      'SUCCESS',
  scanId:      string | null,
  artistId:    string | null,
  domain:      string,
  data:        { ...domain-specific payload },
  metadata:    { engineVersion: '1.0.0', ...optional },
}
```

Response objects are deep-frozen. No consumer may mutate a response.

### Response Statuses

| Status | Meaning |
|---|---|
| `SUCCESS` | Canonical Intelligence returned |
| `NOT_FOUND` | Requested endpoint is not registered |
| `ERROR` | An error occurred during response construction |
| `UNAVAILABLE` | Domain data temporarily unavailable |

---

## Endpoint Reference

### `getIdentity({ canonicalDomains, scanId, artistId })`

Returns artist identity intelligence from `canonicalDomains.identity`.

### `getMusicRights({ canonicalDomains, scanId, artistId })`

Returns music rights and publishing intelligence from `canonicalDomains.publishing` and `canonicalDomains.music_rights`.

### `getCatalog({ canonicalDomains, scanId, artistId })`

Returns catalog intelligence from `canonicalDomains.catalog`.

### `getDistribution({ canonicalDomains, scanId, artistId })`

Returns distribution availability intelligence from `canonicalDomains.distribution`.

### `getMonitoring({ timeline, alerts, latestChanges, snapshotId, scanId, artistId })`

Returns monitoring and change detection intelligence. Accepts monitoring data directly (from Monitoring Engine output). Does not call the Monitoring Engine internally.

### `getSystemOperations({ canonicalDomains, scanId, artistId })`

Returns system operations intelligence from `canonicalDomains.system_operations`.

### `getExecutiveOverview({ canonicalDomains, timeline, alerts, scanId, artistId })`

Returns an aggregated view across all Canonical Intelligence Domains plus monitoring summary. This is the primary endpoint for executive surfaces.

### `dispatch(endpointId, params)`

Generic dispatch — routes `endpointId` to the correct handler. Returns a `NOT_FOUND` response for unregistered endpoints.

### `call(endpointId, params)`

Registry-verified dispatch — checks endpoint registration before calling. Returns a `NOT_FOUND` response if endpoint is not registered.

---

## Versioning Strategy

- Current version: **v1**
- The `apiVersion` field is present on every response
- Version compatibility is validated in `validate.js`
- Deprecation: set `status: 'DEPRECATED'` on endpoint registration; the endpoint remains callable but signals to consumers that a new version exists
- Future versions add new endpoints with a new `version` value; v1 endpoints remain stable

---

## Serialization™

Default format: **JSON** (deterministic — keys sorted recursively).

```js
// JSON serialization
const json = api.serializeToJson(response);

// Generic serialization (format-agnostic, v1 = JSON only)
const serialized = api.serialize(response, 'json');

// Round-trip integrity check
const { valid, missingKeys } = verifySerializationIntegrity(response);
```

Future formats (not yet implemented): GraphQL-compatible, mobile binary, partner API envelope.

---

## Consumer Rules

1. Never import from `api/resolution/`, `api/normalization/`, `api/evidence/`, `api/orchestrator/`, or `api/monitoring/` directly
2. Always call through `MISSION_CONTROL_API` singleton or a `createMissionControlApi()` factory instance
3. Never mutate a response object — all responses are deep-frozen
4. Always check `response.status` before reading `response.data`
5. Include `apiVersion` in any stored response to support future migration

---

## Future Expansion

| Area | Notes |
|---|---|
| GraphQL | `serialization.js` serialization layer is format-agnostic; add `GRAPHQL` case |
| Mobile | Add `MOBILE` format in `SERIALIZATION_FORMATS`; add mobile envelope wrapper |
| Partner APIs | Register new endpoints with `consumer: 'partner'` and versioned schemas |
| Webhooks | Future: event-driven API — `dispatch` routes to webhook payloads |
| Authentication | Future: consumer authentication gates; `CONSUMER_TYPES` already defined |

---

## File Map

| File | Role |
|---|---|
| `version.js` | `MISSION_CONTROL_API_VERSION` |
| `types.js` | All type constants: endpoints, versions, statuses, consumer types, formats |
| `schemas.js` | Response schema per endpoint; `assertSchemaCoverage()` validates at startup |
| `registry.js` | `createEndpointRegistry`, `buildDefaultRegistry` — sole endpoint registrar |
| `responses.js` | `createApiResponse`, `createSuccessResponse`, `createErrorResponse` — immutable envelopes |
| `serialization.js` | `serializeToJson`, `deserializeFromJson`, `serializeResponse`, `verifySerializationIntegrity` |
| `validation.js` | Validation for endpoints, responses, schemas, versioning |
| `routes.js` | `getIdentity`, `getMusicRights`, `getCatalog`, `getDistribution`, `getMonitoring`, `getSystemOperations`, `getExecutiveOverview`, `dispatch` |
| `index.js` | `createMissionControlApi` factory + `MISSION_CONTROL_API` singleton + re-exports |
| `MISSION_CONTROL_API.md` | This document |

Tests: `tests/mission-control-api-test.mjs`
