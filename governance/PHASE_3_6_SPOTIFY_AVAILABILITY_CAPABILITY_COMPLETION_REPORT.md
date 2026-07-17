# Phase 3.6 — Spotify Availability Capability — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `feat/spotify-availability-capability`
**Certification:** 50/50 assertions passing (new suite — no prior Spotify certification suite existed)

---

## Executive Summary

Final connector in the PAL modernization program. Completes the `AVAILABILITY`
capability declaration that was orphaned earlier this session (declared in
`spotify-capabilities.js` with no dispatch wiring behind it) — now backed by
a live-verified, working implementation against Spotify's *current* API
behavior, not the deprecated bulk-markets model the capability was
originally scoped against.

## Live Verification (performed before any code was written)

Against this application's real Spotify client-credentials:

| Check | Result |
|---|---|
| `GET /v1/tracks/{id}` | `available_markets` field **absent entirely** |
| `GET /v1/albums/{id}` | Same — absent entirely |
| `GET /v1/markets` | **403 Forbidden** |
| `GET /v1/tracks/{id}?market={code}` | **Works** — returns `is_playable`, verified to genuinely vary: US/GB/DE = `true`, KP = `false` |

Spotify's availability model has moved from bulk territory lists to
market-by-market playability checks. This connector does not fabricate or
reconstruct the deprecated list — it returns exactly what the current API
exposes.

## Files Changed

- `provider-acquisition/connectors/spotify/SpotifyConnector.js` (dispatch case + `#fetchAvailability()` + `reportHealth()` probe fix)
- `provider-acquisition/connectors/spotify/spotify-capabilities.js` (comment corrected to describe the actual per-market implementation)
- `tests/certification/suites/16-spotify-connector.mjs` (new)
- `tests/certification/harness.mjs` (suite 16 registered)

## Scope of Change

`Capability.AVAILABILITY` → `#fetchAvailability(subjectRef)`:
- `subjectRef.market` required (ISO country code)
- `subjectRef.spotifyTrackId` → `GET /tracks/{id}?market={code}` (priority when both track and album IDs are present)
- `subjectRef.spotifyAlbumId` → `GET /albums/{id}?market={code}`
- Raw response returned untouched — `is_playable`, `restrictions` (when
  present), and any other field Spotify returns pass through unfiltered

## Additional Defect Found and Fixed

The same live verification that confirmed `/v1/markets` returns 403 also
applies to `SpotifyConnector`'s existing `reportHealth()` probe, which was
hardcoded to hit `/markets` — meaning the connector's health check has
likely been reporting `MAINTENANCE`/degraded in production this whole time,
independent of whether Spotify itself was actually reachable. Fixed in this
PR: the probe now targets `GET /tracks/{a known-stable track ID}` (the same
"Shape of You" canary already used for the AVAILABILITY certification
fixtures), which works under every access tier. This does not touch the
`AVAILABILITY` capability itself — it's the connector's pre-existing health
signal, degrading gracefully rather than throwing, so this was a silent
monitoring-accuracy issue, not a crash.

## Certification Results

**50/50 assertions passing**, new suite (none existed for this connector
previously) across 8 groups: static contract (capability count 6→7),
authentication, `AVAILABILITY` dispatch for both the track and album paths
(correct endpoint construction, correct `market` param, priority when both
IDs present, raw payload passthrough including a value that genuinely
differs by market), missing-`subjectRef` handling (no network call),
failure-path health mapping (404, 429), the `reportHealth()` probe fix, and
Evidence Contract integrity. Scoped to the `AVAILABILITY` work per Board
directive — not a retroactive certification of the connector's other 6
pre-existing, already-production capabilities.

## Scope Boundary — Explicitly Not Touched

`api/territory-scan.js` currently reads `data.available_markets || []`,
which silently evaluates to an empty array under Spotify's current API
behavior — producing empty territory data without erroring. This is a real,
separate production issue, **not fixed in this PR**. Tracked as a future
Board task: **Territory Intelligence Refactor** — updating Territory
Intelligence to consume PAL `AVAILABILITY` evidence (this connector's new
per-market capability, plus any other providers') instead of depending on
Spotify's deprecated bulk field.

## Merge Recommendation

**Recommend merge.** Completes the PAL connector modernization program.
Every claim in this report is grounded in a live API call made this session,
not carried forward from an earlier finding — the connector, its
certification, and this report all reflect Spotify's actual current
behavior.
