# Royaltē — Handoff Brief
## For Next Session Start

**Handoff date:** Saturday, May 9, 2026
**Owner:** Darryl West (Se7ven Labs Inc.)
**Project:** Royaltē — Music Audit Intelligence Platform
**Live URL:** royalte.ai
**Status:** Pre-paywall beta. Production healthy. Ready to begin Phase 1 paid product build.

---

## How to Start the Next Session

Open a fresh Claude chat and paste this opener:

> *"Picking up Royaltē build. Reading from ROYALTE_BUILD_SPEC.md and ROYALTE_HANDOFF_BRIEF.md. Starting Sprint 1: Foundation work. Ready to begin Stripe product configuration + Supabase schema additions."*

Attach both documents to the chat. Claude will re-orient from these files instead of re-asking questions you've already answered.

---

## Current State of Production

### Live & Working
- **Free audit flow** at royalte.ai — instant PDF delivery via Resend
- **6-module audit engine** scanning Spotify + Apple Music against MusicBrainz, Deezer, AudioDB, Discogs, SoundCloud, Last.fm, Wikidata, YouTube
- **Apple Music JWT auth** stable post-rotation (env var auto-repair logic in place)
- **PDF generation** via `generate_royalte_pdf.py` (4-page, light-theme, DejaVu fonts)
- **Submit-audit endpoint** triggers Resend email with download link
- **Beta access banner** on homepage ("FIRST 200 ARTISTS GET A FULL ROYALTĒ AUDIT FREE")
- **3 nav CTAs working correctly:** "Run Free Scan" (hero button), "REQUEST FULL AUDIT" (top-right, gated by scan completion), "GET MY FULL AUDIT" (in audit results panel)

### Parked but Preserved
- `pricing.html` — exists in repo, redirects to homepage via vercel.json
- `dev-spec.html` — same pattern
- `dashboard.html` — same pattern
- All three unpark with single-line vercel.json edit when ready

### Known Issues
- **Tidal integration:** 95% built, parked pending Tidal-side approval for catalog API scope. Email Tidal developer support requesting catalog scope for client ID `2H1oU0ouhI7kbWBR`.
- **Apple-only fixture in `pipeline-test.mjs`:** test gap, on Code's task list (low priority)

---

## Today's Wins (May 9, 2026)

Six commits shipped to production via Deploy Discipline:

| # | Hash | What |
|---|---|---|
| 1 | `4c36b32` | Beta-state hygiene merge (10 commits — copy alignment, page parking, nav cleanup) |
| 2 | `1c4d19b` | Hero button rename: "Run Free Audit" → "Run Free Scan" |
| 3 | `5f83335` | Top-right nav button wired to `openAuditModal()` |
| 4 | `b86976b` | Top-right nav button gated — pre-scan scrolls to paste box, post-scan opens modal |

Plus: Complete product spec session lockdown (see ROYALTE_BUILD_SPEC.md).

---

## Locked Product Decisions (DO NOT RE-LITIGATE)

These are spec-locked. Next session does not re-discuss these — execute on them.

### Pricing
- **Audit Only:** $19.99 one-time (Stripe one-time payment)
- **Monitoring:** $29.99/month OR $299/year ("save $60") (Stripe recurring)
- First 200 audits FREE during beta, then paywall activates

### Audit Only delivers
- One-time Full Audit emailed to artist
- No daily scans, no weekly reports, no monitoring
- Past audit access retained

### Monitoring delivers (while subscription active)
- Initial Full Audit at signup (emailed)
- Daily lightweight scans (platform availability, broken links, major metadata changes, recent releases, UGC movement, alert-triggering deltas)
- Weekly Friday deep scan (full audit re-run + score movement + unresolved issues)
- Weekly Friday email report (9am ET, single timezone)
- Critical email alerts (Tier 1 only)
- Basic dashboard pulsing-red alert indicator (Phase 1)
- Full dashboard with auth/history/resolve workflow (Phase 2)

### Alert Tier System
- **Tier 1 — Critical:** Immediate email + dashboard pulsing red. Track disappears, ISRC missing, platform coverage drops, ownership inconsistency, etc.
- **Tier 2 — Notable:** Weekly digest + dashboard. Metadata mismatches, score >5 movement, unresolved issues
- **Tier 3 — Informational:** Dashboard only. Daily scan complete, no material change, minor moves

### Cancellation
- Cancel only at launch, no pause
- Past audit retained
- All monitoring stops on cancel

### Positioning (Immutable)
> *"Royaltē does not collect royalties. Royaltē monitors catalog/backend infrastructure and identifies risks using Verified Data Only."*

---

## Phase 1 Launch Plan (~36 hours work)

Per ROYALTE_BUILD_SPEC.md Section 11, build in 5 sprints:

