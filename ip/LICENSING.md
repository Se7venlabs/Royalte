# LICENSING

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

The Vault's licensing-posture register. Every product or methodology that Se7ven Labs LLC may, does, or anticipates offering under license — by license type, by product, by status, with the operative terms summarised. Counsel + CFO use this file to coordinate enterprise conversations; the Board uses it to gate which surfaces ship under which license model.

Companion files: `PRODUCT_REGISTRY.md` (the products being licensed), `IP_ROADMAP.md` (future licensing intent), `OPEN_SOURCE.md` (assets explicitly *not* under license restriction).

> No license described in this file has been offered to a counterparty, executed, or invoiced. The register documents *intent and offering posture*, not signed contracts.

---

## 1. License types

### 1.1 API

Programmatic access to a Royaltē surface over HTTP, returning the canonical Royaltē payload shape (CIO, Intelligence Report, Health Report). Used by integration partners who want to query Royaltē in real time.

- **Pricing model:** per-request + monthly minimum + enterprise tier.
- **Terms standard inclusions:** rate limits · uptime SLA · data-handling clause · usage reporting · audit right.
- **Restrictions:** no resale of raw responses; no extraction of underlying datasets; no scraping; no model training on Royaltē output without explicit written permission.

### 1.2 SDK

Client-library access to the Royaltē surface, distributed as a versioned package (npm / pip / similar). Wraps the API; carries the same restrictions, plus brand-attribution obligations.

- **Pricing model:** same as API; SDK is a delivery mechanism, not a separate price point.
- **Terms standard inclusions:** API terms apply · attribution: "Powered by Royaltē™" required on consumer surfaces · version-support window: N-1.
- **Restrictions:** no forking of the SDK source; no removal of attribution.

### 1.3 OEM

Original-Equipment-Manufacturer integration — the licensee embeds Royaltē methodology into a product they ship to *their* customers. The Royaltē brand may be hidden or surfaced depending on the negotiated terms.

- **Pricing model:** minimum guarantee + per-end-user revenue share + annual platform fee.
- **Terms standard inclusions:** branded vs unbranded election · co-marketing clause · joint-quality-control clause · termination + transition assistance.
- **Restrictions:** the OEM may not extend the methodology beyond the surface granted; sub-licensing requires Board approval.

### 1.4 Enterprise

Direct license to a corporate customer (label, distributor, rights-management organisation, music-tech vendor) for internal use. Includes the API + SDK and may include data-room access to specific datasets per `ACQUISITION_DATA_ROOM.md` rules.

- **Pricing model:** annual subscription + tier-based pricing.
- **Terms standard inclusions:** named-user license · usage cap · uptime SLA · data-residency clause · custom integration support.
- **Restrictions:** internal use only; no resale; no white-label of Royaltē surfaces under the licensee's brand.

### 1.5 White Label

The licensee operates a branded Royaltē surface — Mission Control, Executive Brief, Review — under their own brand. Royaltē attribution is on the back-end only.

- **Pricing model:** annual platform fee + per-end-user revenue share + integration cost.
- **Terms standard inclusions:** brand-substitution rights · co-developed quality-control clause · termination + de-brand process · audit right.
- **Restrictions:** the underlying methodology and engine code remain Se7ven Labs's property; the licensee receives the surface, not the IP.

---

## 2. Products available for licensing

The Royaltē products explicitly identified by the Board as licensable. Each row records what is being offered, under which license types, the operative terms, and the offering's status.

| Product | License Type | Terms | Status |
|---|---|---|---|
| **Royaltē Health Engine™** | API · SDK · OEM · Enterprise | Per-call pricing for API; revenue-share for OEM embedding; annual subscription for Enterprise. Output is the canonical Health Report (0-100 score + A+/A/B/C/D/F grade + per-category breakdown). | Available — first commercial conversations pending. |
| **Royaltē Identity Graph™** | API · Enterprise · OEM | Per-query pricing for API; bulk-extract priced per record for Enterprise; OEM available with revenue share. Output is the canonical Identity Graph projection (royalteId + externalIds map). | Available — counsel review of data-handling clause pending. |
| **Royaltē Monitoring™** | Subscription · Enterprise | Monthly subscription (artist tier) and annual (enterprise tier). Includes continuous rescans + delta-engine diff + subscriber-gated notifications. | Available for direct subscription. Enterprise licensing pending Board policy. |
| **Royaltē Mission Control™** | White Label · Enterprise | Annual platform fee + integration cost. Branded Mission Control surface for partners (labels, management, services). | Available — first partner conversations pending. |
| **Royaltē Executive Brief™** | Subscription · White Label · Enterprise | Per-brief subscription (artist tier); branded delivery available under White Label. | Available for direct subscription. White Label posture: pending Board policy. |
| **Royaltē Revenue Intelligence™** | Enterprise · OEM | Pricing not yet established (Phase reserved). | Reserved — surface not yet shipped. |

---

## 3. Surface-by-license summary

Quick lookup: which surface ships under which license types.

| Surface | API | SDK | OEM | Enterprise | White Label | Subscription |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Health Engine | ✅ | ✅ | ✅ | ✅ | — | — |
| Identity Graph | ✅ | — | ✅ | ✅ | — | — |
| Monitoring | — | — | — | ✅ | — | ✅ |
| Mission Control | — | — | — | ✅ | ✅ | — |
| Executive Brief | — | — | — | ✅ | ✅ | ✅ |
| Revenue Intelligence | — | — | (reserved) | (reserved) | — | — |

---

## 4. Mechanisms not available for license

- **Royaltē Rule Library™** — the declarative business knowledge is Se7ven Labs's competitive advantage; not licensed independently of the Intelligence Engine.
- **Royaltē Master Constitution** + **Royaltē Engineering Stack™** documentation — not licensed (these define how Royaltē operates, not what a partner can run).
- **Royaltē Boot Sequence™** — operational; not licensed as a standalone artefact.
- **Trade-secret methodologies** registered in `TRADE_SECRETS.md` — never licensed without Board ratification.

---

## 5. Termination and transition

Every license includes:

- A **termination-for-cause** clause with a 30-day cure period for the breach.
- A **termination-for-convenience** clause available to either party at 90 days' notice (Enterprise + OEM + White Label).
- A **transition assistance** clause obliging Se7ven Labs to provide reasonable migration support during the wind-down period.
- A **data-return / data-destruction** clause covering any licensee-supplied data.

---

## 6. Audit rights

Every license includes a **once-per-year audit right** exercisable by Se7ven Labs LLC on 30 days' notice. The audit covers usage volumes, end-user counts, and attribution compliance. Reasonable audit costs are borne by Se7ven Labs unless the audit reveals a breach, in which case the licensee reimburses.

---

*Owned by Se7ven Labs LLC. Internal corporate record; no license described here has been offered to a counterparty, executed, or invoiced.*
