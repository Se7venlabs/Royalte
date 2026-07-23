# AI Insights™ — Workspace Dependency Map

**Status:** Discovery Phase — no code changes. Investigation only.
**Requested by:** Executive Board
**Date:** 2026-07-23

---

## Real, current dependency graph (as-built, confirmed by code)

```
Identity Intelligence™ (ctx.identityIntelligence)  ──┐
Publishing Intelligence™ (ctx.publishingIntelligence) ─┤
Catalog Intelligence™ (ctx.catalogIntelligence)     ──┼──► royalteAI (api/_lib/royalte-ai-assembler.js)
Global Music Footprint™ (ctx.globalMusicFootprint)  ──┘         │
                                                                  │
Health Engine (healthScore, healthReport, healthIntelligence) ───┼──► executiveBrief (api/_lib/executive-brief-engine.js)
                                                                  │
                                                                  ▼
                                                          AI Insights™ (consumes both, plus healthReport directly, plus dead reads of catalogIntelligence/backendIntelligence/monitoringIntelligence)
```

**Note on Catalog Intelligence™**: it is passed into `assembleRoyalteAI()` (real input) but is *also* separately read into the AI Insights™ workspace's own `ctx.catalogIntelligence` variable and never used there (dead read) — it reaches AI Insights™ twice, once productively (via `royalteAI`) and once uselessly (direct read).

## What AI Insights™ actually consumes today

| Source | Consumed? | How |
|---|---|---|
| Identity Intelligence™ | Yes | Indirectly via `royalteAI`; directly via `identityIntelligence.issues` (legacy CimAdapter-bridged field, not CIM-native) |
| Publishing Intelligence™ | Yes | Same dual path as Identity |
| Catalog Intelligence™ | Partially | Indirectly via `royalteAI` only — the direct `ctx.catalogIntelligence` read is dead code |
| Health Intelligence™ | Yes | Directly — `healthScore`, `healthReport`, `healthIntelligence` are the single largest data source on the page |
| Backend Intelligence™ | **No** | Read into `ctx.backendIntelligence`, never used — dead code |
| Global Music Footprint™ | Yes | Indirectly via `royalteAI`; directly via `globalMusicFootprint.reachNarrative` (one fallback branch) |
| Media Intelligence™ | **No** | Not referenced anywhere in the file |
| Recording Intelligence™ | **No** | Not referenced anywhere in the file |
| Settings™ | **No** | Not referenced anywhere in the file |
| Monitoring™ | **No** | Read into `ctx.monitoringIntelligence`, never used — dead code |

## Gap vs. the Board's expected dependency order

The Board's brief describes an expected chain: Identity → Publishing → Catalog → Media → Global Footprint → Backend → Health → Monitoring → AI Insights™, with AI Insights™ as the **final consumer of all of them**. The real current state:

- **3 of 9 upstream domains are fully wired in** (Health directly; Identity/Publishing partially, via a legacy bridge; Catalog/Global Footprint partially, only through `royalteAI`'s narrower selection of fields).
- **Backend Intelligence™ and Monitoring™ are read but discarded** (dead code, zero effect).
- **Media Intelligence™ and Recording Intelligence™ — both real, live domains as of this session's prior work — are completely absent.** AI Insights™ predates both and was never updated to consume them.
- **Settings™ was never an intelligence-producing domain** (it's user configuration, not canonical evidence) — its absence from this chain is correct, not a gap.

## Legacy/migration debt affecting this dependency chain

`identityIntelligence`/`publishingIntelligence` reach AI Insights™ via `lib/rie/CimAdapter.js`, explicitly marked **"MIGRATION INFRASTRUCTURE — REMOVE AFTER PRODUCT MIGRATION"** and confirmed structurally identical to `cim.identity`/`cim.publishing` today. `mc-workspace-context.js`'s own code comments confirm AI Insights™ is "not yet recovered" to CIM-native reads, unlike Identity Intelligence™ and Publishing Intelligence™'s own workspaces, which already read `ctx.identity`/`ctx.publishing` directly. This means AI Insights™ currently depends on a component the codebase has already scheduled for removal — a real, load-bearing dependency risk distinct from the evidence-completeness gaps above.

## Recommendation for future architecture (discovery-only — not implemented here)

If AI Insights™ becomes the platform's true final-consumer synthesis layer, its dependency chain should: (1) migrate off `CimAdapter` to CIM-native reads (`cim.identity`, `cim.publishing`) matching the pattern every single-domain workspace already uses, (2) either wire in Media Intelligence™ and Recording Intelligence™ or explicitly document why they're excluded, (3) remove the three dead reads (`catalogIntelligence`, `backendIntelligence`, `monitoringIntelligence`) or actually use them, and (4) resolve the `royalteAI` vs. `executiveBrief` vs. `healthReport` three-source overlap into one coherent synthesis input rather than three independently-read objects with overlapping content.
