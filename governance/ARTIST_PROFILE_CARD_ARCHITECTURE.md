# Artist Profile Card — Architecture Specification

**Section 1 — Core Architecture & Data Flow**

**Status:** Board Alignment Required — proposed product-layer specification, not yet ratified.
**Governing document:** Board Engineering Handoff "Royaltē v3.0 — Artist Profile Card Architecture Brief" (corrected version, superseding the initial Section 1 draft).
**Scope:** Documentation and alignment only. No code changes in this phase.

---

## 1. Purpose

The Artist Profile Card is a **product architecture layer** — a user-facing canonical artist view for Mission Control. It is explicitly **not** a replacement for the existing Canonical Payload V2 / CIO / CIM architecture, which remains the engineering source of truth. This document defines where the Artist Profile Card sits relative to what's already built, grounded in the actual current implementation (traced and Board-reviewed in PR #359, Mission Control Handoff & Canonical Payload Discovery Report).

## 2. Current Implemented Architecture (Do Not Change)

```text
SCAN
(External Provider Data Collection)
   │
   ▼
CANONICAL PAYLOAD V2 (CIO / CIM)
   │
   ▼
RUNTIME CONTEXT
   │
   ▼
MISSION CONTROL
```

| Layer | Responsibility | Actual implementation |
|---|---|---|
| **Scan** | Collects external music ecosystem data; calls supported providers; produces scan results | `api/audit.js` → `api/_lib/run-scan.js` → 12 PAL connectors (`provider-acquisition/connectors/*`) |
| **CIO / CIM** | Canonical normalization layer; stores structured intelligence; remains the backend source of truth | `api/lib/normalizeAuditResponse.js` → `api/_lib/cio-assembler.js` (`assembleCio()`) → `lib/rie/index.js` (`runRIE()` → `assembleCIM()`) → `lib/rie/certify.js`. Schema: `api/schema/cio.js`, `api/schema/canonical-intelligence-model.js`. Persisted as `canonical` to `audit_scans.payload` |
| **Runtime Context** | Combines required runtime data; provides workspace data to Mission Control | `public/js/runtime-context-mapper.js` (`buildWorkspaceRuntimeContext()`) → `sessionStorage['royalte_workspace_context']` |
| **Mission Control** | Presentation layer; displays intelligence workspaces | `public/workspaces/*.html`, read via `public/js/mc-workspace-context.js` (`readWorkspaceContext()`) |

This layer stack is unchanged by this specification.

## 3. Artist Profile Card — Target Product Layer

The Artist Profile Card represents the **user-facing canonical artist view**, sitting between the engineering source of truth and the presentation layer:

```text
CIO / CIM
   │
   ▼
ARTIST PROFILE CARD
(User-Facing Canonical View)
   │
   ▼
MISSION CONTROL
```

The Artist Profile Card should:
- Present normalized artist intelligence in one consistent, user-facing shape.
- Provide a consistent artist overview across every Mission Control workspace.
- Feed Mission Control workspace experiences.
- Avoid duplicate data ownership — it is a *view* over CIO/CIM, not a second store.

**Relationship to Runtime Context:** the Artist Profile Card and Runtime Context are not the same layer. Runtime Context (`buildWorkspaceRuntimeContext()`) is the existing, Board-locked (Runtime Context Contract v1.2/1.3) mechanical transformation from `canonical` to `royalte_workspace_context` — confirmed in PR #360 (buildWorkspaceRuntimeContext Field-Level Trace Report) to already perform exactly this kind of "present normalized data consistently" role for the 23 fields it currently carries. Whether the Artist Profile Card is realized *as* an extension of Runtime Context, or as a distinct new layer that Runtime Context itself draws from, is an open implementation question for a future section — not decided here. This document specifies the product-layer relationship and population-source rules only.

## 4. Population Source Rules

Every Artist Profile Card field, when specified in future sections, must be tagged with exactly one of the following three sources.

### 4.1 Scan

Externally discovered data — Apple Music, Spotify, YouTube, Deezer, TIDAL, catalog data, territory data.

```text
Provider → Scan → CIO/CIM → Artist Profile Card
```

Concrete example (traced in PR #359): a provider field acquired by a PAL connector (e.g. `provider-acquisition/connectors/apple-music/AppleMusicConnector.js`) flows through `api/_lib/apple-pal-acquisition.js` → `lib/rie/EvidenceBridge.js` (`translateArtistIdentity()`, etc.) → `canonical.platforms.appleMusic.*` → a domain assembler (e.g. `api/_lib/identity-intelligence.js`) → `cim.identity` → surfaces in `canonical.identityIntelligence`.

### 4.2 Onboarding

Artist-provided information — PRO, SoundExchange, Music Publisher, Publishing Administrator, Rights Profile information.

**Current implementation, confirmed by direct trace, not assumed:** stored separately (Supabase `profiles.music_rights_profile`, per the Board-locked Music Rights Profile™ v2, PR #286), and merged **client-side at the Runtime Context layer only** — `public/js/mission-control.js`'s `__mcPopulate()` fetches it independently and passes it as a separate `musicRightsProfile` argument into `buildWorkspaceRuntimeContext()` (`runtime-context-mapper.js:133`). **Do not assume write-back into CIO/CIM** — no such pipeline exists today. If the Artist Profile Card requires onboarding data to be present in CIO/CIM itself (rather than merged later), that is new engineering work requiring its own brief, not something this specification authorizes.

### 4.3 Royaltē System

Internally generated intelligence — Backend Intelligence, AI-generated recommendations, risk analysis, ATHENA (future naming layer).

## 5. ATHENA Clarification

ATHENA is the **future intelligence-layer naming direction**, not the current production system. Confirmed independently twice this session, in Board-reviewed reports now in `governance/` (`ERI_PHASE1_ARCHITECTURE_ASSESSMENT.md` and the merged Platform Refactoring discovery): `api/athena/` (`createAthenaEngine()`) has zero production callers.

**Current production intelligence pipeline:**
```text
CIO/CIM → RIE / AI Assembly (api/_lib/royalte-ai-assembler.js, via lib/rie/index.js) → AI Insights
```

**Future target (not built, not authorized by this document):**
```text
Artist Profile Card → ATHENA → AI Insights
```

This specification does not authorize refactoring the existing AI architecture, retiring the current `royalteAI` assembler, or activating `api/athena/`. That remains a separate, future, explicitly-scoped decision — the same wire-vs-retire question already surfaced for the Board in the ERI Phase 1 package.

## 6. Explicit Non-Goals For This Phase

Per the Board brief, this phase does **not**:
- Replace CIO/CIM.
- Create duplicate canonical storage.
- Move onboarding data into scan payloads.
- Rename existing production engines.
- Rebuild Mission Control's data flow.

## 7. Deliverable Status

This document satisfies deliverable item 4 (Mission Control display relationship) and the architectural half of item 2 (Population Source — the three-category rule). Deliverable items 1 (field definitions) and 3 (provider source mapping) are field-by-field work, out of scope for this architecture-level Section 1 — reserved for **Section 2 — Identity Intelligence Field Schema** and subsequent per-domain sections, each to be its own scoped handoff.

**Standing by for Board alignment before Section 2 begins.**
