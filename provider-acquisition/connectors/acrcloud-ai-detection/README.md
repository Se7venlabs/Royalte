# ACRCloud AI Detection Connector™ v1

Phase 5.0 Board Authorization. Constitutional implementation of `ProviderConnector`
for ACRCloud's AI Music Detection product (File Scanning, engine 5).
https://docs.acrcloud.com/faq/ai-music-detection

## Purpose

This connector answers exactly one question: **"Was this recording likely
AI-generated?"**

It is completely separate from the [ACRCloud Audio Recognition
Connector™](../acrcloud/) (`acrcloud`), which answers "what recording is
this?" via a different ACRCloud product entirely (the Identify API). The two
connectors share a provider name prefix and nothing else — different auth
model, different processing model, different capability, different
provider trust context. PAL acquires evidence from each independently;
combining recognition and AI-detection evidence into a single judgment is
ATHENA's job, not either connector's.

## Constitutional Responsibilities

> This connector NEVER normalizes, reconciles, scores, interprets, or
> computes. It acquires raw evidence and packages it in the constitutional
> Evidence Contract.

Concretely: this connector never converts ACRCloud's `ai_probability` into a
Royaltē verdict, never picks a "winning" `likely_source`, never collapses
the `segments`/`source_probabilities` arrays, and never generates a warning
or recommendation. Every one of ACRCloud's raw fields — `prediction`,
`likely_source`, `ai_probability`, `source_probabilities`, `segments`,
`model_id`, timestamps — passes through untouched.

## Supported Capability

| Capability | Vocabulary entry |
|---|---|
| `AI_MUSIC_DETECTION` | `Capability.AI_MUSIC_DETECTION` — `'AI Music Detection'` |

Declared in `acr-ai-capabilities.js` (`ACR_AI_DETECTION_CAPABILITIES`, one
entry) — deliberately does not reuse or extend `AUDIO_RECOGNITION`.

## Provisioning Dependency (read before using)

This connector requires a **pre-existing ACRCloud File Scanning container**
configured with `engine: 5` (AI Music Detection). Container creation is
account provisioning — done once via ACRCloud's console or the
`fs-containers` CRUD API — and is explicitly **not** something this
connector does. `initialize()` requires `containerId` to be supplied; there
is no fallback, no auto-provisioning, no default container.

## Supported API Endpoints

| Purpose | Method | Endpoint | Host |
|---|---|---|---|
| Submit audio for scanning | `POST` | `/api/fs-containers/{containerId}/files` | `https://api-{region}.acrcloud.com` (region-specific) |
| Poll scan status/result | `GET` | `/api/fs-containers/{containerId}/files/{fileId}` | same region-specific host |
| Health probe (read-only) | `GET` | `/api/fs-containers/{containerId}` | `https://api-v2.acrcloud.com` (global) |

`region` must be one of ACRCloud's three documented values —
`eu-west-1`, `us-west-2`, `ap-southeast-1` — matching whichever region the
container was actually created in. There is no default; a wrong guess would
silently target the wrong regional host and every request would fail, so
`region` is required alongside `token` and `containerId`, with no
implicit fallback for any of the three.

## Processing Model — Asynchronous Submit-and-Poll

Unlike every other connector in this PAL (one request, one response), File
Scanning is asynchronous:

1. `acquire()` submits the audio source — returns `{id, state: 0 (processing), ...}` immediately.
2. The connector polls `GET .../files/{fileId}` internally, within a bounded budget.
3. `state: 1` → scan complete, raw result (including `ai_detection[]`) returned as `payload`, `AVAILABLE` / `completeness: 'full'`.
4. `state: -1` → provider reported a scan error, raw response still returned as `payload`, `PARTIAL_RESPONSE` / `completeness: 'partial'`.
5. Budget exhausted while still `state: 0` → `TIMEOUT` / `completeness: 'partial'`, with the **last known provider response preserved** (never fabricated, never silently discarded).

Polling never runs indefinitely. Configurable via `initialize(config)`:

| Field | Default | Meaning |
|---|---|---|
| `pollIntervalMs` | `2000` | delay between poll attempts |
| `pollMaxAttempts` | `10` | hard cap on poll attempts |
| `pollTotalTimeoutMs` | `30000` | overall budget across all attempts |

Whichever bound (attempts or total time) is hit first ends polling.

## Supported Input Types

Only input types whose full request **and** response shape is verified
against ACRCloud's official documentation are implemented:

| `subjectRef` field | ACRCloud `data_type` | Notes |
|---|---|---|
| `audioSample` (Buffer) | `audio` | multipart file upload |
| `fingerprint` (Buffer) | `fingerprint` | multipart file upload |
| `audioUrl` (string) | `audio_url` | `url` form field, no file |

ACRCloud's documentation also lists `platforms` and `isrc` as valid
`data_type` values, but does not fully specify which field carries the
reference value for either mode. **Not implemented** — per Board directive,
this connector does not claim support for an input type until its request
shape is verified, not guessed.

## Authentication

Static, console-generated Bearer token — no login/token-exchange endpoint
exists, matching the same architectural situation as the sibling
Audio Recognition connector's HMAC signing (no token endpoint there either,
for a different structural reason). `authenticate()` is therefore a local
credential-presence check (`token`, `containerId`, valid `region` all
present), not a network call. Real auth failures (bad token, wrong
container) surface lazily via `401`/`403` on the first real request.

Credentials are never exposed — `authenticate()` returns `{ mode: 'bearer',
value: '[redacted]' }`.

## Health Reporting

`reportHealth()` performs a **read-only** `GET` on the container resource
itself (`/api/fs-containers/{containerId}`) — verifies Bearer token
validity and container reachability without submitting any audio file, per
Board directive ("avoid submitting a real audio file merely to perform
routine health checks").

## Provider Trust

Default `80` — same as the sibling Audio Recognition connector (same
provider/infrastructure, same reliability tier). This reflects **provider
reliability**, not per-detection model confidence — model confidence is
already carried per-item in the raw payload's `ai_probability` field, and
this connector does not interpret or elevate that number in any way.

## Known Limitations

- **No live authenticated verification performed.** No ACRCloud credentials
  (Identify or File Scanning) exist in this environment. This connector's
  request/response contract is grounded in ACRCloud's official
  documentation (`docs.acrcloud.com`), verified live via direct fetch
  during design — not training-data assumptions — but has never been
  round-tripped against a real File Scanning container. **Production
  verification remains required once credentials and an engine-5 container
  are provisioned.** Do not describe this connector as fully
  production-verified until that live test occurs.
- The exact `state` enum beyond `0` (processing) is inferred from the
  structurally identical Bucket API's documented `{0: processing, 1: ready,
  -1: error}` convention, which File Scanning's own docs confirm at least
  `state: 0` shares — not independently confirmed for `1`/`-1` against a
  live File Scanning response.
- `platforms` and `isrc` input types are documented as valid but not
  implemented (see above) pending verified request-shape confirmation.

## Out of Scope (this connector, this phase)

- Container creation/configuration (account provisioning, not acquisition)
- The `platforms`/`isrc` input types (unverified request shape)
- Any interpretation of `ai_probability`/`prediction`/`likely_source` (ATHENA's responsibility)
- Changes to the existing ACRCloud Audio Recognition Connector™
- Territory Intelligence Refactor, `HealthState.UNAVAILABLE` PAL-wide audit, `EvidenceBridge` updates — all separately tracked, none touched here

## Certification

`tests/certification/suites/18-acrcloud-ai-detection-connector.mjs` — fully
mocked, no live credentials required or used. 12 groups (A–L): static
contract, initialization (missing token/containerId/region, invalid
region), authentication, submission routing (all 3 supported input types),
initial-processing response, multi-poll successful completion, provider
scan error, bounded-timeout with last-response preservation, error handling
(401/403/429/malformed/5xx), `reportHealth()`, Evidence Contract integrity
and immutability, and edge cases (missing subjectRef, unsupported
capability, shutdown/cleanup). 82/82 assertions passing.
