# Canonical Executive Architecture™

**Status:** Board-ratified permanent constitutional architecture.
**Adopted:** 2026-07-24, upon formal closure of ATHENA™ Phase 1 (Canonical Executive Intelligence Object™).
**Authority:** Executive Board.
**Type:** Architectural governance document — describes permanent layer responsibilities and their separation. Not an implementation record; see §6 for a note distinguishing this document's conceptual pipeline from current wiring status.

---

## §1 — Purpose

Royaltē consists of **four distinct architectural layers**:

1. **Evidence Layer™** — discovers facts.
2. **Canonical Intelligence Layer™** — resolves verified facts into canonical truth.
3. **Executive Intelligence Layer™** — transforms canonical truth into executive decisions.
4. **Presentation Layer** — communicates executive decisions to the artist.

These layers are independent. **Their responsibilities must never overlap.** This separation is permanent, constitutional, and binds every future engineering brief — a proposed feature that cannot be placed cleanly into exactly one layer is a signal to stop and reconcile the architecture before writing code, not to force a fit.

This document formally records the point at which Royaltē evolved from a Canonical Intelligence Platform™ (Evidence + Canonical Intelligence only) into an **Executive Intelligence Platform™** (all four layers), completed with ATHENA™ Phase 1.

---

## §2 — Evidence Layer™

**Responsibility:** acquire, normalize, and verify raw evidence from external providers; resolve conflicts between providers; produce verified canonical evidence.

Constituent concepts:
- **Evidence Books™** — the per-provider raw evidence a scan collects.
- **Evidence Connectors™** — the provider-specific acquisition logic (Apple Music, Spotify, MusicBrainz, Discogs, Deezer, AudioDB, Last.fm, Wikidata, YouTube, Tidal, MLC, and future providers).
- **Evidence Registry™** — the durable record of what evidence exists and where it came from.
- **Evidence Resolution Engine™** — reconciles conflicting provider claims into one resolved answer per fact.

Responsibilities:
- Acquire evidence.
- Normalize evidence.
- Verify evidence.
- Resolve conflicting provider information.
- Produce verified canonical evidence.

**This layer discovers facts. It does not make business recommendations.**

---

## §3 — Canonical Intelligence Layer™

**Responsibility:** interpret verified evidence and determine canonical truth.

Current intelligence domains:
- Identity Intelligence™
- Publishing Intelligence™
- Catalog Intelligence™
- Health Intelligence™
- Media Intelligence™
- Global Music Footprint™
- Backend Intelligence™
- Monitoring Intelligence™

Responsibilities:
- Interpret verified evidence.
- Determine canonical truth.
- Calculate intelligence.
- Generate intelligence scores.
- Produce canonical artist state.

**This layer answers "What is true?" It does not generate executive recommendations.**

---

## §4 — Executive Intelligence Layer™

**Responsibility:** interpret canonical intelligence and determine what should happen next.

ATHENA™ is the Executive Intelligence Layer. Constituent concepts:
- **ATHENA™** — the interpretive engine itself.
- **Executive Intelligence Object™** — the canonical output shape (established, ATHENA™ Phase 1).
- **Executive Recommendations™**
- **Executive Priorities™**
- **Opportunity Intelligence™**
- **Executive Confidence™**
- **Executive Briefings™**
- **Executive Memory™**
- **Executive Forecasts™**

Responsibilities:
- Interpret canonical intelligence.
- Determine priorities.
- Identify opportunities.
- Assess risk.
- Generate recommendations.
- Generate executive summaries.
- Prepare executive intelligence for presentation.

**This layer answers "What should happen next?" It never resolves raw evidence — it consumes canonical intelligence, never providers directly.**

---

## §5 — Presentation Layer

**Responsibility:** display intelligence and executive decisions to the artist.

Constituent concepts:
- Mission Control™
- AI Insights™
- Executive Overview™
- Future Ask ATHENA™
- Reports™
- Notifications™
- Future Mobile Applications™
- Future Public APIs™

Responsibilities:
- Display intelligence.
- Render executive information.
- Present recommendations.

**Never calculate recommendations. Never determine canonical truth. Never duplicate executive reasoning.** A UI component that computes its own severity ranking, invents its own priority order, or fabricates a recommendation the Executive Intelligence Layer never produced is a constitutional violation of this boundary, regardless of how small the computation looks.

---

## §6 — Canonical Pipeline

```
Evidence Books™
      │
      ▼
Evidence Connectors™
      │
      ▼
Evidence Registry™
      │
      ▼
Evidence Resolution Engine™
      │
      ▼
Canonical Intelligence Domains™
      │
      ▼
Mission Control Runtime Context™
      │
      ▼
ATHENA Adapter™
      │
      ▼
ATHENA Engine™
      │
      ▼
Executive Intelligence Object™
      │
      ▼
Presentation Layer™
      │
      ▼
Artist
```

This is the **permanent conceptual pipeline** — the intended, constitutional shape of how intelligence flows through Royaltē, and the target every future engineering brief should converge toward.