**Sprint 1 — Foundation (~10h):**
Supabase tables, Stripe products configured, feature flag library, branded success page, Stripe Checkout (Audit Only path), Stripe webhook handler.

**Sprint 2 — Paid Audit Flow (~8h):**
Paywall toggle in audit.html, 200-counter logic, end-to-end Audit Only test, Monitoring Checkout flow, end-to-end Monitoring test, success page conditional copy.

**Sprint 3 — Monitoring Backend (~10h):**
Daily scan cron, weekly deep scan cron, alert classification logic, auto-resolve logic.

**Sprint 4 — Email Delivery (~7h):**
Critical alert email, weekly Friday report email, drip sequence cron + 4 templates, end-to-end email path testing.

**Sprint 5 — Polish (~3h):**
Basic dashboard pulsing-red indicator, full launch checklist run-through.

**Realistic timeline at 2-3 hours/day pace:** 3-4 weeks Phase 1 + 3 weeks Phase 2 = **6-7 weeks to fully-realized product.**

---

## Critical Pre-Build Items (Handle Before Sprint 1)

Two non-coding items that block coding sessions:

### 1. Confirm Vercel Tier
- **Current state:** Project tagged "Hobby" in Vercel dashboard
- **Problem:** Hobby caps cron at 2 invocations/day
- **Phase 1 spec needs 4 cron jobs:** daily scan, weekly deep scan, drip queue, alert auto-resolve
- **Decision needed:** Upgrade to Pro ($20/month) OR consolidate all 4 jobs into single endpoint with time-branching logic

### 2. Configure Stripe Products
- **Current state:** Stripe account exists, products do not
- **Action:** ~30 minutes manual UI work in Stripe dashboard
- **Create:**
  - "Audit Only" — One-time, $19.99 USD
  - "Monitoring Monthly" — Recurring, $29.99/month
  - "Monitoring Annual" — Recurring, $299/year
- **Capture:** Product IDs and Price IDs for env vars
- **Best done:** Outside coding session (brain-dead clicking)

Once both done, Sprint 1 can start cleanly.

---

## Working Style (CRITICAL — preserved across sessions)

These patterns are why ship velocity is high. Do not deviate.

### Code Discipline
- **Atomic commits, one task per commit** — no kitchen-sink merges
- **Always test against Vercel preview before merging** — Deploy Discipline rule in CLAUDE.md
- **Per-action approval discipline** — always decline "don't ask again" prompts
- **Single quotes around URLs in curl** — `'https://example.com'` not `"https://..."`
- **`!` prefix in Code TUI for shell commands**
- **Production probes:** hit `https://www.royalte.ai/...` to skip apex 307
- **Vercel CLI:** `npx --yes vercel ls royalte` (not installed globally)
- **Discovery before edits** — read current state first, never edit blind
- **Sanity check after surgical edits** — `grep` to verify zero matches of removed strings

### Communication Style
- **Concise briefs, surgical edits** — "duplicate X onto Y" works better than 4-phase strategic conversations
- **No multiple-choice questions in coding briefs** — inline prose only
- **Direct redirect when sessions become exploratory without resolution**
- **Show diff before committing** — always
- **One confirmed change at a time before proceeding**

### Architecture Warnings
- **GitHub `main` ≠ deployed state** — has been observed out of sync. Always treat uploaded files or browser View Source as authoritative baseline.
- **Local code reads can disagree with production reality** — empirical user testing > grep findings.
- **Domain rule (CRITICAL):** royalte.ai = live app/platform (`/api/audit`, `/api/submit-audit` live here). royalteaudit.com = landing page ONLY (separate Vercel project, separate Supabase project). Never conflate.

---

## What NOT to Build in Phase 1 (Anti-Scope-Creep)

- ❌ Login/signup system
- ❌ User dashboard with full data binding
- ❌ Alert history viewer
- ❌ Subscription management UI (use Stripe customer portal direct link instead)
- ❌ Pause feature
- ❌ Manual alert resolution
- ❌ Per-user timezone scheduling
- ❌ Mobile app
- ❌ Multi-artist accounts (one email = one catalog)

These are intentional Phase 2 scope. Resist any urge during Sprint 1-5.

---

## Drip Email Sequence Status

