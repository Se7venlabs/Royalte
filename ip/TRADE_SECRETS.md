# TRADE SECRETS

**Header:** **CONFIDENTIAL — Se7ven Labs LLC**

**Owner:** Se7ven Labs LLC
**Classification:** Restricted. Not for distribution outside the Executive Sponsor + Supporting Executives without Board direction.
**Effective:** 2026-06-11

A trade secret is information that (a) derives independent economic value from not being generally known, (b) is subject to reasonable efforts to maintain its secrecy, and (c) is not the subject of a published patent or defensive publication.

This file lists the methodologies, processes, and architectural decisions that Se7ven Labs LLC has elected to **maintain as trade secret** rather than disclose. Each entry records what the secret is, how it is classified, the method of protection, and who has access.

Companion files: `PATENTS.md` (inventions Se7ven Labs may file), `DEFENSIVE_PUBLICATIONS.md` (inventions Se7ven Labs may deliberately disclose), `COPYRIGHTS.md` (creative expressions, not ideas).

> A methodology cannot be both trade-secret-protected and patented. Once any Board ratifies a patent filing or defensive publication on the same methodology, the corresponding trade-secret entry here is superseded with a row citing the disposition.

---

## Classification scale

| Classification | Meaning |
|---|---|
| **Restricted** | Founder + Executive Sponsor only. Disclosure outside this group requires Board vote. |
| **Confidential** | Executive Board only. Disclosure to a Supporting Executive requires Executive Sponsor approval. |
| **Internal** | All Se7ven Labs personnel. Not for public disclosure. |

---

## Protection methods

| Method | Description |
|---|---|
| **Repository access control** | Source-of-truth files live only in the private repository; access is restricted at the GitHub-organisation level. |
| **NDA on engagement** | Every contractor, advisor, or contractor-of-contractor signs an NDA before access. |
| **Compartmentalisation** | High-value methodology is decomposed across modules so no single module reveals the full method. |
| **No publication** | The methodology is not published in blogs, white papers, presentations, or marketing material. Only the *outcome* is presented externally. |
| **Code-comment discipline** | Source files reference the *what* and *why* of the constitutional contract, never the proprietary judgement that produced the specific constants (weights, thresholds, deduction values). |

---

## Methodology registers

### Health methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Royaltē Health Engine™ weighting calibration | The internal evidence and reasoning behind the specific `CATEGORY_WEIGHTS` (`identity 0.20 · publishing 0.25 · catalog 0.20 · metadata 0.15 · coverage 0.10 · confidence 0.10`) and the grade-band thresholds. The constants themselves are public in `api/schema/health.js`; the *derivation* is not. | Confidential | No publication · code-comment discipline | Founder · CTO · Executive Sponsor |
| Severity-deduction calibration | The methodology by which CRITICAL/HIGH/MEDIUM/LOW/INFO map to `-30/-20/-10/-5/-2` (rather than any other ratio). | Confidential | No publication | Founder · CTO |
| V2 Health Score signal weights (Brief 012a) | Bucket maxes (catalog_verification 40 · big6 20 · backend_health 20 · youtube_presence 10 · isrc 10) and the empirical decisions behind them. | Confidential | No publication · NDA on engagement | Founder · CTO |

### Identity methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| `royalteId` allocation strategy | The internal procedure by which a canonical artist identity is minted and persisted across providers. The Identity Graph public API is open; the matching heuristics are not. | Restricted | Compartmentalisation · code-comment discipline | Founder · CTO |
| Apple-canonical / Spotify-verification doctrine (locked 2026-06-07) | The constitutional rule that Apple Music is the canonical identity source and Spotify is verification — and the rationale. | Confidential | No publication | Founder · CTO · Executive Sponsor |

