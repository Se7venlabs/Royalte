# Phase 3.6 — MLC Connector: Song-Code Search & Refresh-Token Auth — Completion Report

**Status:** BOARD APPROVED FOR MERGE
**Date:** 2026-07-17
**Branch:** `feat/mlc-songcode-search-and-refresh-auth`
**Certification:** 83/83 assertions passing

---

## Executive Summary

Additive enhancement to the existing, already-production `MLCConnector`,
migrating the raw-acquisition subset of a legacy, dead-code MLC resolver's
capabilities into the constitutional connector (per the "should migrate"
gap-analysis from earlier this session), while explicitly leaving the
resolution waterfall, title normalization, and confidence scoring out —
those remain orchestration-layer concerns.

## History Resolution (Board-flagged issue)

Earlier in this session, the certification suite for this work (commit
`5d79427`, `test(mlc): recertify MLC Connector suite...`) was committed to a
different, since-abandoned branch (`fix/p0-workspace-auth-timing`) — but the
connector code it certifies (`MLCConnector.js`, `mlc-capabilities.js`,
`mlc-http.js`) was never committed anywhere. The Board flagged this as a
structural defect: that commit, checked out in isolation, tests code that
doesn't exist in that same history.

**Resolved in this PR**: the connector code (previously uncommitted, sitting
in the working tree) and the already-written certification suite (pulled
forward via `git checkout 5d79427 -- tests/certification/suites/10-mlc-connector.mjs`
from the old commit's content) are committed together, in this single PR, on
a fresh branch off current `main`. The old branch and its orphaned commit are
not reused or rewritten — this is a clean, forward-only commit that ships
both halves as one unit, as they should have shipped originally.

## Files Changed

- `provider-acquisition/connectors/mlc/MLCConnector.js` (+97/-15)
- `provider-acquisition/connectors/mlc/mlc-capabilities.js` (+4/-2)
- `provider-acquisition/connectors/mlc/mlc-http.js` (+84)
- `tests/certification/suites/10-mlc-connector.mjs` (+283/-4)

## Scope of Change

- **Refresh-token authentication**, alternative to username/password on
  `POST /oauth/token` — `initialize()` accepts either credential set;
  password takes priority if both are present.
- **`#fetchSongCodeSearch()`** — `POST /search/songcode`, new `SONGWRITERS`
  capability.
- **`#fetchWorkById()`** — `GET /work/id/{id}`, routed through the existing
  `PUBLISHING` capability's dispatch case (single-ID lookup vs. the existing
  batch `mlcSongCodes` array lookup — existing production callers, which
  always pass the array, are unaffected).
- New `mlcGet()` HTTP helper (`mlc-http.js`), sibling to the existing
  `mlcPost`, mirroring its retry/backoff/error-classification exactly.

Explicitly **not** migrated (per the earlier gap-analysis directive): the
5-stage resolution waterfall, title normalization, confidence scoring —
those remain in the dead-code legacy resolver, untouched, pending a future
orchestration-layer decision.

## Certification Results

**83/83 assertions passing** across 8 groups (A–H): static contract
(capability count 2→3, `SONGWRITERS` added), auth behavior (both credential
modes, redaction shape generalized to `{mode, value}`, password-priority
when both present), the two new endpoints (signed body construction, Bearer
auth header, raw payload passthrough, single-object vs. array response
shape), and a regression assertion proving the existing `mlcSongCodes` batch
path is unaffected by the new single-ID dispatch branch.

## Merge Recommendation

**Recommend merge.** Implementation and certification now travel together in
one commit history, resolving the Board's structural concern. No orchestration
or resolution logic was migrated — connector remains raw-acquisition-only.
