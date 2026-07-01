# ROYALTĒ OPERATING SYSTEM REBUILD

## Executive Engineering Brief — Royaltē Intelligence Engine (RIE) Architecture

**Authority:** Royaltē Master Constitution v1.3 — supersedes all prior architecture guidance
**Status:** 🔒 Board-Approved Architecture — Locked
**Audience:** Claude Code (implementation)
**Classification:** Architectural Blueprint — supersedes all prior module-level plans

> **This brief approves architecture, not schedule.** No timelines, day estimates, or sprint commitments appear in this document by Board directive. Phases are ordered by architectural dependency, not calendar.

---

## 0. WHAT THIS IS

This is not a Publishing Intelligence project.
This is not a Mission Control project.
This is not a Scan Engine project.

Publishing Intelligence surfaced a deeper problem. The response is not a repair. It is an **Operating System rebuild**.

The objective is to establish **one constitutional intelligence architecture** that every current and future Royaltē product consumes. The Royaltē Intelligence Engine (RIE) becomes the center of the platform. Everything else becomes a consumer.

---

## 1. THE CONSTITUTIONAL RULE THAT GOVERNS EVERYTHING

> ### NO PRODUCT OWNS INTELLIGENCE.

Products **present** intelligence.

Products do **not**:

- acquire intelligence
- create intelligence
- normalize intelligence
- reconcile intelligence
- validate intelligence
- interpret provider responses
- enrich intelligence
- compute intelligence

Those responsibilities belong **exclusively** to the Royaltē Intelligence Engine.

Every product — Mission Control, Executive Brief, Audit, Publishing Intelligence, Identity Intelligence, Catalog Intelligence, Health Intelligence, Monitoring Intelligence, AI Insights, and **every future module** — shall consume **only** the Canonical Intelligence Model produced by the RIE.

No product may communicate directly with Apple Music, Spotify, MusicBrainz, MLC, Deezer, YouTube, Discogs, SoundExchange, Last.fm, AudioDB, SoundCloud, Listen Notes, or any future provider.

All provider communication occurs **exclusively** through the Provider Acquisition Layer and the RIE.

Any implementation that bypasses the RIE, performs provider-specific business logic inside a product, or creates an additional source of truth is a **constitutional violation and must not be merged.**

This rule applies to all current features, all future features, and every pull request going forward.

---

## 2. LEGACY ARCHITECTURE vs CONSTITUTIONAL ARCHITECTURE

### 2.1 Legacy (what exists today)

```
                 ┌─────────────────┐
   Apple ───────▶│  Scan Engine    │──┐
   Spotify ─────▶│  (identity)     │  │
                 └─────────────────┘  │
                                      ▼
   Apple ──────▶ generate_audit_pdf.py (Pydantic Subject model)
   Spotify ────▶ Mission Control (reads scan payload)
   MusicBrainz ▶ Publishing Intelligence (own provider calls)
   MLC ────────▶ (planned, own path)

   ── Multiple entry points.
   ── Providers treated unequally (Apple = "canonical", others bolted on).
   ── Business logic distributed across products.
   ── Each product a potential second source of truth.
   ── Architectural drift accumulates as new modules are added.
```

**Diagnosis:** Intelligence is computed in more than one place. Apple is privileged as identity source *inside product/scan code* rather than as one evidence source among many *inside the engine*. Every new module risks adding another provider path and another calculation. This is Constitutional Debt (v1.2 §3.12).

### 2.2 Constitutional (v1.3 target)

```
   PROVIDERS (evidence sources — all equal)
   Apple · Spotify · MusicBrainz · MLC · Discogs · Deezer
   YouTube · Last.fm · AudioDB · SoundCloud · SoundExchange · Future
        │
        ▼
   ┌──────────────────────────────────────────────┐
   │  LAYER 1 — PROVIDER ACQUISITION LAYER         │
   │  fetch · authenticate · rate-limit · retry    │
   │  return RAW provider evidence (no logic)      │
   └──────────────────────────────────────────────┘
        │  (raw evidence only)
        ▼
   ┌──────────────────────────────────────────────┐
   │  LAYER 2 — ROYALTĒ INTELLIGENCE ENGINE (RIE)  │
   │  collect → validate → reconcile → normalize   │
   │  → enrich → compute → certify                 │
   │                                                │
   │  Produces: ONE CANONICAL INTELLIGENCE MODEL   │
   └──────────────────────────────────────────────┘
        │  (certified canonical intelligence only)
        ▼
   ┌──────────────────────────────────────────────┐
   │  LAYER 3 — PRODUCTS (presentation only)       │
   │  Mission Control · Executive Brief · Audit    │
   │  Publishing · Identity · Catalog · Health     │
   │  Monitoring · AI Insights · Future modules    │
   │                                                │
   │  RENDER intelligence. Never produce it.       │
   └──────────────────────────────────────────────┘
```

**Principle:** One direction of flow. Evidence in, intelligence out. Products live downstream of certification and never reach upstream of it.

