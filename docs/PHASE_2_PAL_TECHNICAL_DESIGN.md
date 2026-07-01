# ROYALTĒ INTELLIGENCE ENGINE — PHASE 2 TECHNICAL DESIGN

## Provider Acquisition Layer (PAL)

**Authority:** Royaltē Master Constitution v1.3
**Status:** 🟡 REVISED DRAFT (v3) FOR BOARD FINAL APPROVAL — no implementation authorized
**Baseline:** Phase 1 (RIE core) merged and locked
**Audience:** Constitutional Board (review) → Claude Code (implementation, after approval)
**Revision:** Incorporates Board review refinements #1–#8 (post-9.8/10 assessment). Change log at §12.

> **This is an architecture exercise, not an implementation exercise.** No Phase 2 code is written until the Board reviews and approves this design. This document contains no application code — only architecture, contracts, and flow.

---

## GOVERNING PRINCIPLE

> ## The Provider Acquisition Layer never answers the question: **"What is true?"**
> ## It answers only: **"What did each provider say?"**

This single sentence defines the constitutional separation between the PAL and the Royaltē Intelligence Engine. Everything in this document is downstream of it. The PAL collects what providers *say*; the RIE alone decides what is *true*. If any proposed PAL behavior would require it to judge truth, importance, correctness, or meaning, that behavior belongs in the RIE, not the PAL.

---

## 0. SCOPE & OPEN RULINGS

### 0.1 What this document designs

The Provider Acquisition Layer (PAL) — **Layer 1** of the four constitutional layers (v1.3). PAL is the only component permitted to talk to external providers. It acquires raw evidence and hands it to the RIE. Nothing more.

### 0.2 Baseline assumption (confirm)

This design treats the **Phase 1 RIE core as fixed**. PAL is designed to deliver evidence *to* the RIE's existing collection entry point, not to redefine it. If Phase 1 exposed a different intake contract than §5 assumes, that contract wins and §5 is adjusted to match.

### 0.3 Provider roster discrepancy (Board ruling requested)

The Phase 2 brief and the v1.3 Constitution list different provider sets:

| Provider | v1.3 Constitution (PAL) | Phase 2 Brief |
|---|:---:|:---:|
| Apple Music | ✓ | ✓ |
| Spotify | ✓ | ✓ |
| MusicBrainz | ✓ | ✓ |
| MLC | ✓ | ✓ |
| Deezer | ✓ | ✓ |
| Discogs | ✓ | ✓ |
| YouTube | ✓ | ✓ |
| SoundExchange | ✓ | ✓ |
| Last.fm | ✓ | — |
| AudioDB | ✓ | — |
| SoundCloud | ✓ | — |
| Listen Notes | — | ✓ |

**This design does not resolve the discrepancy.** Instead it makes the roster a **configuration concern, not an architecture concern**: PAL is provider-agnostic, every provider is registered through one uniform adapter contract, and adding/removing a provider is a registry change, not a redesign. The canonical roster should be ratified separately by the Board and recorded in the Constitution. Until then, the architecture supports any of the above without change.

---

## 1. THE PROVIDER ACQUISITION LAYER

### 1.0 The PAL is constitutionally "dumb" — by design

This is the most important property of the PAL, and it is deliberate. The PAL is **constitutionally dumb.** Its lack of understanding is not a limitation to be engineered away later — it is the constitutional guarantee that makes "One Truth / One Engine" enforceable.

**The PAL does not understand evidence.**
**The PAL does not understand music.**
**The PAL does not understand publishing.**
**The PAL does not understand metadata.**
**The PAL does not understand Royaltē.**

Its sole responsibility is to communicate with external providers and package what they return.

| The PAL KNOWS | The PAL NEVER KNOWS |
|---|---|
| where to request | what the information means |
| how to authenticate | whether it is correct |
| how to retry | whether it is important |
| how to package | whether it should influence intelligence |
| how to report health | which provider is "right" |

Every item in the right-hand column is an act of *understanding* or *judgment*. All of them belong exclusively to the Royaltē Intelligence Engine. A PAL that started to understand any of these would, by that act, become a second source of truth — a constitutional violation (v1.3). The PAL stays dumb so the RIE can stay sovereign.

### 1.1 What the PAL is

The PAL is the platform's **single, governed gateway to the outside world.** It is the only place in Royaltē permitted to open a network connection to a music-data provider. Every byte of external evidence enters the platform through it.

The PAL is a **collection layer**, not an intelligence layer. It answers exactly one question: *"What did each provider say?"* It never answers *"What is true?"* — that question belongs to the RIE.

### 1.2 Why it exists

- **Constitutional isolation.** v1.3 requires that no product communicate with a provider directly. A single acquisition layer makes that rule enforceable by architecture rather than by discipline: if provider access physically lives in one place, a product *cannot* bypass it without an obvious, reviewable violation.
- **Provider independence.** Providers change APIs, rate limits, auth, and schemas constantly. Concentrating that volatility in one layer means the rest of the platform never feels it. The RIE and every product see a stable internal shape regardless of provider churn.
- **One source of evidence, one source of truth.** PAL produces evidence; RIE produces truth. Keeping these physically separate is what makes "One Truth / One Engine" real rather than aspirational.
- **Testability & observability.** One layer to mock in tests, one layer to monitor in production, one layer to rate-limit and cache.

