# Executive Data Flow™

Phase 3 Closeout — Post-Merge Engineering Directive. Traces the real, live data flow from a scan to an artist's experience of it, as it actually executes on `main` — not the aspirational or dormant version. Every persistence point and read-only boundary is called out explicitly.

---

## 1. The live flow, as it actually runs

```
Artist Scan
   │  GET /api/audit?url=...  (api/audit.js)
   │  10-platform fan-out (Promise.allSettled), never aborts on one source failing
   ▼
┌─────────────────────────────────────────────┐
│ PERSISTENCE POINT 1                          │
│ audit_scans row written                      │
│ (payload, schema_version, scanId)            │
└─────────────────────────────────────────────┘
   │
   ▼
Canonical Intelligence
   │  public/js/runtime-context-mapper.js
   │  buildWorkspaceRuntimeContext(payload) → royalte_workspace_context v1.1
   │  (client-side transform only — no server round-trip, no write)
   ▼
┌─────────────────────────────────────────────┐
│ PERSISTENCE POINT 2 (browser-local, ephemeral)│
│ sessionStorage['royalte_workspace_context']  │
│ read-only boundary: every workspace page      │
│ reads through mc-workspace-context.js's       │
│ readWorkspaceContext() — never writes it       │
└─────────────────────────────────────────────┘
   │
   ▼
Executive Intelligence Object (EIO) generation
   │  POST /api/executive-intelligence (Bearer-optional)
   │  runExecutiveIntelligencePipeline(workspaceContext)
   │    Adapter → ATHENA_ENGINE.analyze() → buildExecutiveIntelligenceObject()
   ▼
┌─────────────────────────────────────────────┐
│ READ-ONLY BOUNDARY                           │
│ The EIO pipeline never writes anything itself │
│ — it is a pure function of workspaceContext.  │
│ Archiving (below) is a separate, explicit     │
│ step gated on the caller being authenticated. │
└─────────────────────────────────────────────┘
   │  (Bearer-authenticated callers only)
   ▼
┌─────────────────────────────────────────────┐
│ PERSISTENCE POINT 3                          │
│ executive_brief_archive row written           │
│ (executive_intelligence_object jsonb,         │
│  scan_id FK, idempotent on                   │
│  (artist_profile_id, scan_id))                │
│ api/_lib/executive-brief-archive.js           │
└─────────────────────────────────────────────┘
   │
   ├──────────────────────────────────┐
   ▼                                    ▼
Mission Control                    Cross-Scan Intelligence™ (Phase 3D)
   │  ai-insights.html and every      │  api/_lib/canonical-domain-fingerprints.js
   │  workspace page render the        │  reads audit_scans.payload directly
   │  royalte_workspace_context +      │  (never re-reads the archive's jsonb,
   │  fetched EIO directly — pure      │  which only records request status,
   │  presentation, no business logic  │  never domain field values)
   │  client-side                      │  READ-ONLY — produces comparisons on
   ▼                                    │  demand, writes nothing
┌─────────────────────────────────────────────┐
│ READ-ONLY BOUNDARY                           │
│ Every workspace page (incl. Mission Control)  │
│ is a pure renderer. It receives context and   │
│ EIO data and renders — it never computes      │
│ business logic or writes intelligence data.   │
└─────────────────────────────────────────────┘
   │
   ▼
Executive Memory™ (Phase 3C)
   │  Two paths:
   │  (a) DERIVED (read-only): api/_lib/executive-memory.js diffs archived
   │      briefs for recurringIssues/resolvedIssues — computed fresh every
   │      request, nothing persisted for this part.
   │  (b) PERSISTED (writable): an artist explicitly confirms a goal, a
   │      correction, or promotes an ATHENA Recommendation (Memory
   │      Promotion™ — never automatic) via api/executive-memory-actions.js
   ▼
┌─────────────────────────────────────────────┐
│ PERSISTENCE POINT 4                          │
│ executive_memory_items row written or         │
│ superseded/expired (never hard-deleted)       │
│ api/_lib/executive-memory-store.js            │
│ (the ONLY write path into this table)         │
└─────────────────────────────────────────────┘
   │
   ▼
Ask ATHENA™ (Phase 3E)
   │  POST /api/ask-athena — reads audit_scans.payload,
   │  executive_brief_archive (via the reader), executive_memory_items
   │  (via buildExecutiveMemory), and its own conversation turns.
   │  Deterministic path: answers directly, zero further reads/writes.
   │  AI-required path: assembles a prompt, calls the configured provider,
   │  normalizes the result.
   ▼
┌─────────────────────────────────────────────┐
│ PERSISTENCE POINT 5                          │
│ athena_conversations / athena_conversation_    │
│ turns rows written (Conversation Memory™)     │
│ api/_lib/athena-conversation-store.js         │
│ EXPLICIT NON-BOUNDARY-CROSSING GUARANTEE:      │
│ this write path never touches                 │
│ executive_memory_items — verified by an        │
│ automated structural test and confirmed live   │
│ via direct database query (Phase 3E            │
│ certification).                                │
└─────────────────────────────────────────────┘
   │
   ▼
Artist Experience
   Mission Control (browse) + Ask ATHENA (converse) — two front doors onto
   the same underlying canonical intelligence, neither a competing source
   of truth for the other.
```

