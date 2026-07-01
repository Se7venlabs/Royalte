# ROYALTĒ INTELLIGENCE ENGINE — PHASE 2.1 IMPLEMENTATION PLAN

## Provider Connector Framework

**Authority:** Royaltē Master Constitution v1.3
**Parent design:** Phase 2 PAL Technical Design v3 (Board-approved)
**Status:** 🟡 IMPLEMENTATION PLAN FOR BOARD APPROVAL — no implementation authorized
**Baseline:** Phase 1 (RIE core) merged and locked
**Audience:** Constitutional Board (approval) → Claude Code (implementation, after approval)

> **This is the final planning document before engineering begins.** No code, no implementation, no production changes. Per Board governance: Architecture → Implementation Plan → Implementation → Certification → Board Review → Merge → Lock. This document is the second step; implementation is not authorized until the Board approves it.

---

## 0. SCOPE & GOVERNANCE NOTES

### 0.1 What Phase 2.1 builds

Phase 2.1 builds the **Provider Connector Framework** — the Operating System infrastructure that every current and future provider will use. It is **framework only.** It establishes the interface, registry, and supporting frameworks (capability, health, trust, evidence contract, lifecycle) that all providers plug into.

### 0.2 What Phase 2.1 explicitly does NOT build

Per the Board directive, this phase contains **zero provider-specific logic**:

- ❌ No Apple code
- ❌ No Spotify code
- ❌ No MusicBrainz code
- ❌ No MLC code (or any other provider)
- ❌ No Mission Control wiring
- ❌ No RIE wiring
- ❌ No product integration
- ❌ No Monitoring Intelligence integration (health is *reported*, not yet *routed*)
- ❌ No Evidence Store (§5A of parent design is future roadmap)

Provider-specific connectors, and wiring the framework to the RIE, are later phases (2.2+). This phase produces the empty, tested, constitutional scaffold.

### 0.3 Naming decision required — "Connector" vs "Adapter" (Board ruling)

The approved Phase 2 design (§2.0) retained **"Adapter"** with documented rationale. This Phase 2.1 directive names the phase **"Provider Connector Framework"** and uses "Connector" throughout. These are two Board-approved artifacts using different terms for the same component.

**This plan adopts "Connector"**, treating the Board's consistent, deliberate use in the phase directive as an override of the §2.0 "Adapter" recommendation. This is logged here as a single, explicit decision rather than a silent substitution.

**Board: please confirm.** If "Adapter" is preferred, the swap is a global find-replace with no structural impact, and §2.0 of the parent design stands. Until confirmed, all files and interfaces below use `Connector`. *(One term, chosen once, applied everywhere — the design must not carry both.)*

### 0.4 Assumed stack

Consistent with the existing repo: **Node ESM, no build step.** Framework files are plain ES modules under a new `provider-acquisition/` tree. No new runtime dependency is introduced by Phase 2.1 beyond what the repo already uses; if hashing (evidence integrity) needs a library beyond Node's built-in `crypto`, that is flagged for Board note (§11) rather than assumed.

---

## 1. PROVIDER CONNECTOR INTERFACE

The single contract every provider must implement. This is the heart of Phase 2.1. It is provider-agnostic: nothing in the interface knows about any specific provider.

### 1.1 Interface responsibilities

| Method | Responsibility | Returns |
|---|---|---|
| `initialize(config)` | one-time setup from injected config; no network calls | ready state |
| `authenticate()` | acquire/refresh credentials → auth context | auth result / health signal on failure |
| `discoverCapabilities()` | return this connector's declared Capability Profile | `CapabilityProfile` (§3) |
| `reportHealth()` | current health without side effects | `ProviderHealthSignal` (§4) |
| `acquire(EvidenceRequest)` | fetch raw evidence for a request | `EvidenceContract` (§6) |
| `getVersion()` | report connector + provider API version | version descriptor |
| `shutdown()` | release resources, close connections | void |

### 1.2 Constitutional constraints on the interface

- The interface returns **raw evidence and metadata only.** No method normalizes, scores, reconciles, or interprets. (Parent design §1.0 — the connector is constitutionally "dumb.")
- `acquire()` never decides truth or picks winners; it returns what one provider said, wrapped in the common Evidence Contract.
- Every method that can fail resolves to a **health signal**, never a raw thrown provider error (parent §2.10).
- The interface is **stateless with respect to intelligence** — it may hold connection/auth state, never derived meaning.

### 1.3 Interface as an abstract contract

Phase 2.1 ships the interface as an **abstract base / contract definition** plus a conformance test suite (§8). No concrete provider implements it yet. A **reference mock connector** (test-only, never shipped to production paths) is built solely to prove the framework works end-to-end and to serve as the conformance fixture.

---

## 2. PROVIDER REGISTRY