### Matching methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Recording ↔ composition reconciliation heuristics | The internal procedure for linking ISRC-keyed recordings to ISWC-keyed compositions when one or both providers omit cross-references. | Restricted | Compartmentalisation · NDA on engagement | Founder · CTO |
| Writer-IPI deduplication procedure | The internal rules for treating writer-IPI matches across MLC / SOCAN / ASCAP / BMI / CISAC sources as the same person. | Restricted | Compartmentalisation | Founder · CTO |

### Monitoring methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Monitoring subscriber gating procedure | The internal procedure by which paid monitoring features (e.g., Listen Notes podcast intelligence) are gated. The mechanism (`isMonitoringSubscriber`) is in the code; the *pricing and tier rationale* is not. | Confidential | No publication | Founder · CFO · Executive Sponsor |
| Future monitoring rule families (CATEGORIES.MONITORING reserved) | The Board's internal plan for what populates the `MONITORING` rule category. | Confidential | No publication | Founder · CTO |

### Revenue methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Future revenue rule families (CATEGORIES.REVENUE reserved) | The Board's internal plan for what populates the `REVENUE` rule category, including methodology for revenue signal detection and royalty reconciliation. | Confidential | No publication | Founder · CFO · Executive Sponsor |

### Inference methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Cross-source coverage inference | The internal procedure by which a missing publishing registration (or missing recording linkage) is inferred from the presence of corroborating signals in adjacent providers. | Restricted | Compartmentalisation · code-comment discipline | Founder · CTO |
| Confidence-score derivation | The internal procedure by which an observation receives `HIGH` / `MEDIUM` / `LOW` / `UNKNOWN` confidence. | Confidential | No publication | Founder · CTO |

### Executive Brief methodology

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Royaltē Executive Brief™ structural template and tone-of-voice rules | The internal format that converts a CIO + Intelligence Report + Health Report into the locked Executive Brief layout. | Restricted | No publication · NDA on engagement | Founder · Executive Sponsor · Creative Director |

### AI architecture

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Royaltē Executive Runtime™ orchestration topology | The internal procedure by which the AI Executives (Athena, Hephaestus, Celine, Avery Cole, Ellie Morgan, Victoria Sterling, Marcus Blackwell) are sequenced, gated, and reconciled. | Restricted | No publication · compartmentalisation | Founder · CTO |
| AI Executive prompt corpora | The full system-prompt + scaffold corpora for each AI Executive. | Restricted | No publication · repository access control | Founder · CTO · Executive Sponsor (per executive) |
| Royaltē Boot Sequence™ pre-implementation question taxonomy | The internal reasoning behind the 5 pre-implementation questions and the Constitutional Priority chain. The procedure is public in `CLAUDE.md`; the *taxonomy of failure modes it prevents* is not. | Confidential | No publication | Founder · CTO |

### Internal business processes

| Entry | Description | Classification | Protection Method | Access Level |
|---|---|---|---|---|
| Pricing and packaging strategy | Royaltē OS™ pricing tiers (free scan, monitoring subscription, enterprise license) and the rationale behind the boundaries. | Confidential | No publication | Founder · CFO |
| Customer-acquisition channels and conversion data | Channels, conversion rates, and cost-of-acquisition. | Confidential | No publication | Founder · CFO |
| Investor pipeline | Active and recent conversations with prospective investors. | Restricted | No publication | Founder · CFO |
| Acquisition-defence playbook | Internal procedure for responding to inbound acquisition interest. | Restricted | No publication | Founder · CFO · Executive Sponsor |

---

## Conventions

- Entries are added when a methodology crosses the threshold of having independent economic value and being subject to reasonable secrecy efforts.
- Disposition changes (entry moves to `PATENTS.md` or `DEFENSIVE_PUBLICATIONS.md`) are recorded as a superseding row here that cites the disposition, not by deleting the original.
- Access lists are reviewed quarterly by the Executive Sponsor.
- Every external party with access (counsel, contractor, advisor) signs an NDA before access is granted; the NDA register is maintained separately under counsel control.

---

*Owned by Se7ven Labs LLC. CONFIDENTIAL — internal corporate record; not for distribution outside the access list.*
