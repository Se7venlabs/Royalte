# Runtime Dependency Map™

Phase 3 Closeout — Post-Merge Engineering Directive. Documents every major Executive Intelligence runtime dependency as it exists on `main`, with explicit ownership and dependency direction. Verified against the real file tree and real caller sites on `main`, not from memory.

---

## 1. Ownership table

One row per major component. "Owner" is the single file/module with write authority or canonical logic; every other file listed under "Consumers" reads or calls it, never re-implements it.

| Component | Owner (single source of truth) | Consumers |
|---|---|---|
| Canonical scan payload | `api/audit.js` → `audit_scans` table | `runtime-context-mapper.js`, every Phase 3 service via `audit_scans.payload` |
| Workspace runtime context | `public/js/runtime-context-mapper.js` (`buildWorkspaceRuntimeContext`) | Every `public/workspaces/*.html` page, via `mc-workspace-context.js` |
| Executive Intelligence Object (EIO) | `api/athena/pipeline.js` (`runExecutiveIntelligencePipeline`) | `api/executive-intelligence.js`, `api/_lib/executive-brief-archive.js` |
| Executive Brief Archive™ | `api/_lib/executive-brief-archive.js` (write), `api/_lib/executive-brief-archive-reader.js` (read) | `api/executive-brief-archive.js`, `api/executive-comparison.js`, `api/executive-trends.js`, `api/executive-history-summary.js`, `api/executive-memory.js`, `api/athena/ask/capabilities/executive-brief-archive.js`, `api/athena/ask/reasoning-engine.js` |
| Cross-Scan Intelligence™ (Phase 3D) | `api/_lib/canonical-domain-fingerprints.js` (`compareDomain`, `DOMAIN_FINGERPRINTS`) | `api/_lib/executive-comparison.js`, `api/_lib/executive-trend-detection.js`, `api/athena/ask/capabilities/_fingerprint-capability.js` (8 of 11 Capability Registry modules) |
| Executive Memory™ (Phase 3C) | `api/_lib/executive-memory-store.js` (write), `api/_lib/executive-memory.js` (read/derive) | `api/executive-memory.js`, `api/executive-memory-actions.js`, `api/athena/ask/capabilities/executive-memory.js`, `api/athena/ask/reasoning-engine.js` |
| Executive Intelligence Bus™ | `api/athena/bus/executive-intelligence-bus.js` | `api/_lib/executive-memory-store.js` (publisher) — no subscribers on `main` today (a clean, inert extension point) |
| Capability Registry™ (Phase 3E) | `api/athena/ask/capabilities/registry.js` | `api/athena/ask/context-builder.js`, `api/athena/ask/reasoning-engine.js` |
| Context Builder™ (Phase 3E) | `api/athena/ask/context-builder.js` | `api/ask-athena.js` |
| Evidence Attribution™ (Phase 3E) | `api/athena/ask/evidence-attribution.js` | `api/ask-athena.js` |
| Prompt Assembly™ (Phase 3E) | `api/athena/ask/prompt-assembly.js` | `api/ask-athena.js` |
| ATHENA Service™ (Phase 3E) | `api/athena/ask/athena-service.js` | `api/ask-athena.js` |
| Provider Interface™ (Phase 3E) | `api/athena/ask/provider-interface.js`, `provider-factory.js` | `api/athena/ask/athena-service.js` |
| Response Contract™ (Phase 3E) | `api/athena/ask/response-contract.js` | `api/athena/ask/reasoning-engine.js`, `api/athena/ask/athena-service.js`, `public/workspaces/ask-athena.html` |
| Conversation Memory™ (Phase 3E) | `api/_lib/athena-conversation-store.js` | `api/ask-athena.js`, `api/athena/ask/capabilities/conversation-history.js` |
| Rate limiting | `api/_lib/rate-limit.js` | `api/audit.js`, `api/submit-audit.js`, `api/ask-athena.js` |
| Workspace contract validation | `public/js/mc-workspace-context.js` | Every `public/workspaces/*.html` page |

## 2. Dependency direction (who calls whom, never the reverse)

```
public/workspaces/*.html  (Experience Layer — presentation only, no business logic)
        │
        │ fetch() with Bearer token
        ▼
api/ask-athena.js  ──────────────────────────────┐
api/executive-memory.js                            │
api/executive-memory-actions.js                     │
api/executive-comparison.js                          │  top-level endpoints
api/executive-trends.js                               │  (auth + orchestration only)
api/executive-brief-archive.js                          │
api/executive-history-summary.js                          │
api/executive-intelligence.js  ─────────────────────────┘
        │
        ▼
api/_lib/*.js  +  api/athena/**/*.js   (business logic — never imported by
        │                                a workspace page directly)
        ▼
Supabase (audit_scans, executive_brief_archive, executive_memory_items,
          athena_conversations, athena_conversation_turns)
```