The authoritative directory of every provider connected to Royaltē.

### 2.1 What the registry maintains (per provider)

```
RegistryEntry
  name                 // "apple_music", "spotify", ...
  version              // connector + provider API version
  capabilityProfile    // §3
  trustValue           // §5 — governance config, carried not interpreted
  healthState          // §4 — last reported state
  enabled              // boolean — governance switch
  implementationStatus // planned | scaffolded | implemented | certified
```

### 2.2 Registry responsibilities

- **Registration:** a connector registers itself (or is registered from config) at startup, publishing its identity, version, capability profile, and trust value.
- **Lookup:** the RIE (in later phases) queries the registry to discover which providers exist, what they can do, and whether they're enabled — *the registry is how the RIE will later select providers by capability without hardcoded lists.*
- **State of record:** holds current health and implementation status as the single source of truth about *provider availability*, distinct from *intelligence* (which is never here).

### 2.3 Constitutional note

The registry is a **directory, not a decision-maker.** It records what providers declare; it never ranks them, never decides which to use, never computes. Selection logic belongs to the RIE. `implementationStatus` lets the platform carry providers that are declared-but-not-yet-built (`planned`/`scaffolded`) without breaking — supporting incremental provider rollout in later phases.

---

## 3. CAPABILITY PROFILE FRAMEWORK

Implements parent design §2.12.

### 3.1 What it does

Defines how a connector declares its functional coverage against a **standardized, versioned capability vocabulary**, and how those declarations are loaded into the registry.

### 3.2 The vocabulary

- A single shared enumeration (the 22 capabilities ratified in parent §2.12: Artist Identity, Releases, Tracks, Albums, ISRC, ISWC, UPC, Publishing, Songwriters, Contributors, Territories, Availability, Genres, Labels, Audio Features, Artwork, Social Links, Rights Data, Performance Data, Collection Data, Podcasts, Videos).
- **Versioned** (`vocabularyVersion`) so the vocabulary can expand without breaking existing profiles.
- Capabilities are declared from this enumeration only — never invented ad-hoc inside a connector (parent §2.12 governance rule).

### 3.3 Extensibility guarantee

- Adding a **new provider** = write a connector + declare its profile. No framework change.
- Adding a **new capability** = extend the shared vocabulary + bump `vocabularyVersion`. No connector or registry redesign.
- This is the "capability expansion without architectural changes" the directive requires — provider-agnostic by construction.

---

## 4. HEALTH FRAMEWORK

Implements parent design §4.

### 4.1 Supported states (all constitutional states)

```
AVAILABLE · PARTIAL_RESPONSE · MAINTENANCE · TIMEOUT ·
AUTH_FAILED · SCHEMA_CHANGED · RATE_LIMITED · DEPRECATED · DISABLED
```