### 1.3 Responsibilities (what PAL DOES)

1. **Acquire** — issue authenticated requests to providers.
2. **Manage the connection lifecycle** — auth, retries, timeouts, rate limits, backoff.
3. **Wrap** — package each raw provider response as an **Evidence Record** (§3) with provenance metadata (source, timestamp, request context, raw payload).
4. **Report health** — emit a per-provider health signal (§4) for every acquisition attempt.
5. **Deliver** — hand the collected Evidence Record(s) to the RIE intake boundary (§5).

### 1.4 Boundaries (where PAL stops)

PAL's responsibility **ends the moment evidence has been successfully collected and packaged.** It does not look inside the evidence for meaning. It hands a sealed envelope to the RIE and stops.

### 1.5 What PAL must NEVER do

PAL must never:

- **validate** evidence for correctness or plausibility (well-formedness of the *envelope* is allowed; judging the *content* is not)
- **normalize** provider shapes into canonical shapes
- **reconcile** conflicting evidence between providers
- **enrich** evidence with derived data
- **score** anything
- **compute intelligence** of any kind
- **interpret** what a provider response *means*
- **decide truth** — pick a "winner" when providers disagree
- **contain business logic** — any Royaltē concept, rule, or heuristic

If a proposed PAL change requires knowing what a field *means* (not just that it exists), it belongs in the RIE, not PAL. **That is the litmus test.**

---

## 2. PROVIDER ADAPTER ARCHITECTURE

### 2.0 Naming: "Adapter" retained, with rationale (Board review #7)

The Board asked whether "Provider **Adapter**" or "Provider **Connector**" better represents the constitutional architecture. **Recommendation: retain "Adapter."** Rationale:

- **"Adapter" is a precise, established engineering term.** The Adapter pattern's definition is *"convert the interface of one system into an interface a client expects."* That is exactly and only what these components do: convert a provider's idiosyncratic external interface into the one uniform internal contract the PAL expects. The name already encodes the constitutional job.
- **"Adapter" implies translation without state or ownership.** An adapter is a thin, stateless translator — it does not own a persistent relationship with the provider. That matches the constitutionally-dumb model (§1.0): fetch, translate the shape, return, forget.
- **"Connector" implies more than we want.** In common platform usage "connector" suggests a persistent integration that manages an ongoing relationship, syncs state, or holds configuration and logic (cf. "Salesforce connector," "OAuth connector"). That connotation risks inviting exactly the stateful, logic-bearing behavior the PAL must never have. The weaker word could quietly license constitutional drift.
- **Cost of change is real, benefit is nil.** "Adapter" is already threaded through this design and the mental model. Renaming churns every reference for no architectural gain.

If the Board sees a governance reason to prefer "Connector" (e.g. to reserve "Adapter" for a different future concept), it is a global find-replace with no structural impact — but absent such a reason, "Adapter" is the stronger long-term term. **Retained pending Board override.**

### 2.1 Principle: every provider is equal

Every provider — Apple, Spotify, MusicBrainz, MLC, Deezer, Discogs, YouTube, SoundExchange, and any future source — implements **the identical adapter contract.** No provider is privileged at this layer. Apple's role as identity anchor is a **reconciliation rule inside the RIE**, not an adapter privilege (v1.3). An adapter's job is uniform regardless of source: authenticate, fetch, return raw evidence.

### 2.2 The standard Provider Adapter contract

Conceptual interface (not code — shape only):

```
ProviderAdapter
  identity:
    name                     // "apple_music", "spotify", ...
    version                  // adapter contract version (§2.9)
    capabilities             // standardized Capability Profile (§2.12)

  authenticate()             // acquire/refresh credentials → auth context
  fetch(EvidenceRequest)     // → RawProviderResponse (untouched)
  healthCheck()              // → ProviderHealthSignal (§4), no side effects

  // configuration surfaced to the PAL runtime, not hardcoded in logic:
  retryPolicy                // §2.4
  rateLimitPolicy            // §2.5
  timeoutPolicy              // §2.6
  providerTrust              // §2.11 — governance config value, exposed not interpreted
```

The adapter returns **raw** provider data. It does not shape it toward canonical form. A downstream reader of an adapter's output should be unable to tell whether Royaltē has any canonical model at all — the output is pure provider evidence plus provenance.

### 2.3 Request

- Every acquisition is driven by an **EvidenceRequest**: *what subject, what evidence type, what context.* The subject reference is provider-neutral (e.g. a resolved artist reference from Phase 1 identity resolution); the adapter is responsible for translating it into the provider's own query form.
- Adapters **never originate** requests on their own. PAL orchestrates; adapters execute.

### 2.4 Retries

