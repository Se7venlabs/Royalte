# Royaltē Testing Architecture

**Status:** Permanent. Describes all test surfaces and how to run them.  
**Authority:** `constitution/ROYALTE_MASTER_CONSTITUTION.md` v1.3  
**Last updated:** 2026-07-02 (OS v1.0 certification harness added)

---

## Test Suites

### 1. Pipeline Test (CI gate)

```bash
node tests/pipeline-test.mjs
```

**Role:** The GitHub CI gate. Required to pass before any PR may merge to `main`.  
**What it tests:** `normalizeAuditResponse()` → `validateAuditResponse()` end-to-end against a realistic raw engine payload, plus negative cases.  
**Framework:** None. Throws on failure; exits 0 on success.  
**Assertions:** ~226 (as of OS v1.0)

---

### 2. Golden Fixture Test

```bash
node tests/golden-fixture-test.mjs
```

**Role:** Regression guard for the 7 canonical golden CIO fixtures.  
**What it tests:** All 7 fixtures through `runIntelligenceEngine` + `computeHealthScore`. Checks specific known outputs (observation counts, rule IDs, health grade ranges).  
**Assertions:** ~31 (as of OS v1.0)

The Golden Fixture Library (`tests/fixtures/`) is append-only (Phase 6.5, PR #135). Never overwrite or modify an existing fixture; add forward only.

---

### 3. RIE Phase 1 Test

```bash
node tests/rie-phase1-test.mjs
```

**Role:** Integration test for the full RIE pipeline (PAL → CIO → Intelligence → Health → CIM).  
**What it tests:** `runRIE()` on canonical-radiohead, verifying CIM structure and field presence.  
**Assertions:** ~25

---

### 4. Identity Wiring Test

```bash
node tests/identity-wiring-test.mjs
```

**Role:** Verifies the end-to-end identity intelligence pipeline: Scan → CIO → Rule Library → Identity Intelligence → audit_scans.payload.  
**What it tests:** Identity coverage, provider verification, strengths/issues/recommendations output.  
**Assertions:** ~19

---

### 5. Publishing Intelligence Test

```bash
node tests/publishing-intelligence-test.mjs
```

**Role:** Verifies the publishing intelligence assembly pipeline.  
**What it tests:** MLC adapter → Publishing Intelligence assembler → CIM publishing fields.  
**Assertions:** ~26

---

### 6. Health Engine Test

```bash
node tests/health-engine-test.mjs
```

**Role:** Dedicated unit test for `computeHealthScore()`.  
**What it tests:** Board-locked CATEGORY_WEIGHTS (sum to 1.0), GRADE_THRESHOLDS (A+/A/B/C/D/F), score determinism.  
**Assertions:** ~36

---

### 7. Board Certification Harness (OS v1.0)

```bash
node tests/certification/harness.mjs
```

**Role:** Permanent certification gate. Must pass before any release tag is created and after any change to the Intelligence Engine, Health Engine, Rule Library, RIE, or CIM schema.

**Exit codes:**
- `0` = CERTIFIED — all suites pass
- `1` = NOT CERTIFIED — one or more suite failures

**Architecture:** 5 suites, run sequentially. All must pass.

| Suite | File | Purpose | Assertions |
|-------|------|---------|-----------|
| 01-regression | `suites/01-regression.mjs` | 8 golden fixtures through IE + Health | 73 |
| 02-determinism | `suites/02-determinism.mjs` | 20 fixtures × 10 IE runs + 5 RIE runs | 21 |
| 03-artist-library | `suites/03-artist-library.mjs` | 12 archetypes through IE + Health + assemblers | 177 |
| 04-cim-integrity | `suites/04-cim-integrity.mjs` | Full RIE → CIM §8.2 structure + deep-freeze | 36 |
| 05-performance | `suites/05-performance.mjs` | Stage timings + 500ms RIE budget gate | 1 |
| **Total** | | | **308** |

See `CERTIFICATION.md` for full documentation of the harness and its policies.

---

## Running All Tests

Run the full test surface (recommended before any PR):

```bash
node tests/pipeline-test.mjs && \
node tests/golden-fixture-test.mjs && \
node tests/rie-phase1-test.mjs && \
node tests/identity-wiring-test.mjs && \
node tests/publishing-intelligence-test.mjs && \
node tests/health-engine-test.mjs && \
node tests/certification/harness.mjs
```

All must exit `0` for a clean surface.

---

## Test File Map

```
tests/
├── pipeline-test.mjs               — CI gate (GitHub checks this)
├── golden-fixture-test.mjs         — Golden fixture regression
├── rie-phase1-test.mjs             — Full RIE pipeline integration
├── identity-wiring-test.mjs        — Identity intelligence pipeline
├── publishing-intelligence-test.mjs— Publishing intelligence pipeline
├── health-engine-test.mjs          — Health Engine unit tests
├── fixtures/                       — Golden Fixture Library (append-only)
│   ├── fixture-loader.mjs
│   ├── artist-perfect.json
│   ├── artist-major-verified.json
│   ├── artist-minor-issues.json
│   ├── artist-serious-risks.json
│   ├── artist-missing-publishing.json
│   ├── artist-international.json
│   └── artist-sparse-metadata.json
└── certification/                  — Board Certification Harness (OS v1.0)
    ├── harness.mjs                 — Orchestrator (entry point)
    ├── reporters/
    │   └── board-report.mjs        — Board Certification Report formatter
    ├── suites/
    │   ├── 01-regression.mjs
    │   ├── 02-determinism.mjs
    │   ├── 03-artist-library.mjs
    │   ├── 04-cim-integrity.mjs
    │   └── 05-performance.mjs
    └── artist-library/             — Certification Artist Library (append-only)
        ├── library-loader.mjs
        ├── artist-major.json
        ├── artist-independent.json
        ├── artist-single-only.json
        ├── artist-album-heavy.json
        ├── artist-no-publisher.json
        ├── artist-legacy-catalog.json
        ├── artist-duplicate-identity.json
        ├── artist-international.json
        ├── artist-classical.json
        ├── artist-sparse-metadata.json
        ├── artist-null-fields.json
        └── artist-multi-publisher.json
```

---

## CI Configuration

**Workflow:** `.github/workflows/pipeline-test.yml`  
**Job name:** `Run pipeline test`  
**Command:** `node tests/pipeline-test.mjs`  
**Branch protection:** Ruleset id `16344395` on `main` requires this check to pass before merge.

The Board Certification Harness is **not** run in CI by default — it is run manually before release tagging and after changes to the intelligence stack. Adding it to CI is a future Board decision.

---

## Governance Rules for Tests

- **Golden fixtures are append-only.** `tests/fixtures/` may only receive new files. Existing fixtures are never modified.
- **Certification artist library is append-only.** `tests/certification/artist-library/` may only receive new files. Existing archetypes are never modified.
- **Any change to the IE, Health Engine, Rule Library, or RIE requires a passing harness run** before merge. See `GOVERNANCE.md` Certification Gates.
- **Harness suites must be updated before a CIM schema change may merge.** Suite 04 enforces the §8.2 CIM structure; update it to match any approved schema change.
- **Test fixes must prove engine or fixture behavior is correct** before changing the assertion. Do not change a test to make it pass — investigate which side is wrong first.
