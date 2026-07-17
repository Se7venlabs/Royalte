# Phase 3.9 — ACRCloud Audio Recognition Connector™ v1 — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `fix/p0-workspace-auth-timing` (pre-existing session branch — see Regression Investigation Summary / branching note before merge)
**Certification:** 79/79 assertions passing (own suite)

---

## Executive Summary

Royaltē's first acoustic-identity provider. Every existing PAL connector
matches a recording by text or ID (artist name, ISRC, catalog number); this
connector matches by acoustic sample — raw audio or a precomputed fingerprint
— against ACRCloud's Identify API. It answers exactly one question, per Board
directive: **"What recording is this?"** It contains no AI-generated-music
detection, human-vs-AI classification, or related logic — that is reserved
for a separate, later-phase ACRCloud AI Detection Connector™.

Delivered through a governance-checkpointed process: initial implementation
attempt was paused mid-build when a shared architectural file
(`capabilityVocabulary.js`) was modified as a side effect of building a single
connector; the Board required a formal Discovery Report and capability-gap
analysis before implementation resumed. The final capability footprint (1 new
vocabulary entry, not the 4 originally proposed) reflects that review.

## Files Created

- `provider-acquisition/connectors/acrcloud/ACRCloudConnector.js` — main connector class
- `provider-acquisition/connectors/acrcloud/acr-http.js` — retry/timeout/status.code-classification HTTP wrapper
- `provider-acquisition/connectors/acrcloud/acr-auth.js` — HMAC-SHA1 request signer
- `provider-acquisition/connectors/acrcloud/acr-capabilities.js` — capability declaration
- `provider-acquisition/connectors/acrcloud/README.md` — connector documentation
- `tests/certification/suites/15-acrcloud-connector.mjs` — certification suite (79 assertions)
- `governance/PHASE_3_9_ACRCLOUD_COMPLETION_REPORT.md` — this report

## Files Modified

- `provider-acquisition/capability/capabilityVocabulary.js` — added `Capability.AUDIO_RECOGNITION`; `VOCABULARY_VERSION` 1.0 → 1.1
- `tests/certification/harness.mjs` — registered suite 15 in the inventory comment, import list, and run sequence

No other connector's code was modified as part of this work. (Unrelated
Deezer/Discogs/MLC/MusicBrainz/Spotify/YouTube modifications present in the
working tree predate this directive and are excluded from this report and
from the commit — see Regression Investigation Summary.)

## Capability Vocabulary Changes

One capability added: `AUDIO_RECOGNITION: 'Audio Recognition'`.

Three candidates proposed in the original implementation attempt —
`AUDIO_FINGERPRINT`, `CONFIDENCE`, `EXTERNAL_IDS` — were reverted and
re-evaluated under a dedicated Board Discovery Report before any were
re-added. Final disposition: `AUDIO_FINGERPRINT` and `CONFIDENCE` rejected as
redundant with `AUDIO_RECOGNITION` (input-mode and payload-field distinctions,
not separate evidence categories); `EXTERNAL_IDS` deferred (real concept, no
current consumer, ships as plain payload fields for v1). Full reasoning
recorded in the connector README.

## Authentication Implementation

HMAC-SHA1 per-request signing (`access_key` + `access_secret`), computed fresh
per request — ACRCloud's Identify API has no login/token endpoint. This
required a documented deviation from the `MLCConnector`/`AppleMusicConnector`
template: `authenticate()` is a local credential-presence check rather than a
network round-trip, since there is no token endpoint to call. `reportHealth()`
compensates with a genuine 1-byte probe request so real auth/connectivity
failures remain detectable pre-production. Credentials are redacted in every
returned object (`{ mode: 'hmac-sha1', value: '[redacted]' }`) and never
logged. No live ACRCloud credentials were used, seen, or requested at any
point in this work.

## HTTP Client Summary

`acr-http.js` posts multipart/form-data (new plumbing for this PAL — every
other connector's HTTP wrapper sends JSON) to `https://{host}/v1/identify`.
Classifies ACRCloud's `status.code` (returned inside an HTTP 200 body, not the
HTTP status line) into `HealthState`, with exponential-backoff-with-jitter
retry (1s base, doubling, 8s cap, ±400ms jitter, default 3 attempts) applied
only to rate-limit and service-error codes — auth failures and malformed
requests fail fast without retrying.

## Health Reporting Summary