- **Idempotent reads only** are retried (all provider fetches here are reads).
- **Exponential backoff with jitter.** Bounded retry count per provider via `retryPolicy`.
- Retry only on **transient** classes: network error, 5xx, timeout, explicit rate-limit responses (after honoring `Retry-After`).
- **Never retry** on auth failure, 4xx client errors (except 429), or schema-shape errors — these are surfaced as health signals, not retried into a wall.

### 2.5 Rate limits

- Each adapter declares a `rateLimitPolicy`; PAL enforces it centrally (token-bucket or equivalent) so the platform respects each provider's ceiling regardless of how many products triggered demand.
- Rate-limit enforcement is **global per provider**, not per-request — because all demand funnels through PAL, this is enforceable in one place.
- On provider-signaled throttling (429 / `Retry-After`), PAL backs off and emits a `RATE_LIMITED` health signal.

### 2.6 Timeout strategy

- Per-provider `timeoutPolicy` with a sane platform default.
- **Two-level timeout:** per-request timeout and an overall acquisition-attempt budget. Exceeding either yields a `TIMEOUT` health signal and a partial/empty Evidence Record, never a hang.
- Timeouts are **fail-fast**: the OS prefers a clean partial result over a blocked pipeline (§6).

### 2.7 Response format

- Adapter output is always a **RawProviderResponse** wrapped into an **Evidence Record** (§3): the untouched payload + provenance, never a canonicalized shape.
- Provider-specific fields are **preserved verbatim** inside the evidence envelope (§3.5) so nothing is lost, but they are quarantined from the Canonical Intelligence Model.

### 2.8 Health monitoring

- Every `fetch` and `healthCheck` emits a **ProviderHealthSignal** (§4).
- Health is a **first-class output of PAL**, not a side effect — it flows to Monitoring Intelligence (§4.3).

### 2.9 Versioning

- **Adapter contract version:** the interface PAL depends on. Changing it is a coordinated PAL+adapter change.
- **Provider API version:** what the adapter targets externally. Isolated inside the adapter so a provider's API bump never ripples past PAL.
- **Evidence Record schema version:** stamped on every record (§3) so the RIE can evolve intake without breaking historical evidence.
- Rule: a provider changing its API is an **adapter-internal** change. If it forces a change past the adapter boundary, that is a design smell to escalate.

### 2.10 Failure handling (adapter level)

- Adapters **never throw raw provider errors upward.** Every failure is classified into a health state (§4) and returned as a structured outcome.
- An adapter failure produces an Evidence Record marked `unavailable`/`partial` with the failure reason — the pipeline continues (§6).

### 2.11 Provider Trust (Board review #3) — governance, not intelligence

Every provider exposes a configurable **Provider Trust** value (e.g. Apple Music 100, MLC 100, Spotify 96, MusicBrainz 90). This is a critical distinction the design draws explicitly:

- **Provider Trust is provider *governance*, not *intelligence*.** It is a static, human-set configuration value describing how much institutional trust Royaltē places in a source — a policy statement, not a computed score. It is set by governance, versioned in config, and changed by deliberate decision, never by an algorithm.
- **The PAL only *exposes* it. The PAL never *uses* it.** Provider Trust rides along on the Evidence Record as a declared provenance attribute. The PAL attaches the configured value and does nothing else with it — consistent with §1.0, the PAL does not know what "trust" *means* or whether it *matters*.
- **The RIE decides whether it has any influence.** Provider Trust becomes *one of many possible inputs* the RIE **may** consider during reconciliation (e.g. as a tie-breaker when providers disagree). Whether it influences a given reconciliation, and how much, is entirely the RIE's judgment. The RIE may weight it, combine it with freshness and completeness, or ignore it.

This keeps the constitutional line intact: a governance value that *informs* truth-finding is fine, so long as the *finding* happens only in the RIE. The PAL carries the value; it never acts on it.

> **Why this is not a back-door into PAL intelligence:** exposing a number is not interpreting it. The PAL treats Provider Trust exactly as it treats a provider's name — an attribute of provenance to be recorded and passed along. The moment anything *reasons* with the number, that reasoning is happening in the RIE, on the far side of the boundary (§5).

### 2.12 Provider Capability Profiles (Board review #8) — self-description, not intelligence

Every provider exposes a standardized **Capability Profile** through the adapter contract: a declaration of *what the provider is capable of supplying* — its functional coverage — **not the data itself**. This is metadata *about* the provider, on the same constitutional footing as Provider Trust (§2.11): the PAL exposes it; the PAL never judges it; the RIE decides what to do with it.

**What a Capability Profile is.** A structured, self-describing declaration of which evidence types an adapter can fetch, drawn from a standardized capability vocabulary. It answers *"what could this provider tell us?"* — never *"what did it say?"* (§3) and never *"which provider is better?"* (that is RIE reconciliation, §5).

**Standardized capability vocabulary.** Capabilities are declared from one shared, versioned enumeration so every provider is described in the same terms. The initial vocabulary:

```
Artist Identity · Releases · Tracks · Albums · ISRC · ISWC · UPC ·
Publishing · Songwriters · Contributors · Territories · Availability ·
Genres · Labels · Audio Features · Artwork · Social Links · Rights Data ·
Performance Data · Collection Data · Podcasts · Videos
```

