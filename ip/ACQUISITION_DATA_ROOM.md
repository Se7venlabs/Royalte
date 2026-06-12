# ACQUISITION DATA ROOM

**Owner:** Se7ven Labs LLC
**Status:** living index — refreshed on demand for each acquisition conversation.
**Effective:** 2026-06-11

Acquisition-readiness index. When the Board engages an acquisition conversation, this file is the **table of contents** of the data room. Each section names what an acquirer expects to find and points to the canonical source — inside this Vault, in the operating codebase, or in counsel's records.

> No acquisition conversation is in progress. This file is prepared in advance so the data room can be assembled rapidly when one begins. The Acquisition-Defence Playbook (registered in `TRADE_SECRETS.md`) governs the *posture* taken in those conversations.

---

## 1. Corporate

| Item | Source |
|---|---|
| Articles of Organization | (held by counsel) |
| Operating Agreement | (held by counsel) |
| Cap table | (held by counsel) |
| Officer / member rosters | (held by counsel) |
| Annual filings + good-standing certificates | (held by counsel) |
| Tax filings | (held by counsel) |
| Bank statements | (held by CFO) |

---

## 2. Legal

| Item | Source |
|---|---|
| Material contracts (counsel) | (held by counsel) |
| NDAs in effect | NDA register (held by counsel) |
| Pending or threatened litigation | (none known; refresh at data-room open) |
| Compliance and regulatory filings | (held by counsel) |
| Privacy policy + DPA + data-handling | `public/index.html` privacy section · `CLAUDE.md` § AUTH_UNAVAILABLE semantics · privacy clause in commercial agreements |
| Insurance certificates | (held by counsel) |

---

## 3. Technology

| Item | Source |
|---|---|
| Engineering Stack summary | `PRODUCT_REGISTRY.md` § Engineering Stack |
| Engineering Stack canonical doc | `docs/ROYALTE_ENGINEERING_STACK.md` + Master Constitution § 8B |
| Architecture Decision Records | `ARCHITECTURE_DECISIONS.md` |
| Deployment posture | `CLAUDE.md` § Deploy Discipline + Vercel project settings |
| Repository access list | (held by Executive Sponsor) |
| CI / CD configuration | `.github/workflows/pipeline-test.yml` + branch-protection ruleset `16344395` |
| Third-party services in use | `CLAUDE.md` § Required environment variables |
| Open-source dependencies | `package.json` · `OPEN_SOURCE.md` § Open Source Assets used by the platform |

---

## 4. Architecture

| Item | Source |
|---|---|
| Engineering Stack (7 layers) | Constitution § 8B |
| Constitutional separation doctrine | Constitution + `ARCHITECTURE_DECISIONS.md` |
| Identity Graph design | `api/_lib/identity-graph.js` + `project_royalte_identity_graph_separation` directive |
| CIO + Intelligence Engine + Health Engine | `api/schema/*.js` + `api/_lib/*-engine.js` + `api/_lib/cio-assembler.js` |
| Rule Library | `api/rules/*` |
| Governance Layer | `/governance/*` |
| Boot Sequence | `CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION" |

---

## 5. IP

| Item | Source |
|---|---|
| Trademark register | `TRADEMARKS.md` + `TRADEMARK_USAGE.md` + `FIRST_USE_LOG.md` |
| Patent register | `PATENTS.md` + `PRIOR_ART.md` + `DEFENSIVE_PUBLICATIONS.md` |
| Copyright register | `COPYRIGHTS.md` |
| Trade-secret register | `TRADE_SECRETS.md` (restricted) |
| Invention log | `INVENTION_LOG.md` |
| Founder notes | `FOUNDER_NOTES.md` |
| AI Executive registry | `AI_MODELS.md` |
| IP roadmap | `IP_ROADMAP.md` |

---

## 6. Brand

| Item | Source |
|---|---|
| Brand guidelines | `BRAND_GUIDELINES.md` |
| Wordmarks · logos · favicons | `public/se7ven_labs_popped.png` · brand-asset folder |
| Locked UI designs | `public/index.html` · `public/dashboard.html` · `public/audit.html` |
| Press coverage | `PRESS.md` |
| Competitor analysis | `COMPETITOR_ANALYSIS.md` |
| Domain portfolio | `DOMAIN_REGISTRY.md` |

---

## 7. Financial

| Item | Source |
|---|---|
| Cap table | (held by counsel) |
| Bank statements | (held by CFO) |
| MRR / ARR | (pre-launch; held by CFO) |
| Operating budget | (held by CFO) |
| Burn + runway | (held by CFO) |
| Valuation framework | `VALUATION.md` (restricted) |
| Tax filings | (held by counsel) |

---

## 8. Licensing

| Item | Source |
|---|---|
| Licensable surfaces | `LICENSING.md` |
| License terms | `LICENSING.md` § 1 |
| Active licenses | (none yet) |
| OEM / White Label opportunities | `IP_ROADMAP.md` § 5 |

---

## 9. Contracts

| Item | Source |
|---|---|
| Customer agreements | (none yet) |
| Vendor agreements | (held by counsel) |
| Independent-contractor agreements | (held by counsel) |
| NDAs | (held by counsel; registered in counsel's NDA register) |
| Service agreements | (held by counsel) |

---

## 10. Ownership

| Item | Source |
|---|---|
| Cap table | (held by counsel) |
| Founder equity | 100% (founder) |
| AI Executive registry (operating attribution) | `AI_MODELS.md` |
| Executive Board (governance) | `governance/EXECUTIVE_BOARD.md` |

---

## 11. Data assets

| Item | Source |
|---|---|
| Scan corpus (Supabase `audit_scans`) | (held in Supabase project; configuration in `CLAUDE.md` § environment) |
| Audit-request corpus (Supabase `audit_requests`) | (same) |
| Reconciled Identity Graph (in-memory + persisted) | `api/_lib/identity-graph.js` data structures + Supabase persistence |
| Rate-limit + blocked-IP corpus | Supabase `rate_limits` + `blocked_ips` |

Data-handling clauses and privacy posture: `CLAUDE.md` § AUTH_UNAVAILABLE semantics + privacy policy on public surfaces.

---

## 12. Strategic assets

| Item | Source |
|---|---|
| Reconciled Identity Graph | `api/_lib/identity-graph.js` (operational); `IP_ROADMAP.md` § 8 |
| Royaltē Review longitudinal corpus | `audit_requests` + rendered PDFs |
| Constitutional architecture | Constitution + `docs/ROYALTE_ENGINEERING_STACK.md` |
| Royaltē Executive Runtime™ + AI Executives | `AI_MODELS.md` |
| Domain portfolio | `DOMAIN_REGISTRY.md` |
| Brand assets | `BRAND_GUIDELINES.md` |
| Open-source posture (what is open vs closed) | `OPEN_SOURCE.md` |

---

## Conventions

- This file is an **index**, not a content store. Documents themselves live in counsel's records, in Supabase, in the operating codebase, or in other Vault files.
- The order of sections matches a standard tech-acquisition data-room outline so an acquirer can navigate by familiar headings.
- For every section, the **source** column tells the acquirer exactly where to look. Entries marked "(held by counsel)" or "(held by CFO)" are produced on request through the gated process; the Vault never duplicates them.
- Refresh this file before opening any data room — confirm every source pointer still resolves to a live document.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
