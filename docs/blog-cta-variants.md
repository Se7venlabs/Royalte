# Royaltē Blog CTA Library

**Purpose:** Reusable CTA variants for blog articles. Each CTA is paired with usage notes so the right CTA gets matched to the right article's emotional arc.

**Architecture rule:** CTAs live in `_template.html` as baked-in elements per the existing convention. To use a CTA variant on a specific article, the variant lives here; the template is updated once and propagates to all articles. **Do NOT add custom CTAs per article** — that breaks A/B testing capability.

**SEO note:** CTA copy itself is not a ranking signal. CTAs affect SEO indirectly by improving dwell time, internal click-through, and bounce rate. The keyword opportunities below are for the CTA *body copy* (the few sentences under the headline), where naturally weaving target keywords reinforces the article's SEO theme without keyword stuffing.

---

## COLD READER CTAs (6 variants)

**Audience:** First-time blog visitor, found article via search, never scanned, no relationship with Royaltē yet.
**Friction profile:** Lowest possible. Free, no signup, no payment.
**Destination:** `/#scan-tool` (free scan on homepage) — unified for all cold CTAs to preserve A/B testing.
**Tone goal:** Curiosity → low-commitment action.

---

### COLD-01 · "Diagnostic"

**Pairs with:** Articles ending on a "you might have a problem you can't see" emotional state.

**Headline:**
> Find out what your catalog is actually doing.

**Body:**
> Royaltē scans your music catalog and surfaces metadata problems, publishing gaps, and royalty risks before they turn into long-term catalog damage. No signup. No card. Just a verified scan.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords to weave in body:** music metadata problems, royalty risks, publishing gaps

---

### COLD-02 · "Specific Fear"

**Pairs with:** Articles that named specific royalty sources (SoundExchange, MLC, PROs) the reader didn't know existed.

**Headline:**
> You may be missing royalties you never knew existed.

**Body:**
> Most independent artists never check whether their SoundExchange, MLC, publishing, and PRO registrations are actually in place. Royaltē scans your catalog and tells you what's missing — in seconds, for free.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords to weave in body:** SoundExchange missing royalties, MLC royalties, PRO registration music, missing music royalties

---

### COLD-03 · "Confidence Check"

**Pairs with:** Articles that argued the reader's assumptions about their catalog are wrong.

**Headline:**
> Don't assume your catalog is fine. Verify it.

**Body:**
> Streaming numbers don't tell you whether your metadata, publishing, and registrations are actually clean. Royaltē runs a verified scan against your catalog — no guesswork, no estimates — and shows you exactly what's at risk.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords:** music metadata problems, broken music metadata, independent artist backend, royalty tracking

---

### COLD-04 · "Catalog Hygiene"

**Pairs with:** Articles framed around DIY responsibility, the artist-as-mini-label angle, or "the system doesn't catch your back anymore."

**Headline:**
> Your catalog is your business. Treat it like one.

**Body:**
> Every release adds to the infrastructure you're now responsible for — metadata, registrations, publishing, rights. Royaltē scans your catalog and surfaces the gaps the system won't show you. Free, instant, and built for independent artists.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords:** catalog management, DIY artist music business, independent artist backend, metadata intelligence

---

### COLD-05 · "Money Quietly"

**Pairs with:** Articles emotionally pitched at "you're working hard but the money doesn't add up."

**Headline:**
> The streams are there. Where's the money?

**Body:**
> If your streaming numbers don't match what's actually paying out, the problem is usually one layer underneath — broken metadata, missing publishing, or routing errors no one ever shows you. Royaltē finds them for free.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords:** missing streaming royalties, music royalty leaks, music royalty problems

---

### COLD-06 · "Before It Breaks"

**Pairs with:** Articles emphasizing speed, AI-era release cycles, or fragile-catalog risk.

**Headline:**
> Find catalog problems before they cost you.

**Body:**
> Disputes, missed payments, and rights conflicts almost always start with metadata problems that were quietly building for months. Royaltē catches them while they're still fixable. No signup, no card, no commitment.

**Button:** `Run Your Free Royaltē Scan →`

**SEO keywords:** music metadata problems, music rights infrastructure, royalty monitoring

---

## WARM READER CTAs (6 variants)

**Audience:** Reader who has already done a free scan (or knows enough about Royaltē to skip that step). They want the full picture or ongoing protection.
**Friction profile:** Higher commitment — paying. $19.99 one-time or $29.99/mo.
**Destination:** `/pricing.html` (pricing/plans page — to be built pre-launch) so warm readers choose Full Audit vs. Monitoring.
**Tone goal:** Trust → paid commitment.

**IMPORTANT:** Warm reader CTAs are for POST-BETA use. Current beta is using the "Founding Artist Spots" framing as the locked final-cta. Do not swap to warm CTAs until the Founding Artist beta closes (planned post-June-1 launch).

