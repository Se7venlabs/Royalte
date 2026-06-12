# DOMAIN REGISTRY

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

Owned, watched, and reserved internet domains. Each row records the registrar, dates, owner, DNS posture, auto-renewal flag, status, and any notes (e.g., production vs. parked vs. redirect). The register is the canonical reference for renewal — counsel and the CFO use it to make sure no domain expires by oversight.

> The renewal dates listed are illustrative tracking placeholders. The authoritative renewal date is the one held by the registrar; this file mirrors that authority but does not replace it.

---

## Owned domains

| Domain | Registrar | Purchase Date | Renewal Date | Owner | DNS | Auto Renew | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| `royalte.ai` | TBD | TBD | TBD | Se7ven Labs LLC | TBD (production candidate) | ON (target) | RESERVED | Primary product domain — anticipated production host. |
| `royalte.ca` | TBD | TBD | TBD | Se7ven Labs LLC | TBD | ON (target) | RESERVED | Canadian jurisdiction domain. |
| `royalte.com` | TBD | TBD | TBD | Se7ven Labs LLC | TBD | ON (target) | RESERVED | Highest-value defensive TLD for the Royaltē™ brand. |
| `royalte.app` | TBD | TBD | TBD | Se7ven Labs LLC | TBD | ON (target) | RESERVED | App-store-aligned TLD. |
| `royalte.io` | TBD | TBD | TBD | Se7ven Labs LLC | TBD | ON (target) | RESERVED | Developer-aligned TLD (suggested in `README.md`). |
| `se7venlabs.ai` | TBD | TBD | TBD | Se7ven Labs LLC | TBD | ON (target) | RESERVED | Corporate umbrella domain for Se7ven Labs LLC. |

---

## Domains the CFO + Executive Sponsor monitor for opportunistic acquisition

These are *not yet owned* but the Board has identified them as worth pursuing if they become available.

| Domain | Reason to monitor |
|---|---|
| `royaltē.ai` (with `ē`) | Punycode equivalent of the locked spelling; defensive registration. |
| `royaltehealth.com`, `royalteintelligence.com`, `royaltereview.com` | Sub-product domains. |
| `musicbackendintelligence.com` | Category-mark defence. |
| `royalte.xyz`, `royalte.tech`, `royalte.dev` | Defensive secondaries. |

---

## DNS posture

The authoritative DNS posture for each owned domain is **set by the deployment platform** (Vercel, when active) and reflected here in summary form only. Detailed DNS records (A / AAAA / CNAME / TXT / MX) are documented in the operations runbook, not in this Vault file, because the Vault is the *IP* record and DNS records are operational.

For Vercel-hosted domains: the DNS configuration follows the platform's published guidance, with SSL automatic. See `CLAUDE.md` § Custom domain for the original guidance.

---

## Renewal policy

- **Auto-renew ON** for every owned domain. The CFO confirms this annually.
- **30-day pre-expiry alert** configured on every domain at the registrar; mirror alert on the Executive Sponsor's calendar.
- **No domain is allowed to expire** without an explicit Board decision recorded in `governance/BOARD_DECISIONS.md`.

---

## Conventions

- One row per domain. Sub-domains (e.g., `dashboard.royalte.ai`) are not listed here; they are operational, not registered.
- `Purchase Date` and `Renewal Date` are filled in from the registrar's record; `TBD` indicates the row has been reserved but not yet confirmed by counsel + CFO against the registrar.
- `Status` values: `RESERVED` (recognised but not yet confirmed registered) · `OWNED` (confirmed in the registrar) · `PRODUCTION` (DNS pointing at a live service) · `PARKED` (registered but not pointed) · `REDIRECT` (registered and 301'd to another domain) · `LAPSED` (allowed to expire — by explicit Board decision only) · `RECOVERED` (re-acquired after lapse).
- `Notes` documents the strategic purpose of each domain.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
