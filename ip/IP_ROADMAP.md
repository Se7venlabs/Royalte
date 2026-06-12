# IP ROADMAP

**Owner:** Se7ven Labs LLC
**Status:** living document — additions appended; commitments are versioned by date and supersede earlier statements.
**Effective:** 2026-06-11

The Vault's forward-looking instrument: what IP Se7ven Labs LLC has now, what it has identified but not yet acted on, and what the Board anticipates pursuing. The roadmap is **not** a binding plan — it is a registry of intent, useful to counsel, the CFO, and prospective investors.

Companion files: `TRADEMARKS.md`, `PATENTS.md`, `COPYRIGHTS.md`, `TRADE_SECRETS.md`, `PRODUCT_REGISTRY.md`, `LICENSING.md`.

---

## 1. Existing IP

IP Se7ven Labs LLC owns today, with documented first use and (where applicable) protection in place.

### 1.1 Trademarks (common-law, asserted)

The PLANNED register in `TRADEMARKS.md` covers 36 marks. Common-law assertions accrue through documented commercial use; the marks with the strongest current evidence are:

- **Royaltē™**, **Royaltē Mission Control™**, **Royaltē Audit™** — public-facing surfaces with continuous use since May 2026.
- **Royaltē Intelligence Engine™**, **Royaltē Identity Graph™**, **Royaltē Canonical Intelligence Object™**, **Royaltē Rule Library™**, **Royaltē Health Engine™**, **Royaltē Golden Fixture Library™** — engineering-tier marks with git-anchored first use.
- **Royaltē Engineering Stack™**, **Royaltē Governance Layer™**, **Royaltē Boot Sequence™** — documentation marks anchored in the Constitution and `CLAUDE.md`.
- **Music Backend Intelligence™** — category mark, first used 2026-05-29.

### 1.2 Copyrights (automatic at fixation)

The full register lives in `COPYRIGHTS.md`. The high-value blocks:

- Source code for every locked engine and adapter (Phases 2 – 7).
- Royaltē Master Constitution v1.0 → v1.3.
- Royaltē Review PDF template + render pipeline.
- Locked UI surfaces (Scan V1, Mission Control V1, Signal Meter).
- Brand assets (Royaltē wordmark, Royaltē Orb™, Se7ven Labs logo).

### 1.3 Trade secrets (maintained)

The full register lives in `TRADE_SECRETS.md`. The categories:

- Health scoring weighting / threshold derivation.
- Identity matching heuristics and `royalteId` allocation.
- Recording ↔ composition reconciliation procedure.
- Confidence-score derivation.
- AI Executive Runtime orchestration topology + prompt corpora.

### 1.4 Constitutional / governance assets

- Royaltē Master Constitution v1.3.
- Royaltē Engineering Stack™ (Constitution § 8B + companion doc).
- Royaltē Governance Layer™ (`/governance/*`).
- Royaltē Boot Sequence™ (`CLAUDE.md`).

---

## 2. Pending IP

IP identified, scoped, and awaiting a disposition decision by the Board.

### 2.1 Trademarks pending classification + filing

Counsel review of the 36 PLANNED marks → consolidated filing strategy. Anticipated order of priority:

1. **Se7ven Labs™** (umbrella house mark).
2. **Royaltē™** (primary product mark, with the locked spelling — see `BRAND_GUIDELINES.md` § 9.1).
3. **Music Backend Intelligence™** (category mark — protects positioning).
4. **Royaltē Health Engine™ · Royaltē Intelligence Engine™ · Royaltē Identity Graph™** (engineering-tier marks with deepest first-use evidence).
5. The remaining 30 PLANNED marks in tranches as the platform expands.

Jurisdictions: United States · Canada · (anticipated) European Union.

### 2.2 Patent candidates under review

The candidate methodologies in `PATENTS.md` § Candidates → counsel's prior-art analysis (`PRIOR_ART.md`) → Board disposition (patent · defensive publication · trade secret). Top candidates:

- Constitutional separation pattern for intelligence systems.
- Provider-isolated normalisation adapter pattern.
- Royaltē Identity Graph™ multi-provider reconciliation.
- Royaltē Canonical Intelligence Object™ assembly pattern.
- Declarative Rule Library™ + generic Intelligence Engine pair.
- Royaltē Health Engine™ scoring pattern.

### 2.3 Copyright registrations pending Board authorisation

- U.S. Copyright Office registration of the locked engines (Phases 2 – 7) as a single platform release.
- U.S. Copyright Office registration of the Royaltē Master Constitution v1.3.
- CIPO registration of the Royaltē™ wordmark + Royaltē Orb™.

---

## 3. Future Trademarks