---

## 3. THE FOUR CONSTITUTIONAL LAYERS

### Layer 1 — Provider Acquisition Layer

The **first constitutional layer.** Its sole job is to fetch raw evidence from providers and hand it to the RIE. It contains no business logic, no interpretation, no scoring, no reconciliation.

- Every provider is an **adapter** with one contract: *authenticate, fetch, return raw evidence.*
- Every provider is treated **equally**. There is no "canonical provider" at this layer. Apple is an evidence source. Spotify is an evidence source. MLC is an evidence source. None is the source of truth.
- Provider adapters do not decide what evidence *means*. They only deliver it.

**Adapter contract (conceptual):**

```
ProviderAdapter {
  name: string
  authenticate() -> credentials
  fetch(subjectRef) -> RawProviderEvidence   // untouched, unscored, uninterpreted
}
```

> Note on "canonical identity": Apple remains the **identity anchor** as a matter of *reconciliation policy inside the RIE* (v1.2 §3.6), not as a privileged provider path in product or scan code. The privilege moves from the wiring to the engine's reconciliation rules, where it can be governed and changed constitutionally.

### Layer 2 — Royaltē Intelligence Engine (RIE)

The **authority.** The RIE is the only component permitted to turn evidence into intelligence. It owns seven responsibilities:

1. **Collect** — gather raw evidence from the Provider Acquisition Layer
2. **Validate** — confirm evidence is well-formed and trustworthy
3. **Reconcile** — resolve conflicts between providers (identity, metadata, catalog)
4. **Normalize** — map provider-specific shapes into canonical shapes
5. **Enrich** — derive intelligence not present in any single provider
6. **Compute** — produce scores, findings, risks, opportunities, recommendations
7. **Certify** — stamp the output as canonical, versioned, and consumable

The RIE emits exactly one artifact: the **Canonical Intelligence Model**.

### Layer 3 — Canonical Intelligence Model (the single artifact)

The RIE's output is the **Royaltē Intelligence Model™** (Constitution §8). It is the single source of truth. Every product reads it; no product writes it.

Canonical Intelligence Objects (§8.2):

```
identity{}        health{}          globalFootprint{}
catalog{}         verification{}    metadata{}
publishing{}      opportunities{}   actions{}
aiInsight{}       revenueSignals{}  scanAuthority{}
```

Four questions gate any new concept before it enters the model (§8.3):

1. Is this a Royaltē concept or a provider concept?
2. Which Intelligence Object does it belong to?
3. Can it be generated once and consumed everywhere?
4. Does it eliminate duplicate business logic?

### Layer 4 — Products (presentation only)

Every product is a **view** into the Canonical Intelligence Model.

| Product | Reads (canonical objects) | Computes |
|---|---|---|
| Mission Control | all, operationally | **nothing** |
| Executive Brief | health, opportunities, actions, aiInsight | **nothing** |
| Audit | all, evidentially | **nothing** |
| Publishing Intelligence | publishing, verification, metadata | **nothing** |
| Identity Intelligence | identity, verification | **nothing** |
| Catalog Intelligence | catalog, metadata | **nothing** |
| Health Intelligence | health | **nothing** |
| Monitoring Intelligence | all, longitudinally | **nothing** |
| AI Insights | aiInsight (+ context) | **nothing** |

If a product's code path fetches a provider, interprets a provider response, normalizes data, or computes a score, it is out of constitutional compliance.

---

## 4. WHAT COUNTS AS A CONSTITUTIONAL VIOLATION

A module is in violation if it does any of the following outside the RIE:

- calls an external provider directly
- interprets or parses provider responses into meaning
- normalizes provider data into canonical shapes
- performs business logic (scoring, risk detection, reconciliation)
- computes its own intelligence
- introduces a second source of truth that can disagree with the RIE

**Design QA test:** if two products can display different answers to the same question about the same artist, an unauthorized second source of truth exists. Find it and route it through the RIE.

---

## 5. THE OPERATING SYSTEM MIGRATION

The plan is **not** a list of module fixes. It is an OS migration that moves the platform progressively into full constitutional compliance, using a **controlled strangler pattern**: legacy provider-driven paths are **identified, isolated, migrated, and retired** in sequence — never deleted blindly. The goal is not to break production. The goal is to move the platform from legacy provider-driven paths into the RIE architecture in a controlled sequence, with production green at every step.

Phases are dependency-ordered. Each phase lands behind its own gate; **`DO NOT MERGE` on previews**; one commit per stage; per-action approval in Code always.

### Phase 1 — Build the complete RIE architecture

Stand up the Royaltē Intelligence Engine as a real internal service with all seven responsibilities (collect → validate → reconcile → normalize → enrich → compute → certify) and a defined output contract: the Canonical Intelligence Model. At the end of Phase 1 the RIE exists and can produce a certified model, even if only one provider is wired.

