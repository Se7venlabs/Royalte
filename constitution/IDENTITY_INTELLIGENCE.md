# Royaltē Identity Intelligence™ — Pointer

**Status:** Phase 3B LOCKED v1.0 (Board Final Lock 2026-06-17)

**Source of truth: `api/_lib/identity-intelligence.js`.**

This file is a pointer, not a duplicate. The authoritative algorithm,
output shape, coverage formula, and state-mapping rules live in the
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

6. **Royaltē never renders intelligence for a provider that has not
   been scanned (Board R4).** Missing adapter ≠ Not Found. Missing
   adapter ≠ Unable To Confirm. Unsupported providers are excluded
   entirely until a first-class adapter exists.

7. **Output shape is LOCKED v1.0 (Board R1).** No new fields without
   explicit Board approval. The locked keys are: `providers`,
   `supportedProviders`, `verifiedProviders`, `totalProviders`,
   `coverage`, `strengths`, `issues`, `recommendations`.

8. **`supportedProviders` (Board R2) is the platform-capability
   self-description.** Mission Control reads it instead of hardcoding
   a provider list. When a new adapter lands, extending
   `IDENTITY_PROVIDERS` propagates automatically — no UI rewrite.

## Identity Intelligence™ vs Royaltē Health™ (Board Final Lock, 2026-06-17)

Identity Intelligence™ answers:

> "Is my artist identity healthy across supported providers?"

Royaltē Health™ answers:

> "How healthy is my entire backend ecosystem?"

Those are different questions and must remain separate intelligence
domains. Identity Intelligence owns identity STATUS and provider
COVERAGE. It does NOT compute an executive Health Score.

The future Royaltē Health™ Engine will consume Identity Intelligence
alongside Publishing / Catalog / Backend / Metadata / DSP / Collection
/ Revenue intelligence and produce a single executive Health Score.

## Coverage (informational only)

```
coverage = round(verifiedProviders / totalProviders * 100)
```

- `verifiedProviders` — count of providers whose state is `VERIFIED`.
  `ACTION_REQUIRED`, `NOT_FOUND`, and `UNABLE_TO_CONFIRM` do NOT count.
- `totalProviders` — count of providers in the Phase-3 set
  (`IDENTITY_PROVIDERS.length`, currently 3: apple · spotify · youtube).

Coverage is INFORMATIONAL ONLY. It is NOT a Health Score. Mission
Control MUST render it as a provider-coverage indicator — never as
an executive score.

Any weighted average of provider states (e.g. `VERIFIED = 100`,
`ACTION_REQUIRED = 50`, `NOT_FOUND = 0`) is hereby deprecated and
MUST NOT be reintroduced. Score-class computation belongs exclusively
to the future Royaltē Health™ Engine.

## Future provider expansion (Board R5 + R9)

```
New Adapter
   ↓
Scan Engine
   ↓
cio.observations.providers.<newProvider>   ← only schema change required
   ↓
Rule Library                                ← optional new rules
   ↓
Identity Intelligence                       ← extend IDENTITY_PROVIDERS only
   ↓
Mission Control / Royaltē AI / Executive Brief / Priority Actions
   (no rewrite required — they consume the locked shape)
```

The pipeline accepts any number of future providers (Amazon, Deezer,
Tidal, SoundCloud, MusicBrainz, Discogs, …) without architectural
redesign. Mission Control reads `supportedProviders` to discover
capability — it never hardcodes a provider list.

## Why this file does not list field shapes

Duplicating the output shape here would cause drift. The module
itself contains the authoritative doc-comment, and the test suite
at `tests/identity-intelligence-test.mjs` enforces it. This pointer
file does not have that guarantee.