`DEPRECATED` (parent Board-review #2): endpoint works now but is scheduled for retirement — a forward-looking warning. `DISABLED`: governance-off via the registry `enabled` flag — distinct from a provider-side failure.

### 4.2 What Phase 2.1 builds

- A **health signal type** and the framework for connectors to report it (via `reportHealth()` and as health metadata on every Evidence Contract).
- Health classification helpers (structural/transport facts only — never content interpretation, parent §4.2).

### 4.3 What Phase 2.1 does NOT build

- **No Monitoring Intelligence integration.** Health is *reported and made available*; routing it into Monitoring is a later phase. The framework exposes health; it does not yet consume or forward it downstream. This boundary is explicit in the directive.

---

## 5. TRUST FRAMEWORK

Implements parent design §2.11. Governance metadata, **not intelligence.**

### 5.1 What it defines

- **Where trust values live:** in governance configuration (a versioned config source), not in connector logic and not hardcoded.
- **How they're configured:** set by governance/human decision, changed deliberately, never by an algorithm.
- **How connectors expose them:** the connector reads its configured trust value and carries it onto the Evidence Contract and registry entry as a declared provenance attribute.
- **How the RIE will later consume them:** as *one possible input* to reconciliation (e.g. tie-breaking). Phase 2.1 does **not** build that consumption — it only ensures the value is exposed and carried.

### 5.2 Constitutional constraint

The Connector Framework **never interprets trust values.** It reads a number from config and attaches it. Any reasoning with the value happens in the RIE, in a later phase, on the far side of the boundary (parent §2.11, §5).

---

## 6. EVIDENCE CONTRACT

The common structural contract every connector returns, regardless of source. Implements parent design §3.2. **Common contract only — no provider-specific payloads defined.**

### 6.1 The contract

```
EvidenceContract
  // ── Identity & traceability ──
  evidenceId · acquisitionId · correlationId · requestId · schemaVersion

  // ── Provider metadata ──
  provider · providerVersion · connectorVersion · providerTrust · capabilityProfileRef

  // ── Timing ──
  acquiredAt · providerReportedAt

  // ── Health metadata ──
  health · completeness            // full | partial | empty

  // ── Payload & integrity ──
  payload                          // RAW provider response, untouched (shape unknown to framework)
  providerFields                   // provider-specific fields, preserved & quarantined
  payloadChecksum · rawResponseHash
```

### 6.2 What the framework defines vs. leaves open

- **Defines:** every field above as a common, provider-agnostic envelope, plus validation that the *envelope* is well-formed (not that the *content* is correct — that's RIE validation).
- **Leaves open:** `payload` and `providerFields` are opaque containers. The framework never defines their internal shape — that would be provider-specific logic, forbidden here.

### 6.3 Note

`capabilityProfileRef` ties each piece of evidence back to what the provider *claimed* it could supply, enabling later RIE cross-checks (did a provider return less than it declared?). The framework only records the reference; it draws no conclusion.

---

## 7. LIFECYCLE

Every provider follows the identical lifecycle. Phase 2.1 implements the lifecycle **orchestration** (the framework that drives these steps), with a mock connector proving it — no real provider.

```
   Initialize
       ↓
   Register            (publish identity, version, capability profile, trust → Registry)
       ↓
   Authenticate
       ↓
   Health Check
       ↓
   Capability Discovery
       ↓
   Acquire Evidence    (on an EvidenceRequest)
       ↓
   Return Evidence Contract
       ↓
   Shutdown
```

### 7.1 Framework responsibilities in the lifecycle

- The framework **orchestrates** the sequence and enforces ordering (e.g. cannot `acquire` before `authenticate` + `initialize`).
- Each transition emits/updates health where relevant (auth failure → `AUTH_FAILED`, etc.).
- The lifecycle is uniform across all providers by construction — a provider cannot define its own lifecycle, only implement each step's contract.

---

## 8. CERTIFICATION CRITERIA (PHASE 2.1 EXIT GATES)

Phase 2.1 is complete only when **all** gates pass:

- [ ] **Provider Connector interface complete** — abstract contract + conformance test suite defined.
- [ ] **Registry operational** — register, look up, hold all seven `RegistryEntry` fields; state-of-record verified.
- [ ] **Capability framework operational** — versioned vocabulary; profiles declared, loaded, queryable; new-capability expansion demonstrated without framework change.
- [ ] **Trust framework operational** — trust values live in config, exposed onto contract + registry, never interpreted by framework.
- [ ] **Health framework operational** — all nine states representable and reportable; **no** Monitoring integration present.
- [ ] **Evidence contract finalized** — common envelope complete; integrity fields (`payloadChecksum`, `rawResponseHash`) produced; payload treated as opaque.
- [ ] **Provider lifecycle complete** — full sequence orchestrated and ordering-enforced, proven via mock connector.
- [ ] **No provider-specific code** — grep-clean: no Apple/Spotify/MusicBrainz/MLC/any-provider logic; no RIE wiring; no product/Monitoring integration.
- [ ] **Conformance suite green** — the mock connector passes the full interface conformance suite.

---

## 9. DELIVERABLES

### 9.1 Files to be created (illustrative structure — subject to Code's final layout within these responsibilities)

All under a new `provider-acquisition/` tree, provider-agnostic:

| File | Responsibility |
|---|---|
| `provider-acquisition/connector/ProviderConnector.js` | Abstract Connector interface/contract (§1) |
| `provider-acquisition/connector/lifecycle.js` | Lifecycle orchestration + ordering enforcement (§7) |
| `provider-acquisition/registry/ProviderRegistry.js` | Registry: register, look up, state of record (§2) |
| `provider-acquisition/registry/RegistryEntry.js` | Registry entry shape (§2.1) |
| `provider-acquisition/capability/capabilityVocabulary.js` | Standardized, versioned capability enumeration (§3.2) |
| `provider-acquisition/capability/CapabilityProfile.js` | Profile declaration + loading (§3) |
| `provider-acquisition/health/healthStates.js` | The nine constitutional health states (§4.1) |
| `provider-acquisition/health/ProviderHealthSignal.js` | Health signal type + reporting (§4) |
| `provider-acquisition/trust/trustConfig.js` | Trust value config source + loader (§5) |
| `provider-acquisition/evidence/EvidenceContract.js` | Common evidence envelope (§6) |
| `provider-acquisition/evidence/integrity.js` | `payloadChecksum` + `rawResponseHash` helpers (§6.1) |
| `provider-acquisition/evidence/EvidenceRequest.js` | Request shape passed to `acquire()` (§1.1) |
| `provider-acquisition/__tests__/conformance.test.js` | Interface conformance suite (§1.3, §8) |
| `provider-acquisition/__tests__/mockConnector.js` | Test-only reference connector (§1.3) — never used in production paths |
| `provider-acquisition/README.md` | Framework overview + constitutional constraints |

### 9.2 Dependency relationships

```
capabilityVocabulary ─┐
                      ├─▶ CapabilityProfile ─┐
healthStates ─▶ ProviderHealthSignal ────────┤
trustConfig ──────────────────────────────────┤
integrity ─▶ EvidenceContract ◀── EvidenceRequest
                      │                        │
                      ▼                        ▼
              ProviderConnector (interface) ◀──┘
                      │
                      ├─▶ lifecycle (orchestrates the interface)
                      └─▶ ProviderRegistry ◀── RegistryEntry
                      │
              conformance.test ◀── mockConnector (exercises all of the above)
```

Foundational leaf modules (vocabulary, health states, integrity, trust config) have no internal dependencies and are built first.

### 9.3 Implementation order

1. **Leaf types** — `healthStates`, `capabilityVocabulary`, `integrity`, `trustConfig`, `EvidenceRequest`. (No dependencies; safe to build first.)
2. **Composite types** — `CapabilityProfile`, `ProviderHealthSignal`, `EvidenceContract`. (Depend only on leaves.)
3. **The interface** — `ProviderConnector` abstract contract. (Depends on the types it returns.)
4. **Orchestration & directory** — `lifecycle`, `RegistryEntry`, `ProviderRegistry`.
5. **Proof** — `mockConnector` + `conformance.test`; iterate until green.
6. **Docs** — `README.md` capturing the constitutional constraints.

One commit per numbered step (per your locked governance), each behind its own review.

### 9.4 Certification checkpoints (mapped to order)

- After step 2: types finalized → evidence contract review.
- After step 3: interface contract review (the constitutional core).
- After step 4: registry + lifecycle review.
- After step 5: **all §8 exit gates verified** → Phase 2.1 certification.

### 9.5 Risks

| Risk | Mitigation |
|---|---|
| **Framework creep** — a "helper" quietly interprets payload/trust/capability, breaching §1.0. | Conformance suite asserts the framework never reads inside `payload`; code review against the §1.0 litmus test; grep gate for provider names. |
| **Interface churn** — later real connectors reveal the interface is wrong, forcing rework. | Mock connector deliberately exercises hard cases (auth failure, partial, schema-changed, deprecated) before the interface is locked; interface is versioned (§1.1 `getVersion`). |
| **Naming conflict (§0.3)** unresolved → design carries both "Connector" and "Adapter". | Board ruling requested before implementation; one term applied everywhere once ruled. |
| **Evidence integrity dependency** — hashing needs a lib beyond Node `crypto`. | Prefer built-in `crypto`; if insufficient, flag to Board (§11) rather than adding a dependency silently. |
| **Registry becoming a decision-maker** — pressure to put selection logic in the registry. | Constitutional note §2.3; selection stays in the RIE (later phase); review gate. |

### 9.6 Rollback strategy

- Phase 2.1 is **purely additive** — a new `provider-acquisition/` tree, no changes to existing production paths, no RIE/product/Monitoring wiring. Nothing in production consumes it yet.
- Rollback = revert the additive commits / remove the new tree. Because nothing depends on it, rollback carries **zero production risk.**
- Delivered on a feature branch, **DO NOT MERGE** until Phase 2.1 certification + Board review, per the governance chain.

---

## 10. GOVERNANCE CHAIN (this phase's position)

```
Architecture  →  Implementation Plan  →  Implementation  →  Certification  →  Board Review  →  Merge  →  Lock
   (v3 ✓)            (this doc)            (not yet)          (§8 gates)        (Board)       (rebase)  (locked)
                         ▲ you are here
```

Standing engineering governance for the build (when authorized): per-action approval always · one commit per step · no `Co-Authored-By` trailer · PR body to temp file, Read-verified before push · `DO NOT MERGE` on preview · rebase-merge + branch delete on approval · complete drop-in files for new modules · escalate any constitutional conflict before proceeding.

---

## 11. DECISIONS REQUESTED FROM THE BOARD

1. **§0.3 — Naming.** Confirm **"Connector"** (this plan's assumption, from the phase title) or direct **"Adapter"** (parent §2.0's recommendation). One term, applied everywhere.
2. **§0.4 / §9.5 — Integrity hashing.** Approve using Node built-in `crypto` for `payloadChecksum`/`rawResponseHash`; if a specific algorithm is mandated, name it.
3. **§9.1 — File layout.** Approve the `provider-acquisition/` tree location and structure, or direct an alternative path.
4. **Roster (carried from parent §0.3).** Still-open provider roster ratification (Last.fm/AudioDB/SoundCloud vs Listen Notes) does not block Phase 2.1 (framework is provider-agnostic), but remains open for Phase 2.2+ when real connectors are built.

No implementation is authorized until this plan is approved and the above are ruled.
