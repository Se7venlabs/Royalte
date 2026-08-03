# Playbook Action Engine™ Architecture

Phase 4A — Executive Actions™. The constitutional reference for the Playbook Action Engine as it exists on this branch — Royaltē's first capability that turns Executive Intelligence into guided execution. Updated for the Board's **Final Hardening & Merge Readiness** directive (ten Executive Change Requests, "ECR1"–"ECR10" below) — refinements to the certified 4A design, not a redesign.

---

## 1. Governing principle

> Don't just tell artists what is wrong. Help them fix it.

Every playbook is a narrow, production-grade guided workflow triggered by real, already-computed canonical evidence — never a generic checklist, never fabricated urgency. Completing a playbook records the artist's own confirmation; it never claims the underlying issue was independently re-verified (**Evidence First™** — see §7 and §13).

The authoritative evidence chain, made structural by the hardening pass (ECR1), is:

```
Canonical Runtime™ → Mission Control Runtime Context™ → Playbook Action Engine™ → Presentation Layer
```

`sessionStorage`/`localStorage` are never an eligibility authority. Every eligibility, start, and verify decision is recomputed server-side in `api/playbook-actions.js` from the artist's own latest real scan (`buildCanonicalRawInputs()`, §11) — a client-supplied `workspaceContext` is presentation-only and is never read for a decision.

## 2. Scope decision (Board-ratified)

Objectives 3 and 6 of the Phase 4 brief (Executive Action Center™, ATHENA Action Engine™) are, in substance, the previously-reserved Executive Action Framework™ + Tool Invocation Framework™ + Executive Decision Engine™ (Phase 3E) — three components whose own governance docs have a circular "when to build it" dependency. The Board's explicit decision: build a **narrow, production-grade Playbook Action Engine™** instead — not the general framework. The engine is designed so it *could* become one implementation adapter underneath a future, general Executive Action Framework™, but that framework, Tool Invocation Framework™, and Executive Decision Engine™ remain fully reserved — see each one's own governance document.

## 3. Registry vs. Definitions — formally separate responsibilities

**The Registry (`api/playbooks/registry.js`) knows about definitions; it does not contain them.** A registration record is deliberately lightweight, expanded by the hardening pass (**Executive Change Request 2**) to carry governance/analytics metadata alongside the original discovery fields:

```js
{
  playbookId, currentVersion, definitionSchema, registeredAt,
  domain,             // e.g. 'Publishing', 'Identity' -- for filtering/reporting
  owner,              // canonical owning team, e.g. 'Royaltē Publishing Intelligence™'
  status,             // 'active' by default; governance-facing lifecycle for the playbook itself
  introducedInPhase,  // e.g. '4A' -- when this playbook entered the catalog
  deprecated,         // boolean, default false
}
```

`registerPlaybook({playbookId, playbookVersion, definitionSchema, domain, owner, introducedInPhase, status, deprecated, load})` stores this record plus a `load()` accessor; `getPlaybook(id)`/`getAllPlaybooks({includeDeprecated})` call `load()` on demand — `getAllPlaybooks()` excludes deprecated playbooks by default so a retired playbook stops being recommended while its historical rows (already-started/completed instances) remain fully readable via `getPlaybook(id)` directly. `getRegistrations()` returns the metadata only (never content, never the `load` accessor) for governance/reporting use. **Content lives and is owned entirely in `api/playbooks/definitions/*.js`.** Adding a future playbook (SoundExchange, ASCAP, BMI, SOCAN, PRS, SACEM, YouTube OAC, split sheets, Content ID, TikTok Artist Profile, dozens more) is: create one new file, call `registerPlaybook()` on import, add one line to `definitions/index.js` — **zero changes to `registry.js` or the store, ever.** This mirrors the Capability Registry pattern (`api/athena/ask/capabilities/`) and the Engine Provider Registry, the same self-registering-module idiom now proven a third time in this codebase.

## 4. Playbook Definition schema

