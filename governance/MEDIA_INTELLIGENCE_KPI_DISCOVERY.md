# Media Intelligence™ — KPI Discovery

**Status:** Executive Board Direction — design/strategy deliverable, no code or UI built.
**Source of truth:** `governance/MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md` — every card below traces to a specific finding in that document; nothing here introduces evidence the audit didn't already confirm real.
**Date:** 2026-07-22
**Updated 2026-07-22:** each card below now records its **Primary Executive Business Question**, per the newly-ratified Executive Question Framework™ (`constitution/ROYALTE_MASTER_CONSTITUTION.md` §4.21). This document is the first real application of that framework — every question below is the Board's own wording from the framework brief.

---

## How this was built

Every raw evidence cluster from the audit was tested against one question: *if this artist's manager saw only this number, would they know what to do next?* Where the answer was no, the raw fact was either elevated into a real derived concept (see the audit's §6 Derived Intelligence Opportunities for what's legitimately derivable), merged with another thin signal into something with more executive weight, or dropped. Six raw statistics the Board explicitly flagged as insufficient — Subscriber Count, View Count, Video Count, Follower Count, Upload Count, and (by extension) a bare Website/Facebook link — do not appear as standalone cards anywhere below. Their real underlying evidence still powers the recommended cards; it's just never presented as a naked number.

