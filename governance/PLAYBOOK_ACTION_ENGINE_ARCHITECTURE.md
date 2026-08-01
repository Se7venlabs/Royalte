# Playbook Action Engine™ Architecture

Phase 4A — Executive Actions™. The constitutional reference for the Playbook Action Engine as it exists on this branch — Royaltē's first capability that turns Executive Intelligence into guided execution.

---

## 1. Governing principle

> Don't just tell artists what is wrong. Help them fix it.

Every playbook is a narrow, production-grade guided workflow triggered by real, already-computed canonical evidence — never a generic checklist, never fabricated urgency. Completing a playbook records the artist's own confirmation; it never claims the underlying issue was independently re-verified (**Evidence First™** — see §7).

## 2. Scope decision (Board-ratified)

Objectives 3 and 6 of the Phase 4 brief (Executive Action Center™, ATHENA Action Engine™) are, in substance, the previously-reserved Executive Action Framework™ + Tool Invocation Framework™ + Executive Decision Engine™ (Phase 3E) — three components whose own governance docs have a circular "when to build it" dependency. The Board's explicit decision: build a **narrow, production-grade Playbook Action Engine™** instead — not the general framework. The engine is designed so it *could* become one implementation adapter underneath a future, general Executive Action Framework™, but that framework, Tool Invocation Framework™, and Executive Decision Engine™ remain fully reserved — see each one's own governance document.

## 3. Registry vs. Definitions — formally separate responsibilities

**The Registry (`api/playbooks/registry.js`) knows about definitions; it does not contain them.** A registration record is deliberately lightweight:

```js
{ playbookId, currentVersion, definitionSchema, registeredAt }
```

`registerPlaybook({playbookId, playbookVersion, definitionSchema, load})` stores this record plus a `load()` accessor; `getPlaybook(id)`/`getAllPlaybooks()` call `load()` on demand. **Content lives and is owned entirely in `api/playbooks/definitions/*.js`.** Adding a future playbook (SoundExchange, ASCAP, BMI, SOCAN, PRS, SACEM, YouTube OAC, split sheets, Content ID, TikTok Artist Profile, dozens more) is: create one new file, call `registerPlaybook()` on import, add one line to `definitions/index.js` — **zero changes to `registry.js` or the store, ever.** This mirrors the Capability Registry pattern (`api/athena/ask/capabilities/`) and the Engine Provider Registry, the same self-registering-module idiom now proven a third time in this codebase.

## 4. Playbook Definition schema

```js
{
  playbookId,            // stable slug, e.g. 'mlc-registration' -- never changes
  playbookVersion,        // e.g. '1.0' -- content version
  definitionSchema,       // e.g. 1 -- format version, independent of playbookVersion;
                           // protects future migrations of the definition SHAPE itself
  title, executiveSummary, whyItMatters,
  metrics: { difficulty, estimatedMinutes, estimatedRevenueImpact },  // grouped, not
                           // flat root fields -- keeps the schema extensible
  prerequisites,           // descriptive only -- see Playbook Independence Rule
  requiredDocumentation, affectedDomain,
  steps: [{ stepId, stepNumber, title, instructions, resources }],
                           // stepId is permanent (e.g. 'MLC-001'); stepNumber may be
                           // reordered in a future playbookVersion, stepId never is
  helpfulResources, completionVerification,
  isEligible(rawInputs) -> boolean,
  evidenceConfidence(rawInputs) -> 'HIGH'|'MEDIUM'|'LOW'|'INSUFFICIENT_DATA',
}
```

`isEligible`/`evidenceConfidence` are pure functions reading the same kind of `rawInputs` shape Ask ATHENA's Capability Registry already consumes (real CIM fields, e.g. `identity.coverage`, `publishingIntelligence.registrations.mlcRegistration`) — eligibility and confidence are computed from real evidence, never guessed, never fabricated by the presentation layer.

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
| Status, Progress (facts), Completion History | Playbook Action Engine™ (`api/_lib/playbook-action-store.js`) |
| Steps, Version, Definition Schema | Playbook Registry™ (`api/playbooks/definitions/`) |
| Evidence Confidence | Canonical Intelligence Engine™ (the same CIM/CIO-derived fields `isEligible` reads) |
| Recommendation (why a playbook is surfaced) | ATHENA™ (`api/athena/risk-analysis.js`) |
| Supporting Evidence | Evidence Attribution™ vocabulary (the same 7-value set Ask ATHENA uses; `'Evidence Registry'` is a recognized-but-currently-unused category — `api/evidence/registry/` is real but dormant, zero live callers, per the Phase 3 Closeout audit) |

