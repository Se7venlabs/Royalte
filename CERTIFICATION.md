# Royaltē Board Certification Harness™

**Status:** Permanent. Append-only record of the certification methodology.  
**Authority:** `constitution/ROYALTE_MASTER_CONSTITUTION.md` v1.3  
**Harness merged:** 2026-07-02 via PR #192  
**Certified baseline:** `royalte-os-v1.0` at commit `65c5c16`

---

## Constitutional Purpose

The Board Certification Harness is the repeatable, machine-verifiable gate that separates a release candidate from a certified OS release. It answers one binary question:

> **Is this Royaltē OS build certifiable for production?**

Exit code `0` = **CERTIFIED**. Exit code `1` = **NOT CERTIFIED**.

No release tag may be created unless the harness exits `0` and GitHub CI is green.

---

## Running the Harness

```bash
node tests/certification/harness.mjs
```

Output includes a full Board Certification Report. The final line is the verdict.

---

## Suite Architecture

The harness runs five suites in sequence. All must pass for certification.

### Suite 01 — Regression (`tests/certification/suites/01-regression.mjs`)

**Purpose:** Guarantee that all eight Board-locked golden fixtures still pass through the Intelligence Engine and Health Engine without producing unexpected results.

**Fixture source:** `tests/fixtures/` — the append-only Golden Fixture Library (Phase 6.5, PR #135).

**Assertions:** 73 (as of OS v1.0)

**What it checks:**
- Every fixture loads without error
- `runIntelligenceEngine(cio, ALL_RULES)` returns a frozen report with observations and risks arrays
- `computeHealthScore(report)` returns a numeric score in `[0, 100]`
- Archetype-specific expectations (e.g., `artist-missing-publishing` produces observations; `artist-perfect` yields zero risks)

**Governance rule:** A regression suite failure on a previously-passing fixture is a production defect. Stop and fix before any other work.

---

### Suite 02 — Determinism (`tests/certification/suites/02-determinism.mjs`)

**Purpose:** Verify that the same evidence always produces the same intelligence output.

**What it checks:**
- **Part A:** 8 golden fixtures × 10 IE runs — JSON-identical
- **Part B:** 12 artist library fixtures × 10 IE runs — JSON-identical
- **Part C:** `canonical-radiohead` → full RIE pipeline × 5 runs with fixed clock → JSON-identical

**Excluded from Part C comparison** (legitimately volatile, not intelligence):
- `scanAuthority.scanId` — `randomUUID()` per call (provenance identifier)
- `_certifiedAt` — certification wall-clock stamp
- `health.report.generatedAt` — internal `new Date()` in Health Report assembler
- `aiInsight.generatedAt` — internal `new Date()` in Royaltē AI assembler
- `brief.generatedAt` — internal `new Date()` in Executive Brief assembler

**Assertions:** 21 (as of OS v1.0)

**Determinism policy:** Any non-determinism in intelligence values (scores, grades, labels, observation lists) is a production defect. Timestamp-only non-determinism is accepted and excluded from comparison per this policy.

---

### Suite 03 — Certification Artist Library (`tests/certification/suites/03-artist-library.mjs`)

**Purpose:** Stress-test the OS against the full range of real-world artist archetypes, including edge cases that golden fixtures do not cover.

**Assertions:** 177 (as of OS v1.0)

**Per-archetype checks:**
- `runIntelligenceEngine` runs without throwing
- Report has frozen `observations[]` and `risks[]`
- `computeHealthScore` returns a numeric score in `[0, 100]`
- `assembleIdentityIntelligence` and `assemblePublishingIntelligence` run without throwing
- Archetype-specific behavioral expectations (see table below)

---

## Certification Artist Library

**Location:** `tests/certification/artist-library/`  
**Loader:** `tests/certification/artist-library/library-loader.mjs`  
**Policy:** append-only. Never modify existing fixtures. Add archetypes forward with a new file.

The library covers 12 artist archetypes at OS v1.0:

| Archetype | File | Purpose |
|-----------|------|---------|
| Major artist | `artist-major.json` | 3-provider verified, 63 albums, 432 works. Confirms high-coverage path. |
| Independent artist | `artist-independent.json` | Spotify only, minimal publishing. Tests limited-provider path. |
| Singles-only artist | `artist-single-only.json` | 20 singles, 0 albums. Tests catalog classification edge case. |
| Album-heavy catalog | `artist-album-heavy.json` | 72 albums, 1,840 works, 40-year career. Tests large catalog. |
| No publisher | `artist-no-publisher.json` | Zero publishing data. Confirms publishing gap detection. |
| Legacy catalog | `artist-legacy-catalog.json` | 53-year career, null ISRCs (pre-digital era). Tests null ISRC handling. |
| Duplicate identity | `artist-duplicate-identity.json` | 2 Spotify + 2 Apple profiles. Must fire `identity.duplicate-dsp-profiles`. |
| International artist | `artist-international.json` | Non-ASCII artist name (Korean). Confirms Unicode safety. |
| Classical performer | `artist-classical.json` | No publishing authorship (performer, not writer). Tests zero-authorship path. |
| Sparse metadata | `artist-sparse-metadata.json` | High `flagCount`, `missingCredits`. Confirms metadata observation firing. |
| All-null fields | `artist-null-fields.json` | Maximally null CIO. Confirms no null-pointer throws anywhere in the stack. |
| Multi-publisher | `artist-multi-publisher.json` | 6 publishers, 15 writers, 340 works. Tests complex publishing graph. |

---

### Suite 04 — CIM Integrity (`tests/certification/suites/04-cim-integrity.mjs`)

**Purpose:** Verify that `runRIE()` on a canonical fixture produces a structurally valid, deeply frozen Certified Canonical Intelligence Model conforming to the §8.2 twelve-object schema.

**Fixture:** `api/fixtures/canonical-radiohead.json`

**Assertions:** 36 (as of OS v1.0)

**What it checks:**
- All 12 §8.2 CIM objects are present
- `_certified === true`
- CIM passes deep-freeze verification (every nested object and array is frozen)
- Field types on key CIM paths:
  - `health.score` is a number
  - `health.grade` is a string
  - `health.identityScore` is a number
  - `scanAuthority.subjectName` is a string or null
  - `identityIntelligence.coverage` is a number
  - `identityIntelligence.verifiedProviders` is a number
  - `publishingIntelligence.coverageStatus` is a string

**Known Phase 3.5 gap** (tracked in suite comment):  
`cim.health` does not contain `domainStatuses`. That object lives in `healthIntelligence` (returned by `assembleHealthIntelligence`), which is not yet promoted into the CIM. This is a scheduled Phase 3.5 task; the suite does not assert on it until promotion is complete.

---

### Suite 05 — Performance Baseline (`tests/certification/suites/05-performance.mjs`)

**Purpose:** Establish and enforce performance baselines for each pipeline stage.

**Assertions:** 1 (budget gate)

**Method:** 20 timing samples per stage on a warm JIT. Stats reported: min, p50, p95, max.

**Budget:** Full RIE pipeline p95 < 500ms. This is the only hard gate; other stage timings are informational.

**OS v1.0 baseline** (measured 2026-07-02):

| Stage | P50 (ms) | P95 (ms) |
|-------|---------|---------|
| Intelligence Engine | 0.04 | 0.07 |
| Health Engine | 0.00 | 0.01 |
| Identity Intelligence | 0.00 | 0.01 |
| Publishing Intelligence | 0.00 | 0.01 |
| Full RIE pipeline | 0.15 | 0.31 |

---

## Board Certification Report

The harness emits a structured report (`tests/certification/reporters/board-report.mjs`) on every run. The report contains:

- Per-suite pass/fail counts
- Per-fixture detail (fixture name, health score, grade, observation count, risk count)
- Determinism summary (runs × fixtures, DETERMINISTIC / NON-DETERMINISTIC per fixture)
- Artist library table (all 12 archetypes, health score, grade)
- CIM integrity results
- Performance timing table
- Final Board Certification Verdict: **CERTIFIED** or **NOT CERTIFIED**
- Recommendation: **TAG `royalte-os-v1.0`** if all suites pass

---

## Certification Gates

These rules apply to all future work on the OS:

| Change Type | Gate Required |
|-------------|--------------|
| Intelligence Engine change | 100% harness pass before merge |
| Health Engine change | 100% harness pass before merge |
| Rule Library change | 100% harness pass before merge |
| RIE change | 100% harness pass before merge |
| CIM schema change | Harness suites updated + 100% pass before merge |
| Release tag creation | 100% harness pass + GitHub CI green |
| Artist library addition | Fixture added, suite updated, 100% pass |
| Golden fixture addition | Existing golden suite continues to pass |

---

## Certified Baseline Record

| Field | Value |
|-------|-------|
| Release tag | `royalte-os-v1.0` |
| Certified commit | `65c5c16` |
| Certification date | 2026-07-02 |
| Total assertions | 308 |
| Passed | 308 |
| Failed | 0 |
| Verdict | **CERTIFIED** |
| PR | #192 |
| Harness commit | `e72e396` (rebased, now `65c5c16`) |