The vocabulary is **governed and extensible**: new capabilities are added to the shared enumeration (a governance change), never invented ad-hoc inside an adapter. This keeps "self-describing" from becoming "every provider describes itself in its own private language."

**Declaration shape (conceptual — not code):**

```
CapabilityProfile
  vocabularyVersion         // which capability enumeration this profile speaks (§2.9-style versioning)
  capabilities[]            // subset of the standardized vocabulary this provider supports
```

**Illustrative declarations** (subject to the ratified roster, §0.3):

| Provider | Declares (illustrative) |
|---|---|
| Apple Music | Artist Identity · Releases · Albums · Tracks · Availability · Artwork |
| Spotify | Artist Identity · Releases · Albums · Audio Features |
| MLC | Publishing · Songwriters · Collection Data |

**The PAL exposes; it does not rank.** The PAL surfaces each provider's declared capabilities and stops. It does **not** decide that one provider's coverage is better, more complete, or more authoritative than another's — that is a judgment, and judgment lives in the RIE (§1.0). Two providers both declaring `Artist Identity` are equal at this layer; which one anchors identity is an RIE reconciliation rule, not a PAL capability comparison.

**What the RIE does with capabilities.** The Royaltē Intelligence Engine consumes capability declarations to decide **which providers participate** in a given evidence-acquisition, reconciliation, or future intelligence workflow. For example: a publishing-focused workflow can ask the RIE to fan out only to providers declaring `Publishing` / `Songwriters` / `Collection Data`, rather than querying every provider blindly. The *decision* to route by capability is the RIE's; the PAL only supplies the honest declaration and executes the resulting acquisition requests.

**Why this matters architecturally.** Capability Profiles create a **self-describing provider ecosystem**:

- **Minimal-change extensibility** — adding a new provider means writing an adapter and declaring its Capability Profile against the shared vocabulary. No orchestration code changes; the RIE can immediately reason about the new provider's coverage.
- **Future dynamic provider orchestration** — the RIE can select provider sets per workflow at runtime based on declared capabilities, rather than relying on hardcoded provider lists. Capability-driven routing is the foundation for this, and building the Profile now makes it possible later without re-architecting.
- **Governed consistency** — because capabilities come from one versioned vocabulary, "what providers can do" is described uniformly across the whole ecosystem.

**Constitutional placement.** Like Provider Trust, a Capability Profile is *provider governance metadata* the PAL carries but never acts on. Declaring a capability is not exercising it; exposing a declaration is not interpreting it. The PAL stays constitutionally dumb (§1.0); the RIE stays sovereign over which capabilities matter, when, and how.

---

## 3. THE EVIDENCE MODEL

### 3.1 What constitutes evidence

**Evidence is what a provider said, at a point in time, in response to a specific request — before Royaltē has decided what any of it means.** It is raw, attributed, and timestamped. It is explicitly *not* intelligence.

### 3.2 The Evidence Record

```
EvidenceRecord
  // ── Identity & traceability (Board review #6) ──
  evidenceId               // unique record identity
  acquisitionId            // this specific acquisition attempt
  correlationId            // ties all evidence from one scan/request together
  requestId               // the individual provider request that produced this
  schemaVersion            // Evidence Record schema version (§2.9)

  // ── Provenance ──
  provider                 // source identity
  providerVersion          // provider's external API version targeted (§2.9)
  adapterVersion           // adapter contract version that produced this (§2.9)
  providerTrust            // governance value, exposed not interpreted (§2.11)
  request                  // the EvidenceRequest that produced it (context)

  // ── Timing (§3.3) ──
  acquiredAt               // when PAL received the response (UTC, authoritative)
  providerReportedAt       // provider's own timestamp, if any

  // ── Health & completeness ──
  health                   // ProviderHealthSignal for this acquisition (§4)
  completeness             // full | partial | empty (not a judgment of truth)

  // ── Payload & integrity (Board review #6) ──
  payload                  // RAW provider response, untouched
  providerFields           // provider-specific fields, preserved (§3.5)
  payloadChecksum          // checksum of the stored payload (tamper/corruption detection)
  rawResponseHash          // hash of the exact bytes as received from the provider
```

