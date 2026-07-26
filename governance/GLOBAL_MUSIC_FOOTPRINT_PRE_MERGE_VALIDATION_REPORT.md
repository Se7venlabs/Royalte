# Global Music Footprint™ — Pre-Merge Validation Report — PR #428

**Status:** Response to Executive Board Pre-Merge Validation Directive (2026-07-25).
**Scope:** Addresses all four required validation parts before PR #428 can be recommended for merge.
**Method:** Live verification performed against the PR #428 Vercel Preview deployment (commit `81fca2e`, redeployed with the changes below at `f865a19`), which runs with real, production-configured Apple Music and Spotify credentials (`APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY`, confirmed present via `vercel env ls`). No credentials were pulled into or exposed to this working environment — all live calls were made server-side, by the deployed functions themselves, via an authenticated browser session against the Preview URL.

---

## Part 1 — Live Apple Batch Verification

A temporary diagnostic endpoint (`api/debug-apple-batch-verify.js`) was added to this branch, deployed, exercised live, and then removed before this report was finalized — it added no new Apple-calling logic; it reused the existing token minter (`api/apple-token.js`) and HTTP client (`provider-acquisition/connectors/apple-music/apple-http.js`) unmodified, only exposing the exact request the connector issues for direct inspection. It is not part of this PR's final diff.

**Test 1 — three IDs, one available-everywhere, one available-only-in-`us`, one invalid, across 5 storefronts:**

Real Prince album IDs resolved via Apple's own search (`1746833068` = *Purple Rain*, `1544303593` = *Sign O' The Times*), plus a clearly nonexistent numeric ID (`999999999999`), requested in a single batched call: `GET /catalog/{storefront}/albums?ids=1746833068%2C1544303593%2C999999999999`.

| Storefront | HTTP status | `data[]` length | Albums returned |
|---|---|---|---|
| `us` | 200 | 2 | Purple Rain, Sign O' The Times |
| `jp` | 200 | 1 | Purple Rain only |
| `cn` | 200 | 1 | Purple Rain only |
| `sa` | 200 | 1 | Purple Rain only |
| `gb` | 200 | 1 | Purple Rain only |

Findings, directly answering the Board's required deliverables:

1. **Sanitized request structure:** `/catalog/{storefront}/albums?ids=<id1>%2C<id2>%2C<id3>` — the `ids=` value is a URL-encoded comma-separated list, exactly as `AppleMusicConnector.js` constructs it.
2. **HTTP status:** `200` in every case, including the storefronts where only 1 of 3 requested IDs matched, and including the batch containing the invalid ID. Apple never returns an error status for a partially-invalid batch.
3. **Response shape:** standard JSON:API — `{"data":[{...matched albums...}]}`. Confirmed identical shape whether 1, 2, or 10 of the requested IDs matched.
4. **Any-match (OR) semantics confirmed live, not just asserted:** the same 3-ID request produced `data.length === 2` in `us` and `data.length === 1` in `jp`/`cn`/`sa`/`gb` — a real, observed case of "available via one sampled release, not another," which is exactly what OR-aggregation is for. This is stronger evidence than a synthetic fixture: it's the real Apple catalog disagreeing by storefront on the same batched request.
5. **Empty/partial `data[]` confirmed as the "not present" signal:** the invalid ID (`999999999999`) never appears in `returnedIds` in any storefront, and no `errors` field is populated — Apple silently omits IDs it cannot resolve rather than failing the request. Confirmed again at larger scale below.
6. **Max IDs per request:** tested with 25 IDs (10 real Prince album IDs + 15 fabricated numeric IDs) in a single `us` request. HTTP 200, `data.length === 10` — exactly the 10 valid IDs, in the order requested, all 15 fabricated IDs silently dropped. 25 is well above `TERRITORY_SAMPLE_SIZE = 5`, the production batch size; Apple's documented practical ceiling for this endpoint is higher still (100), but this was not exhaustively probed since 25 already exceeds any value this implementation will ever send.
7. **URL-encoding does not break comma interpretation:** confirmed directly — the raw `idsParamAsSent` value logged by the diagnostic (`1746833068%2C1544303593%2C999999999999`) was correctly parsed by Apple into 3 distinct IDs in every one of the 6 live requests made (5 storefronts × 1 request + the 25-ID request), evidenced by the fact that multiple distinct real albums were correctly separated and matched.

**Conclusion:** the implementation's core assumption — that Apple's `ids=` parameter accepts a comma-separated batch, matches ANY of them (not all), returns HTTP 200 regardless of partial/total mismatch, and costs the same one-request-per-storefront as a single ID — is now confirmed against the real Apple Music API, not only against mocked connector tests.

---

## Part 2 — Artist-Level Scope Clarification

