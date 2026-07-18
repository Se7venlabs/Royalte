# Royaltē — Artist Profile Card
# Section 9: Monitoring Timeline™ Field Schema

## Status note — read before anything else

Unlike Sections 2–8, Monitoring Timeline™ has never been formally architected as a constitutional domain. Per Board directive, this document does **not** assume the current HTML/implementation is final product. It treats the existing implementation as prototype-status unless evidence proves otherwise, and separates findings into three tiers — **Current Prototype**, **Current Production Implementation**, and **Future Constitutional Architecture** — rather than forcing everything into a single "implemented vs. gap" model as prior sections did. Where the implementation exposes architectural inconsistencies, they are documented as findings, not defects.

This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8), does not introduce architecture changes, revisit prior sections, modify Mission Control, or activate ATHENA. Scope is documentation only. No production code is changed.

**Disambiguation, confirmed by direct trace:** "Monitoring Timeline™" (this workspace) is a different system from Health Intelligence's hardcoded 7-day "Executive Timeline™" mock (`ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §4, task #53). They share no code. The Board's stated intent for those two to eventually converge is future direction, not current fact.

---

## 1. What Currently Exists

### 1a. Current Prototype (placeholder, not product)

The raw HTML (`monitoring-timeline.html:137-158`) contains a static hero + "Coming Soon" card (icon, eyebrow, title, "This workspace is being prepared. Check back after your next Board brief."). This is genuinely prototype/placeholder markup — it is not the product state. On every valid scan, a real renderer script (`monitoring-timeline.html:169-431`) immediately overwrites this container's `innerHTML`. The static copy is only visible in the narrow edge case where the container element isn't found (defensive null check, line 186-187) — not a realistic production path, but the presence of "Coming Soon" copy at all is itself evidence this workspace was never signed off as finished, consistent with the Board's framing.

### 1b. Current Production Implementation (real, wired, wholly independent of this document)

This is a materially different finding from the "everything is hardcoded" pattern found on Catalog/Footprint/Backend, and closer to Health Intelligence's mostly-real pipeline:

- `assembleMonitoringIntelligence()` (`api/_lib/monitoring-intelligence.js:90`) is real and wired via the same two-phase, authenticated-scans-only patch already confirmed in `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §4.
- `runtime-context-mapper.js`'s `_normalizeMonitoring()` (lines 76-88) only promotes a null first-scan result to a canonical empty baseline shape — it does not alter real data (`if (raw) return raw;`, confirmed by direct read, no enrichment anywhere in the pipeline).
- `mi.status`, `mi.scanNumber`, `mi.newThisScan` — real, direct from the assembler.
- Event `title` and `severity` — real (see §2 for the full field model).
- Health Snapshot and Coverage Grid reuse `hi.score`, `hi.status`, `hi.identityScore`, `hi.publishingScore`, `hi.catalogScore`, `hi.backendScore`, `hi.footprintScore` — all real, already confirmed in the Health Intelligence trace.
- The true first-scan onboarding state (`mi.status === 'baseline' && mi.scanNumber <= 1`) is real and correctly wired.
- **The delta engine itself** (`api/_lib/delta-engine.js`) is real, production code, not a prototype — it runs on every authenticated scan with a prior snapshot, and writes real rows to `monitoring_alerts`. Its scope is narrow (see §3), but what it does do, it does for real.

### 1c. What is hardcoded

Nothing found in this workspace's own script. Unlike `catalog-intelligence.html`, `global-music-footprint.html`, or `health-timeline.js`, `monitoring-timeline.html`'s renderer contains no embedded fixture/mock dataset — every value it displays is read from `ctx.monitoringIntelligence` / `ctx.healthIntelligence`. The issues found here (§2) are field-shape mismatches between real data and what the renderer expects, not hardcoded placeholder content.

---

## 2. The Actual Event Contract — traced without normalizing field names

Per Board instruction, all four layers were checked independently, with no assumption that names align across layers.

### Layer 1 — What the delta engine actually produces (raw alert, `delta-engine.js`, `buildAlert()`, lines 50-65)

```text
{
  user_id, artist_id, artist_name, scan_id, previous_scan_id,
  detected_at, resolved (boolean, always false — nothing in this
    file ever sets it true), track_name, territory, isrc, platform,
  change_type, severity, title, detail
}
```

Confirmed via all 5 real emitter functions (`emitBaseline`, `emitTerritoryDeltas`, `emitTrackDeltas`, `emitReleaseDeltas`, `emitVideoDeltas`). **Complete `change_type` taxonomy — exactly 10 values, no more:** `baseline_established`, `territory_loss`, `territory_gain`, `isrc_dropped`, `isrc_added`, `isrc_mismatch`, `release_removed`, `release_added`, `video_removed`, `video_added`. **Complete `severity` taxonomy:** `informational`, `action_needed`, `positive`, `monitor` — matches `VALID_SEVERITIES` exactly.

`detail` is real, rich, always-populated text (e.g. *"New release 'Take It All' detected in the current Apple Music catalog."*) — generated per-alert by the emitter that raises it.

### Layer 2 — What Monitoring Intelligence™ actually produces (`monitoring-intelligence.js`, `normalizeEvent()`, lines 78-86)

```text
{ changeType, title, severity }
```

Exactly three fields, frozen. **This layer discards `detail`, `resolved`, `platform`, `territory`, `isrc`, `track_name`, and every identifier field from Layer 1** — not because that data doesn't exist, but because `normalizeEvent()`'s return statement only names three keys. This is a narrowing decision inside `normalizeEvent()` itself, not a fact about what data is available.

### Layer 3 — What Runtime Context receives and passes through (`runtime-context-mapper.js`, `_normalizeMonitoring()`, lines 76-88)

Identical to Layer 2. Confirmed by direct read: when `monitoringIntelligence` is non-null, the function returns it completely unchanged (`if (raw) return raw;`). No transformation, no enrichment, no field renaming happens at this layer. Runtime Context is not the source of any mismatch — it faithfully passes through whatever Layer 2 gives it.

### Layer 4 — What `monitoring-timeline.html` expects on each event

```text
ev.category    (buildChangeGroups(), line 279)
ev.polarity    (lines 256, 360)
ev.type        (lines 256, 369 — checks ev.type === 'RESOLVED')
ev.title       (real, matches Layer 2/3)
ev.description (line 370)
ev.severity    (real, matches Layer 2/3, but see vocabulary check below)
```

### Do the four contracts align? No — documented precisely, not normalized:

| Renderer expects (Layer 4) | Exists at Layer 2/3? | Exists at Layer 1 (raw alert)? | Precise finding |
|---|---|---|---|
| `category` | No | No | **Does not exist anywhere in the pipeline.** Would require new derivation logic (e.g. mapping `change_type` prefixes to a domain) — genuinely new capability, not a dropped field. |
| `polarity` | No | No (as a named field) | **The underlying signal already exists**, just under a different name: `severity: 'positive'` at Layer 1 (and Layer 2/3, since severity passes through) already distinguishes positive changes from `action_needed`/`monitor`/`informational` ones. The renderer's `ev.polarity === 'positive'` check could be satisfied by checking `ev.severity === 'positive'` instead — this is a much smaller gap than "field doesn't exist," it's "renderer checks the wrong field name for a signal that's already there." |
| `type` (checked against `'RESOLVED'`) | No | No | **Corresponds to nothing real at any layer.** Layer 1 has a `resolved` boolean (always `false` in every current emitter), not a `type` string enum, and Layer 2 drops even that. This looks like speculative code referencing a shape that was never implemented, not a dropped field. |
| `description` | No | **Yes — as `detail`** | **Real, rich data exists at Layer 1 and is discarded by `normalizeEvent()`** before it ever reaches Layer 2/3/4. This is the one genuinely "just wire it through" gap — no new data generation needed, only a change to `normalizeEvent()`'s return shape. |
| `severity` value check (`'CRITICAL'`/`'HIGH'`) | Real field, wrong vocabulary | Real field, wrong vocabulary | Layers 1–3 all agree on `informational \| positive \| action_needed \| monitor`. The renderer's check against `'CRITICAL'`/`'HIGH'` matches none of these — an independent vocabulary mismatch, not a missing-field problem. |

**Conclusion: the four contracts do not align.** Per Board instruction, this is documented as the current implementation state — a set of findings, not defects to be silently patched or assumed away.

---

## 3. The Constitutional Capability Gap (the most significant finding in this document)

The Board's stated vision is that Monitoring Timeline™ becomes Royaltē's permanent audit history for Artist Profile changes across nine domains: Identity, Publishing, Catalog, Global Music Footprint, Backend, Media, Health, Settings, and Territory Intelligence.

**Today's delta engine detects changes in exactly three of those nine:**
- Territory / Global Music Footprint (`territory_loss`, `territory_gain`)
- Catalog (`isrc_dropped`, `isrc_added`, `isrc_mismatch`, `release_removed`, `release_added`)
- A raw YouTube-match signal (`video_removed`, `video_added`) — **not** wired to the Media Intelligence domain object (which per `ARTIST_PROFILE_CARD_MEDIA_SCHEMA.md` has no assembler at all); this is an independent, older signal (`getYoutubeMatches()` reads `canonical_data.youtubeMatches`, unrelated to Media Intelligence's own data model).

**Zero change-detection exists for:** Identity Intelligence™, Publishing Intelligence™, Backend Intelligence™, Health Intelligence™, Media Intelligence™ (as its own domain), and Settings. There is no `change_type` value, no emitter function, and no code path anywhere in `delta-engine.js` that produces an alert for any of these six domains.

This is not a UI-binding gap or a field-name mismatch — it is an entirely unbuilt capability. Building it is a significant scope of new work (new emitter functions per domain, each requiring its own definition of what constitutes a "meaningful change" for that domain), not a documentation or rewiring task.

---

## 4. Future Constitutional Architecture

**Status for everything in this section: Phase 1 constitutional design, per Board Implementation Brief. Not built. Not authorized for implementation by this document. No Build Pass has been opened for Monitoring Timeline™ — the Board has explicitly confirmed this remains a documentation exercise only, with implementation deferred to a future, separately-opened, multi-PR engineering initiative.** Everything below is blueprint, to be used as the specification for that future Build Pass — it does not describe, and must never be read as describing, anything that exists in the codebase today. §1–3 above remain the authoritative record of current state.

### 4.1 Constitutional Purpose

Monitoring Timeline™ is not an activity log. It is the permanent historical record of every meaningful change that occurs within an Artist Profile — answering one question: *"What happened to this artist's digital business over time?"* Every significant discovery, correction, synchronization, user update, and system intelligence event is intended to ultimately be recorded here. This is designed to become the historical memory of Royaltē.

**Core principle:** Monitoring Timeline™ does not create events. It receives events from every constitutional domain. Mission Control displays those events. The Artist Profile owns the history. Monitoring Timeline™ never calculates business logic — it only records the result.

### 4.2 Architectural Relationships

```text
Identity Intelligence™
        │
