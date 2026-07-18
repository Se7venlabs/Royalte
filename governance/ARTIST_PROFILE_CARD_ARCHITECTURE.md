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

The Artist Profile Card represents the **user-facing canonical artist view**, sitting between the engineering source of truth and Runtime Context, the existing delivery layer:

```text
CIO / CIM
   │
   ▼
ARTIST PROFILE CARD
(User-Facing Canonical View)
   │
   ▼
RUNTIME CONTEXT
(existing, locked delivery contract — unchanged)
   │
   ▼
MISSION CONTROL
```

The Artist Profile Card should:
- Present normalized artist intelligence in one consistent, user-facing shape.
- Provide a consistent artist overview across every Mission Control workspace.
- Feed Runtime Context, which continues to feed Mission Control workspace experiences.
- Avoid duplicate data ownership — it is a *view* over CIO/CIM, not a second store.

**Relationship to Runtime Context — resolved (Board decision, 2026-07-18):** the Artist Profile Card and Runtime Context are not the same layer, and one does not replace the other. The Artist Profile Card is a new consolidation layer sitting between CIO/CIM (and Music Rights Profile onboarding data) and Runtime Context. Runtime Context (`buildWorkspaceRuntimeContext()`, Board-locked Runtime Context Contract v1.2/1.3, confirmed in PR #360) remains the locked delivery mechanism that serves Mission Control workspaces — it is not superseded, and `sessionStorage['royalte_workspace_context']` is not replaced. `buildWorkspaceRuntimeContext()` is not replaced at this stage.

Rationale: four weeks from launch, Runtime Context is already integrated across Mission Control; replacing it now is unnecessary risk. The Artist Profile Card is the normalized product model above CIO/CIM and Music Rights Profile; Runtime Context continues as the workspace delivery mechanism, and — in a future phase, out of scope here — may be updated to read from the Artist Profile Card as an additional input alongside `canonical` and `musicRightsProfile`, rather than being replaced by it. Evaluating a deeper Runtime Context refactor is deferred to a post-launch phase, not part of this specification.

```text
SCAN                          ONBOARDING
(CIO/CIM existing pipeline)   (Music Rights Profile)
        │                              │
        └──────────────┬───────────────┘
                        ▼
              ARTIST PROFILE CARD
           (new consolidation layer)
                        │
                        ▼
                RUNTIME CONTEXT
        (existing, locked delivery contract)
                        │
                        ▼
                 MISSION CONTROL
```

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

**Current implementation, confirmed by direct trace, not assumed:** stored separately (Supabase `profiles.music_rights_profile`, per the Board-locked Music Rights Profile™ v2, PR #286), and merged **client-side at the Runtime Context layer only** — `public/js/mission-control.js`'s `__mcPopulate()` fetches it independently and passes it as a separate `musicRightsProfile` argument into `buildWorkspaceRuntimeContext()` (`runtime-context-mapper.js:133`). **Do not assume write-back into CIO/CIM** — no such pipeline exists today.

**Merge point moves, source does not:** per the resolved layer relationship in §3, the Artist Profile Card is the new merge point for onboarding data (`Onboarding → Artist Profile Card`), one step earlier than today's Runtime Context merge. This does not require writing onboarding data into CIO/CIM — `profiles.music_rights_profile` remains the source of truth, read independently the same way `__mcPopulate()` reads it today, just consumed one layer earlier by the Artist Profile Card builder instead of by `buildWorkspaceRuntimeContext()` directly. Field-level mapping is Section 2+ work, not decided here.

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

---

## 8. Approved Target Architecture (superseded status update, Board decision 2026-07-18)

**Status:** Approved. This is the target architecture Royaltē v3.0 is being built toward — not a roadmap curiosity, not conditional on a future brief. Sections 1–7 above describe the *current repository implementation* (CIO/CIM, Runtime Context) as it exists today; they are reference points for the migration, not permanent constraints on this target.

The approved architecture direction:

```text
SCAN
   │
   ▼
ARTIST PROFILE CARD
   │
   ▼
INTELLIGENCE PROCESSING
(analysis, enrichment, scoring)
   │
   ▼
ATHENA™
(intelligence layer)
   │
   ▼
MISSION CONTROL
```

Under this target, the Artist Profile Card becomes the canonical artist record itself — Identity Intelligence, Publishing Intelligence, Catalog Intelligence, Global Music Footprint™, rights information, and ecosystem intelligence all attached to one record ("One artist = one Artist Profile Card"), with ATHENA as the executive-insight layer consuming it. CIO/CIM's and Runtime Context's current responsibilities are absorbed into this pipeline as implementation proceeds — evaluated for reuse, change, or replacement, not preserved by default.

**Decided by this section:**
- The Artist Profile Card, Intelligence Processing, and ATHENA are the approved target architecture, not a conditional future path.
- CIO/CIM and Runtime Context are current-repository implementation detail to be assessed against this target — see the Repository Review (§9) — not permanent product constraints.
- ATHENA (`api/athena/`, `createAthenaEngine()`) is the approved target intelligence layer, superseding the current `royalteAI` assembler pipeline (§5) once the migration reaches that stage.

**Not yet decided — sequencing, not direction:**
- Timeline and phase order for retiring/migrating CIO/CIM and Runtime Context responsibilities.
- Which specific components are reused vs. rebuilt (subject of the Repository Review, §9).

**Note on Sections 1–7 above:** those sections accurately describe the *current* implementation and were correct when written. They are no longer to be read as "unchanged by this specification" or "do not change" — that framing is superseded by this section. They remain useful as a factual baseline for the Repository Review.

Section 2 (Identity Intelligence Field Schema, `governance/ARTIST_PROFILE_CARD_IDENTITY_SCHEMA.md`) and all subsequent per-domain field-schema sections proceed against this approved target architecture (§8), with items not yet supported by current code marked "Implementation Required" rather than omitted.

---

## 9. Repository Review — Reuse / Change / Replace

**Status:** Complete.
**Scope:** Assess CIO/CIM, Runtime Context, and the Mission Control workspaces against the §8 target architecture. For each component, classify as Reuse / Change / Replace, with reasoning grounded in actual code (same evidentiary standard as PR #359/#360) — not assumption.

Full findings: `governance/ARTIST_PROFILE_CARD_REPOSITORY_REVIEW.md`. Summary: CIO/CIM — Change (insertion seam risk); Runtime Context — Change (input source swaps, output contract frozen); Mission Control workspaces (12) — Reuse (fully insulated by Runtime Context's existing contract); ATHENA — unbuilt target layer, zero production callers, own input contract needs a second design decision; current AI/RIE pipeline — Reuse now, superseded at the ATHENA boundary on a later scheduled phase, not immediately.
