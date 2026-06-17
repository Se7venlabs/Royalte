# Royaltē Identity Intelligence™ — Pointer

**Status:** Phase 3B (added 2026-06-17)

**Source of truth: `api/_lib/identity-intelligence.js`.**

This file is a pointer, not a duplicate. The authoritative algorithm,
output shape, score formula, and state-mapping rules live in the
doc-comment block at the top of `api/_lib/identity-intelligence.js`.

Read the source: [`api/_lib/identity-intelligence.js`](../api/_lib/identity-intelligence.js).

## Position in the architecture

```
Scan Engine → Apple Adapter → Canonical Intelligence Object™
                                      ↓
                              Rule Library™
                                      ↓
                              Observations
                                      ↓
                        Identity Intelligence™  ← this layer
                                      ↓
   Mission Control™ · Royaltē AI™ · Executive Brief™ · Priority Actions™
```

One Scan → One CIO → One Rule Library → One Identity Intelligence
Object → Many Consumers.

## Constitutional rules (binding)

1. **AUTH_UNAVAILABLE and ERROR resolve to ⏳ Unable to Confirm —
   never ❌ Not Found.** Telling an artist Royaltē confirmed their
   absence when in fact Royaltē could not look is forbidden.

2. **Mission Control performs zero calculations.** Mission Control
   reads the Identity Intelligence™ object and renders. Every other
   downstream surface does the same.

3. **One Identity Intelligence Object.** No surface recomputes per-
   provider state. No surface calls a provider API directly. No
   surface reads `cio.observations.providers` and derives a state
   bypass.

4. **Provider coverage = apple · spotify · youtube** (Phase 3B).
   Amazon Music is deferred per Board D1 and intentionally absent
   from the output. Adding a provider requires explicit Board
   approval AND a working adapter — placeholders are not permitted.

5. **Spotify never resolves to ACTION REQUIRED in Phase 3B.** Board
   D4: "Do NOT invent Action Required conditions until richer
   Spotify observations exist." Future phases may add Spotify rules.

## Stage 3B v1.0 score formula (flagged for Board ratification)

The current `score` formula is:

- VERIFIED          = 100 points
- ACTION_REQUIRED   = 50 points
- NOT_FOUND         = 0 points
- UNABLE_TO_CONFIRM = excluded from numerator AND denominator
- score = round(sum / count of evaluated providers)
- All-UNABLE_TO_CONFIRM → score = `null`

This formula was not explicitly locked in the Phase 3 brief and is
held for Board ratification or amendment before Mission Control™
wiring.

## Why this file does not list field shapes

Duplicating the output shape here would cause drift. The module
itself contains the authoritative doc-comment, and the test suite
at `tests/identity-intelligence-test.mjs` enforces it. This pointer
file does not have that guarantee.
