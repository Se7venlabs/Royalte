# Phase 5.0 — ACRCloud AI Detection Connector™ — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `feat/acrcloud-ai-detection-connector`
**Certification:** 82/82 assertions passing (new connector, new suite)

---

## Executive Summary

New constitutional PAL connector answering "was this recording likely
AI-generated?" — completely separate from the existing ACRCloud Audio
Recognition Connector™ ("what recording is this?"), per Board directive.
Different ACRCloud product (File Scanning, engine 5, vs. the Identify API),
different auth model (Bearer console token vs. HMAC signing), different
processing model (asynchronous submit-and-poll vs. synchronous single
request). The two connectors share no code and no capability.

## Constitutional Audit / Design Basis

This is new-connector work, not a modernization of existing code — the
"audit" here is the pre-implementation live-documentation verification
performed before any code was written (see below), matching the same rigor
applied to every modernized connector's own audit phase.

## Live API Verification

**No ACRCloud credentials of any kind exist in this environment** —
confirmed absent for both the Identify API (already known from the original
Audio Recognition connector's build) and File Scanning. Per Board direction,
implementation proceeded on the basis of ACRCloud's official documentation,
verified via live fetch against `docs.acrcloud.com` during design (not
training-data assumptions), with mocked certification coverage standing in
for authenticated verification.

**Confirmed via direct fetch of ACRCloud's documentation:**
- AI Music Detection is a File Scanning (FS) product feature (`engine: 5`), entirely separate from the Identify API
- Auth: `Authorization: Bearer {token}` — Console-API family, same as Metadata/Buckets/Monitoring researched during the original Audio Recognition Discovery Report
- Submission: `POST /api/fs-containers/{container_id}/files`, multipart, `data_type` ∈ `{audio, fingerprint, platforms, audio_url, isrc}`, returns `{id, state: 0 (processing), uri, data_type}` immediately
- Retrieval: `GET /api/fs-containers/{container_id}/files/{file_id}` — asynchronous, requires polling (or a `callback_url`, not implemented here)
- Result shape: `ai_detection: [{start, end, prediction, likely_source, ai_probability, duration, stem, source_probabilities: [{source, probability}], segments: [...], model_id}]`
- Detectable sources (per ACRCloud's own FAQ): `human, suno, udio, sonauto, mureka, rdiffusion` — "actively expanding" to include ElevenLabs, MiniMax, Seed-Music
- Container retrieve (used as this connector's health probe): `GET https://api-v2.acrcloud.com/api/fs-containers/{container_id}` — global host, distinct from the region-specific file-submission host

**Not independently confirmed** — the exact `state` enum beyond `0`
(processing). Inferred from the structurally identical Bucket API's
documented `{0: processing, 1: ready, -1: error}` convention (same
Console-API family, same file-object shape pattern), which File Scanning's
own docs confirm at least `state: 0` shares. Documented as an inference, not
asserted as independently verified.

## Implementation Summary

New directory: `provider-acquisition/connectors/acrcloud-ai-detection/`

- **`acr-ai-capabilities.js`** — declares `Capability.AI_MUSIC_DETECTION` only, does not reuse `AUDIO_RECOGNITION`
- **`acr-ai-http.js`** — Bearer-authenticated GET/multipart-POST wrapper, standard-HTTP-status classification (401/403→`AUTH_FAILED`, 404→`PARTIAL_RESPONSE`, 429→`RATE_LIMITED` with retry, 5xx→`MAINTENANCE` with retry, timeout→`TIMEOUT`)
- **`ACRCloudAIDetectionConnector.js`** — full `ProviderConnector` implementation: `initialize()` requires `token`+`containerId`+valid `region` together, no partial-credential operation; `authenticate()` is a local presence check (no login endpoint exists); `reportHealth()` probes the container resource read-only; `acquire()` dispatches `AI_MUSIC_DETECTION` to submit-and-poll
- **`README.md`** — full documentation, including the "Known Limitations" section required by the Board's credential-limitation instruction

**Capability vocabulary**: one new entry, `AI_MUSIC_DETECTION: 'AI Music Detection'`, `VOCABULARY_VERSION` 1.1 → 1.2. Explicitly does not touch `AUDIO_RECOGNITION` or any other existing capability.

### Asynchronous Acquisition Design

`#submitAndPoll()` submits, then `#pollUntilResolved()` polls within a
bounded budget (`pollIntervalMs` × `pollMaxAttempts`, capped by
`pollTotalTimeoutMs` — defaults 2s / 10 attempts / 30s total, all
overridable). Outcomes:
- `state: 1` → `AVAILABLE` / `full`, raw result payload
- `state: -1` → `PARTIAL_RESPONSE` / `partial`, raw error payload preserved
- Budget exhausted at `state: 0` → `TIMEOUT` / `partial`, **last known
  provider response preserved**, never fabricated

Verified by direct smoke test before certification was written: a 3-poll
resolve sequence (`state 0 → 0 → 1`) correctly returns the final raw
`ai_detection` payload; a never-resolving sequence correctly times out
while preserving the last poll's actual response body.

### Input Types — Verified Only

Implemented: `audioSample` (multipart, `data_type: audio`), `fingerprint`
(multipart, `data_type: fingerprint`), `audioUrl` (form field,
`data_type: audio_url`). **Not implemented**: `platforms` and `isrc`, both
documented as valid `data_type` values by ACRCloud but without a fully
specified request field for the reference value — per Board directive, not
claimed as supported until verified, not guessed.

## Certification Results

**82/82 assertions passing**, 12 groups (A–L), fully mocked:
- A: static contract (capability count, distinctness from `AUDIO_RECOGNITION`)
- B: initialization (missing token / containerId / region, invalid region — each independently confirmed to fail closed)
- C: authentication (redaction, shutdown clears state)
- D: submission routing (all 3 supported input types, correct `data_type`, correct Bearer header)
- E: initial processing response triggers polling
- F: successful completion after multiple polls, full raw-field preservation (`prediction`, `ai_probability`, `likely_source`, `source_probabilities[]`, `segments[]`, `model_id` — none reinterpreted or collapsed)
- G: provider-reported scan error (`state: -1`)
- H: bounded timeout with last-response preservation, finite request count confirmed (no infinite polling)
- I: error handling (500, 401, 403, malformed JSON, 429)
- J: `reportHealth()` — confirmed read-only, no file upload
- K: Evidence Contract integrity + immutability
- L: edge cases (missing subjectRef, unsupported capability, no-credentials, shutdown/cleanup)

Full harness: **18/18 suites, zero regressions.** Pipeline test: 218+8
assertions, unaffected (no production wiring files touched — this connector
is not yet wired into any scan pipeline).

## Production Findings

None outside this connector's own scope. No existing file was modified other
than the shared capability vocabulary (additive, one entry) and the
certification harness (additive, one suite registration).

## Architectural Decisions

- **Separate directory, separate files, separate capability** — no shared
  code with the existing Audio Recognition connector, per Board directive
- **`region` required with no default** — a wrong guess would silently
  target the wrong regional host; treated with the same "no implicit
  fallback" discipline the Board specified for `containerId`
- **Health probe uses container retrieval, not file submission** — read-only,
  per Board directive to avoid burning scan quota on routine health checks
- **Trust value 80** — matches the sibling connector (same
  provider/infrastructure); explicitly documented as reflecting provider
  reliability, not per-detection model confidence

## Credential Limitation (stated per Board requirement)

- Live authenticated API verification was **not** performed — no credentials exist in this environment
- The request/response contract is grounded in official ACRCloud documentation, fetched live during design
- **Production verification remains required** once credentials and an engine-5 File Scanning container are provisioned
- This connector must not be described as fully production-verified until that live test occurs

## Merge Recommendation

**Recommend merge**, with the above limitation clearly on record. Fully
self-certifying, zero regressions, constitutional boundaries (no scoring,
no interpretation, no business logic) enforced throughout and explicitly
tested (Group F asserts every AI-detection field is preserved raw and
untouched). Not yet wired into any production scan pipeline — that wiring,
and the first live credentialed test, are natural next steps for a future,
separately-scoped directive.