```js
{
  playbookId,            // stable slug, e.g. 'mlc-registration' -- never changes
  playbookVersion,        // e.g. '1.0' -- content version
  definitionSchema,       // e.g. 1 -- format version, independent of playbookVersion;
                           // protects future migrations of the definition SHAPE itself
  title, executiveSummary, whyItMatters,
  // Executive Opportunity Metadata (Executive Change Request 5) -- grouped,
  // not flat root fields, keeps the schema extensible. Metadata only, no
  // ranking logic here -- ranking is Phase 4B's Executive Opportunity
  // Engine™.
  metrics: { difficulty, estimatedMinutes, estimatedRevenueImpact, businessImpact, priority },
  prerequisites,           // descriptive only -- see Playbook Independence Rule
  requiredDocumentation, affectedDomain,
  steps: [{ stepId, stepNumber, title, instructions, resources }],
                           // stepId is permanent (e.g. 'MLC-001'); stepNumber may be
                           // reordered in a future playbookVersion, stepId never is
  helpfulResources, completionVerification,
  isEligible(rawInputs) -> boolean,
  evidenceConfidence(rawInputs) -> 'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT_DATA',
  explainRecommendation(rawInputs) -> string,
                           // ATHENA Explanation Support™ (Executive Change Request 8) --
                           // answers "why am I seeing this recommendation?" from the real
                           // evidence state. Lives in the Definition, the same canonical
                           // owner as everything else about this playbook -- ATHENA never
                           // generates this explanation ad hoc.
}
```

`isEligible`/`evidenceConfidence`/`explainRecommendation` are pure functions reading the same kind of `rawInputs` shape Ask ATHENA's Capability Registry already consumes (real CIM fields, e.g. `identity.coverage`, `publishingIntelligence.registrations.mlcRegistration`) — eligibility, confidence, and explanation are all computed from real evidence, never guessed, never fabricated by the presentation layer or by ATHENA.

### Reference playbooks shipped in 4A (proof, not a content library)

Per the Board's explicit directive: build the engine, not the content library. Two reference definitions ship:

| Playbook ID | Domain | Real evidence source |
|---|---|---|
| `mlc-registration` | Publishing | `publishingIntelligence.registrations.mlcRegistration` (a `PUBLISHING_STATE` value already computed by `api/_lib/publishing-intelligence.js` from the CIO's MLC PAL evidence) |
| `identity-coverage` | Identity | `identity.coverage`/`verifiedProviders`/`totalProviders` (already computed) |

Every other named business playbook is deliberately deferred to independent content-only follow-up slices.

## 5. Playbook Independence Rule™

Every playbook is completely self-contained. A definition may declare `prerequisites` (descriptive text an artist should have ready) but must never programmatically invoke or depend on another playbook's state — no cross-playbook chains. Enforced structurally: no definition file imports another (verified by `tests/playbook-action-engine-test.mjs` §2), and each `isEligible`/`evidenceConfidence` function reads only canonical evidence, never another playbook's action state.

## 6. Canonical Ownership™

| Field | Canonical owner |
|---|---|
| Status, Progress (facts), Completion History, Confidence History, Action Number | Playbook Action Engine™ (`api/_lib/playbook-action-store.js`) |
| Steps, Version, Definition Schema, Registry metadata (domain/owner/introducedInPhase/deprecated) | Playbook Registry™ (`api/playbooks/definitions/`, `api/playbooks/registry.js`) |
| Evidence Confidence | Canonical Intelligence Engine™ (the same CIM/CIO-derived fields `isEligible` reads) |
| Recommendation + Explanation (why a playbook is surfaced) | ATHENA™ (`api/athena/risk-analysis.js`) for the risk trigger; the Playbook Definition's own `explainRecommendation()` for the artist-facing explanation text — ATHENA never generates this ad hoc |
| Supporting Evidence | Evidence Attribution™ vocabulary (the same 7-value set Ask ATHENA uses; `'Evidence Registry'` is a recognized-but-currently-unused category — `api/evidence/registry/` is real but dormant, zero live callers, per the Phase 3 Closeout audit) |
| Executive Opportunity Metadata (revenue impact, time, difficulty, business impact, priority) | Playbook Registry™ (`definition.metrics`) — metadata only; ranking logic is Phase 4B |

Presentation layers (`ai-insights.html`'s Guided Playbooks™ section) only render these values — no business logic exists client-side.

## 7. Evidence First™ completion

Marking a step complete records the **artist's own confirmation** (`completion_outcome`, e.g. `'user_confirmed_complete'`) — it never silently changes any Executive Intelligence score or claims the underlying platform state was independently re-verified. As of the hardening pass (**Executive Change Request 3**), this is now structural, not just documented: `completePlaybook()` can only ever move a row to `waiting_verification`, never directly to `completed`. Only `verifyPlaybook()` — re-running the Definition's own `isEligible()` against fresh, server-fetched canonical evidence — can advance a row to `verified`/`completed`. See §13 for the full lifecycle.

## 8. Stable identity

- **Playbook ID**: hand-authored, fixed, never generated — the Registry's own key.
- **Action ID**: the primary key of a `playbook_actions` row, made stable by a partial unique index on `(artist_profile_id, playbook_id) WHERE status != 'archived'` — one active instance per pair. "Resume" means the store looks up this row before inserting a new one; the index is the enforcement backstop.
- **Step ID**: permanent per step (e.g. `'MLC-001'`), independent of `stepNumber` — every transition in `playbook_action_history` and every `advancePlaybookStep()` call is keyed by `stepId`, never by array position.

This is deliberately simpler than deriving identity from unstable risk/opportunity data (`riskId`/`opportunityId` are `randomUUID()`-regenerated every scan, confirmed via `api/athena/risk-analysis.js`) — the (artist, playbook) pair is already stable by construction.

## 9. Facts, not derived values

`playbook_actions` stores `completed_steps`/`total_steps` only. `progressPercentage` is always computed at read time (`api/_lib/playbook-action-store.js`'s `withProgressPercentage()`) — never a persisted column, so no derived value can ever drift from its source facts. The hardening pass extends this same discipline to Executive Action Numbers (§16): `action_number` is a stored `bigserial` fact, and the artist-facing `'EA-000001'` display string is always formatted at read time (`formatActionNumber()`), never persisted as text.

## 10. MLC risk wiring (the one real detection extension in 4A)

`api/athena/runtime-context-adapter.js`'s `buildMusicRightsEnvelope()` now threads `ctx.publishingIntelligence.registrations.mlcRegistration` through into the ATHENA `musicRights` envelope (a real, already-owned field — not a new derivation). `api/athena/risk-analysis.js`'s `identifyRightsRisks()` emits a real "Not Registered with The MLC" risk when that value is `'ACTION_REQUIRED'` or `'NOT_FOUND'` — deliberately excluding `'UNABLE_TO_CONFIRM'`, matching `publishing-intelligence.js`'s own stated principle: "we do not know — say nothing executive about it."

## 11. API surface — `api/playbook-actions.js`

- `GET` — lists the artist's own `playbook_actions` rows (every status except `archived` by default; `?status=archived` or `?includeArchived=1` to see archived rows too), enriched with each row's real step list (from the Registry) and its Executive Action Number display string, so the client can render an accurate checklist and determine the real next `stepId`. Also returns Executive Dashboard Metrics™ counts (§17).
- `POST {action: 'checkEligibility'}` — recomputes eligibility from the artist's real latest scan, fetched server-side (§1, §14); persists a `'recommended'` row for any newly-eligible playbook (§18); returns the artist's full current item list.
- `POST {action: 'start', playbookId}` — re-verifies eligibility server-side (from the same server-fetched evidence) before starting/resuming.
- `POST {action: 'advance'|'complete'|'archive', actionId, ...}` — pure state-machine calls into the store. `complete` moves a row to `waiting_verification`, never directly to `completed` (§13).
- `POST {action: 'verify', actionId}` — re-checks the artist's real latest scan against the same `isEligible()` the playbook was triggered by; moves the row to `verified → completed` if the issue is resolved, otherwise leaves it in `waiting_verification` with an informational history entry (§13, §15). An explicit, callable action — not an automatic post-scan hook (§14).
- `POST {action: 'history', actionId}` — returns the row's full Executive Timeline™ (§15).

Bearer-auth throughout; `artistProfileId` is always the authenticated caller's own `auth.uid()`, never client-supplied. No endpoint reads or trusts a client-supplied `workspaceContext` for any decision (§1, §14).

## 12. Sequencing

4A (this milestone) is the foundation only. 4B (Executive Opportunity Engine™ — ranking), 4C (Executive Action Center™ workspace + Executive Progress™ + Executive Timeline™), and 4D (ATHENA Action Engine™ — Ask ATHENA integration) each require their own branch, full certification, and explicit Board merge approval before beginning — see the approved Phase 4A plan for the full sequencing rationale.

---

## Final Hardening & Merge Readiness — Executive Change Requests

The sections below document the ten ECRs the Board required before merge approval. Each is a refinement to the design above, not a departure from it.

## 13. Executive Health States™ (Executive Change Request 3)

The lifecycle expanded from the original 4A design's five statuses to eight:

```
available → recommended → started → in_progress → waiting_verification → verified → completed → archived
```

- `recommended` — persisted by `recommendPlaybook()` the moment `checkEligibility` finds a match (§18); a genuinely new state, not present in the original 4A design, which treated eligibility as an ephemeral computed list.
- `started` / `in_progress` — unchanged from the original design; `advancePlaybookStep()` moves `started → in_progress` on the first step.
- `waiting_verification` — **new, and the crux of this hardening pass.** `completePlaybook()` (the artist's own self-report) can only ever land here. It is structurally impossible for a self-report to reach `completed` directly.
- `verified` / `completed` — only reachable via `verifyPlaybook()`, which re-runs the Definition's own `isEligible()` against fresh, server-fetched canonical evidence (§14). A `resolved: true` result writes both transitions atomically in one call (`waiting_verification → verified`, then `verified → completed`), preserving full timeline fidelity (§15) while presenting a single clean "completed" end state. A `resolved: false` result leaves the row in `waiting_verification` with an informational history note — the artist's self-report was honest, the underlying issue just isn't independently confirmed yet.
- `archived` — reachable from any non-archived status (not just `completed`, as in the original design) via `archivePlaybook()`.

This is Evidence First™ (§7) made structural rather than aspirational: the database schema itself (the `status` CHECK constraint) makes a self-report-to-completed transition impossible, not just discouraged by convention.

**Deliberate scope decision:** no automatic hook into the scan pipeline (`api/audit.js`) triggers `verifyPlaybook()` on every new scan. `verify` is a real, callable API action today; wiring an automatic post-scan trigger is the correct, real extension point for a future phase, not built now — matching the Board's own demonstrated restraint elsewhere in this same directive (ECR5's "no ranking logic required now," ECR9's "no UI required this phase").

## 14. Server-side canonical evidence (Executive Change Request 1)

`api/playbook-actions.js`'s `buildCanonicalRawInputs(supabase, artistProfileId)` fetches the artist's own latest `audit_scans` row (`WHERE user_id = artistProfileId ORDER BY created_at DESC LIMIT 1`) and builds the same `royalte_workspace_context` shape every workspace page builds client-side, via `runtime-context-mapper.js`'s documented dual browser/Node usage. This is now the sole input to every `isEligible()`/`evidenceConfidence()`/`explainRecommendation()` call on the server. A client-supplied `workspaceContext` is never read for any eligibility/start/verify decision — it is presentation-only, matching §1's evidence chain.

## 15. Confidence History™ + Automatic Executive Timeline™ (Executive Change Requests 4 and 7)

Every lifecycle transition already produced a `playbook_action_history` row in the original 4A design (`recordHistory()`). The hardening pass extends this in two ways:

- **Confidence History™** — `playbook_action_history` gains a `confidence` column. Each transition records the evidence confidence at that moment; later transitions never overwrite earlier ones, so reading a row's history sequentially yields a real confidence timeline (e.g. `HIGH → HIGH → MEDIUM`), not a single mutable snapshot.
- **Automatic Executive Timeline™** — `describeHistoryEvent(row)` computes a human-readable label (e.g. `"Started Playbook"`, `"Completed step MLC-002"`, `"Completed by Artist — Waiting Verification"`, `"Independently Verified"`) at read time from the stored `from_status`/`to_status`/`to_step_id` facts — the label itself is never persisted, matching the same "facts stored, derived values computed" discipline as `progressPercentage` (§9). `getPlaybookHistory()` returns each event pre-enriched with its `.label`.

## 16. Executive Action Numbers™ (Executive Change Request 6)

Every `playbook_actions` row carries an `action_number` — a globally-unique `bigserial` fact, assigned at insert time. The artist-facing display string (`'EA-000001'`) is always derived via `formatActionNumber()`, never stored as text (§9). The UUID `id` column remains the sole canonical backend identifier for every join, foreign key, and API call — `action_number` exists purely for human-readable, artist-facing display.

## 17. Executive Dashboard Metrics™ (Executive Change Request 9)

`getPlaybookCounts({supabase, artistProfileId})` returns `{total, available, recommended, started, in_progress, waiting_verification, verified, completed, archived, active}` — clean backend counts per Executive Health State, plus an `active` convenience aggregate. Surfaced today only as a `counts` field alongside `GET /api/playbook-actions`'s `items` array — **no UI consumes it yet**, per the Board's explicit "no UI required this phase." This is the correct, real extension point for a future Executive Action Center™ dashboard summary (4C).

## 18. Executive History™ permanence (Executive Change Request 10)

Two structural guarantees ensure a playbook never silently vanishes from an artist's record:

1. **`recommendPlaybook()` persists on first eligibility, not on every check.** The moment `checkEligibility` finds a newly-eligible playbook, a real `'recommended'` row is written immediately (idempotent — a repeat call never duplicates or regresses an already-in-progress row). Eligibility is no longer an ephemeral computed list that could differ between two calls; it becomes a permanent, queryable historical fact the instant it's first true.
2. **`archivePlaybook()` never deletes.** Archiving is a status transition like any other — the row, its full step progress, and its full history remain permanently queryable. `GET`'s default filter hides `archived` rows from the primary view for presentation cleanliness only; `?includeArchived=1` or `?status=archived` retrieves them in full.