**Traceability as a defining strength (Board review #6).** The RIE is an intelligence platform; evidence traceability is one of its defining strengths, not an afterthought. Every acquisition is now fully traceable end-to-end:

- **`correlationId`** stitches every provider's evidence from a single scan into one traceable set — answering *"what did the whole system see for this artist, this run?"*
- **`acquisitionId` / `requestId`** pinpoint an individual attempt and request for debugging and provider regression analysis.
- **`providerVersion` / `adapterVersion`** make every record self-describing about *how* it was obtained, so a provider API change or adapter change is attributable after the fact.
- **`payloadChecksum` / `rawResponseHash`** guarantee integrity: the checksum detects storage corruption/tampering; the raw-response hash lets the OS prove two acquisitions returned byte-identical provider output (the foundation of provider regression detection and scan replay — §5A Evidence Store).

None of these fields require the PAL to understand the payload — they are computed over bytes and attached as provenance. The constitutionally-dumb model (§1.0) holds.

### 3.3 Timestamps

- **`acquiredAt`** — when PAL received the response (UTC, authoritative for freshness).
- **`providerReportedAt`** — the provider's own "last updated" if supplied, preserved but never trusted as canonical.
- Timestamps enable the RIE to reason about **freshness and staleness during reconciliation** — but PAL only records them, it never acts on them.

### 3.4 Confidence

- **PAL does not assign confidence.** Confidence is an intelligence judgment and belongs to the RIE.
- PAL records only **objective acquisition facts** that the RIE may later use to *derive* confidence: completeness, health state, freshness, provider identity. The distinction is deliberate — PAL supplies inputs to confidence; it never outputs confidence.

### 3.5 Provider-specific fields without polluting the canonical model

- Provider-specific fields are preserved **verbatim inside `providerFields`**, namespaced by provider. They never leak upward as canonical.
- The Canonical Intelligence Model (§8 RIM) is populated **only by the RIE**, only from normalized/reconciled evidence. Because raw provider fields live in the evidence envelope — not the canonical model — nothing a provider invents can contaminate canonical truth. The envelope is the quarantine boundary.

---

## 4. PROVIDER HEALTH

### 4.1 Health states

Every acquisition attempt resolves to exactly one state:

| State | Meaning |
|---|---|
| `AVAILABLE` | healthy, full response |
| `PARTIAL_RESPONSE` | responded, but incomplete data |
| `UNAVAILABLE` | no response / connection failure |
| `RATE_LIMITED` | provider throttled us |
| `AUTH_FAILED` | credentials rejected / expired |
| `TIMEOUT` | exceeded request or attempt budget |
| `MAINTENANCE` | provider signalled planned downtime |
| `SCHEMA_CHANGED` | response shape no longer matches adapter expectation |
| `DEPRECATED` | provider/endpoint still functions today but is officially scheduled for retirement or replacement |

**On `DEPRECATED` (Board review #2).** This state is distinct from `UNAVAILABLE`, `MAINTENANCE`, `TIMEOUT`, and `SCHEMA_CHANGED`: the endpoint is *working right now*, but the provider has announced it will be retired or replaced. It is a **forward-looking warning**, not a current failure. It lets the Operating System warn the platform *before* an endpoint disappears — surfacing a planned migration need through Monitoring Intelligence while evidence still flows normally. An acquisition can be simultaneously successful and `DEPRECATED`; in that case the record carries full data *and* the deprecation warning. `DEPRECATED` is typically set from adapter configuration (a known sunset date the provider published), not inferred from the response — again consistent with the constitutionally-dumb model (§1.0).

### 4.2 How health is determined

- Health is classified by the **adapter** (it knows the provider's conventions) and recorded by **PAL** (it owns the record). Classification uses only *shape and transport* facts — status codes, response structure, transport outcome — never *meaning* of the content.
- `SCHEMA_CHANGED` is the one that most often signals real trouble: it means the provider altered their API and the adapter needs attention. It is detected structurally (expected envelope fields absent), **not** by interpreting values.

### 4.3 Flow into Monitoring Intelligence

- Every ProviderHealthSignal is emitted as an **evidence-adjacent telemetry stream** to the RIE, which certifies it into the `monitoring` view of the Canonical Intelligence Model.
- **Monitoring Intelligence is a product (Layer 3): it presents provider health; it does not compute it and does not poll providers itself.** PAL is the sole origin of provider-health facts. This keeps even health telemetry constitutionally clean — one origin, certified once, consumed everywhere.
- This gives the OS a live picture: which providers are healthy, degraded, or down, and how that affects the confidence and completeness of downstream intelligence.

---

## 5. RECONCILIATION ENTRY POINT (THE PAL↔RIE BOUNDARY)

### 5.1 The boundary, stated precisely

```
   ┌─────────────── PAL (Layer 1) ───────────────┐
   │  acquire → manage lifecycle → wrap as         │
   │  Evidence Record → report health              │
   │                                               │
   │  RESPONSIBILITY ENDS HERE ────────────────────┼──▶  handoff
   └───────────────────────────────────────────────┘        │
                                                             ▼
   ┌─────────────── RIE (Layer 2) ───────────────┐
   │  INTAKE: receive Evidence Record(s)           │
   │  → validate → normalize → reconcile →         │
   │  enrich → compute → certify                   │
   └───────────────────────────────────────────────┘
```

### 5.2 What crosses the boundary

- **Only Evidence Records cross.** A batch of raw, attributed, timestamped, health-stamped evidence envelopes. Nothing canonical, nothing scored, nothing reconciled.

### 5.3 Boundary guarantees

- Nothing inside PAL performs **reconciliation.**
- Nothing inside PAL determines **truth.**
- Nothing inside PAL decides a **"winner"** when providers disagree — it hands *all* evidence over, disagreements intact, for the RIE to reconcile.
- PAL's job is **done** when evidence is collected and delivered. The very next step — validation — is the RIE's, on the far side of the boundary.

### 5.4 Why the boundary is drawn here

Placing the boundary at "evidence collected, not yet judged" is what makes the constitution enforceable: everything upstream is provider-shaped fact; everything downstream is Royaltē-defined truth. There is exactly one crossing point, and it is inspectable.

---

## 5A. THE EVIDENCE STORE (LONG-TERM ARCHITECTURE — NOT PHASE 2)

**The Board is not requesting implementation during Phase 2.** This section acknowledges the Evidence Store as a ratified part of the long-term Operating System roadmap, so Phase 2's design is forward-compatible with it. No Evidence Store code is written in Phase 2.

### 5A.1 Position in the architecture

The Evidence Store sits **between the PAL and the RIE**, as a durable record of everything the PAL acquired:

```
   Providers → Provider Acquisition Layer → Evidence Store → Royaltē Intelligence Engine
                                                              → Canonical Intelligence Model → Products
```

The Evidence Store persists Evidence Records (§3.2) exactly as the PAL produced them — raw, attributed, hashed, untouched. It is a **write-once evidence ledger**, not an intelligence store. It holds what providers *said*, never what Royaltē concluded.

### 5A.2 Purpose

- **Historical evidence retention** — a durable archive of raw provider responses over time.
- **Scan replay** — re-run the RIE against stored evidence without re-querying providers.
- **Provider regression detection** — compare today's evidence to yesterday's (via `rawResponseHash`, §3.2) to detect when a provider silently changed its output.
- **Debugging** — reproduce any past scan exactly.
- **Audit trail** — prove what evidence a given certified intelligence was derived from.
- **Historical comparison** — track how a provider's evidence for an artist evolved.
- **Future rescoring without re-querying providers** — when the RIE's intelligence logic improves, re-certify historical evidence into an updated Canonical Intelligence Model without touching a single provider. This is the strategic payoff: **intelligence improves retroactively; evidence never has to be re-fetched.**

### 5A.3 Why Phase 2 must be built with it in mind

Phase 2 does not build the Evidence Store, but Phase 2's Evidence Record is designed to make it possible later: the traceability and integrity fields added in §3.2 (`correlationId`, `acquisitionId`, `rawResponseHash`, `payloadChecksum`, `providerVersion`, `adapterVersion`) are precisely what scan replay, regression detection, and audit trail will require. Building the Evidence Record correctly now means the Evidence Store can be introduced later **without re-acquiring or re-shaping historical evidence.** This is the design being forward-compatible by intent, not by accident.

### 5A.4 Constitutional note

The Evidence Store stores **evidence**, never **intelligence**. It never becomes a second Canonical Intelligence Model. Products never read the Evidence Store — they read only the certified Canonical Intelligence Model (§8 RIM). The Evidence Store serves the RIE and the platform's operators, not the products. This keeps "One Truth" intact: there is still exactly one certified truth, and the Evidence Store is a record of the *inputs* to it, not a competing output.

---

## 6. FAILURE STRATEGY

**Governing principle: the OS degrades, it does not collapse.** Evidence is additive; missing evidence lowers completeness and (downstream) confidence, but never halts the pipeline. Reconciliation of *truth* from *partial evidence* is the RIE's job — PAL's job is to report exactly what it got and what it didn't.

| Scenario | PAL behavior | Constitutional note |
|---|---|---|
| **Apple fails** | Emit health state (`UNAVAILABLE`/`AUTH_FAILED`/etc.), deliver whatever other evidence exists. Apple is the *identity anchor via RIE reconciliation rule* — so the **RIE** decides how to proceed without Apple evidence, not PAL. | PAL never special-cases Apple. |
| **Spotify fails** | Same uniform handling — health-stamped, pipeline continues. | Equal treatment. |
| **MLC fails** | Same. Publishing/rights evidence marked absent for this run. | RIE decides downstream impact. |
| **MusicBrainz fails** | Same. | Equal treatment. |
| **Providers disagree** | PAL delivers **all** conflicting evidence, untouched. | Reconciliation is RIE-only (§5). PAL never picks a winner. |
| **Partial data** | Record marked `completeness: partial`; delivered as-is. | Not a truth judgment. |
| **Provider changes API** | Adapter emits `SCHEMA_CHANGED`; that provider's evidence is `unavailable` for the run; other providers unaffected. | Change is quarantined inside the adapter. |
| **No provider responds** | Every record `unavailable`; RIE receives an all-empty evidence set and decides the outcome (e.g. cannot certify, serve last-certified model, or fail gracefully). | Even total acquisition failure is a *reported state*, not a crash. |

### 6.1 Resilience mechanisms (PAL-side)

- **Isolation:** one provider's failure never blocks another's acquisition (independent fan-out, per §8 RIM architecture).
- **Fail-fast timeouts** (§2.6) prevent one slow provider from stalling the batch.
- **Circuit-breaking:** repeated failures for a provider trip a breaker that fast-fails further attempts (emitting health) until a probe succeeds — protecting both Royaltē and the provider.
- **No cascading failure:** because acquisition is fanned out and health-stamped, the RIE always receives a *complete accounting* of what succeeded and what didn't.

---

## 7. CERTIFICATION PIPELINE (COMPLETE JOURNEY)

```
                        Provider
                           │  (external evidence source)
                           ▼
                    Provider Adapter          ── Layer 1 (PAL)
                           │  authenticate · fetch · classify health
                           ▼
              Provider Acquisition Layer       ── Layer 1 (PAL)
                           │  wrap as Evidence Record · report health
   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┼┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  ◀── Evidence Store (§5A, future) sits here
   ════════════════════════╪════════════════════  ◀── the one boundary (§5)
                           ▼
            Royaltē Intelligence Engine         ── Layer 2 (RIE)
                           │
                     ┌─────┴─────┐
                     ▼           (RIE-internal stages)
                 Validation
                     ▼
               Normalization
                     ▼
              Reconciliation
                     ▼
                Enrichment
                     ▼
          Intelligence Computation
                     ▼
               Certification
                     ▼
        Canonical Intelligence Model            ── Layer 3 (the single artifact, §8 RIM)
                     │
   ┌─────────────────┼───────────────────────────────────┐
   ▼        ▼        ▼         ▼         ▼        ▼        ▼   ── Layer 4 (products, present-only)
 Mission  Exec.    Audit   Publishing  Identity  Health  Monitoring  AI Insights  Future
 Control  Brief            Intelligence Intel.    Intel.  Intelligence            Products
```

**Phase 2 owns only the top band** — Provider → Adapter → PAL → the boundary. Everything below the boundary is Phase 1 (RIE) and later phases. This document defines PAL precisely so the handoff into the existing RIE intake is clean.

---

## 8. CONSTITUTIONAL COMPLIANCE

| Principle | How PAL satisfies it |
|---|---|
| **One Truth** | PAL produces *evidence*, never truth. Truth is certified once, by the RIE, into one Canonical Intelligence Model. PAL cannot create a competing truth because it is structurally forbidden from judging content. |
| **One Engine** | Only the RIE turns evidence into intelligence. PAL feeds it; PAL never computes. |
| **One Platform** | Every provider enters through one gateway with one contract. No product has its own provider path. |
| **No Product Owns Intelligence** | PAL is not a product and owns no intelligence either — it owns *acquisition*. Products sit two layers downstream of PAL and never see a provider. |
| **Canonical Intelligence Model** | PAL never writes the canonical model. It hands raw evidence to the RIE, which is the sole author of the model. Provider-specific fields are quarantined in the evidence envelope (§3.5). |
| **Provider Independence** | Providers are equal, swappable, config-registered adapters. Provider volatility is contained in Layer 1 and never felt upstream. |
| **Constitutional Engineering Rules** | Single responsibility (acquire only), no duplicate logic (one gateway), build-once/reuse-everywhere (one adapter contract), one direction of flow (evidence in, never truth out). |
| **Provider Trust stays governance, not intelligence** | PAL exposes the configured trust value as provenance; only the RIE may reason with it during reconciliation (§2.11). Exposing a value is not interpreting it. |
| **Evidence Store stays evidence, not truth** | The future Evidence Store (§5A) records inputs to intelligence, never a second Canonical Intelligence Model; products never read it. One certified truth remains. |
| **Capability Profiles stay self-description, not intelligence** | PAL exposes each provider's declared coverage (§2.12) from a shared governed vocabulary; the RIE alone decides which providers participate. Declaring a capability is not ranking it. |

**Enforceability:** because provider access physically exists only in PAL, a violation (a product calling a provider, or PAL scoring evidence) is not a subtle drift — it is a structurally obvious, reviewable breach. The architecture makes the constitution self-policing.

---

## 9. MIGRATION STRATEGY

*(Design only — no code, no implementation. This describes how today's provider integrations move into PAL.)*

### 9.1 Migration order

Ordered by **evidence criticality and reconciliation dependency**, not by ease:

1. **Apple Music** — the identity anchor. Migrating it first lets every subsequent provider's evidence be requested against a resolved, PAL-acquired identity, and validates the boundary on the most important path.
2. **Spotify** — highest-volume enrichment; migrating second exercises multi-provider fan-out and the "providers disagree" path early.
3. **MusicBrainz, Discogs, Deezer** — catalog/metadata breadth; validates provider-agnostic uniformity across dissimilar APIs.
4. **MLC, SoundExchange** — publishing/rights/collection evidence; more sensitive, migrated once the boundary is proven.
5. **YouTube, and remaining roster** (Last.fm / AudioDB / SoundCloud / Listen Notes — *pending §0.3 ruling*) — long-tail evidence sources.

### 9.2 Dependencies

- Phase 1 RIE intake boundary must be confirmed stable (§0.2) before any adapter is repointed.
- Phase 1 identity resolution must be available before non-anchor providers migrate (they request evidence against a resolved identity).
- Provider roster must be ratified (§0.3) before the long-tail providers are scheduled.

### 9.3 Risks

- **Hidden product-side provider logic.** Existing consumers (e.g. `generate_audit_pdf.py` and its Pydantic `Subject` model; Mission Control scan-payload reads; Identity Intelligence Apple/Spotify paths) may contain interpretation that currently lives outside a clean boundary. Risk: migrating acquisition without catching that logic leaves a hidden second source of truth.
- **Behavioral drift.** A provider fetched through PAL must yield the same evidence as the legacy path; subtle differences (default params, field selection) could change downstream intelligence.
- **Rate-limit consolidation.** Centralizing rate limits in PAL may surface aggregate demand that individual legacy paths hid.

### 9.4 Rollback strategy

- **Strangler pattern (v1.3-ratified):** each provider is migrated behind the existing legacy path, not by deleting it. PAL acquisition runs in parallel and is compared against legacy output until proven equivalent.
- **Per-provider toggle:** a provider can be reverted to its legacy path independently if PAL output diverges, without affecting already-migrated providers.
- Legacy paths are **strangled, then retired** (later phases) — never deleted mid-migration. Production stays green throughout.

### 9.5 Certification gates (per provider)

A provider is considered migrated only when:

1. Its adapter conforms to the standard contract (§2).
2. PAL-acquired evidence is **equivalence-verified** against the legacy path (same evidence, same completeness).
3. Health signals emit correctly across all states (§4).
4. Failure behavior matches §6 (isolation, fail-fast, no cascade).
5. No product retains a direct path to that provider.

### 9.6 Completion criteria (Phase 2 done)

- Every ratified provider is reachable **only** through a PAL adapter.
- No product, and no scan/legacy module, imports a provider SDK or hits a provider endpoint directly.
- Every acquisition emits a health signal into Monitoring.
- The PAL↔RIE boundary (§5) is the single crossing point from evidence to intelligence.
- Legacy provider paths are dormant and unreferenced (removal happens in the later Phase 5/6 per the OS migration).

---

## 10. DELIVERABLES CHECKLIST (what this document provides)

| Board-requested deliverable | Section |
|---|---|
| Architecture diagrams | §2.2, §7 |
| Layer diagrams | §5.1, §5A.1, §7 |
| Component responsibilities | §1.0, §1.3–1.5, §2 |
| Provider lifecycle | §2.3–2.12 |
| Provider self-description | §2.12 (Capability Profiles) |
| Data flow | §3, §7 |
| Evidence flow | §3, §5, §5A, §7 |
| Failure handling | §4, §6 |
| Certification flow | §7 |
| Migration roadmap | §9 |

---

## 11. DECISIONS REQUESTED FROM THE BOARD

Before Phase 2 implementation is authorized, the Board is asked to rule on:

1. **§0.3 — Canonical provider roster.** Reconcile the Constitution list vs. the Phase 2 brief list (Listen Notes in/out; Last.fm, AudioDB, SoundCloud in/out). Design is provider-agnostic and unaffected either way, but the roster should be ratified and recorded.
2. **§0.2 — Phase 1 intake contract.** Confirm the RIE's Phase 1 collection entry point so §5's boundary is drawn against the real contract.
3. **§9.1 — Migration order.** Approve or reorder.
4. **§4.3 — Monitoring origin.** Confirm PAL as the sole origin of provider-health facts, with Monitoring Intelligence as present-only.
5. **§2.0 — Naming.** Confirm "Adapter" is retained (recommended), or direct a change to "Connector."
6. **§2.11 — Provider Trust ownership.** Confirm Provider Trust is set by governance/config and that the RIE (not PAL) decides its reconciliation influence.
7. **§5A — Evidence Store.** Confirm the Evidence Store is acknowledged as long-term roadmap (not Phase 2), and that Phase 2's Evidence Record is to be built forward-compatible with it.
8. **§2.12 — Capability vocabulary.** Ratify the standardized capability enumeration (and its governance process for additions), so provider Capability Profiles are declared against an approved shared vocabulary.

Nothing in this document is implemented until these are ruled and the design is approved.

---

## 12. CHANGE LOG — v3 (post-9.8/10 Board review)

| # | Board refinement | Where incorporated |
|---|---|---|
| 1 | PAL described as constitutionally "dumb"; boundary made impossible to misunderstand | New §1.0 (knows/never-knows table); strengthened language throughout |
| 2 | New `DEPRECATED` health state | §4.1 (added state + distinguishing note) |
| 3 | Provider Trust — governance, not intelligence | New §2.11; added to adapter contract (§2.2) and Evidence Record (§3.2) |
| 4 | Elevate "what did each provider say?" to a governing principle | New **Governing Principle** callout at top of document |
| 5 | Acknowledge the Evidence Store in long-term architecture | New §5A; added to §7 pipeline diagram; rationale for forward-compatible Evidence Record |
| 6 | Expand the Evidence Record for full traceability | §3.2 (added acquisitionId, correlationId, requestId, providerVersion, adapterVersion, payloadChecksum, rawResponseHash + traceability rationale) |
| 7 | Review "Adapter" vs. "Connector" | New §2.0 — "Adapter" retained with documented rationale; Board override path noted |
| 8 | Introduce Provider Capability Profiles | New §2.12 — standardized, governed, self-describing capability declarations; PAL exposes, RIE orchestrates; added to adapter contract (§2.2), compliance table (§8), decisions (§11) |

No implementation was performed. This remains an architecture document pending Board final approval.
