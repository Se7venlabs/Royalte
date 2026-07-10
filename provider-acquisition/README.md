# Provider Acquisition Layer — Connector Framework

**Authority:** Royaltē Master Constitution v1.3
**Phase:** 2.1 — Provider Connector Framework
**Status:** Dormant infrastructure. Nothing in production imports this tree in Phase 2.1.

---

## Governing Principle

> **The framework is constitutionally "dumb."**
> It acquires and packages what providers say.
> It NEVER validates, normalizes, reconciles, enriches, scores, interprets, or computes.
> Those responsibilities belong to the Royaltē Intelligence Engine.

If a helper would need to know what a payload **means**, it does not belong here.

---

## Naming

All components use **"Connector"** (Phase 2.1 Board directive). Do not use "Adapter."

---

## Tree Structure

```
provider-acquisition/
  connector/
    ProviderConnector.js        Abstract Connector interface — the constitutional core
    lifecycle.js                Lifecycle orchestration + ordering enforcement
  registry/
    ProviderRegistry.js         Provider directory (register / lookup / state-of-record)
    RegistryEntry.js            One provider's record shape (7 fields)
  capability/
    capabilityVocabulary.js     22 Board-ratified capabilities + vocabulary version
    CapabilityProfile.js        Profile declaration against the shared vocabulary
  health/
    healthStates.js             9 constitutional health states
    ProviderHealthSignal.js     Health signal type + reporting
  evidence/
    EvidenceRequest.js          Request shape passed to acquire()
    EvidenceContract.js         Common evidence envelope (provider-agnostic)
    integrity.js                payloadChecksum + rawResponseHash (Node crypto only)
  trust/
    trustConfig.js              Trust value loader (governance config, never interpreted)
  __tests__/
    mockConnector.js            Reference implementation (TEST-ONLY, not for production)
    conformance.test.js         Full conformance suite — run with node
```

---

## Constitutional Constraints

### What the Connector Framework does

1. Defines the **interface** every provider connector must implement.
2. Provides the **registry** — the authoritative directory of what providers exist and what they declare.
3. Provides the **capability vocabulary** — the shared enumeration from which connectors declare functional coverage.
4. Provides the **health framework** — 9 states for classifying acquisition outcomes by transport/shape facts only.
5. Provides the **trust framework** — a config-sourced value the framework carries but never interprets.
6. Provides the **evidence contract** — the common envelope wrapping raw provider responses.
7. Provides **lifecycle orchestration** — enforces the canonical connector sequence with strict ordering.

### What the Connector Framework must NEVER do

- Validate **content** (well-formedness of the envelope is allowed; judging content meaning is not).
- Normalize provider shapes into canonical shapes.
- Reconcile conflicting evidence between providers.
- Enrich evidence with derived data.
- Score anything.
- Compute intelligence of any kind.
- Interpret what a provider response means.
- Decide truth — pick a "winner" when providers disagree.
- Contain business logic — any Royaltē concept, rule, or heuristic.
- Import or reference provider-specific code (Apple, Spotify, MLC, etc.).
- Wire into the RIE, any product surface, or Monitoring Intelligence.

The **litmus test**: if a proposed addition would need to know what a payload field *means* (not just that it exists), it belongs in the RIE — not here.

---

## The Provider Connector Interface

Every concrete connector implements these 7 methods:

| Method | Responsibility |
|---|---|
| `initialize(config)` | One-time setup from injected config. No network calls. |
| `authenticate()` | Acquire/refresh credentials. Returns `{ health, credentials }`. Never throws raw errors. |
| `discoverCapabilities()` | Return this connector's `CapabilityProfile` (static — no network required). |
| `reportHealth()` | Current health state. No side effects. |
| `acquire(EvidenceRequest)` | Fetch raw evidence. Returns `EvidenceContract`. Never interprets. |
| `getVersion()` | Connector version + provider API version. |
| `shutdown()` | Release resources. |

---

## Lifecycle Sequence

```
Initialize → Register → Authenticate → CheckHealthAndCapabilities → [Acquire]* → Shutdown
```

Ordering is enforced: calling `acquire()` before `authenticate()` throws. See `lifecycle.js`.

---

## Health States (9 constitutional states)

```
AVAILABLE · PARTIAL_RESPONSE · MAINTENANCE · TIMEOUT ·
AUTH_FAILED · SCHEMA_CHANGED · RATE_LIMITED · DEPRECATED · DISABLED
```

`DEPRECATED`: endpoint works now but is scheduled for retirement — a forward-looking warning.
`DISABLED`: governance-off via the registry `enabled` flag — distinct from a provider-side failure.

---

## Capability Vocabulary

22 Board-ratified capabilities (vocabulary version `1.0`):

```
Artist Identity · Releases · Tracks · Albums · ISRC · ISWC · UPC ·
Publishing · Songwriters · Contributors · Territories · Availability ·
Genres · Labels · Audio Features · Artwork · Social Links · Rights Data ·
Performance Data · Collection Data · Podcasts · Videos
```

Connectors declare from this enumeration only. Adding a new capability = extend `capabilityVocabulary.js` + bump `VOCABULARY_VERSION`. No other file changes needed.

---

## Provider Trust

Trust values are governance decisions — human-set, versioned in config, never computed by an algorithm. The framework reads a number from `trustConfig.js` and attaches it to the Evidence Contract and registry entry. **Any reasoning with the number happens in the RIE (future phase).**

---

## Evidence Contract

The `EvidenceContract` is a sealed envelope containing:
- Full identity and traceability fields (IDs, versions, timestamps)
- Provenance metadata (provider, trust value, capability profile reference)
- Health metadata (state, completeness)
- The raw `payload` — **opaque container, never defined or parsed by the framework**
- Provider-specific `providerFields` — **quarantined, never hoisted to canonical shape**
- Integrity hashes (`payloadChecksum`, `rawResponseHash`)

---

## Running the Conformance Suite

```
node provider-acquisition/__tests__/conformance.test.js
```

Exits 0 on all-green. Exits 1 on any failure. No test runner required.

---

## What Is NOT Built in Phase 2.1

- No concrete provider connectors (Apple, Spotify, MLC, etc.)
- No RIE wiring
- No Canonical Intelligence Model wiring
- No product integration (Mission Control, Scan, etc.)
- No Monitoring Intelligence integration (health is reported here; routing is a later phase)
- No Evidence Store (long-term roadmap — parent design §5A)

Provider connectors and RIE wiring are Phase 2.2+.