**Rule enforced throughout**: workspace pages call top-level `api/*.js` endpoints only, over HTTP with a Bearer token — they never import `api/_lib/*` or `api/athena/*` directly (there is no bundler in this repo; every workspace is a plain `<script>` tag). All cross-cutting business logic lives in `api/_lib/` or `api/athena/`, imported only by the top-level endpoint files.

## 3. Ask ATHENA's internal dependency graph (Phase 3E, most granular)

```
api/ask-athena.js
  │
  ├─► api/_lib/rate-limit.js
  ├─► api/_lib/executive-brief-archive-reader.js   (listBriefs, countBriefs)
  ├─► api/_lib/executive-memory.js                  (buildExecutiveMemory)
  ├─► api/_lib/athena-conversation-store.js
  ├─► api/athena/validate.js                         (validatePromptSafety)
  ├─► api/athena/ask/intent-engine.js
  ├─► api/athena/ask/question-classifier.js
  ├─► api/athena/ask/reasoning-engine.js
  │      └─► api/athena/ask/capabilities/registry.js
  │      └─► api/_lib/executive-comparison.js        (compareExecutiveBriefs)
  ├─► api/athena/ask/capabilities/index.js  (registers all 11)
  │      └─► 8 modules ─► api/athena/ask/capabilities/_fingerprint-capability.js
  │                          └─► api/_lib/canonical-domain-fingerprints.js
  │      └─► executive-memory.js, executive-brief-archive.js,
  │           conversation-history.js  (each capability's own rawInputs read)
  ├─► api/athena/ask/context-builder.js
  ├─► api/athena/ask/evidence-attribution.js
  ├─► api/athena/ask/prompt-assembly.js
  │      └─► api/athena/ask/personality.js
  └─► api/athena/ask/athena-service.js
         └─► api/athena/ask/provider-factory.js
                └─► api/athena/ask/provider-interface.js
                └─► api/athena/ask/providers/placeholder-provider.js
```

No cycle exists anywhere in this graph — a deliberate property, verified by construction (every arrow above points strictly "toward" more primitive, lower-level modules; nothing in `api/_lib/canonical-domain-fingerprints.js` or `capabilities/registry.js` imports back up toward `reasoning-engine.js` or `ask-athena.js`).

## 4. Cross-phase reuse (the concrete evidence that "no layer duplicates another" held)

- `api/_lib/canonical-domain-fingerprints.js` (built Phase 3D) is imported by **both** `api/_lib/executive-comparison.js`/`executive-trend-detection.js` (Phase 3D's own endpoints) **and** `api/athena/ask/capabilities/_fingerprint-capability.js` (Phase 3E, built two milestones later) — the same extract/compare logic, never re-derived.
- `api/_lib/executive-comparison.js`'s `compareExecutiveBriefs()` (Phase 3B, extended Phase 3D) is called directly by `api/athena/ask/reasoning-engine.js`'s "compare last two scans" deterministic pattern — Phase 3E's deterministic answer is not a re-implementation of comparison logic, it's a direct call into the existing function.
- `api/_lib/executive-brief-archive-reader.js` (Phase 3B) is the sole data-access layer for the archive across Phase 3B, 3D, 3C, and 3E — five different consuming modules, one reader.
- `api/athena/bus/executive-intelligence-bus.js` (built Phase 3C) has exactly one production publisher (`executive-memory-store.js`) and zero subscribers on `main` today — an honest, inert extension point, not dead code (see the Technical Debt Audit, `governance/PHASE3_EXECUTIVE_SUMMARY.md` §Technical Debt).

## 5. What Mission Control itself does and does not depend on

`public/mission-control.html` (the landing page) depends only on the canonical scan pipeline and its own hero-globe wiring (`public/js/mission-control.js`) — it does **not** directly call any Phase 3 executive endpoint. The dependency on Executive Memory™, Cross-Scan Intelligence™, and Ask ATHENA™ exists one level down, in the individual workspace pages reached from Mission Control's nav rail:

- `public/workspaces/ai-insights.html` calls `/api/executive-intelligence`, `/api/executive-memory`, `/api/executive-memory-actions`, `/api/executive-comparison`, `/api/executive-trends`.
- `public/workspaces/ask-athena.html` calls `/api/ask-athena` exclusively.
- No other workspace page calls any Phase 3 endpoint directly.

This confirms the intended separation: Mission Control is the shell and navigation surface; `ai-insights.html` remains the one workspace that surfaces the full historical-intelligence picture; `ask-athena.html` is the one workspace with a live conversational interface. Neither duplicates the other's role.
