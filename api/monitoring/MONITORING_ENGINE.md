# Monitoring & Change Detection Engine™

**Sprint 8 — Canonical Intelligence Platform™**
**Status:** Board-locked v1.0 — 2026-07-12

---

## Constitutional Mission

The Monitoring Engine™ answers one question:

> **What has changed since the last verified Canonical Intelligence snapshot?**

It **observes** Canonical Intelligence. It **never creates** Canonical Intelligence. It **never modifies** Canonical Intelligence.

---

## Architecture

```
Scan Orchestrator(tm) (Sprint 7)
        |
        | recordScan({ scanId, artistId, canonicalDomains, ... })
        v
Monitoring Engine(tm) (Sprint 8)
        |
        |-- buildSnapshotFromScanResult()   --> Canonical Snapshot(tm)
        |-- compareSnapshots()              --> ComparisonResult
        |-- generateTimeline()              --> TimelineEvent[]
        |-- generateAlertsFromTimeline()    --> Alert[]
        |-- createHistoryStore()            --> persists all artifacts
        v
Mission Control(tm) / ATHENA(tm) / Executive Brief(tm)
```

---

## Core Components

### Canonical Snapshot™ (`snapshots.js`)

Every completed scan produces one immutable Canonical Snapshot™.

```js
{
  snapshotId:              string (UUID),
  scanId:                  string,
  artistId:                string,
  timestamp:               ISO 8601 string,
  canonicalDomains:        object (deep-frozen),
  engineVersions:          object,
  scanDuration:            number (ms),
  createdAt:               ISO 8601 string,
  monitoringEngineVersion: string,
}
```

Snapshots are **never modified** after creation. Adding a field to a snapshot in a future sprint requires creating a new snapshot, not mutating the existing one.

### Change Detection Engine™ (`change-engine.js`)

Compares two Canonical Snapshots™ by flattening `canonicalDomains` to dotted leaf paths and performing value-level comparison.

**Algorithm:**
1. Flatten `previousSnapshot.canonicalDomains` → `{ path: value }` map
2. Flatten `currentSnapshot.canonicalDomains` → `{ path: value }` map
3. Paths in current but not previous → `ADDED`
4. Paths in previous but not current → `REMOVED`
5. Paths in both with different values → `MODIFIED`
6. Paths in both with identical values → counted as `UNCHANGED` (not stored individually)

**Determinism guarantee:** Same snapshot pair always produces the same change classifications. IDs (`changeId`, `comparisonId`) are ephemeral UUIDs — only the change logic is replayable.

### Severity Engine™ (`severity.js`)

Board-locked deterministic severity classification.

| Severity    | Examples                                                        |
|-------------|------------------------------------------------------------------|
| CRITICAL    | Ownership, rights, publishing, IPI, ISWC, writer, pro splits    |
| HIGH        | Label, distributor, verification status, ISRC                   |
| MEDIUM      | Metadata, genre, profile changes, release date                  |
| LOW         | Artwork, biography, profile image                               |
| INFORMATION | System events: rescan complete, catalog verified                 |

Classification: `classifyChangeSeverity(domain, field)` — domain = first segment of fieldPath; field = last segment.

### Timeline Engine™ (`timeline.js`)

Converts `FieldChange[]` from the comparison into ordered `TimelineEvent[]`.

- Only `ADDED`, `REMOVED`, `MODIFIED` changes produce timeline events
- `UNCHANGED` is recorded in summary counts only
- Timeline is sorted: highest severity first, then newest timestamp first within same severity

### Alert Engine™ (`alerts.js`)

Groups timeline events by `(severity, domain)` and produces one `Alert` per group.

Alert levels mirror severity levels. CRITICAL alerts always sort first.

### History Store (`history.js`)

In-memory append-only store. State is never mutated after insertion.

| Operation               | Description                                          |
|-------------------------|------------------------------------------------------|
| `addSnapshot`           | Stores snapshot; throws on duplicate snapshotId      |
| `getLatestSnapshot`     | Returns newest snapshot for artistId                 |
| `getPreviousSnapshot`   | Returns snapshot directly preceding the given one    |
| `listSnapshots`         | Returns all snapshots for artistId in insertion order|
| `addComparison`         | Stores comparison result                             |
| `addTimelineEvents`     | Appends timeline events for artistId                 |
| `addAlerts`             | Appends alerts for artistId                          |
| `getTimelineEvents`     | Filtered query by domain/severity/changeType/limit   |
| `getAlerts`             | Filtered query by level/domain/limit                 |