One honest correction to the Board's own brief, flagged rather than silently absorbed: the brief's worked example ("Better Card: Audience Reach™ — ATHENA can explain: Audience growth...") assumes trend data. The evidence audit confirmed no historical snapshot mechanism exists for any provider today (§8, same gap class as Global Music Footprint™'s already-deferred Coverage Timeline™). Audience Reach™ below is recommended without a growth dimension — it would be evidence-first malpractice to ship a "growth" story on a single point-in-time scan. Growth is listed in §5 as a real future opportunity, not smuggled into today's version of the card.

---

## Recommended cards

Each card is scored qualitatively (High/Medium/Low, never a fabricated numeric score) against: Executive Value, Business Relevance, Actionability, Evidence Quality, Scalability, Future Expansion.

### 1. Media Platform Coverage™
**Mission:** Answer "how visible am I across the platforms that matter?" in one glance.
**Primary Executive Business Question:** "Where is my public media presence incomplete?" (per Board Executive Question Framework™, 2026-07-22)
**Business value:** An artist with real evidence on only one of three real media providers has a concrete, immediate gap — a manager can act on "we have no presence signal on TheAudioDB" the same day.
**Evidence used:** Presence/absence of a real evidence package per provider for this artist, across YouTube, Apple Music, and TheAudioDB (this workspace's real media scope, per the audit — not the full 14-provider roster, which includes non-media providers like MLC).
**Canonical providers:** YouTube, Apple Music, TheAudioDB — each independently canonical for its own presence signal; no single provider owns "coverage" as a concept.
**Fields consumed:** channel/artist resolution success per provider (already the same real signal Global Music Footprint™'s Provider Coverage™ pattern uses — evidence-package presence, not a fabricated "official" claim).
**Why it deserves dashboard space:** Directly reuses a pattern this platform has already shipped and validated (Global Music Footprint™), with the same honesty guarantee already proven there: never conflate "provider returned evidence" with "provider confirms an official channel."
**Scores:** Executive Value High · Business Relevance High · Actionability High (tells you exactly which provider to pursue) · Evidence Quality High (binary, unambiguous) · Scalability High (adds a row per new provider, zero redesign) · Future Expansion High (Meta/TikTok slot in the moment those connectors exist).
**ATHENA compatibility:** Yes — "You have a confirmed presence on YouTube and Apple Music, but no evidence found on TheAudioDB" is a real, defensible sentence.

### 2. Media Asset Completeness™
**Mission:** Answer "does my public media presence look complete and professional?"
**Primary Executive Business Question:** "Is my public brand presentation complete?" (per Board Executive Question Framework™, 2026-07-22)
**Business value:** Missing brand assets (no banner, no logo) is a concrete, fixable gap an artist's team can act on before a release, not a vanity metric.
**Evidence used:** Presence/absence of each real asset type — thumbnail/profile image, banner, logo, clearart — across YouTube (thumbnails, banner), Apple Music (artwork), TheAudioDB (thumb, wide thumb, logo, clearart, banner, fan art).
**Canonical providers:** TheAudioDB (canonical — broadest real asset-type range of any provider in the ecosystem), Apple Music (artwork), YouTube (channel visuals) as secondary contributors.
**Fields consumed:** `strArtistThumb/WideThumb/Logo/Clearart/Banner/Fanart1-4` (TheAudioDB), `attributes.artwork` (Apple), `thumbnails`/`bannerImageUrl` (YouTube) — all already wired to canonical.
**Why it deserves dashboard space:** A completeness score (X of Y real, standard asset types present) is real, non-speculative, and directly actionable — distinct from a raw asset count, since it frames the number against a real, defined set of asset types rather than presenting an unanchored count.
**Scores:** Executive Value Medium-High · Business Relevance Medium-High (visual brand presence matters commercially, if secondary to revenue-facing cards elsewhere in the platform) · Actionability High (tells you exactly which asset is missing) · Evidence Quality High · Scalability High · Future Expansion Medium (grows if new visual-asset fields appear on any provider).
**ATHENA compatibility:** Yes — "Your TheAudioDB profile is missing a banner and logo; your YouTube channel has no banner image" is real and defensible.

### 3. Content Activity Status™
**Mission:** Answer "is my content strategy healthy right now?" — the Board's own literal example question.
**Primary Executive Business Question:** "Is my content strategy active or dormant?" (per Board Executive Question Framework™, 2026-07-22)
**Business value:** A dormant channel is a real, actionable business signal (re-engage, plan a release-tied upload) distinct from a raw date.
**Evidence used:** Real upload timestamps (YouTube `publishedAt` per video, Apple Music video `releaseDate`, TheAudioDB video list) — once the documented, already-scoped translation step lands for YouTube/Apple (currently acquired only; TheAudioDB's video data is already wired). Classified into a small number of honest, threshold-based buckets (e.g. Active / Slowing / Dormant) derived from days-since-last-upload — a single real timestamp, not a trend.
**Canonical providers:** YouTube (primary — has the richest, most frequent upload cadence of any wired provider); TheAudioDB and Apple Music as secondary confirmation where their video data overlaps.
**Fields consumed:** `snippet.publishedAt` (YouTube, per video), `attributes.releaseDate` (Apple, per video), `strMusicVid`-linked timestamps where available (TheAudioDB).
**Why it deserves dashboard space:** This is the audit's own worked example of "richer than 'Latest Upload'" — a status classification an artist can act on ("we're in the Slowing tier") rather than a bare date that requires the reader to do their own mental math.
**Scores:** Executive Value High · Business Relevance High · Actionability High · Evidence Quality Medium-High (real timestamp, but the bucket thresholds are a genuine editorial judgment call — must be documented as configurable, board-set thresholds, not evidence itself, matching the precedent already established for Market Priority™'s tier ruleset in Global Music Footprint™) · Scalability High · Future Expansion High (becomes a real trend card the moment historical snapshots exist — see §5).
**ATHENA compatibility:** Yes, with a caveat that must be enforced in implementation — ATHENA may explain the current tier and its distance from the next threshold, but must not claim a trend or direction without real historical data.

### 4. Digital Presence™
**Mission:** Answer "do I have a professional, discoverable web/social footprint outside the streaming platforms?"
**Primary Executive Business Question:** "Can fans easily discover and connect with me?" (per Board Executive Question Framework™, 2026-07-22)
**Business value:** A missing official website or Facebook page is a concrete, fixable gap for an artist's team, distinct from any streaming-platform metric.
**Evidence used:** `strWebsite`, `strFacebook` (TheAudioDB) — the only two real, working link fields in the entire provider ecosystem today, per the audit. Twitter is explicitly excluded (provider-broken, filtered to null); Instagram/TikTok are explicitly excluded (no data exists anywhere).
**Canonical providers:** TheAudioDB — sole real source; no secondary or duplicate provider exists for this signal today.
**Fields consumed:** `strWebsite`, `strFacebook`.
**Why it deserves dashboard space:** Merges two individually-thin single-provider fields into one coherent presence signal, exactly the kind of consolidation the Board asked for — neither field alone justifies its own card, but together they answer one real question.
**Scores:** Executive Value Medium · Business Relevance Medium (real, but narrow — only two data points) · Actionability High (missing website/Facebook is directly fixable) · Evidence Quality Medium (single-provider, no cross-verification possible — must be labeled as such, not presented with false confidence) · Scalability Low today, High if Meta/TikTok/website-scraper connectors are ever built (this card is the natural landing zone for that future evidence with zero redesign) · Future Expansion High.
**ATHENA compatibility:** Yes, narrowly — "A public website was found; no Facebook page was found in reviewed sources" — must avoid implying platforms not checked (Instagram, TikTok) were checked and came back empty, since they were never queried at all.

### 5. Catalog Media Support™
**Mission:** Answer "how does my media presence support my music catalog?" — again, the Board's own literal example question, and the strongest, most executive-grade card this audit's evidence supports.
**Primary Executive Business Question:** "Which releases are under-supported by media?" (per Board Executive Question Framework™, 2026-07-22)
**Business value:** "3 of your last 5 releases have no supporting video" is a direct, prioritized action list tied to real releases an artist already knows and cares about — the single most business-relevant card in this set.
**Evidence used:** Cross-references real release data (already acquired via Apple Music's album catalog, the same evidence Catalog Intelligence™ already consumes) against real video data per release — Apple Music video `releaseDate`/`artistName` matched against a real album (high-confidence match), and TheAudioDB's `idAlbum`-linked video entries (already wired, structurally exact match, not text-heuristic). YouTube video-title text matching against a release name is explicitly excluded as a match source here — flagged in the audit as heuristic/lower-confidence, and this card's integrity depends on exact, not fuzzy, matches.
**Canonical providers:** Apple Music (release catalog + video catalog, single-provider exact match), TheAudioDB (structural album-to-video linkage) as a secondary, independent confirmation source.
**Fields consumed:** Apple `attributes.releaseDate`/`id` (albums) cross-referenced with Apple video `releaseDate`/`artistName`; TheAudioDB `idAlbum` cross-referenced with `strAlbum`/`idMVid`.
**Why it deserves dashboard space:** This is the audit's own answer to "is there a richer intelligence story than 'Videos'?" — not a count, a coverage gap tied to specific, real, already-known releases. It is the clearest example in this whole set of evidence becoming genuine executive intelligence rather than a restated statistic.
**Scores:** Executive Value Very High · Business Relevance Very High · Actionability Very High (names the specific release) · Evidence Quality High for the Apple/TheAudioDB exact-match path (explicitly Medium-Low and excluded for any YouTube text-matching path) · Scalability High (extends automatically as more releases and videos are wired) · Future Expansion High (a natural home for a future YouTube exact-match once a non-heuristic linking signal exists, e.g. video descriptions that reference a real ISRC).
**ATHENA compatibility:** Yes, strongly — this is the card most suited to a genuinely useful ATHENA sentence: "Your release 'Freedom' has no video support across any reviewed platform; your 2 most recent releases before it both have official videos."

### 6. Audience Reach™
**Mission:** Answer "where is my audience, and how concentrated is it?" — not "how many fans do I have."
**Primary Executive Business Question:** "Where is my audience today?" (per Board Executive Question Framework™, 2026-07-22 — deliberately without a growth clause; see the correction at the top of this document)
**Business value:** Real per-platform reach numbers, read honestly (not summed across incompatible platforms), tell a manager where to focus content/marketing effort.
**Evidence used:** YouTube `subscriberCount`/`viewCount` (richest, wired), with Spotify `followers.total`, Deezer `fans`, Last.fm `listeners`, SoundCloud `followers_count` as secondary per-platform reach signals, each labeled by its own platform, never summed into one fabricated cross-platform total.
**Canonical providers:** YouTube canonical for channel-scale reach (subscriber/view depth); each streaming provider canonical only for its own number — no provider is canonical for "total audience," because that concept doesn't exist honestly across incompatible platforms.
**Fields consumed:** `subscriberCount`, `viewCount` (YouTube); `followers.total` (Spotify); `fans` (Deezer); `listeners` (Last.fm); `followers_count` (SoundCloud).
**Why it deserves dashboard space:** This is the audit's direct answer to the Board's own "Subscribers → Audience Reach™" example — implemented honestly, as a real per-platform breakdown and concentration signal, explicitly without the "growth" dimension the Board's example implied, because no evidence supports growth today (see correction at the top of this document).
**Scores:** Executive Value High · Business Relevance High · Actionability Medium (tells you where reach is concentrated, doesn't by itself prescribe an action the way Catalog Media Support™ does) · Evidence Quality High per-platform, but must never be presented as a single combined number · Scalability High · Future Expansion High (the single strongest future-growth-metric candidate the moment historical snapshots exist).
**ATHENA compatibility:** Yes, with the same discipline as Content Activity Status™ — ATHENA may describe today's distribution across platforms, never a trend.

---

## Supporting intelligence cards

Two list-style detail cards, following the same proven pattern Global Music Footprint™ already established with Top Missing Markets™ (a KPI card's real gap list, not a new independent metric):

### 7. Missing Media Assets™
Supports Media Asset Completeness™. A real, itemized list — "TheAudioDB: no banner · YouTube: no banner image" — per provider, per missing asset type. No new evidence; a drill-down view of card 2's already-real data.
**Primary Executive Business Question:** "What media assets should I create next?" (per Board Executive Question Framework™, 2026-07-22)

### 8. Unsupported Releases™
Supports Catalog Media Support™. A real, itemized list of specific releases with zero matched video evidence across the exact-match providers (Apple, TheAudioDB). No new evidence; a drill-down view of card 5's already-real data.
**Primary Executive Business Question:** "Which releases require media investment first?" (per Board Executive Question Framework™, 2026-07-22)

**Total: 8 cards.** Deliberately at the bottom of the Board's 8–10 range rather than padded to the top — every additional candidate considered (see below) failed at least one evaluation criterion badly enough to exclude.

---

## Cards that should NOT exist

| Rejected card | Why |
|---|---|
| Subscriber Count, View Count, Video Count, Follower Count, Upload Count (raw) | Explicitly named by the Board as statistics, not intelligence. Their real evidence powers cards 3 and 6 above; none stands alone. |
| Official Channel / Official Artist Channel badge | Confirmed absent from every provider in the ecosystem (audit §8) — no evidence exists to back this at any confidence level. |
| Monetization Readiness | Confirmed absent from every provider (audit §8) — would require an entirely different, OAuth-scoped API surface Royaltē doesn't have access to today. |
| Content-type breakdown (Lyric Video / Behind-the-Scenes / Official Music Video / Live Performance) | No provider returns this classification (audit §8); any implementation would require fabricated keyword-heuristic guessing, which this audit explicitly does not recommend. |
| Genre & Brand Consistency (cross-provider genre/style/mood alignment) | Real evidence exists (Apple `genreNames`, TheAudioDB `strGenre`/`strStyle`/`strMood`), but this doesn't clear the executive-value bar — an artist's team rarely has an actionable next step from "your genre tags don't perfectly match across two metadata providers." Evidence Quality real; Business Relevance and Actionability too weak to justify dashboard space. |
| Standalone Website / Facebook link cards | Real, but individually too thin (one field each) to justify separate cards — merged into Digital Presence™ (card 4) instead, per the Board's own "merge multiple metrics" instruction. |
| Any growth/trend/delta card (subscriber change %, view change %, upload frequency trend) | No historical snapshot mechanism exists for any provider (audit §8) — see §5 below for the honest future-expansion path instead of building this now. |
| Provider Data Freshness / Evidence Confidence meta-card | Real evidence exists (`lastVerified`/`acquiredAt` timestamps), but this is a system-health signal, not artist-facing executive intelligence — it belongs in Backend Intelligence™ (an existing, separate workspace for exactly this kind of signal), not Media Intelligence™. Flagging the scope boundary rather than building it here. |

---

## Opportunities to merge multiple metrics into stronger intelligence

- **Website + Facebook → Digital Presence™** (card 4) — already applied above, the clearest case in this set.
- **Per-provider follower/subscriber/listener counts → Audience Reach™** (card 6) — merged as a labeled, per-platform breakdown rather than five separate single-number cards, without summing into a false combined total.
- **Release dates + video dates → Catalog Media Support™** (card 5) — the strongest merge in this set: two evidence streams (catalog and media) that were never connected before this audit, producing a genuinely new intelligence concept neither stream could produce alone.
- **Considered and rejected as a merge:** combining Media Platform Coverage™ (card 1) and Digital Presence™ (card 4) into one "Overall Presence" card — rejected because they answer meaningfully different questions (official platform presence vs. independent web/social discoverability) and merging them would obscure which specific gap needs fixing, working against the Board's own "actionability" criterion.

---

## Future KPI ideas requiring additional APIs or historical data

| Future card | Requires |
|---|---|
| Audience Growth™ / Content Momentum™ | A real historical snapshot/monitoring mechanism (does not exist for any provider today — same gap class as Global Music Footprint™'s deferred Coverage Timeline™). The single highest-value future addition identified in this exercise — both Content Activity Status™ and Audience Reach™ are natural, no-redesign upgrade paths the moment this exists. |
| Monetization Readiness™ | YouTube Analytics/Content ID API access (OAuth, channel-owner-scoped) — a fundamentally different auth model than the current API-key connector, not a data-availability problem. |
| Official Channel Verification™ | Either a manual artist-attestation product flow, or a data source that doesn't currently exist anywhere in the ecosystem — not solvable by API access alone. |
| Social Reach Expansion (Instagram, TikTok) | New connector builds — both confirmed entirely absent from the codebase (audit §1). Real, scoped future work, not a near-term unlock. |
| YouTube-matched Catalog Media Support™ (beyond Apple/TheAudioDB) | A non-heuristic linking signal between a YouTube video and a specific release (e.g. an ISRC reference in the video description, if YouTube ever exposed structured metadata for this) — currently unavailable; text-title matching was deliberately excluded from card 5 for integrity reasons. |
| Cross-Platform Fan Overlap | Would require a unified fan-identity resolution across platforms that doesn't exist and isn't close to existing — flagged only as a long-horizon idea, not a near-term candidate. |

---

## Recommended launch dashboard

The 8 cards above, in this priority order for a first Media Intelligence™ build:

1. **Catalog Media Support™** — the single strongest card in this audit; ties directly into the music catalog every artist already understands.
2. **Media Platform Coverage™** — the fastest "where do I stand" read, reuses a proven platform pattern.
3. **Content Activity Status™** — directly answers "is my content strategy healthy," the Board's own framing.
4. **Audience Reach™** — real, honest, no growth-story overclaim.
5. **Media Asset Completeness™** — professional-presence signal, directly actionable.
6. **Digital Presence™** — narrow but real, and the natural landing zone for future Meta/TikTok evidence.
7. **Unsupported Releases™** — drill-down supporting card 1 above.
8. **Missing Media Assets™** — drill-down supporting card 5 above.

Every card on this list is backed by evidence already confirmed real in `governance/MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md`; two (Catalog Media Support™, Content Activity Status™) require the already-scoped, already-identified video-translation wiring step (§8 of that audit) before they can show real data — not a new discovery, a known, bounded engineering task.

---

## Constitutional note

No implementation is authorized by this document. Card names, evidence sources, and canonical ownership are proposed for Executive Board review; visual design, layout, and Mission Control integration remain a separate, later phase per the Board's own phase sequencing (Evidence → KPI Architecture → [not yet reached] Implementation).
