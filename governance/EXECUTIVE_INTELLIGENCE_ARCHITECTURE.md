# Executive Intelligence Architecture™

Phase 3 Closeout — Post-Merge Engineering Directive. Documents the completed Executive Intelligence platform exactly as it exists on `main` after Phase 3D (PR #442), Phase 3C (PR #444), and Phase 3E (PR #446) merged. This is the canonical constitutional reference for the platform's architecture — future work should extend it, not re-derive it.

---

## 1. What "Executive Intelligence" means in this codebase

Royaltē's core product loop is: run a scan → produce canonical intelligence → synthesize it into executive judgment (risks, opportunities, recommendations) → let an artist act on it, either by reading Mission Control or by asking ATHENA directly. Three architectural eras built this, each documented and merged separately:

- **Phase 1/2 (2026-07-21 – 2026-07-24)**: the Canonical Executive Intelligence Object™ pipeline — `api/athena/pipeline.js` orchestrates Adapter → Engine → Executive Intelligence Object (EIO). Not wired to a live caller until Phase 3A.
- **Phase 3A/3B (2026-07-24 – 2026-07-25)**: the Executive Brief Archive™ (persists an EIO snapshot per scan) and the history/timeline/comparison/trend-detection/memory-foundation services that read it.
- **Phase 3D/3C/3E (2026-07-29 – 2026-07-31, this closeout's subject)**: Cross-Scan Intelligence™ (real per-field domain comparison), Executive Memory™ (a writable, artist-curated fact store), and Ask ATHENA™ (a conversational interface over everything above).

## 2. The Four Layer ATHENA Architecture™ (Ask ATHENA, Phase 3E)

```
Artist Question
      │
──────────────────────────────────────────
Decision Layer™
──────────────────────────────────────────
Executive Intent Engine™ → Question Classifier™ → Executive Reasoning Engine™
      │
      ├── Deterministic Response ────────────────────────► Structured Response
      │
      └── AI Required
              │
──────────────────────────────────────────
Knowledge Layer™
──────────────────────────────────────────
              │
      Capability Registry™ (11 domain modules)
              │
──────────────────────────────────────────
Intelligence Layer™
──────────────────────────────────────────
              │
      Executive Context Builder™ (+ Conversation Memory™)
              │
      Evidence Attribution™
              │
      Prompt Assembly™ (incl. Executive Personality™)
              │
      ATHENA Service™
              │
      Provider Interface™ → LLM Provider
              │
──────────────────────────────────────────
Experience Layer™
──────────────────────────────────────────
              │
      Structured Response → Mission Control (Ask ATHENA™ workspace)
```

This is Ask ATHENA's own architecture (Phase 3E), but it also frames how the rest of Executive Intelligence fits: Decision and Knowledge Layer components consume Cross-Scan Intelligence™ (Phase 3D) and Executive Memory™ (Phase 3C) as two of their Knowledge Layer capabilities, not as separate systems.

## 3. Full request lifecycle — scan to artist experience

```
1. Artist runs a scan
   GET /api/audit  ──►  api/audit.js  ──►  runAudit() (10-platform fan-out)
                          │
                          ▼
                   audit_scans row written (payload, schema_version, scanId)

2. Canonical payload → workspace context (client-side)
   public/js/runtime-context-mapper.js
     buildWorkspaceRuntimeContext(payload) → royalte_workspace_context v1.1
                          │
                          ▼
                   sessionStorage (read by every workspace page via
                   public/js/mc-workspace-context.js's readWorkspaceContext())

3. Executive Intelligence Object™ generation (Phase 1/2 pipeline)
   POST /api/executive-intelligence
     runExecutiveIntelligencePipeline(workspaceContext)
       Adapter (runtime-context-adapter.js)
         → ATHENA_ENGINE.analyze() (risk-analysis.js, opportunities.js,
           recommendations.js, confidence.js)
         → buildExecutiveIntelligenceObject() (executive-intelligence-object.js)
                          │
                          ▼ (Bearer-authenticated callers only)
4. Archive write (Phase 3A)
   archiveExecutiveBrief() (api/_lib/executive-brief-archive.js)
     → public.executive_brief_archive row
       (executive_intelligence_object jsonb, scan_id FK, idempotent on
       (artist_profile_id, scan_id))

5. Mission Control / workspace rendering (presentation only)
   ai-insights.html, health-intelligence.html, etc. render the EIO +
   royalte_workspace_context directly -- no business logic client-side.

6. Historical services (Phase 3B, extended Phase 3D/3C) -- read-only over
   the archive, via api/_lib/executive-brief-archive-reader.js:
     executive-comparison.js / executive-trend-detection.js
       (+ canonical-domain-fingerprints.js, Phase 3D -- real per-field
       comparison, reading audit_scans.payload directly, never duplicating
       into the archive)
     executive-memory.js (derived recurringIssues/resolvedIssues)
       + executive-memory-store.js (Phase 3C -- real writable facts,
       public.executive_memory_items)
     executive-history-summary.js, executive-timeline.js

7. Ask ATHENA (Phase 3E) -- the conversational entrypoint over everything
   above. See §4-§7 below.
```

## 4. The deterministic path (Deterministic Before Generative™)

```
POST /api/ask-athena
  → rate-limit guard, Bearer auth, validatePromptSafety()
  → classifyIntent(question)              [intent-engine.js]
  → classifyQuestion(question, intent)    [question-classifier.js]
  → attemptDeterministicAnswer(...)       [reasoning-engine.js]
       │
       ├─ matches a known pattern (compare last two scans, show my
       │  executive memory, missing registrations, unresolved publishing
       │  issues, list recurring risks, historical improvements)
       │     → composes a full Response Contract directly from the
       │       Capability Registry's data (same registry the AI path
       │       uses) -- zero AI cost, zero AI latency,
       │       providerVersion: 'deterministic'
       │
       └─ no pattern matches → returns null → proceed to §5
```

The Reasoning Engine is deliberately built on the same Capability Registry the AI-required path uses (§5) — the only difference between the two exits is whether an LLM is consulted, never which data layer is queried. See `governance/EXECUTIVE_REASONING_ENGINE.md` for the full pattern list and rationale.

## 5. The AI-required path

```
reasoning-engine.js returns null
      │
      ▼
buildExecutiveContext({domains, rawInputs})     [context-builder.js]
  → asks capabilities/registry.js for only the domains the Question
    Classifier flagged relevant (11 possible: identity, publishing,
    catalog, health, backend, media, globalFootprint, monitoring,
    executiveMemory, executiveBriefArchive, conversationHistory)
  → each available capability contributes {section, text} + evidence +
    citations + a confidence signal
  → folds in Conversation Memory™ as a `recent_conversation` section
      │
      ▼
attributeEvidence(evidence, {evidenceConfidence})   [evidence-attribution.js]
  → tags every fact's origin (Canonical Domain / Executive Brief /
    Executive Memory / Monitoring Event / User Confirmation / Evidence
    Registry / Unknown)
deriveOverallConfidence(confidenceLevels)
  → worst (least confident) capability signal wins
      │
      ▼
assemblePrompt({question, contextSections, attributedEvidence})  [prompt-assembly.js]
  → prepends the fixed Executive Personality™ section
  → dedupes evidence, enforces a character-count token budget, trims
    context sections (never personality/question/evidence) if oversized
      │
      ▼
generateAnswer({assembledPrompt, meta, overallConfidence, citations})  [athena-service.js]
  → createAthenaProvider()                        [provider-factory.js]
       reads process.env.ATHENA_PROVIDER (default 'placeholder')
  → provider.generate(assembledPrompt), bounded retry, hard timeout
  → normalizes the provider's raw output into the Response Contract
  → derives relatedWorkspaces from citations
  → on failure/timeout: makeUnavailableResponse() -- graceful
    degradation, never a hang or opaque 500
```

## 6. Provider abstraction

`api/athena/ask/provider-interface.js` is the entire contract: `generate(assembledPrompt)`, `healthCheck()`, `estimateCost()`, `estimateTokens()`, plus a `providerVersion` string, enforced at runtime by `assertValidProvider()`. Nothing above this interface — Context Builder, Reasoning Engine, Capabilities, Prompt Assembly, every workspace — ever names a vendor. `providers/placeholder-provider.js` is the only implementation on `main` today: zero external calls, a deterministic template-composed answer built from the assembled prompt's own evidence, honestly disclosed as not yet a full conversational answer. Adding a real vendor later means adding one new file under `providers/` and pointing `ATHENA_PROVIDER` at it — nothing else in the tree changes.

## 7. Conversation lifecycle (Conversation Memory™)

```
api/_lib/athena-conversation-store.js  (never-throws contract)

startConversation({artistProfileId})          → new athena_conversations row
getConversation({artistProfileId, id})        → ownership-scoped lookup
appendTurn({..., role, content, responseContract})
                                               → new athena_conversation_turns row
                                                 (role: 'user'|'athena'; the full
                                                 Response Contract is stored on
                                                 'athena' turns so a resumed
                                                 conversation can re-render
                                                 citations/recommendations exactly)
getRecentTurns({..., limit=6})                → fetched ascending, tail-sliced
                                                 in JS (not descending+reverse --
                                                 avoids an ordering bug under
                                                 timestamp ties, see
                                                 LESSONS_LEARNED_PHASE_3E.md §3.4)
```

Conversation Memory™ is short-lived per-conversation turn history for pronoun/reference resolution — explicitly and structurally distinct from Executive Memory™. No code path in `api/ask-athena.js` or `athena-conversation-store.js` writes to `executive_memory_items`; this is verified both by an automated structural test (`tests/ask-athena-test.mjs` §11) and was confirmed live via direct database query during Phase 3E certification.

## 8. Executive Memory™ interaction

Ask ATHENA reads Executive Memory™ (via the `executiveMemory` capability and the `recurringIssues`/`resolvedIssues` derived data `api/_lib/executive-memory.js` already computes) but never writes to it. The only write path into `public.executive_memory_items` is `api/_lib/executive-memory-store.js`, called exclusively from `api/executive-memory-actions.js`, gated by **Memory Promotion™**: an `ATHENA Recommendation`-sourced item is never persisted without an explicit `promotedBy: 'user_confirmed'` flag. An artist must take a deliberate, separate action to promote something ATHENA said into memory — a conversation turn alone never does it.

## 9. Executive Brief™ interaction

Ask ATHENA reads the archive exclusively through `api/_lib/executive-brief-archive-reader.js` (`listBriefs`, `countBriefs`) — the same canonical data-access layer every other Phase 3 service uses. It never writes to `executive_brief_archive`; that write path remains exclusively `api/_lib/executive-brief-archive.js`, triggered only from `/api/executive-intelligence` on a genuine new scan.

## 10. Mission Control integration

Ask ATHENA is a standalone Mission Control workspace (`public/workspaces/ask-athena.html`), reached via its own left-rail nav entry on all 9 existing workspace pages (Health, Identity, Publishing, Catalog, Global Music Footprint, Media, AI Insights, Backend, Settings). It follows the same Canonical Workspace Architecture™ every workspace uses (§1 Context / §2 Intelligence / §3 Presentation / §4 Render), registered in `public/js/mc-workspace-context.js`'s `WORKSPACE_CONTRACTS` as `'ask-athena'` (no required domain — a valid scan context is enough to render the conversation panel; missing domain data degrades honestly per-question via the Response Contract's Insufficient Evidence status, not by blocking the whole workspace).

**Deep Mission Control Integration™**: every citation on a Response Contract carries a `{label, workspace}` pair; `athena-service.js` derives `relatedWorkspaces` from those citations automatically, and the UI renders an "Open Workspace →" action per recommendation — ATHENA is a navigation layer into Mission Control, not an isolated chat window.

`mission-control.html`'s own left rail (Executive Reports™/Settings/Account) and Board-locked 8-node hero-globe are explicitly untouched by any of this — a deliberate scope boundary confirmed with the Board during Phase 3E.

## 11. Sequence diagram — a single Ask ATHENA request, deterministic exit

```
Artist         Ask ATHENA UI      /api/ask-athena       Reasoning Engine    Capability Registry
  │                  │                    │                     │                   │
  │ types question   │                    │                     │                   │
  │─────────────────►│                    │                     │                   │
  │                  │ POST {question,    │                     │                   │
  │                  │  conversationId}   │                     │                   │
  │                  │───────────────────►│                     │                   │
  │                  │                    │ classifyIntent()    │                   │
  │                  │                    │ classifyQuestion()  │                   │
  │                  │                    │────────────────────►│                   │
  │                  │                    │                     │ getCapability()   │
  │                  │                    │                     │──────────────────►│
  │                  │                    │                     │◄──────────────────│
  │                  │                    │◄────────────────────│ Response Contract │
  │                  │                    │  appendTurn() x2 (user + athena)        │
  │                  │◄───────────────────│                     │                   │
  │◄─────────────────│  render answer +   │                     │                   │
  │                  │  badges + evidence │                     │                   │
```

## 12. Sequence diagram — a single Ask ATHENA request, AI-required exit

```
Artist    Ask ATHENA UI   /api/ask-athena   Context Builder   Prompt Assembly   ATHENA Service   Provider
  │             │                │                │                 │                │              │
  │  question   │                │                │                 │                │              │
  │────────────►│───────────────►│  (reasoning     │                 │                │              │
  │             │                │   engine: null) │                 │                │              │
  │             │                │───────────────►│                 │                │              │
  │             │                │  {sections,     │                 │                │              │
  │             │                │   evidence,     │                 │                │              │
  │             │                │   citations}    │                 │                │              │
  │             │                │◄───────────────│                 │                │              │
  │             │                │  attributeEvidence()             │                │              │
  │             │                │────────────────────────────────►│                │              │
  │             │                │  assembledPrompt                 │                │              │
  │             │                │◄────────────────────────────────│                │              │
  │             │                │  generateAnswer()                                  │              │
  │             │                │──────────────────────────────────────────────────►│              │
  │             │                │                                                     │  generate()  │
  │             │                │                                                     │─────────────►│
  │             │                │                                                     │◄─────────────│
  │             │                │◄──────────────────────────────────────────────────│ Response      │
  │             │                │  appendTurn() x2                                    │ Contract      │
  │             │◄───────────────│                                                     │              │
  │◄────────────│                │                                                     │              │
```

## 13. Reserved architecture (documented, not built)

Six components named across the Board's later Phase 3E directives are reserved — governance documentation only, no runtime code: Executive Decision Engine™, Executive Skills™, Executive Planner™, Executive Learning™, Recommendation Ranking Engine™, Tool Invocation Framework™, Executive Action Framework™. Each has its own governance document (`governance/EXECUTIVE_DECISION_ENGINE.md`, etc.) describing what it would be, why it's reserved, and when to build it. See `governance/PHASE3_EXECUTIVE_SUMMARY.md` for the consolidated list.
