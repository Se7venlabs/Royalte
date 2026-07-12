# Scan Orchestrator™ — Sprint 7

**Status:** Board-Ratified  
**Sprint:** Sprint 7 — Scan Orchestrator™  
**Constitutional Principle:** The Orchestrator coordinates execution. It never performs evidence collection, normalization, resolution, or domain logic.

---

## Position in Architecture

```
User Scan Request
        ↓
Scan Orchestrator™        ← Sprint 7 (THIS MODULE)
        ↓
Provider Connectors™       ← Executor interface (wired externally)
        ↓
Evidence Registry™         ← Sprint 3
        ↓
Normalization Engine™      ← Sprint 4
        ↓
Evidence Resolution Engine™← Sprint 5
        ↓
Canonical Intelligence Domains™ ← Sprint 6
        ↓
Mission Control™ / ATHENA™ / Executive Brief™
```

---

## Constitutional Laws

1. **The Orchestrator is the sole component authorized to execute the complete scan pipeline.** No other module may initiate the pipeline sequence.
2. **The Orchestrator coordinates execution only.** It never contains business logic, never collects evidence, never normalizes, never resolves, never refreshes domains.
3. **Every scan follows the constitutional lifecycle.** No stage may be skipped or reordered.
4. **Stage executors are injected.** The Orchestrator declares the interface; the Core Intelligence Engine provides the implementation.
5. **Scan states are immutable.** Each lifecycle transition produces a new frozen state; inputs are never mutated.
6. **Failures terminate cleanly.** A failed stage transitions the scan to FAILED/TIMED_OUT and returns. The Core Intelligence Engine is never corrupted.
7. **No stage may execute out of order.** Pipeline order is constitutionally locked.
8. **The Orchestrator never throws.** All outcomes are returned as scan state.

---

## Scan Lifecycle™

```
SCAN_REQUESTED            — initial state; scan created, not started
        ↓
CONNECTORS_STARTED        — evidence collection in progress
        ↓
EVIDENCE_COLLECTED        — all provider evidence collected
        ↓
REGISTRY_COMPLETE         — evidence stored in Evidence Registry™
        ↓
NORMALIZATION_COMPLETE    — Normalized Records™ produced
        ↓
RESOLUTION_COMPLETE       — Resolution Records™ produced
        ↓
DOMAINS_REFRESHED         — Canonical Intelligence Domains™ updated
        ↓
SCAN_COMPLETE             — terminal success

Any stage may transition to:
    SCAN_FAILED            — terminal: stage executor error
    SCAN_CANCELLED         — terminal: cancellation requested
    SCAN_TIMED_OUT         — terminal: stage exceeded timeout
```

---

## Scan State™

```
scanId              — UUID
status              — PENDING | RUNNING | WAITING | COMPLETED | FAILED | CANCELLED | TIMED_OUT
lifecycleStage      — current stage in the lifecycle
lifecycleHistory    — append-only log of all stage transitions
startedAt           — ISO timestamp (set on first RUNNING transition)
completedAt         — ISO timestamp (set on SCAN_COMPLETE)
failedAt            — ISO timestamp (set on SCAN_FAILED)
cancelledAt         — ISO timestamp (set on SCAN_CANCELLED)
timedOutAt          — ISO timestamp (set on SCAN_TIMED_OUT)
error               — { code, message } or null
cancelRequested     — boolean (set by cancel())
scanRequest         — original scan request (frozen)
stageResults        — { [lifecycleStage]: result } for each completed stage
metadata            — arbitrary metadata (frozen)
engineVersion       — orchestrator version
createdAt           — ISO timestamp
updatedAt           — ISO timestamp (updated on every transition)
```

---

## Event System™

Events emitted during the scan lifecycle:

