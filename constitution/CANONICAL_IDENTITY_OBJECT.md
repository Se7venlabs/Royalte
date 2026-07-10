# Royaltē Canonical Identity Object™ — Pointer

**Status:** Phase 1 / Stage 2B (added 2026-06-17)

**Source of truth: `api/schema/cio.js`.**

This file is a pointer, not a duplicate. The authoritative schema for the
Royaltē Canonical Identity Object — every field, every type, every nullability
rule — lives in the doc-comment block at the top of `api/schema/cio.js`. The
schema is the contract; this file exists only so Constitutional readers can
find it without grepping the codebase.

Read the source: [`api/schema/cio.js`](../api/schema/cio.js).

## What this object IS

`cio.identity` is the **single place** Royaltē records what is known about
an artist's identity. Every downstream surface — Intelligence Engine rules,
Health Engine, Mission Control, Executive Brief — reads identity from here,
never from a provider adapter directly. This sub-object **is** the Royaltē
Identity Object referenced by the Constitution.

## Constitutional rules (binding)

1. **Apple is canonical.** When Apple and Spotify disagree on identity
   fields, Apple wins. (Identity-lock, 2026-06-05.)

2. **Enrich, don't replace.** New provider data appends to
   `externalProfiles[]`; never overwrites a prior entry.

3. **Separation.** Identity holds identity only. No catalog data
   (`releasesCount`, `catalogAgeYears`) and no publishing data
   (`worksCount`, ISRC, IPI, royalteId) lives here — they have their own
   sections (`cio.catalog`, `cio.publishing`).

4. **Adapters never bypass the assembler.** The Apple Adapter
   (`api/_lib/identity/apple.js`) and the Spotify resolver in
   `api/_lib/run-scan.js` write into the scan payload; only the CIO
   Assembly Engine (`api/_lib/cio-assembler.js`) writes into
   `cio.identity`.

## Why this file does not list the fields

Duplicating the schema here would cause drift. The doc-comment in
`api/schema/cio.js` ships in the same file as the live `emptyCio()`
shape — they cannot diverge. This pointer file does not have that
guarantee. See `api/schema/cio.js` for the current field list.

## Stage 3 follow-up (open)

`externalProfiles[].verified` is currently hardcoded to `true` in
`buildExternalProfileFromScan` at `api/_lib/cio-assembler.js`. The real
4-state mapping (Verified / Action Required / Not Found / Unable to
Confirm — where `AUTH_UNAVAILABLE` resolves to **Unable to Confirm**,
never **Not Found**) lives in Phase 5 rules under
`api/rules/identity-rules.js`. Stage 3 of Phase 1 wires the real
verification status through. Until then, treat `verified=true` as
"this provider returned data," not "the artist confirmed ownership."

## Known follow-up: `api/territory-scan.js:327`

That call site bypasses the Apple Adapter and hits
`https://api.music.apple.com/v1` directly. It is intentionally left
in place for Stage 2B; future adapter-migration stage will rewire it
through `api/_lib/identity/apple.js`.