Presentation layers (`ai-insights.html`'s Guided Playbooks™ section) only render these values — no business logic exists client-side.

## 7. Evidence First™ completion

Marking a step or a whole playbook complete records the **artist's own confirmation** (`completion_outcome`, e.g. `'user_confirmed_complete'`) — it never silently changes any Executive Intelligence score or claims the underlying platform state was independently re-verified. Only a real future scan can do that: the MLC risk (and any other trigger) simply stops appearing once a scan shows `mlcRegistration: 'VERIFIED'`. The playbook's `completed` status and the risk's absence are two independently-true facts, never forced to agree artificially.

## 8. Stable identity

- **Playbook ID**: hand-authored, fixed, never generated — the Registry's own key.
- **Action ID**: the primary key of a `playbook_actions` row, made stable by a partial unique index on `(artist_profile_id, playbook_id) WHERE status != 'archived'` — one active instance per pair. "Resume" means the store looks up this row before inserting a new one; the index is the enforcement backstop.
- **Step ID**: permanent per step (e.g. `'MLC-001'`), independent of `stepNumber` — every transition in `playbook_action_history` and every `advancePlaybookStep()` call is keyed by `stepId`, never by array position.

This is deliberately simpler than deriving identity from unstable risk/opportunity data (`riskId`/`opportunityId` are `randomUUID()`-regenerated every scan, confirmed via `api/athena/risk-analysis.js`) — the (artist, playbook) pair is already stable by construction.

## 9. Facts, not derived values

`playbook_actions` stores `completed_steps`/`total_steps` only. `progressPercentage` is always computed at read time (`api/_lib/playbook-action-store.js`'s `withProgressPercentage()`) — never a persisted column, so no derived value can ever drift from its source facts.

## 10. MLC risk wiring (the one real detection extension in 4A)

`api/athena/runtime-context-adapter.js`'s `buildMusicRightsEnvelope()` now threads `ctx.publishingIntelligence.registrations.mlcRegistration` through into the ATHENA `musicRights` envelope (a real, already-owned field — not a new derivation). `api/athena/risk-analysis.js`'s `identifyRightsRisks()` emits a real "Not Registered with The MLC" risk when that value is `'ACTION_REQUIRED'` or `'NOT_FOUND'` — deliberately excluding `'UNABLE_TO_CONFIRM'`, matching `publishing-intelligence.js`'s own stated principle: "we do not know — say nothing executive about it."

## 11. API surface — `api/playbook-actions.js`

- `GET` — lists the artist's own `playbook_actions` rows, enriched with each row's real step list (from the Registry) so the client can render an accurate checklist and determine the real next `stepId`.
- `POST {action: 'checkEligibility', workspaceContext}` — server recomputes eligibility/confidence itself from the supplied evidence via each definition's pure functions; never trusts a client-asserted eligibility claim.
- `POST {action: 'start', playbookId, workspaceContext}` — re-verifies eligibility server-side before starting.
- `POST {action: 'advance'|'complete'|'archive', actionId, ...}` — pure state-machine calls into the store.

Bearer-auth throughout; `artistProfileId` is always the authenticated caller's own `auth.uid()`, never client-supplied.

## 12. Sequencing

4A (this milestone) is the foundation only. 4B (Executive Opportunity Engine™ — ranking), 4C (Executive Action Center™ workspace + Executive Progress™ + Executive Timeline™), and 4D (ATHENA Action Engine™ — Ask ATHENA integration) each require their own branch, full certification, and explicit Board merge approval before beginning — see the approved Phase 4A plan for the full sequencing rationale.
