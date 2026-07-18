# Royaltē — Artist Profile Card
# Section 9: Monitoring Timeline™ Field Schema

## Purpose

Define the Monitoring Timeline™ field contract for the Artist Profile Card: continuous change detection since the artist's previous scan. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit prior sections, modify Mission Control, or activate ATHENA. Scope is field-schema completion only. No production code is changed by this document.

Per established practice (Media Intelligence, Health Intelligence), HTML-first review was performed: the live workspace (`public/workspaces/monitoring-timeline.html`) was inventoried before the code was traced.

**Important disambiguation, confirmed by direct trace:** "Monitoring Timeline™" (this workspace — a single-scan "what changed since last time" view, driven by real `monitoringIntelligence.events[]`) is a **different system** from the hardcoded 7-day "Executive Timeline™" mock dataset already found and logged on Health Intelligence (`ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §4, task #53). They share no code. Per the Board's own note approving PR #371, the *intent* is for Health Intelligence's Executive Timeline™ to eventually be *driven by* this Monitoring Timeline architecture — that is a future integration, not a current fact, and is not claimed as implemented here.

---

## Step 1–3: Field Inventory (from the live HTML/JS)

### Bootstrap/static shell (pre-render only)
Hero icon, title ("Monitoring Timeline™"), description ("Continuous change detection and historical monitoring timeline across your music business infrastructure."), and a "Coming Soon" placeholder card (icon, eyebrow, title, description) are present in the raw HTML (`monitoring-timeline.html:137-158`). **This placeholder is not the product state** — on every valid scan, the real renderer (`monitoring-timeline.html:169-431`) immediately overwrites the `.ws-coming-soon` container's `innerHTML`. The static copy only remains visible in the narrow edge case where the container element itself isn't found (defensive null check, line 186-187) — not a realistic production path.

### Dynamic content — four possible visible states

**1. True first-scan / onboarding state** (`mi.status === 'baseline' && mi.scanNumber <= 1`): eyebrow "Baseline Established", title "Monitoring Begins After Your Next Scan", explanatory paragraph. No health snapshot, no coverage grid, no change list — an early-return path, distinct from state 2 below.

**2. Baseline state** (module-computed, `mi.status === 'baseline' || scanNumber <= 1` — reachable only as an edge case not already caught by state 1, e.g. `scanNumber <= 1` with `mi.status` not `'baseline'`): clock icon, eyebrow "Scan #N · {date}", title "Baseline Established", summary text, Health Snapshot badge, **Baseline Scores coverage grid** — 5 rows (Identity Intelligence™, Publishing Intelligence™, Catalog Intelligence™, Backend Intelligence™, Global Music Footprint™ — each a label + score).

**3. Stable state** (`events.length === 0`): pulse icon, eyebrow "Scan #N · {date}", title "No Changes Detected", summary text, Health Snapshot badge, no supplemental content.

**4. Changed state** (`events.length > 0`): pulse icon, eyebrow "Scan #N · {date} · M Changes Detected", title "Changes Detected", summary text, Health Snapshot badge, **Change List** grouped by category — each group: category label header, then per-event rows (colored dot, title, optional description).

### Sub-elements
- **Health Snapshot badge**: "Health Score™ {score}/100 · {status}"
- **Coverage Grid row**: domain label + score (state 2 only)
- **Change List group**: category label + event rows (state 4 only); event row: severity/polarity-colored dot, title, optional description

---

## Step 4–5: Code Trace & Evidence Validation

**The core pipeline is real — same finding as Health Intelligence.** `assembleMonitoringIntelligence()` (`api/_lib/monitoring-intelligence.js:90`) is the real, wired assembler, confirmed already in `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §4: two-phase patch, gated on authenticated scans, `_normalizeMonitoring()` in `runtime-context-mapper.js:76-88` promotes a null first-scan result to a canonical empty baseline object (and otherwise **passes real data through completely unchanged** — confirmed by reading it directly: `if (raw) return raw;`, no event enrichment happens anywhere in the pipeline).

**Real, correctly wired fields:**
- `mi.status`, `mi.scanNumber`, `mi.newThisScan` — real, direct from the assembler.
- `hi.score`, `hi.status`, `hi.identityScore`, `hi.publishingScore`, `hi.catalogScore`, `hi.backendScore`, `hi.footprintScore` — all real, already confirmed in the Health Intelligence trace, reused here for the Health Snapshot and Coverage Grid.
- The true first-scan detection path (state 1) is real and correctly wired.
- Event `title` — real (`normalizeEvent()`, `monitoring-intelligence.js:78-86`, the only text field it guarantees — events with an empty title are filtered out entirely).
- Event `severity` — real, but see vocabulary mismatch below.

**Confirmed gap — real but never rendered:**
- `mi.capturedAt`, `mi.nextScan` (both real fields on the assembler's output, `monitoring-intelligence.js:106-107,114-115`) are never read anywhere in `monitoring-timeline.html`'s renderer. Same class of finding as Health Intelligence's `grade` (task #52).
- Event `changeType` (the real field name) is never read by the renderer at all — it reads `ev.type`, not `ev.changeType`. Since events always have a non-empty `title` (filtered by `normalizeEvent`), the `ev.type` fallback is effectively unreachable dead code in the renderer.

**Major finding — the renderer expects event fields the real assembler does not produce.** `normalizeEvent()` (`monitoring-intelligence.js:78-86`) freezes each event as exactly `{ changeType, title, severity }` — nothing else. But the renderer reads four fields that don't exist on that shape:

| Renderer expects | Real event has it? | Effect in production |
|---|---|---|
| `ev.category` (`buildChangeGroups()`, `monitoring-timeline.html:279`) | No | Every event falls into the `'backend'` default bucket (`(ev.category \|\| 'backend').toLowerCase()`) — **all change events are grouped under "Backend Intelligence™" regardless of their true domain** |
| `ev.polarity` (lines 256, 360) | No | The "improvement" count in the summary text is always 0; the positive/green dot-color branch can never trigger from real data |
| `ev.type` (lines 256, 369) | No (real field is `changeType`) | Same effect as `polarity` on the improvement count; title fallback is dead code |
| `ev.description` (line 370) | No | Silently never renders — not broken, just always absent |

**A second, independent mismatch — severity vocabulary.** The renderer checks `(ev.severity || '').toUpperCase()` against `'CRITICAL'` or `'HIGH'` (`monitoring-timeline.html:257,361`) to count "critical" issues and color dots red. The real, Board-locked severity vocabulary (`VALID_SEVERITIES`, `monitoring-intelligence.js:57`) is `informational | positive | action_needed | monitor` — **none of these ever match `'CRITICAL'` or `'HIGH'`**. Effect: the `critical` count in the summary is always 0, and every event dot renders with the same default (blue/informational) color, regardless of real severity — an `action_needed` event looks identical to an `informational` one.

**Net effect, stated precisely (not alarmist):** the Changed state does not crash and does display real event titles and a real count. But category grouping, the improvements/critical breakdown in the summary text, and severity-based visual urgency all silently degrade to defaults because of this field-name and vocabulary mismatch — the same class of finding as Catalog Intelligence's ISRC Coverage™ KPI field-name mismatch (task #45), not a new kind of defect in this series.

---

## Artist Profile Monitoring Schema

### Section 1 — Implemented Fields

| Field | Classification | Population Source | Current Implementation Reference |
|---|---|---|---|
| Scan Number | Canonical Data Field | Royaltē System | `mi.scanNumber`, real, `monitoring-intelligence.js:111` |
| Monitoring Status (baseline/no_changes/active) | Canonical Data Field | Royaltē System | `mi.status`, `deriveStatus()`, `monitoring-intelligence.js:72-76` |
| New-This-Scan Count | Canonical Data Field | Royaltē System | `mi.newThisScan`, `monitoring-intelligence.js:112` |
| Event Title | Canonical Data Field | Royaltē System (delta engine) | `ev.title`, real, only guaranteed non-empty field per event |
| Event Severity (raw value) | Canonical Data Field | Royaltē System (delta engine) | `ev.severity`, real, but vocabulary mismatch with the renderer (see above) |
| Health Snapshot (score, status) | Canonical Intelligence Field | Royaltē System | `hi.score`/`hi.status`, real, shared with Health Intelligence™ |
| Coverage Grid scores (5 domains) | Canonical Intelligence Field | Royaltē System | `hi.identityScore` etc., real, shared with Health Intelligence™ |
| First-scan onboarding state | Canonical Data Field | Royaltē System | `mi.status === 'baseline' && mi.scanNumber <= 1`, real and correctly wired |

### Section 2 — Implementation Required

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Event Category (for grouping) | `ev.category` does not exist on real events — every event is grouped under a default "backend" bucket | `monitoring-intelligence.js`'s `normalizeEvent()` needs a real `category` field, likely derived from `changeType` or the originating domain assembler |
| Event Polarity / improvement detection | `ev.polarity` does not exist — the "improvements detected" summary count is always 0 | New field on `EventEntry`, populated from the delta engine's own classification of the change (positive vs. negative) |
| Event Description | `ev.description` does not exist — description sub-line never renders | New field on `EventEntry` |
| Severity-based visual urgency | Renderer's `'CRITICAL'`/`'HIGH'` checks never match the real `informational/positive/action_needed/monitor` vocabulary | Either the renderer's severity checks need to be updated to match the real, Board-locked vocabulary, or a new higher-urgency severity tier needs to be added to `VALID_SEVERITIES` — a decision, not just a rename |
| `capturedAt` / `nextScan` display | Both real fields, never rendered | UI-binding gap only — bind to the workspace (e.g. "next scheduled scan" copy) |
| `changeType` (correct field name) | Renderer reads the non-existent `ev.type` instead of the real `ev.changeType` | Fix the renderer's field reference — same class as Catalog's ISRC KPI mismatch |

---

## Monitoring Timeline™ Rules

1. This workspace is a single-scan "what changed" view driven by the real delta engine — it is not the same system as Health Intelligence's hardcoded 7-day Executive Timeline™ mock (task #53). The Board's intent for those two to eventually converge is documented as future direction, not current fact.
2. Monitoring Intelligence™ (`assembleMonitoringIntelligence()`) is the sole constitutional owner of change-detection data. This document does not propose duplicating that logic — every gap in Section 2 is scoped to extending that existing module's output shape.
3. Health Intelligence™ fields reused here (score, status, per-domain scores) are owned by Health Intelligence™, not by this workspace — confirmed already in `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md`.
4. A field belongs in **Section 1 — Implemented Fields** only if traceable to real, committed code today and actually consumed correctly by the renderer. A field that exists on the real assembler but is read under the wrong name by the renderer (`changeType`/`type`) is documented as a mismatch, not counted as either fully implemented or fully missing.
5. No approved field is removed for lack of current support.
6. This document does not authorize fixing the renderer/assembler field-name mismatches — they are documented as gaps and logged as separate engineering tasks.

---

## Deliverable Status

Monitoring Timeline™ field schema — complete:
- ✅ Bootstrap/static shell distinguished from the real, dynamically-rendered product state
- ✅ All four visible states inventoried (onboarding, baseline, stable, changed)
- ✅ Core pipeline (scan number, status, event count, Health Snapshot, Coverage Grid) confirmed real and wired
- ✅ Major finding documented, not fixed: renderer expects `category`/`polarity`/`type`/`description` fields that don't exist on real events, plus an independent severity-vocabulary mismatch (`CRITICAL`/`HIGH` vs. the real `informational/positive/action_needed/monitor` set) — both degrade gracefully, neither crashes, but both silently lose fidelity
- ✅ Two real-but-unrendered fields found (`capturedAt`, `nextScan`)
- ✅ Disambiguated from Health Intelligence's separate Executive Timeline™ mock-data finding
- ✅ No production code changed; no Mission Control changes
- ✅ Ready for review and lock

**Monitoring Timeline™ ready to lock.**