**Exit gate:** RIE produces a certified Canonical Intelligence Model from at least one provider, with the full object schema (§8.2) present, versioned, and testable (§7.11).

### Phase 2 — Move every provider into the Provider Acquisition Layer

Extract every existing provider call — Apple, Spotify, and any others currently reached from scan/product code — into Provider Acquisition Layer adapters conforming to the single adapter contract. Providers become equal evidence sources. No product retains a direct provider call after this phase completes.

**Exit gate:** every provider is reachable only through an adapter; no product or scan module imports a provider SDK or hits a provider endpoint directly.

### Phase 3 — Normalize every provider into one Canonical Intelligence Model

Move all normalization and reconciliation into the RIE. Provider-specific shapes are mapped to canonical shapes **inside the engine**. Apple's role as identity anchor becomes an explicit, governed reconciliation rule in the RIE — not a wiring privilege. Conflicts between providers are resolved by the engine, deterministically and testably.

**Exit gate:** given multi-provider evidence, the RIE emits one reconciled canonical model; identity/metadata/catalog conflicts resolve through documented engine rules, not product code.

### Phase 4 — Move every existing module to consume only the Canonical Intelligence Model

Repoint every product at the certified canonical model. This includes the known legacy consumers:

- `generate_audit_pdf.py` (repo root) and its Pydantic `Subject` model — must consume the canonical model instead of provider-shaped data. Keep the Pydantic model in lockstep with the canonical schema, exactly as it is currently kept in lockstep with `api/schema/auditResponse.js`.
- Mission Control scan-payload reads — repoint to the canonical model.
- Publishing / Identity / Catalog / Health module reads — repoint to the canonical model.

Legacy provider paths are **strangled, not deleted**, in this phase: the product reads canonical, the old path is left dormant and unreferenced, production stays green throughout.

**Exit gate:** every product renders from the canonical model; no product computes intelligence; production output is unchanged or improved (no regressions in shipped reports/UI).

### Phase 5 — Remove all remaining provider bypasses

With every product now reading canonical, remove the dormant provider bypasses left behind in Phase 4. Any remaining direct-provider path, product-side normalization, or shadow calculation is deleted. After this phase, the only route from provider to product runs through the Provider Acquisition Layer and the RIE.

**Exit gate:** grep-clean — no provider SDK import, no provider endpoint, no normalization, no scoring anywhere outside Layer 1 (fetch only) and Layer 2 (RIE).

### Phase 6 — Retire legacy architectural paths

Remove the legacy scaffolding entirely: old scan-payload contracts superseded by the canonical model, dead schema mirrors, obsolete provider-coupling utilities, and any compatibility shims added during migration. The platform now runs exclusively on the constitutional architecture.

**Exit gate:** legacy architecture is gone; the codebase reflects only the four constitutional layers; documentation (§7.15 — explain *why*) records what was retired and why.

---

## 6. STANDING GOVERNANCE FOR THIS MIGRATION

These apply to every PR in the rebuild:

- **Per-action approval in Code, always.** Never "don't ask again."
- **One commit per stage/task.**
- **PR body written to a temp file, Read-verified before push.**
- **`DO NOT MERGE` on previews.** Rebase-merge with branch deletion on approval.
- **No `Co-Authored-By` trailers.**
- **Complete drop-in files over diffs** for new engine/layer components; surgical edits only for existing files, no redesign without explicit approval.
- **Trust render over `getBoundingClientRect`** for any visual verification; no scripts for visual QA.
- **Escalate conflicts to the Founder.** Any brief instruction that appears to conflict with the Constitution, the canonical model, or One-Truth/One-Engine/One-Platform: stop, explain, propose, wait.
- **Art Direction Lock™ (§7A) still governs all product surfaces.** This rebuild changes where intelligence is *produced*, not how approved artboards are *rendered*. No product's approved composition changes because of this migration.

---

## 7. CONSTITUTIONAL ENGINEERING PRINCIPLE (carry into every PR)

> **No Product Owns Intelligence.**
>
> Products present intelligence.
> Products never acquire intelligence.
> Products never normalize intelligence.
> Products never reconcile intelligence.
> Products never compute intelligence.
> Products consume intelligence.
>
> The Royaltē Intelligence Engine is the sole authority responsible for intelligence generation.

**One Truth. One Engine. One Platform.**

---

## APPENDIX A — Constitutional authority

**Royaltē Master Constitution v1.3 supersedes all prior architecture guidance.**

The Royaltē Intelligence Engine (RIE) is now the **constitutional operating architecture** of the platform. The RIE-as-core direction and the "No Product Owns Intelligence" rule are part of v1.3 by Board amendment — not an interpretation, not an inference.

Some internal section headings within the constitutional document still reference v1.0, v1.1, or v1.2. This is expected and does not weaken authority: **those sections are understood to operate under v1.3 authority.** Where an older heading and the v1.3 direction appear to differ, v1.3 governs. Header version stamps may be reconciled in a later editorial pass; the constitutional direction is not in question.