Marks anticipated but not yet ratified. Add to this list before adding to `TRADEMARKS.md`.

| Mark | Anticipated context | Notes |
|---|---|---|
| Royaltē OS™ | Operating-system framing of the platform. | First public use anticipated as the V3 scan experience matures. |
| Royaltē Catalog Health™ | Catalog-only health sub-product. | Decomposition of Royaltē Health™ as Phase 8+ wiring lands. |
| Royaltē Publishing Health™ | Publishing-only health sub-product. | Same as above. |
| Royaltē Identity Health™ | Identity-only health sub-product. | Same as above. |
| Royaltē Revenue Score™ | Revenue-side analogue of the Health Score. | When Royaltē Revenue Intelligence™ first ships. |
| Royaltē Backend Pulse™ | Continuous-monitoring product framing. | Successor to monthly review cadence. |
| Royaltē Intelligence Network™ | Cross-artist insight surface. | Long horizon. |

---

## 4. Future Patents

Patent candidates the Board has not yet ratified but is monitoring:

- Multi-provider music-rights reconciliation method (Identity Graph + adapter combination).
- Deterministic intelligence-report scoring with Board-locked weights and reserved future-section invariance.
- Append-only repository-level governance pattern with phase-merge binding.
- Royaltē Executive Runtime™ orchestration topology (alternative: trade secret + defensive publication of the public abstraction).

---

## 5. Future Licensing

Surfaces the Board anticipates offering under license — see `LICENSING.md` for terms.

| Surface | Anticipated license type | Earliest plausible offer |
|---|---|---|
| Royaltē Health Engine™ | API · SDK · Enterprise | Post-Phase 8 wiring completion. |
| Royaltē Identity Graph™ | API · Enterprise | After two additional adapter integrations land. |
| Royaltē Monitoring™ | Subscription · Enterprise | Beta launch (June 1, 2026). |
| Royaltē Mission Control™ | White Label | Post-beta. |
| Royaltē Executive Brief™ | Subscription | Post-beta. |
| Royaltē Revenue Intelligence™ | Enterprise | When the Revenue layer ships. |

---

## 6. Future Products

Products on the Royaltē / Se7ven Labs roadmap not yet locked. Aligned with `governance/ROADMAP.md` "8+ (per future Board directives)".

- **Engine Wiring → `/api/audit`** — wire `assembleCio` + `runIntelligenceEngine` + `computeHealthScore` into the live scan path; persist alongside the canonical AuditResponse.
- **Royaltē Executive Brief™ runtime** — generate the locked Executive Brief from CIO + Intelligence Report + Health Report.
- **Royaltē Monitoring™ recurring schedule** — cron-driven rescans + delta-engine diff + subscriber-gated notification.
- **Royaltē Revenue Intelligence™** — populate `CATEGORIES.REVENUE`; introduce revenue-side rules; ship the first revenue surface.
- **Royaltē AI Executive™ public personas** — externally addressable Avery Cole · Ellie Morgan personas.
- **Royaltē API** — public-facing programmatic surface.
- **Royaltē SDK** — first-class client libraries for partners.
- **Royaltē White Label** — partner-deployable Royaltē Mission Control™.

---

## 7. Future Commercialization

Commercial mechanics the Board has begun thinking about — captured here so the roadmap remains coherent.

- **Free Scan → Paid Monitoring → Enterprise License** funnel. Health Score visible at the free tier; subscriber-gated capabilities behind the paywall.
- **Enterprise licensing of the Identity Graph** — for labels, distributors, and rights-management organisations that want the reconciliation layer without building it.
- **OEM licensing of the Health Engine** — for adjacent SaaS products that want to embed the Royaltē Health Score™ in their own surfaces.
- **White-label Mission Control** — for label groups, management companies, and music-industry services that want a branded post-scan surface.
- **Defensive publication strategy** — establish prior art for the constitutional separation pattern and append-only governance pattern so competitors cannot patent them.

---

## 8. Future Strategic Assets

Long-horizon assets the Board considers strategically valuable to acquire, build, or partner around:

- **Owned dataset of reconciled music-rights identity** — the Identity Graph populated continuously becomes a strategic asset in its own right.
- **The Royaltē Executive Brief™ corpus** — every brief delivered to every artist becomes a longitudinal observational dataset.
- **Royaltē OS™ as a platform** — the AI Executive Runtime + constitutional governance generalised to additional Se7ven Labs products.
- **A public defensive-publication footprint** — to keep the constitutional patterns out of competitor hands.
- **Strategic domain portfolio** — primary `royalte.*` family + `se7venlabs.ai`. Registered domains listed in `DOMAIN_REGISTRY.md`.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing. Forward-looking statements are intent, not commitment.*