---

### WARM-01 · "Get the Full Picture"

**Pairs with:** Articles that previewed a problem and left the reader wanting depth.

**Headline:**
> See exactly what's broken — and what to do about it.

**Body:**
> The free scan tells you where the risks are. The full audit gives you the complete breakdown: every issue, every action step, every gap, every fix. One report, $19.99, downloadable PDF.

**Button:** `Get Your Full Audit — $19.99 →`

**Destination:** `/pricing.html` (or direct to Full Audit checkout)
**SEO keywords:** royalty monitoring, music rights infrastructure, metadata intelligence

---

### WARM-02 · "Ongoing Protection"

**Pairs with:** Articles about ongoing risk, fragile catalogs, things changing without notice.

**Headline:**
> Your catalog changes every week. So should your audit.

**Body:**
> Releases drop, metadata shifts, platforms update, registrations age. Royaltē Monitoring scans your catalog weekly and alerts you the moment something changes. $29.99/month for continuous catalog protection.

**Button:** `Start Royaltē Monitoring →`

**Destination:** `/pricing.html`
**SEO keywords:** royalty monitoring, royalty tracking, music rights infrastructure

---

### WARM-03 · "Insurance Framing"

**Pairs with:** Articles emphasizing risk, liability, or "this could blow up later."

**Headline:**
> Insurance is what you wish you had after something breaks.

**Body:**
> Most artists discover their catalog is broken when a dispute, audit, or missed payment forces them to look. Royaltē watches it for you continuously, so you find issues while they're still small. Full Audit from $19.99. Monitoring from $29.99/month.

**Button:** `See Plans →`

**Destination:** `/pricing.html`
**SEO keywords:** independent artist backend, music rights infrastructure, royalty monitoring

---

### WARM-04 · "Built By Artists" (identity-led)

**Pairs with:** Articles that lean hard on the DIY-artist identity, the systems-overload arc, or "no one ever taught us this."

**Headline:**
> You weren't supposed to figure this out alone.

**Body:**
> Royaltē was built by independent artists who got tired of watching catalogs break in silence. Full Audit shows you what's wrong. Monitoring watches your catalog the way a label's back office used to. Either way, you stop guessing.

**Button:** `Choose Your Royaltē Plan →`

**Destination:** `/pricing.html`
**SEO keywords:** DIY artist music business, independent artist backend, music rights infrastructure

---

### WARM-05 · "Specificity over Persuasion"

**Pairs with:** Articles where the reader has been walked through specific technical issues (ISRC, splits, contributor mismatches).

**Headline:**
> Every issue. Every fix. Every gap.

**Body:**
> Royaltē identifies ISRC conflicts, registration gaps, publishing mismatches, metadata errors, and royalty risks across your full catalog. The Full Audit gives you the complete diagnostic plus action steps for each finding.

**Button:** `Get Your Full Audit — $19.99 →`

**Destination:** `/pricing.html`
**SEO keywords:** music metadata problems, broken music metadata, music ownership issues, metadata intelligence

---

### WARM-06 · "Clean Catalog" (legacy framing)

**Pairs with:** Articles that closed on the "future belongs to clean catalogs" positioning line, or any "build something that lasts" arc.

**Headline:**
> Clean catalogs aren't built by accident.

**Body:**
> The artists building catalogs that will hold up over the next decade aren't just making better music — they're treating their backend like infrastructure. Royaltē helps you audit it now and protect it ongoing. From $19.99.

**Button:** `Build A Clean Catalog →`

**Destination:** `/pricing.html`
**SEO keywords:** catalog management, music rights infrastructure, metadata intelligence

---

## How to use this library

**When formatting a new article:**

1. Read the article's emotional arc — where does it leave the reader?
2. Match a cold CTA (mid-article position) and a warm CTA (final position, post-beta) from the variants above
3. Note the pairing in the article's PR description for future tuning

**When changing the CTAs site-wide:**

1. Pick the new mid-article CTA + new final CTA from this library
2. Update `_template.html` once with the new copy
3. Open a single PR that propagates to all blog articles
4. Track conversion impact for 2-3 weeks before changing again

**When adding new variants to this library:**

1. Number them sequentially (COLD-07, WARM-07, etc.)
2. Include the same fields: headline, body, button, destination, pairs-with notes, SEO keywords
3. Test the variant on one article before promoting to site-wide use

---

## Out of scope for this library

These are decisions, not CTAs:

- The "Founding Artist 1,000 Spots" beta CTA — stays as-is until beta ends post-June-1
- A/B test infrastructure — variant rotation logic doesn't exist yet
- Direct-to-Stripe-checkout from CTAs — pricing page is the staging area; direct checkout is a future optimization
- Pricing page itself — does not yet exist, must be built pre-launch as a prerequisite for warm CTAs going live

---

*Last updated: 2026-05-15*