All 8 constitutional `HealthState` values reachable and certified:
`AVAILABLE` (match found), `PARTIAL_RESPONSE` (no match — a definitive answer,
not an error), `AUTH_FAILED`, `RATE_LIMITED`, `MAINTENANCE` (both retryable
and non-retryable ACRCloud error classes), `TIMEOUT`, `SCHEMA_CHANGED`
(malformed response body). One real bug was found and fixed during
certification: `reportHealth()` initially read the wrong return shape from
the internal HTTP helper (`result.healthState` instead of `result.health.state`)
— caught by the suite before merge, never shipped.

## Evidence Contract Summary

Standard `createEvidenceContract` envelope, identical shape to every other PAL
connector — verified present and well-formed (SHA-256 checksums, frozen
output) by certification Group I. `payload` carries ACRCloud's raw
`metadata.music[]` response untouched — title, artists, album, label, genres,
duration, release date, match score, ISRC/ISWC/UPC, and cross-platform
Spotify/YouTube/Deezer IDs, whenever ACRCloud returns them.

## Certification Results

**79/79 assertions passing (100%)** across 11 groups: static contract,
authentication behavior, signature-generation correctness (verified against
an independently computed HMAC-SHA1, not the module under test), acquisition
across every ACRCloud status-code class (match/no-match/auth-failure/rate-limit/
service-error), timeout handling, Evidence Contract integrity, dispatch edge
cases, and the `reportHealth()` probe. Fully mocked — no live ACRCloud
credentials required, used, or requested anywhere in development or certification.

## Production Readiness Assessment

Ready for merge as a raw-evidence-acquisition connector. Not yet exercised
against a real ACRCloud account — the signature algorithm is grounded in
ACRCloud's published documentation (verified via live fetch during the
Discovery Report phase), but has never round-tripped against production
credentials. Recommend a first live-credential smoke test before this
connector is wired into any production scan pipeline, ahead of relying on it
for artist-facing intelligence.

## Merge Recommendation

**Recommend merge.** Scope was held exactly to what the Board authorized
across every directive in this sequence — one capability, one endpoint, no AI
detection logic, no orchestration, no other connector touched, no Mission
Control changes. The mid-implementation governance pause (unauthorized shared
architectural change caught and reverted) and the subsequent Discovery Report
produced a smaller, better-justified capability footprint than the original
proposal — a better outcome than if the pause hadn't happened.

---

## Regression Investigation Summary

Running the full certification harness (`node tests/certification/harness.mjs`)
after wiring in Suite 15 surfaced failures in three unrelated suites:
`07-musicbrainz-connector`, `09-youtube-connector`, `11-deezer-connector`.

A controlled isolation test was performed before any conclusion was drawn:
`capabilityVocabulary.js` was restored to its exact `HEAD` commit state
(`VOCABULARY_VERSION` 1.0, no `AUDIO_RECOGNITION`) while leaving the
MusicBrainz/YouTube/Deezer connector files exactly as found in the working
tree, and Suite 07 was re-run in isolation. **The failure persisted
identically** (`MB_CAPABILITIES has exactly 4 capabilities` — got 9),
proving the vocabulary bump is non-causal. `capabilityVocabulary.js` was then
restored to its working v1.1 state and the restoration verified byte-identical
via diff.

**Findings:**
- ACRCloud introduced no platform regression.
- The `capabilityVocabulary.js` v1.0 → v1.1 bump is non-causal for all three failures.
- All three failures were traced to stale certification assertions that
  hardcode capability counts from *before* separate, earlier-session
  capability expansions on those three connectors (MusicBrainz: 4 → 9,
  YouTube and Deezer similarly) — the connectors themselves function
  correctly; only their certification suites were never updated afterward.
  This is the same class of staleness already identified and corrected for
  the MLC connector's suite earlier in this session (commit `5d79427`).
- No production connector defects were identified in MusicBrainz, YouTube, or Deezer.
- No changes were made to MusicBrainz, YouTube, or Deezer connector code or
  their certification suites as part of this directive — tracked separately
  (task: "Certification maintenance: MusicBrainz/YouTube/Deezer stale
  assertions") pending its own Board directive.

**Branching note:** this work was carried out on `fix/p0-workspace-auth-timing`,
a pre-existing session branch also containing unrelated, uncommitted changes
(the same MusicBrainz/YouTube/Deezer/Discogs/Spotify capability work referenced
above, plus unrelated untracked files from other work). Only the files listed
under **Files Created** / **Files Modified** above are included in the commit
for this directive — the unrelated changes remain uncommitted and untouched,
exactly as found.
