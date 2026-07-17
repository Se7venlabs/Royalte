# Phase 3.8 — MusicBrainz Capability Expansion — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `feat/musicbrainz-capability-expansion`
**Certification:** 96/96 assertions passing (self-certifying — was 73/73 before this expansion, then stale at 72/73 until this PR)

---

## Executive Summary

Additive enhancement to the existing, already-production `MusicBrainzConnector`.
Adds 5 new capability/method pairs, all raw-acquisition-only (no
normalization), reusing MBIDs already resolved via the connector's existing
`ARTIST_IDENTITY`/`TRACKS`/`RELEASES` capabilities rather than introducing new
discovery workflows.

## Files Changed

- `provider-acquisition/connectors/musicbrainz/MusicBrainzConnector.js` (+67)
- `provider-acquisition/connectors/musicbrainz/mb-capabilities.js` (+5)
- `tests/certification/suites/07-musicbrainz-connector.mjs` (updated — see Certification below)

## Scope of Change

| Capability | Method | Endpoint |
|---|---|---|
| `PUBLISHING` | `#fetchWorks` | `GET /work?artist={mbid}&limit=100` |
| `SONGWRITERS` | `#fetchWorkRelationships` | `GET /work/{workMbid}?inc=artist-rels+work-rels+url-rels` |
| `CONTRIBUTORS` | `#fetchRecordingRelationships` | `GET /recording/{recordingMbid}?inc=artist-rels+work-rels` |
| `LABELS` | `#fetchReleaseDetail` | `GET /release/{releaseMbid}?inc=labels` |
| `SOCIAL_LINKS` | `#fetchArtistRelationships` | `GET /artist/{mbid}?inc=artist-rels+url-rels` |

`MB_CAPABILITIES` grows from 4 to 9 entries. All 5 new capabilities were
already present in the shared vocabulary before this change — no
`capabilityVocabulary.js` modification required.

## Certification Results

**96/96 assertions passing.** The pre-existing suite (`07-musicbrainz-connector.mjs`)
tested the `EvidenceBridge` translation layer for the original 3 capabilities
but had zero coverage of connector dispatch/acquisition behavior itself, and
zero coverage of the 5 new capabilities. This PR:
- Fixed the stale `MB_CAPABILITIES has exactly 4 capabilities` assertion → 9, with explicit `includes()` checks for each new entry
- Added a new Group H (23 assertions) exercising the connector's public `acquire()` entrypoint directly against a mocked `fetchFn` for all 5 new capabilities — correct endpoint construction, `AVAILABLE` health, raw payload passthrough, and `PARTIAL_RESPONSE` when the required `subjectRef` field is missing (no network call)

Note: the 5 new capabilities have no `EvidenceBridge` translation yet (same
constitutional stage MLC's `PUBLISHING` capability started at) — this is
raw-acquisition-only, consistent with "acquire, never normalize."

## Validation

Live-validated earlier this session against a real Radiohead MBID
(`a74b1b7f-71a5-4011-9441-d0b5e4122711`) — confirmed real writer credit
("Colin Greenwood" as composer), ISWC/PRO-registration IDs, label/catalog-number/
barcode data, and 89 artist relations including Discogs/Wikidata links.

## Merge Recommendation

**Recommend merge.** Self-contained, self-certifying per the new PAL
governance standard — implementation and certification ship together in one PR.