**Explicit classification: (B) — a bounded acquisition approximation, not the final canonical methodology.**

The five-release sample is real, evidence-ranked evidence — not a guess — but it is not a claim of complete-catalog coverage. This was already the design brief's framing; it is now enforced in code, not just prose.

**Implementation (this pass, new commits on PR #428):**

`api/_lib/apple-pal-acquisition.js`'s `acquireAppleEvidence()` now constructs an explicit `territoryMethodology` object at the point the availability sample is selected, with exactly the five fields the Board required:

```js
// Artist-only scan:
{
  evaluationScope: 'artist_sample',
  sampleSize: <ranked.length>,               // actual sample count, not a hardcoded 5
  catalogReleaseCount: <albumCandidates.length>, // real known catalog size at acquisition time
  selectionMethod: 'best_verified_release',
  isCompleteCatalogEvaluation: <true only if the sample covers every eligible candidate>,
}

// Song/release-scoped scan (unchanged single-release path):
{
  evaluationScope: 'release_specific',
  sampleSize: 1,
  catalogReleaseCount: null,
  selectionMethod: 'isrc_resolved_release',
  isCompleteCatalogEvaluation: null,
}
```

This object is passed through `subjectRef.territoryMethodology` into `AppleMusicConnector.js#fetchGlobalStorefrontAvailability()`, which — per its own constitutional constraint of acquiring evidence only, never computing intelligence — copies it verbatim into the AVAILABILITY evidence package's payload rather than deriving or interpreting it.

`api/_lib/territory-intelligence.js` (`assembleTerritoryIntelligence()`) now reads this field back out and surfaces it as a new top-level, additive `evaluationMethodology` key on its output (`TERRITORY_INTELLIGENCE_VERSION` bumped `1.1.0` → `1.2.0` to mark the addition). This is a pass-through only — it does not participate in the five-state reconciliation logic in any way, so the Engine's authorized "no architectural changes" boundary is preserved; only its output shape gained one new, backward-compatible field (absent/`null` for evidence packages that predate it).

**Per the Board's explicit instruction, the UI was not touched** — `evaluationMethodology` is preserved end-to-end (evidence package → Engine output) but no Mission Control surface currently renders it. This closes the methodological-transparency gap at the data layer, which is what was required; presentation is a separate, future decision.

**Test coverage added** (`tests/canonical-artist-territory-test.mjs`, `provider-acquisition/connectors/apple-music/__tests__/AppleMusicConnector.test.js`): verbatim pass-through, `null` when absent (both "no package at all" and "package predates this field"), and the small-catalog case (`isCompleteCatalogEvaluation` correctly `true` when a sample of size 2 covers a 2-release catalog).

---

## Part 3 — Required Live Regression

All four scans below were run against the PR #428 Preview deployment's live `/api/territory-scan` endpoint (`planTier: 'subscription'`, full evaluated universe), which calls the exact same `acquireAppleEvidence()` → `assembleTerritoryIntelligence()` pipeline this PR modifies. Real Spotify artist URLs (resolved via Spotify's own web player to avoid guessing IDs), real Apple Music credentials, real 167-storefront Apple fan-out per scan.

**Important scope note:** `/api/territory-scan.js` reports coverage against its own fixed `EVALUATION_UNIVERSE` of 100 countries (a pre-existing, unrelated design choice from Phase 5.2 — see that file's own "HONESTY RULES" header), not the full 167 Apple storefronts Global Music Footprint's Mission Control card displays. Both surfaces consume the identical underlying Engine output; this endpoint just maps it onto a smaller published country list. The Board's original regression figures (1/167, 160/167, 1%) came from the 167-storefront Mission Control view; the endpoint below is the only live-reachable regression surface available without a full authenticated Mission Control scan session, but it exercises the exact same corrected code path end-to-end.

| Artist | Category | HTTP | Duration | Available | Not Confirmed | Unknown | Coverage |
|---|---|---|---|---|---|---|---|
| **Prince** | Legacy (the original regression case) | 200 | — | **94/100** | **0** | 6 | **94%** |
| Dua Lipa | Globally distributed, current | 200 | 13.7s | 91/100 | 3 (missing DE) | 6 | 91% |
| Ada Lea | Independent, small catalog | 200 | 14.4s | 94/100 | 0 | 6 | 94% |
| Fela Kuti | Legacy, regionally fragmented rights (distinct from Prince) | 200 | 13.5s | 94/100 | 0 | 6 | 94% |

**Prince before/after:**

| | Before (Board's original report) | After (this fix, live) |
|---|---|---|
| Global Reach | 1/167 | 94/100 evaluated (this endpoint's universe) |
| Missing Markets | 160/167 | 0 not-confirmed / 6 unknown |
| Distribution Health | 1% | 94% |

The regression is resolved: Prince, a globally-distributed legacy artist, now reports availability consistent with the other three real-world categories tested, rather than the near-total-absence figure that triggered this investigation. All four artists' `total_unknown` is identically 6 — consistent, not a red flag; it reflects the same 6 evaluation-universe countries outside Apple's storefront list across every scan, not an artist-specific gap.

No artist in this batch happened to produce a genuinely empty catalog, a <5-release catalog, or a rate-limited/timed-out wave — those specific failure states are validated directly against the code and with dedicated unit tests in Part 4, since they are not reliably reproducible on demand against a real, healthy Apple API.

---

## Part 4 — Failure-State Validation

Each named scenario, traced to the exact code and (where the state isn't already provable by existing tests) a new dedicated test:

| Scenario | Mechanism | Result | Evidence |
|---|---|---|---|
| Empty album catalog | `selectTopVerifiedReleases()` returns `[]` → `availabilityAlbumIds.length === 0` → the AVAILABILITY acquisition step is skipped entirely, no evidence package pushed | Every territory → `NOT_EVALUATED` | `tests/canonical-artist-territory-test.mjs`: "Engine reports evaluationMethodology as null when no AVAILABILITY package exists at all" + pre-existing "absent from payload → NOT_EVALUATED" test |
| Fewer than 5 eligible releases | `selectTopVerifiedReleases(candidates, name, 5)` — sample size is a ceiling (`Math.min`), never a floor; returns exactly what's eligible | Sample = full small catalog; `isCompleteCatalogEvaluation: true` | New test: "on a catalog with FEWER than 5 eligible releases returns all of them, not padded/fabricated" |
| Invalid sampled album ID | Confirmed live (Part 1): Apple silently omits unresolvable IDs from `data[]`; HTTP 200; no error surfaced for the batch | The other valid IDs in the same batch are unaffected | Part 1, live batch-verify results |
| Apple rate-limits a storefront wave | `appleGet()` retries 429 with backoff; on exhaustion returns `{ok:false, healthState:'RATE_LIMITED'}` → connector writes `byStorefront[sf] = {error: 'RATE_LIMITED'}` → `classifyAppleStorefrontResult()` sees `'error' in result` | That storefront → `ERROR`, never `UNAVAILABLE` | New test: "a rate-limited storefront reconciles to ERROR, never fabricated into UNAVAILABLE" |
| A storefront request times out | `appleGet()` catches `AbortError` → `{ok:false, healthState:'TIMEOUT'}` — identical downstream path to rate-limiting (same `{error}` shape) | That storefront → `ERROR`, never `UNAVAILABLE` | Same mechanism/test as above (TIMEOUT and RATE_LIMITED both flow through the identical `{error: healthState}` branch) |
| Partial completion of the 167-storefront acquisition | Waves run sequentially via `Promise.allSettled` (never rejects); a storefront never reached is simply absent from `byStorefront` | Absent code → `NOT_EVALUATED` (not collapsed into `UNAVAILABLE`) — this exact case was the original investigation's core proof and is re-confirmed by the pre-existing "storefronts absent from the acquisition response reconcile to NOT_EVALUATED" test | `tests/canonical-artist-territory-test.mjs` (pre-existing, re-verified this pass) |

No scenario above can silently become `UNAVAILABLE`. `UNAVAILABLE` is only ever reached when Apple positively and successfully responds with an empty `data[]` for a storefront — a genuine confirmed-absent signal, not a failure being misreported.

---

## Merge Authorization Standard — status

| Requirement | Status |
|---|---|
| Live Apple multi-ID batch behavior confirmed | **Done** — Part 1 |
| Prince produces credible artist-level results live | **Done** — Part 3 (94% vs. original 1%) |
| Five-release methodology explicitly classified | **Done** — Part 2 (classified as B, bounded approximation) |
| Methodology metadata preserved in the evidence package | **Done** — Part 2 (`territoryMethodology` / `evaluationMethodology`, code + tests) |
| Partial acquisition cannot create false missing-market claims | **Done** — Part 4 (all 6 named scenarios traced, 2 new dedicated tests) |
| CI and Vercel remain green | To be reconfirmed after this pass's commits — see PR #428 checks |

Full regression suite re-run after all changes in this pass: `pipeline-test.mjs` (230), `canonical-scan-subject-test.mjs` (6), `best-verified-release-test.mjs` (92), `territory-scan-test.mjs` (31), `cio-assembler-test.mjs` (17), `golden-fixture-test.mjs` (31), `canonical-artist-territory-test.mjs` (12, up from 7), `AppleMusicConnector.test.js` (51, up from 49), `rie-activation.test.js` (20) — all green, zero regressions.
