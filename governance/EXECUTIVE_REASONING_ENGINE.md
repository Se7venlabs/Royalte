# Executive Reasoning Engine™

ATHENA™ Phase 3E — Ask ATHENA™. Board Directive #1 / #9 — Deterministic Before Generative™.

## The principle

> If Royaltē can answer a question using verified canonical intelligence, it must do so. Only when deterministic systems cannot sufficiently answer should ATHENA invoke an external AI provider.

Not every question requires an LLM. Many answers already exist inside Royaltē's canonical intelligence engine — comparing scans, listing unresolved publishing issues, showing Executive Memory™, listing recurring risks. Answering these with an AI call would be slower, costlier, and would introduce a hallucination surface for questions that already have a ground-truth answer.

## Where it sits

```
Question Classifier™ → Executive Reasoning Engine™ → ┬─ Deterministic Response
                                                       └─ AI Required → Context Builder → ...
```

`api/athena/ask/reasoning-engine.js`'s `attemptDeterministicAnswer({question, intent, category, rawInputs})` is tried before any provider is selected. It returns either a complete Response Contract (deterministic exit, `providerVersion: 'deterministic'`) or `null` (no matching pattern — proceed to the Context Builder / AI-required path).

## Why it's built on the Capability Registry, not a second data-access path

The Reasoning Engine calls the same `api/athena/ask/capabilities/` modules the Context Builder uses for the AI-required path. The only difference between the two exits is whether an LLM is consulted — never which data layer is queried. This was a deliberate design constraint: a Reasoning Engine with its own hardcoded queries would be a second, competing way to read the same canonical data, exactly what "no layer duplicates another" forbids.

## The pattern set (Phase 3E)

A small, bounded list of matcher/composer pairs, one per deterministic question shape the Board named explicitly:

| Pattern | Data source | Answer type |
|---|---|---|
| Compare last two scans / what changed since last scan | `compareExecutiveBriefs()` (Phase 3D) | Derived Conclusion |
| Missing registrations | Latest Executive Brief's Publishing risks | Confirmed Fact |
| Unresolved publishing issues | Latest Executive Brief's Publishing risks | Confirmed Fact |
| Show my Executive Memory | Executive Memory™ capability | Confirmed Fact |
| List recurring risks | `recurringIssues` (derived from archive history) | Derived Conclusion |
| Display historical improvements | `resolvedIssues` (derived from archive history) | Derived Conclusion |

A question that matches a pattern but lacks the underlying data (e.g. "compare my last two scans" with only one scan on record) still returns deterministically — an honest Insufficient Evidence response costs no AI call either. Only a question matching **no** pattern falls through to the Context Builder.

## Explicitly not built this phase

**Executive Decision Engine™** (policy/security/approval gating) is a distinct, reserved component — see `governance/EXECUTIVE_DECISION_ENGINE.md`. The Reasoning Engine answers "can Royaltē answer this directly," not "is this action permitted" — those are different questions the Board deliberately kept separate, even though only one is built today.

## Extending this file

Adding a new deterministic pattern is additive: one new matcher/composer pair in `PATTERNS`, reusing an existing capability's data. It never requires a change to the Question Classifier, the Capability Registry, or the AI-required path.