---

## Public API (`index.js`)

### `createMonitoringEngine({ historyStore? })` → `MonitoringEngine`

Factory. Accepts an optional injected `historyStore` (for testing). Returns frozen engine.

### `MONITORING_ENGINE`

Singleton using the default in-memory history store.

### Engine Methods

| Method                                    | Returns                        |
|-------------------------------------------|--------------------------------|
| `recordScan(scanInput)`                   | `RecordScanResult` (frozen)    |
| `getTimeline(artistId, opts?)`            | `TimelineEvent[]` (frozen)     |
| `getLatestChanges(artistId)`              | `ComparisonResult` or `null`   |
| `getAlerts(artistId, opts?)`              | `Alert[]` (frozen)             |
| `getSnapshot(snapshotId)`                 | `Snapshot` or `null`           |
| `compareSnapshots(previous, current)`     | `ComparisonResult` (frozen)    |
| `getHistory(artistId)`                    | `Snapshot[]` (frozen)          |

### `recordScan` Input

```js
{
  scanId:           string,
  artistId:         string,
  canonicalDomains: object,
  engineVersions:   object?,
  scanDuration:     number?,
  timestamp:        ISO 8601 string?,
}
```

### `recordScan` Output

```js
{
  success:     true,
  firstScan:   boolean,   // true if no prior snapshot for artistId
  snapshot:    Snapshot,
  comparison:  ComparisonResult | null,
  timeline:    TimelineEvent[],
  alerts:      Alert[],
  changeCount: number,
}
```

---

## Consumers

| Consumer          | What it uses                                     |
|-------------------|--------------------------------------------------|
| Mission Control™  | `getTimeline`, `getAlerts`, `getLatestChanges`   |
| ATHENA™           | `getHistory`, `getLatestChanges`, `getTimeline`  |
| Executive Brief™  | `getAlerts` (CRITICAL/HIGH), `getLatestChanges`  |
| Notifications™    | `getAlerts` (future)                             |

---

## Replay Strategy

The change detection algorithm is fully replayable from immutable snapshot pairs:

1. Store all Canonical Snapshots™ permanently
2. To replay a comparison: call `compareSnapshots(previousSnapshot, currentSnapshot)`
3. To replay a full scan timeline: iterate snapshot pairs in order and compare each consecutive pair

New IDs are generated on each replay, but the change classifications, severities, and field values are identical.

---

## Constitutional Laws

1. The Monitoring Engine™ observes Canonical Intelligence — it never creates or modifies it
2. Every completed scan produces exactly one Canonical Snapshot™
3. Snapshots are immutable — never modified after creation
4. Change detection is deterministic — same snapshots → same changes
5. Severity classification is Board-locked — never computed dynamically
6. History is append-only — no entry is ever removed or modified
7. Alert generation is deterministic — same timeline events → same alerts
8. The engine never throws — errors are returned as structured results where possible

---

## File Map

| File                  | Role                                               |
|-----------------------|----------------------------------------------------|
| `version.js`          | `MONITORING_ENGINE_VERSION` constant               |
| `types.js`            | All type constants and Sets                        |
| `severity.js`         | `classifyChangeSeverity` — Board-locked rules      |
| `snapshots.js`        | `createSnapshot`, `buildSnapshotFromScanResult`    |
| `change-engine.js`    | `compareSnapshots` — sole comparison entrypoint    |
| `events.js`           | `createTimelineEvent`, `buildTimelineEventFromChange` |
| `timeline.js`         | `generateTimeline`, `sortTimeline`, `filterTimeline` |
| `alerts.js`           | `createAlert`, `generateAlertsFromTimeline`        |
| `history.js`          | `createHistoryStore` — append-only store           |
| `validate.js`         | Validation functions for all artifact types        |
| `index.js`            | `createMonitoringEngine`, `MONITORING_ENGINE`, re-exports |
| `MONITORING_ENGINE.md`| This document                                      |

Tests: `tests/monitoring-engine-test.mjs`