User has finalized 4-email drip copy (Email #1 immediate, #2 Day 2, #3 Day 5, #4 Day 10).

**Themes:**
- Email #1: Shock + risk recap ("Your music isn't the problem. Your backend is.")
- Email #2: Invisible loss + ongoing leakage
- Email #3: Protection/security framing
- Email #4: Scarcity close

**Reframe needed before shipping:**
- Current copy says "unlock your audit" — but audits ship instantly today
- CTAs need real Stripe destinations (currently `{{AUDIT_URL}}` / `{{MONITORING_URL}}` placeholders)
- Reframe: audit was free, **monitoring is the upsell** at $29.99/mo

**Build order:** Reframe copy → write actual Stripe destination links → build cron + queue logic → ship.

---

## Repo Structure (Quick Reference)

```
/Users/darrylwest/code/Royalte
├── api/                       (existing serverless endpoints)
│   ├── audit.js               (audit engine)
│   ├── submit-audit.js        (form handler + Resend trigger)
│   ├── apple-token.js         (Apple JWT with auto-repair)
│   └── _lib/
├── public/                    (static frontend)
│   ├── index.html             (homepage, ~800KB)
│   ├── audit.html             (audit results page)
│   ├── adjustments.html       (admin/internal page)
│   ├── faq.html, contact.html, terms.html
│   ├── pricing.html           (PARKED)
│   ├── dev-spec.html          (PARKED)
│   └── dashboard.html         (PARKED)
├── tests/
│   └── pipeline-test.mjs      (audit engine tests)
├── generate_royalte_pdf.py    (PDF generator)
├── vercel.json                (deployment config + redirects)
├── CLAUDE.md                  (Deploy Discipline + working style)
└── ROYALTE_BUILD_SPEC.md      (this build's master spec)
```

---

## Environment Variables (Currently Set)

```
RESEND_API_KEY              ✅
SUPABASE_URL                ✅
SUPABASE_SERVICE_KEY        ✅
SPOTIFY_CLIENT_ID           ✅ (rotated April 2026)
SPOTIFY_CLIENT_SECRET       ✅ (rotated April 2026)
APPLE_TEAM_ID               ✅
APPLE_KEY_ID                ✅
APPLE_PRIVATE_KEY           ✅ (auto-repair logic in api/apple-token.js)
DISCOGS_TOKEN               ✅ (rotated April 2026)
YOUTUBE_API_KEY             ✅ (rotated April 2026)
TIDAL_CLIENT_ID             ✅ (2H1oU0ouhI7kbWBR)
TIDAL_CLIENT_SECRET         ✅
```

To be added in Sprint 1:
```
STRIPE_SECRET_KEY                    🟡
STRIPE_WEBHOOK_SECRET                🟡
STRIPE_PRICE_AUDIT_ONLY              🟡
STRIPE_PRICE_MONITORING_MONTHLY      🟡
STRIPE_PRICE_MONITORING_ANNUAL       🟡
PAYWALL_ENABLED=false                🟡
DRIP_ENABLED=false                   🟡
MONITORING_ENABLED=false             🟡
DASHBOARD_ENABLED=false              🟡
EMAIL_FROM=info@royalte.ai           🟡
EMAIL_FROM_NAME=Royaltē              🟡
```

---

## Brand & Visual System

- **Primary green accent:** `#22c55e`
- **Purple secondary gradient:** `#8A5CFF → #E040C8`
- **Dark cinematic aesthetic** with monospace code-comment styling
- **JetBrains Mono** primary font
- **`ē` accent character** is critical to logo rendering (must always render, not as a box)

---

## Memory & Context Hygiene

User memory edits already capture:
- Run Full Audit trigger pattern
- Royaltē audit consistency checklist
- PDF generation specs
- Domain rules (royalte.ai vs royalteaudit.com)
- Tidal integration status
- Bolaji removed from forward scope (memory edit #9)

Next session does not need to re-establish these. They persist via Claude memory.

---

## What "Done" Looks Like

End of Phase 1 (~3-4 weeks from spec lockdown):
- ✅ Stripe products live, can accept real payments
- ✅ 200-free-audit counter active, paywall flips automatically
- ✅ Audit Only purchase flow works end-to-end
- ✅ Monitoring purchase flow works end-to-end
- ✅ Daily lightweight scans running on cron
- ✅ Weekly Friday deep scans running on cron
- ✅ 3-tier alert system classifying issues correctly
- ✅ Critical alert emails sending via Resend
- ✅ Weekly Friday reports sending via Resend (9am ET)
- ✅ 4-email drip sequence sending via Resend
- ✅ Branded post-purchase success page live
- ✅ Basic dashboard pulsing-red indicator working
- ✅ All gated by feature flags — single env var flips activate launch

---

## Final Note from May 9 Session

User shipped 4 surgical commits today through clean Deploy Discipline flow. Working pattern is:
1. Discovery (read current state)
2. Surgical edit brief (specific, narrow)
3. Diff review
4. Branch + commit + push
5. Vercel preview verify (browser test)
6. Merge to main
7. Production verify (curl probes)
8. Delete local branch (preserve remote 48h)

This pattern works. Don't break it.

---

**End of handoff brief.**