| Event | When |
|---|---|
| `SCAN_REQUESTED` | Scan begins execution |
| `CONNECTORS_STARTED` | Connector stage begins |
| `EVIDENCE_COLLECTED` | Connector stage completes |
| `REGISTRY_COMPLETE` | Registry stage completes |
| `NORMALIZATION_COMPLETE` | Normalization stage completes |
| `RESOLUTION_COMPLETE` | Resolution stage completes |
| `DOMAINS_REFRESHED` | Domain refresh stage completes |
| `SCAN_COMPLETED` | Scan reaches SCAN_COMPLETE |
| `SCAN_FAILED` | Any stage fails |
| `SCAN_CANCELLED` | Cancellation processed |
| `SCAN_TIMED_OUT` | Any stage exceeds timeout |
| `PIPELINE_STAGE_STARTED` | Generic: stage begins (no dedicated start event) |
| `PIPELINE_STAGE_COMPLETED` | Generic: stage completes |
| `PIPELINE_STAGE_FAILED` | Generic: stage fails |
| `CONNECTOR_STARTED` | Per-connector event (emitted by executor) |
| `CONNECTOR_COMPLETED` | Per-connector event (emitted by executor) |
| `CONNECTOR_FAILED` | Per-connector event (emitted by executor) |

Subscribe with wildcard `'*'` to receive all events.

---

## Stage Executors

Each executor is an async function with this interface:

```js
async function executor({ scanId, stage, request, previousResults }) {
  // ... perform stage work ...
  return stageResult;   // any serializable object
  // or throw on failure
}
```

The Orchestrator calls executors in this order:

| Executor Key | Produces Stage |
|---|---|
| `connectors` | `EVIDENCE_COLLECTED` |
| `registry` | `REGISTRY_COMPLETE` |
| `normalization` | `NORMALIZATION_COMPLETE` |
| `resolution` | `RESOLUTION_COMPLETE` |
| `domains` | `DOMAINS_REFRESHED` |

---

## Failure Recovery™

| Failure Type | Recovery |
|---|---|
| Executor throws | → SCAN_FAILED; error recorded in state; SCAN_FAILED event emitted |
| Stage timeout | → SCAN_TIMED_OUT; SCAN_TIMED_OUT event emitted |
| Cancellation requested | → SCAN_CANCELLED at next stage boundary; SCAN_CANCELLED event emitted |
| Missing executor | → SCAN_FAILED; EXECUTOR_NOT_FOUND error code |
| Invalid scan request | → Immediate error return; scan never starts |

Failures never corrupt the Core Intelligence Engine. Each scan is isolated.

---

## Replay Strategy

A scan may be replayed by creating a new scan with the same `scanRequest`. The Orchestrator assigns a new `scanId` for each invocation. Stage results from a prior scan may be passed in `previousResults` by a caller that retains them, but the Orchestrator makes no assumptions about replay — every scan is treated as fresh.

---

## Public API

```js
import { SCAN_ORCHESTRATOR, createScanOrchestrator } from './api/orchestrator/index.js';

// Run a scan with default stub executors
const { success, scanId, state, error } = await SCAN_ORCHESTRATOR.scan({
  artistId: 'apple-A001',
  artistName: 'The Weeknd',
});

// Create a wired orchestrator with real executors
const orchestrator = createScanOrchestrator({
  stageExecutors: {
    connectors:    myConnectorExecutor,
    registry:      myRegistryExecutor,
    normalization: myNormalizationExecutor,
    resolution:    myResolutionExecutor,
    domains:       myDomainsExecutor,
  },
  options: { stageTimeout: 30_000, maxConcurrentScans: 3 },
});

// Subscribe to events
orchestrator.on('SCAN_COMPLETED', event => console.log('Done', event.scanId));
orchestrator.on('*', event => console.log(event.eventType, event.scanId));

// Cancel a running scan
orchestrator.cancel(scanId);

// Inspect state
const state = orchestrator.getState(scanId);
const all   = orchestrator.listScans();
```

---

## DO NOT BUILD (Sprint 7 Boundary)

- No provider logic or evidence collection
- No Evidence Contract implementation
- No Evidence Registry logic
- No Normalization logic
- No Resolution logic
- No Canonical Domain logic
- No UI rendering
- No ATHENA™ intelligence
- No Executive Brief generation

All of the above require separate Board briefs or belong to Sprints 1–6.