Publishing Intelligence™
        │
Catalog Intelligence™
        │
Global Music Footprint™
        │
Backend Intelligence™
        │
Media Intelligence™
        │
Health Intelligence™
        │
Settings
        │
Future Territory Intelligence™
        │
        ▼
Change Detection Engine
        │
        ▼
Monitoring Event Engine
        │
        ▼
Artist Profile Timeline Store
        │
        ▼
Monitoring Timeline™ UI
```

Every domain publishes events into this pipeline; none of them read from it. Monitoring Timeline™ (and its future Event Engine) is a pure sink for the other nine domains and a pure source for the UI layer — it does not feed back into any domain's own scoring or state.

### 4.3 Canonical Event Model (proposed constitutional contract)

Every future event is proposed to carry:

| Field | Notes |
|---|---|
| Event ID | unique identifier |
| Artist Profile ID | owning artist |
| Timestamp (UTC) | when the event occurred |
| Source Workspace | which domain published it |
| Event Category | see §4.4 |
| Event Type | specific event, e.g. "Record Label Updated" |
| Severity | see §4.4 |
| Previous Value | prior state, where applicable |
| New Value | resulting state, where applicable |
| Human Summary | plain-language description |
| Technical Details | structured/debug detail |
| User Initiated (Yes/No) | distinguishes artist actions from system detection |
| System Generated (Yes/No) | complement of the above |
| Scan ID (optional) | links to the triggering scan, where applicable |
| Provider (optional) | e.g. Apple Music, Spotify, MLC |
| Metadata (future expansion) | open-ended, for fields not yet anticipated |

**Explicit non-normalization note, per Board instruction:** this proposed model is **not** the same as either the real raw alert shape or the real normalized event shape already documented in §2. It is a superset design for a future engine, not a description of `delta-engine.js`'s current `buildAlert()` or `monitoring-intelligence.js`'s current `normalizeEvent()`. Reconciling this future model against those two real, narrower shapes is itself a Build Pass task, not resolved here. Two concrete overlaps and one open question worth flagging precisely:
- "Previous Value" / "New Value" have no equivalent in the current real event shape at all — closest existing real analog is the raw alert's `territory`/`isrc`/`track_name` fields, which identify *what* changed but not the before/after values themselves.
- "Human Summary" maps closely to the real raw alert's `detail` field (already documented in §2 as real but currently discarded by `normalizeEvent()`).
- "Provider" maps closely to the real raw alert's `platform` field (`'apple_music'`/`'youtube'`, also currently discarded by `normalizeEvent()`).

### 4.4 Event Taxonomy (proposed)

**Event Categories (initial, per Board brief):** Identity, Publishing, Catalog, Media, Backend, Health, Territory, Settings, System, Scan, Synchronization, AI, Security.

**Note on a real discrepancy, documented rather than smoothed over:** this 13-category list does not exactly match the 9-domain list in the §4.2 architecture diagram (which uses "Global Music Footprint" where this list uses "Territory," and adds System/Scan/Synchronization/AI/Security as categories with no corresponding domain box in §4.2's diagram). Both are transcribed exactly as given in the Board brief. Reconciling the two into one consistent taxonomy is future Build Pass work, not resolved by this document.

**Event Severity (proposed):** Informational, Success, Warning, Critical, Achievement.

**This is a different vocabulary from the real, currently-implemented severity set already documented in §2** (`informational | positive | action_needed | monitor`, from `VALID_SEVERITIES` in `monitoring-intelligence.js`). The two share only "Informational." Whether the future taxonomy replaces the current one, or the current one is extended to match it, is an open Build Pass decision — not assumed or normalized here.

**Example events (illustrative, per Board brief — none of these exist in the current 10-value `change_type` taxonomy documented in §2 except where noted):**

| Category | Examples |
|---|---|
| Identity | Official Website Added · Record Label Updated · Identity Coverage Increased |
| Publishing | PRO Detected · Publishing Administrator Added · Publishing Health Improved |
| Catalog | Album Discovered · ISRC Corrected · Metadata Updated (closest real analog: `isrc_added`/`isrc_mismatch`, §2) |
| Media | Official Artist Channel Verified · New Video Published · Biography Updated (closest real analog: `video_added`, §2 — though that signal is not wired to Media Intelligence's own domain object, per §3) |
| Backend | Spotify Sync Completed · Apple Sync Completed · Provider Timeout · Retry Successful |
| Health | Overall Health Increased · Identity Health Improved · Critical Issue Detected |
| Settings | Password Changed · Email Updated · Music Rights Profile Updated |
| Territory | New Territory Detected · Distribution Expanded · Market Coverage Increased (closest real analog: `territory_gain`, §2) |

### 4.5 Ownership

- Each of the nine source domains (§4.2) owns the decision of what constitutes a "meaningful change" within its own scope, and is responsible for publishing events — Monitoring Timeline™ does not decide this on their behalf.
- The proposed Change Detection Engine / Monitoring Event Engine owns ingestion, canonical-model validation, and storage (the future "Artist Profile Timeline Store") — not computation of what changed.
- Mission Control's Monitoring Timeline™ UI owns presentation only.
- ATHENA never owns history — it reads it. Per Board brief example: *"Over the past 30 days your Health Score improved by 12% because Publishing and Media Intelligence completed."* is an ATHENA interpretation layered on top of Monitoring Timeline™ facts, not something Monitoring Timeline™ itself generates.

### 4.6 Relationship to Health Intelligence™

Health Intelligence™ summarizes the current state (already documented as real and wired, `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md`). Monitoring Timeline™ records how the current state was reached. They are designed to complement, not duplicate, each other. This is also where Health Intelligence's own hardcoded Executive Timeline™ mock (task #53) is intended to eventually be replaced by real Monitoring Timeline™ data — a future integration, not decided further here.

### 4.7 Timeline UI Requirements (future — not built, not authorized here)

Each event card: timestamp, workspace icon, workspace name, event title, human summary, status badge, severity, expandable details (previous value → new value), and — if available — provider, scan ID, user/system attribution.

**Filters (future):** date range (Today / 7 Days / 30 Days / 90 Days / All Time), workspace, severity, system events, user events, search.

**Future search (explicitly deferred by the Board brief itself):** natural-language queries such as *"When did Publishing Health reach 90%?"* or *"Show Backend failures."* The brief is explicit: *"Do not build AI search now. Design for it."* — noted here as a design constraint on the future canonical event model (§4.3), not a deliverable of this document.

**Responsive requirements (future):** full desktop/tablet/mobile responsiveness, cards that collapse elegantly, touch-usable filters, no horizontal scrolling.

### 4.8 Future Deliverables (Phase 1 scope, per Board brief — none authorized or built by this document)

- Canonical Event Model (§4.3, as a real schema)
- Monitoring Event Engine
- Timeline UI
- Timeline Filters
- Responsive Layout
- Placeholder event publisher interface for future workspaces

Explicitly out of Phase 1 scope per the Board brief: building every future event now, or wiring every workspace immediately. The stated Phase 1 objective is the platform architecture that lets every workspace publish events consistently — not full domain coverage (§3's six-domain gap remains a separate, larger, later effort).

### 4.9 Board Vision (verbatim intent, for context)

Years from now, an artist should be able to open their profile and replay the evolution of their digital career — when they registered publishing, when their catalog expanded, when new territories appeared, when Health improved, when Media grew, when backend synchronizations occurred. Not an activity feed — the historical intelligence record of the Artist Profile.

---

## 5. Rules

1. This document does not force the current implementation into a constitutional model it hasn't earned. Where evidence showed a mismatch, it is reported as a mismatch — not silently resolved by assuming which side (renderer or assembler) is "correct."
2. No field name is normalized or assumed to mean the same thing across layers unless directly confirmed by reading the code at that layer. This applies equally to §4's proposed future model — it is never conflated with the real, current shapes documented in §2.
3. The delta engine (`delta-engine.js`) and Monitoring Intelligence™ (`monitoring-intelligence.js`) remain the sole owners of current change-detection logic. This document does not propose new business logic in §1–3 — it documents what exists and names the gap between that and the nine-domain constitutional vision.
4. Health Intelligence™ fields reused here (score, status, per-domain scores) remain owned by Health Intelligence™, confirmed already in `ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md`.
5. Nothing in §4 (Future Constitutional Architecture) is authorized for implementation by this document. No Build Pass has been opened for Monitoring Timeline™. This document is the blueprint for that future, separately-authorized, multi-PR engineering initiative — not a work order.
6. This document does not authorize fixing any of the mismatches in §2 or building any of the missing domain coverage in §3 — both are logged as separate engineering tasks for Board sequencing.

---

## Deliverable Status

Monitoring Timeline™ documentation — complete:
- ✅ Current Prototype, Current Production Implementation, and Future Constitutional Architecture explicitly separated, per Board directive — nothing forced into a single implemented/gap model
- ✅ All four contract layers (delta engine raw alert → Monitoring Intelligence normalized event → Runtime Context passthrough → renderer expectations) traced independently, with no field-name normalization or assumption
- ✅ Corrected, more precise findings from the prior draft: `description`/`detail` exists upstream and is discarded (not absent), `polarity` is satisfiable via existing `severity` (not a wholly new field), `type`/`'RESOLVED'` corresponds to nothing real at any layer
- ✅ Major finding: the four contracts do not align — documented as findings, not defects
- ✅ Most significant finding: 6 of the 9 domains in the Board's constitutional vision (Identity, Publishing, Backend, Health, Media, Settings) have zero change-detection today — a genuine unbuilt capability, not a wiring gap
- ✅ Constitutional purpose, canonical event model, event taxonomy, ownership, architectural relationships, and future implementation requirements documented per the Board Implementation Brief — explicitly as Phase 1 blueprint, not implementation
- ✅ Two real discrepancies in the Board's own brief flagged rather than silently reconciled: the 13-category taxonomy vs. the 9-domain architecture diagram, and the proposed 5-value severity taxonomy vs. the real, currently-implemented 4-value one
- ✅ No production code changed; no Mission Control changes; no engine, filtering, or UI built
- ✅ Ready for Board review

**Monitoring Timeline™ constitutional architecture ready to lock as the implementation blueprint for a future Build Pass.**