**Current implementation status (recorded here for honesty, not as a qualifier on the architecture's permanence):**

| Stage | Live status today |
|---|---|
| Evidence Books™ / Connectors™ | **Live**, but not as separate named modules — real evidence acquisition is `api/audit.js`'s direct ~10-provider fan-out plus `lib/rie/*` (CIO assembly). |
| Evidence Registry™ / Evidence Resolution Engine™ (as `api/evidence/*`, `api/registry/*`, `api/resolution/*`) | **Dormant.** Real, tested code with zero production callers — confirmed repeatedly through the platform's history, most recently in the 2026-07-18 Repository Review (PR #368). |
| Canonical Intelligence Domains™ | **Live** via the Domain Assemblers → Intelligence Report → Health Engine™ → Executive Brief Engine™ chain, not the dormant chain above. |
| Mission Control Runtime Context™ | **Live** — `public/js/runtime-context-mapper.js`, `royalte_workspace_context` v1.1. |
| ATHENA Adapter™ / ATHENA Engine™ / Executive Intelligence Object™ | **Built, tested, and isolated as of ATHENA™ Phase 1 — not yet wired to any live caller.** |
| Presentation Layer™ | **Live** (Mission Control, AI Insights™) but currently reads `royalteAI`/`executiveBrief`/`healthReport` directly, not the Executive Intelligence Object™ — see §10. |

The diagram above is the **architectural destination**, ratified as permanent. The table is the **current position on the way there**. Closing the gap between them (retiring the dormant Evidence Registry™/Resolution Engine™ stack or wiring it in, and wiring the Presentation Layer to consume the Executive Intelligence Object™) is Phase 2+ work, not resolved by this document.

---

## §7 — Responsibility Matrix

| Layer | Owns | Never |
|---|---|---|
| **Evidence Layer™** | Evidence acquisition, evidence validation, evidence normalization, provider conflict resolution | Business recommendations, canonical scoring |
| **Canonical Intelligence Layer™** | Identity, Publishing, Catalog, Health, Media, Global Music Footprint, Backend, Monitoring, scores, canonical artist state | Recommendations, priorities, executive summaries |
| **Executive Intelligence Layer™** | Recommendations, priorities, confidence, forecasts, executive memory, executive briefings, opportunity analysis, risk analysis | Raw evidence resolution, canonical fact determination |
| **Presentation Layer** | Rendering, navigation, visualization, interaction | Any business logic — no recommendation, priority, confidence, or canonical-truth computation of its own |

---

## §8 — Architectural Principles

- Evidence never bypasses Canonical Intelligence.
- Canonical Intelligence never bypasses ATHENA™.
- Presentation never bypasses Executive Intelligence.
- Recommendations originate from one engine.
- Confidence originates from one engine.
- Executive summaries originate from one engine.
- No layer duplicates another.

---

## §9 — Constitutional Principles

- Evidence may evolve. Canonical Intelligence may evolve. Executive Intelligence may evolve. **Their responsibilities shall never overlap.**
- Evidence discovers facts.
- Canonical Intelligence resolves verified facts.
- Executive Intelligence transforms verified facts into executive decisions.
- Presentation communicates executive decisions.
- **No layer may bypass another.**
- This separation is permanent.

---

## §10 — Future Extensibility

Future capabilities — including Executive Reports™, Ask ATHENA™, Executive Notifications™, Mobile Executive Dashboard™, Partner APIs™, Investor Reports™, and Email Briefings™ — **must consume the Executive Intelligence Object™** rather than independently generating recommendations, priorities, confidence, or executive summaries.

This is the specific mechanism that prevents the platform's known three/four-source overlap problem (`royalteAI`, `executiveBrief`, `healthReport`, and now the Executive Intelligence Object™ — see `governance/AI_INSIGHTS_IMPLEMENTATION_READINESS.md` §Outstanding Risks #4) from recurring in every new surface. Any brief proposing a new Executive-facing surface should be checked against this rule before implementation begins: does it read the Executive Intelligence Object™, or does it compute its own version of what that object already provides? The latter is a constitutional violation regardless of how small the duplicated logic appears.

---

## §11 — No Implementation

This document is architectural governance only. No code was modified, added, or removed to produce it. No adapters, no ATHENA™ engine files, no Runtime Context, no Mission Control, and no AI Insights™ files were touched.

---

## Final Deliverable Confirmation

✓ `governance/CANONICAL_EXECUTIVE_ARCHITECTURE.md` (this file)
✓ Architecture diagram (§6)
✓ Responsibility matrix (§7)
✓ Constitutional principles (§9)
✓ Future extensibility section (§10)

No code changes. No tests. No UI. No merge.

---

**Executive Board statement, recorded:** This document formally records Royaltē's evolution from a Canonical Intelligence Platform™ into an Executive Intelligence Platform™, effective upon the completion of ATHENA™ Phase 1. Upon acceptance, ATHENA™ Phase 1 is closed and Phase 2 — Executive Briefing & Executive Intelligence Presentation — may be authorized.
