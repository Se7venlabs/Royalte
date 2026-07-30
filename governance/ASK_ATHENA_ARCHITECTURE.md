# Ask ATHENA™ Architecture

ATHENA™ Phase 3E — The Executive Intelligence Advisor™.

## Governing principle

> Royaltē's intelligence originates from its canonical evidence engine. ATHENA's role is to reason over that intelligence — not replace it.

Every response, deterministic or AI-generated, is grounded in verified evidence already produced elsewhere in Royaltē (the scan engine, the Executive Brief Archive™, Executive Memory™). ATHENA never becomes a second, competing source of truth.

## The Four Layer ATHENA Architecture™

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

Each layer owns exactly one responsibility (Separation of Responsibility™). Business logic is never duplicated across layers — a fact this repository has enforced from Phase 3D onward (`api/_lib/canonical-domain-fingerprints.js` is the one comparison logic reused by Phase 3D's comparison/trend endpoints **and** Phase 3E's Capability Registry).

## Why this is provider-independent

`api/athena/ask/provider-interface.js` defines the entire contract a provider must satisfy: `generate`, `healthCheck`, `estimateCost`, `estimateTokens`, plus a `providerVersion` string. Nothing above the Provider Interface — Context Builder, Reasoning Engine, Capabilities, Prompt Assembly, every workspace — ever names a vendor. `api/athena/ask/providers/placeholder-provider.js` is the only implementation that ships this phase: zero external calls, a deterministic template-composed answer built from the assembled prompt's own evidence, honestly disclosed as not yet a full conversational answer. `api/athena/ask/provider-factory.js` reads `process.env.ATHENA_PROVIDER` — adding a real vendor later means adding one new file under `providers/`, nothing else.

## Key files

| Layer | File | Responsibility |
|---|---|---|
| Decision | `intent-engine.js` | What does the artist want ATHENA to *do*? |
| Decision | `question-classifier.js` | What is the question *about*? |
| Decision | `reasoning-engine.js` | Can Royaltē answer this without AI? |
| Knowledge | `capabilities/*.js` | Structured, per-domain evidence access |
| Intelligence | `context-builder.js` | Assemble only the relevant capabilities' context + Conversation Memory™ |
| Intelligence | `evidence-attribution.js` | Tag every fact with its verifiable origin |
| Intelligence | `prompt-assembly.js` | Normalize, dedupe, budget, prepend Personality |
| Intelligence | `response-contract.js` | The merged Executive Response Schema™ every answer conforms to |
| Intelligence | `athena-service.js` | Provider selection, retry, timeout, normalization (the only network I/O in this tree) |
| Experience | `public/workspaces/ask-athena.html` | Standalone Mission Control workspace |

## Safety Layer™

`answerType` on every Response Contract classifies the answer: Confirmed Fact, Derived Conclusion, Recommendation, Unknown, Unavailable, or Insufficient Evidence. When evidence is genuinely insufficient, `answer` is always the exact Board-required sentence: *"There is currently insufficient verified evidence to answer that question."* — never a paraphrase, never a guess dressed as an answer.

## Explainability Framework™

Every entry in `recommendations` answers four questions: Why?, Evidence?, Assumptions?, What could change this? — `{statement, why, evidence, assumptions, whatCouldChange}`. Enforced structurally (`response-contract.js`'s `validateResponseContract()`), in both the deterministic and AI-required paths.

## Deep Mission Control Integration™

Every citation carries a `{label, workspace}` pair; `athena-service.js` derives `relatedWorkspaces` from those citations automatically. The Ask ATHENA workspace renders an "Open Workspace →" action per recommendation — ATHENA is a navigation layer into Mission Control, not an isolated chat window.

## Future Work (not built this phase — see the Reserved Components Roadmap)

- **Recommendation Ranking Engine™**: order `recommendations` by revenue impact, priority, risk reduction, effort, confidence, and dependencies, rather than the order the Reasoning Engine/AI pipeline happens to produce them in. No dedicated governance document was requested by the Board for this component — captured here instead.
- Streaming responses (the Provider Interface's `generate()` signature is designed to accept a future `onToken` callback; nothing implements it today).
- A real token-based prompt budget (Prompt Assembly currently uses a character-count proxy, documented as an approximation).

See `governance/EXECUTIVE_REASONING_ENGINE.md` and `governance/ATHENA_EXECUTIVE_PERSONALITY.md` for the two components with dedicated documents; see the Reserved Components Roadmap (in the approved Phase 3E plan) for everything explicitly deferred.