## 2. Every persistence point, consolidated

| # | Table | Written by | Read by |
|---|---|---|---|
| 1 | `audit_scans` | `api/audit.js` | `runtime-context-mapper.js` (client), `canonical-domain-fingerprints.js`, `api/ask-athena.js` |
| 2 | `sessionStorage['royalte_workspace_context']` (browser-local) | `runtime-context-mapper.js` (client) | Every workspace page via `mc-workspace-context.js` |
| 3 | `executive_brief_archive` | `api/_lib/executive-brief-archive.js` | `executive-brief-archive-reader.js` (5 consumers — see `RUNTIME_DEPENDENCY_MAP.md` §1) |
| 4 | `executive_memory_items` | `api/_lib/executive-memory-store.js` (exclusively) | `executive-memory.js`, `api/athena/ask/capabilities/executive-memory.js`, `reasoning-engine.js` |
| 5 | `athena_conversations` / `athena_conversation_turns` | `api/_lib/athena-conversation-store.js` (exclusively) | `api/ask-athena.js`, `api/athena/ask/capabilities/conversation-history.js` |

## 3. Read-only boundaries, consolidated

- **Every workspace page is a pure renderer.** No business logic, no computed intelligence, no writes to anything but the browser's own `sessionStorage` (which itself is only ever written by the runtime context mapper, never by a workspace).
- **The EIO pipeline (`api/athena/pipeline.js`) is a pure function.** Same input, same output, no side effects — archiving is a separate, explicit step layered on top by the calling endpoint, not something the pipeline does itself.
- **Cross-Scan Intelligence™ never writes anything.** `canonical-domain-fingerprints.js`, `executive-comparison.js`, `executive-trend-detection.js` are pure read/compute — every comparison is produced fresh from `audit_scans.payload` on each request, nothing is cached or persisted.
- **Ask ATHENA never writes to Executive Memory™.** The single most load-bearing read-only boundary in Phase 3E — structurally guaranteed (no code path exists) and independently verified live.

## 4. Named in the Board's directive but not part of the live flow: Evidence Registry™

The Board's requested data flow names an "Evidence Registry" stage between Canonical Intelligence and Mission Control. A real `api/evidence/registry/` module tree exists in this repository (types, versioning, deduplication, a read service, an audit module) — but it has **zero live callers** on `main` outside its own directory, confirmed by a direct grep across `api/` and `public/`. This is dormant infrastructure from an earlier, separately-scoped constitutional stack (Sprints 1–12, `governance/project_royalte_canonical_registry_sprint1_lock.md`-series documents), not wired into the live Scan → EIO → Archive → Mission Control / Ask ATHENA path this document traces.

Documented here honestly rather than silently presenting a flow diagram that implies it's active: the live "evidence" layer today is the Executive Brief Archive™ (Persistence Point 3) plus the direct `audit_scans.payload` reads Cross-Scan Intelligence™ and Ask ATHENA's Capability Registry perform — Evidence Attribution™ (Phase 3E) tags facts with a `sourceType` vocabulary that includes `'Evidence Registry'` as a recognized-but-currently-unused category, a forward-compatible placeholder for if/when this dormant module is ever activated, not a claim that it's active today.
