# ACRCloud Audio Recognition Connector™ v1

Phase 3.9 Board Authorization. Constitutional implementation of `ProviderConnector`
for the [ACRCloud Identify API](https://docs.acrcloud.com/reference/identification-api).

## Purpose

This connector answers exactly one question: **"What recording is this?"**

It is Royaltē's first acoustic-identity provider — every other connector in
this PAL matches by text or ID (artist name, ISRC, catalog number); this one
matches by acoustic sample. Given a raw audio clip or a precomputed
fingerprint, it returns whatever ACRCloud's Identify API says that recording is.

## Constitutional Responsibilities

Per the standing constraint on every `ProviderConnector`:

> This connector NEVER normalizes, reconciles, scores, interprets, or computes.
> It acquires raw evidence and packages it in the constitutional Evidence
> Contract. It NEVER communicates with any Royaltē product (Mission Control,
> Audit, etc.).

Concretely: ACRCloud's own `score` field (0–100 match confidence) is passed
through untouched — this connector does not decide whether a match is "good
enough," rank candidates, or merge ACRCloud's answer with any other provider's.
That is a downstream orchestration/intelligence-layer responsibility.

## Supported Capability

| Capability | Vocabulary entry |
|---|---|
| `AUDIO_RECOGNITION` | `Capability.AUDIO_RECOGNITION` — `'Audio Recognition'` |

Declared in `acr-capabilities.js` (`ACR_CAPABILITIES`, one entry). This is the
only capability this connector implements — see **Out of Scope** below for
what was deliberately not added to the shared vocabulary.

## Supported API Endpoint

| Capability | Method | Endpoint | Auth |
|---|---|---|---|
| `AUDIO_RECOGNITION` | `POST` | `https://{host}/v1/identify` | HMAC-SHA1 request signing |

`{host}` is per-ACRCloud-project (assigned at console project creation, e.g.
`identify-eu-west-1.acrcloud.com`) — never a fixed constant. Supplied via
`config.host` / `ACR_HOST`.

The same endpoint serves two input modes, selected by the request's `data_type`
field, not by two separate capabilities:
- `data_type: "audio"` — raw audio sample (ACRCloud recommends <15s)
- `data_type: "fingerprint"` — a fingerprint the caller precomputed client-side (lower bandwidth)

`ACRCloudConnector#dispatchAcquire` picks the mode from `subjectRef`:
`subjectRef.fingerprint` (if present) takes priority over `subjectRef.audioSample`,
since a precomputed fingerprint is the caller's more specific intent.

## Authentication Model

The Identify API has **no login or token endpoint** — every request is
independently HMAC-SHA1 signed:

```
string_to_sign = "{method}\n{uri}\n{accessKey}\n{dataType}\n{signatureVersion}\n{timestamp}"
signature      = base64( HMAC-SHA1(string_to_sign, accessSecret) )
```

`acr-auth.js` computes this (`generateAcrSignature`, `buildSignedFields`) — pure
functions, credentials passed as parameters, never read from `process.env`
directly and never logged.

Because there's no login step, `authenticate()` cannot make a network call to
verify credentials the way `MLCConnector` does against `/oauth/token`. It can
only confirm `accessKey` + `accessSecret` + `host` are all present — a
deliberate, documented deviation from that template. A wrong key or bad
signature only surfaces lazily, on the first real `acquire()` call, via
ACRCloud status codes `3001` (wrong access key) / `3014` (invalid signature) —
both mapped to `AUTH_FAILED`. `reportHealth()` compensates for this by sending
a minimal real probe request (a 1-byte sample) so genuine auth/connectivity
failures are still detectable without waiting for a production `acquire()` call.

Credentials are never exposed outside the connector — `authenticate()` returns
`{ mode: 'hmac-sha1', value: '[redacted]' }`, matching the redaction pattern
established by `MLCConnector`. No secret is ever logged, returned, or included
in any Evidence Contract.

## Configuration

`initialize(config)` accepts:

| Field | Env var fallback | Required |
|---|---|---|
| `config.accessKey` | `ACR_ACCESS_KEY` | yes |
| `config.accessSecret` | `ACR_ACCESS_SECRET` | yes |
| `config.host` | `ACR_HOST` | yes |
| `config.fetchFn` | — (defaults to `globalThis.fetch`) | no — test injection point |
| `config.timeoutMs` | — (defaults to `15_000`) | no |
| `config.maxRetries` | — (defaults to `3`) | no |

All three required values must be present or the connector initializes into a
credential-less state (`authenticate()` → `AUTH_FAILED`, `acquire()` → empty
contract) — never a partial/ambiguous state. `ACR_ACCESS_KEY`, `ACR_ACCESS_SECRET`,
and `ACR_HOST` already have reserved (currently empty) slots in
`.env.preview` / `.env.production`.

## Health Signal Mapping

ACRCloud returns HTTP `200` for nearly every outcome — the real result lives in
the JSON body's `status.code`, not the HTTP status line.

| ACRCloud `status.code` | Meaning | `HealthState` | Retried? |
|---|---|---|---|
| `0` | Success, match found | `AVAILABLE` | — |
| `1001` | No recognition result | `PARTIAL_RESPONSE` | no |
| `3001` | Wrong access key | `AUTH_FAILED` | no |
| `3014` | Invalid signature | `AUTH_FAILED` | no |
| `3003` | Request count limit exceeded | `RATE_LIMITED` | yes |
| `3015` | QPS limit exceeded | `RATE_LIMITED` | yes |
| `3002` | Invalid HTTP request | `MAINTENANCE` | no |
| `3006` | Invalid arguments | `MAINTENANCE` | no |
| `3000` / `3010` | Recognition service error | `MAINTENANCE` | yes |
| transport timeout | — | `TIMEOUT` | no (respects `maxRetries`) |
| non-JSON response body | — | `SCHEMA_CHANGED` | no |
| anything else | — | `UNAVAILABLE` | no |

A "no match" response (`status.code: 1001`) is preserved as-is — it's a
definitive, well-formed answer ("this sample doesn't match anything ACRCloud
knows about"), not missing or broken data. It maps to `PARTIAL_RESPONSE` /
`completeness: 'empty'`, distinct from an actual failure.

## Evidence Contract

Standard envelope via `createEvidenceContract` — identical shape to every
other connector in this PAL: `evidenceId`, `schemaVersion`, `acquisitionId`,
`correlationId`, `requestId`, `provider`, `providerVersion`, `connectorVersion`,
`providerTrust`, `capabilityProfileRef`, `acquiredAt`, `health`, `completeness`,
`payload`, `payloadChecksum`, `rawResponseHash`. Frozen on construction.

`payload` carries ACRCloud's raw response, untouched:

`metadata.music[]` (recognition candidates, ranked): `acrid`, `title`,
`artists[].name`, `artists[].langs`, `album.name`, `album.langs`, `label`,
`genres[].name`, `duration_ms`, `release_date`, `score` (0–100 match
confidence), `external_ids.isrc`, `external_ids.iswc`, `external_ids.upc`,
`external_metadata.spotify` / `.youtube` / `.deezer` (each an object with
platform-specific track/album/artist IDs). Envelope: `metadata.timestamp_utc`,
`status.code`, `status.msg`, `status.version`.

`completeness` is `'full'` on a match (`status.code: 0`), `'empty'` on no-match
or any failure state — never `'partial'` for this connector, since a single
Identify call either succeeds completely or doesn't.

## Provider Trust

Default `80` (governance-overridable via `trustConfig.js`), same tier as
MusicBrainz and Deezer. ACRCloud is a commercial recognition engine, not a
rights registry — its `isrc` field is a third-party best-guess tag from its own
licensing partnerships, not a statutory source. It should never be elevated to
MLC's tier (`95`) for that reason, and any future intelligence layer that
consumes this evidence should treat ACRCloud's `score` as *acoustic match
confidence*, not *rights accuracy* — conflating the two would be a correctness
bug, not just a trust-tuning question.

## Retry Strategy

`acr-http.js` retries with exponential backoff + jitter (1s base, doubling,
capped at 8s, ±400ms jitter), up to `maxRetries` (default 3), for exactly two
outcome classes:
- Transport-level `429`/`5xx` HTTP responses (rare — ACRCloud usually answers `200`)
- ACRCloud `status.code` `3003`/`3015` (rate limited) and `3000`/`3010` (service error)

Every other outcome — success, no-match, auth failure, invalid request — returns
immediately without retrying, since retrying a wrong signature or a malformed
request cannot succeed on a later attempt.

## Timeout Handling

Each attempt is wrapped in an `AbortController` with a `timeoutMs` budget
(default 15s, matching MLC's connector). A timed-out attempt maps to
`HealthState.TIMEOUT` and does not count toward the retry budget for other
failure classes — it is terminal per attempt, and only retried if the overall
`maxRetries` budget allows another attempt.

## Known Limitations

- Signature algorithm is grounded in ACRCloud's published documentation
  (verified live against `docs.acrcloud.com` during the Discovery Report), but
  has **not been round-tripped against a real ACRCloud account** — no live
  credentials have been used at any point in this connector's development or
  certification. First production credential test should happen before this
  is exercised against real traffic.
- `reportHealth()`'s probe sends a 1-byte sample rather than genuine audio.
  ACRCloud will correctly classify it as "no match," which is sufficient to
  prove connectivity + valid signature, but does not prove the recognition
  pipeline itself works end-to-end with real audio.

## Out of Scope

**Other ACRCloud products** — three exist under the same ACRCloud account and
are deliberately not implemented here:

| Product | Why not v1 |
|---|---|
| **Metadata API** (`GET /api/external-metadata/tracks`) | Different auth model — static Bearer console token, not HMAC signing. No env var slot provisioned for it today (`ACR_CONSOLE_TOKEN` doesn't exist in Vercel). Largely duplicates Identify's fields without needing audio. Candidate for a future, separately-scoped enhancement. |
| **Bucket / Custom Files API** (`POST /api/buckets/:bucket_id/files`) | Same Bearer-token auth gap. Manages a *private* fingerprint database (your own catalog) — a provisioning/administration concern, not raw-evidence acquisition. |
| **Broadcast Monitoring API** (`/api/bm-bd-projects`) | Asynchronous, webhook/callback-based — ACRCloud pushes results to a URL you register, rather than answering a request. Doesn't fit `acquire(evidenceRequest) → EvidenceContract`'s synchronous contract at all; would require a new PAL primitive (a webhook receiver) that doesn't exist anywhere in this codebase. |

**AI-generated music detection** — a separate, independently certifiable
**ACRCloud AI Detection Connector™** (answering "How was this recording
created?") is planned for a later Board-authorized phase. This connector
contains no AI detection logic, AI probability scoring, human-vs-AI
classification, stem-level detection, disclosure logic, or policy analysis —
and no hooks, stubs, or preparation for that future work. The two connectors
are designed to remain independently testable, certifiable, and replaceable.

**Deferred vocabulary candidates** — `AUDIO_FINGERPRINT`, `CONFIDENCE`, and
`EXTERNAL_IDS` were evaluated during the Board Discovery Report and not added:

- **`AUDIO_FINGERPRINT`** — rejected as redundant. Same endpoint, same response
  shape as `AUDIO_RECOGNITION`; differs only in the `data_type` request field,
  an *input* distinction, not a distinct evidence category. Handled as a
  `subjectRef`-level dispatch choice instead.
- **`CONFIDENCE`** — rejected as not capability-grade. ACRCloud's `score` field
  is intrinsic to what a recognition match *is* — no existing connector treats
  a field like this as its own capability. It lives inside `AUDIO_RECOGNITION`'s payload.
- **`EXTERNAL_IDS`** — a structurally novel concept (a pre-resolved bundle of
  *other providers'* IDs for the same recognized recording) with genuine future
  reuse potential, but deferred rather than rejected: nothing consumes it yet.
  Ships as plain fields inside `AUDIO_RECOGNITION`'s raw payload for v1;
  promote to its own capability only once a second consumer needs it.

## Certification

`tests/certification/suites/15-acrcloud-connector.mjs` — fully mocked, no live
credentials required or used. 11 groups (A–K): static contract, authentication,
signature-generation correctness (checked against an independently computed
HMAC-SHA1, not the module under test), acquisition on match/no-match/auth-failure/
rate-limit/timeout, Evidence Contract integrity, dispatch edge cases, and the
`reportHealth()` probe. Wired into `tests/certification/harness.mjs` as suite 15.
79/79 assertions passing.
