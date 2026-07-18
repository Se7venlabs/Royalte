# Royaltē — Artist Profile Card
# Settings Constitutional Ownership

## Status note

Every statement below is traceable to existing implementation or explicitly marked Future Constitutional Architecture — no statement is speculative. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8), does not modify production code, and does not modify Mission Control.

**Headline finding, confirmed by direct trace: there is no dedicated Settings page anywhere in the codebase today.** Every Mission Control workspace's sidebar nav includes a "Settings" item, and every single one of them links to `/mission-control.html` (confirmed identically across `identity-intelligence.html`, `health-intelligence.html`, `monitoring-timeline.html`, and every other workspace traced in this series) — not to a real settings destination. Settings is, today, a placeholder nav label with no corresponding page. This is the most important fact in this document and shapes everything below: Settings is almost entirely Current Prototype or Future Constitutional Architecture, not Current Implementation.

---

## Constitutional Purpose

Settings does not discover information — every other domain in this series (Identity, Publishing, Catalog, Global Music Footprint, Backend, Media, Health) discovers or computes information from external providers or from other domains. Settings is the one constitutional domain whose primary responsibility is the opposite: it stores artist-supplied preferences and platform configuration, and is the source of truth for user-managed information. Where Identity Intelligence™ answers "what does Royaltē know," Settings answers "what has the artist told Royaltē."

---

## Ownership — traced against real implementation

### Profile Information

| Field | Status |
|---|---|
| Artist Name | **Not a Settings field.** Derived, not user-set — from `scan.artist_name` / `scan.payload.subject.artistName` (`public/js/dashboard.js:1412`), a Scan/CIO output, not something the artist edits in Settings. |
| Display Name | **Data model is real; UI is not.** `profiles.display_name` is a real column (`supabase/migrations/20260515184037_auth_schema_foundation.sql:38`), auto-populated at signup from `raw_user_meta_data->>'display_name'` or the email prefix (`handle_new_user()` trigger, lines 88-93), and covered by a real RLS `UPDATE` policy allowing the user to edit their own row (`profiles_update_own`, lines 120-125). No UI or API endpoint was found anywhere that actually lets the artist change it — the data model supports editing, nothing exposes that capability today. |
| Email | **Data model is real; UI is not.** `profiles.email` is a real column, set at signup by the same trigger, denormalized from `auth.users.email`. Same finding as Display Name — editable at the data layer via RLS, but no Settings UI/endpoint found to change it (Supabase Auth's own session `session.user.email` is also real and used directly in `api/save-music-rights-profile.js:56`, a separate, correct copy). |
| Time Zone | **Not implemented.** No storage found. (Note: `public/js/royalte-tz.js` exists and handles timezone *display/formatting* logic, not a user-configurable timezone preference — different concern.) |
| Country | **Not implemented** as a user preference. A country-code lookup exists in `dashboard.js:220` but it's for rendering territory/monitoring data, not a stored artist setting. |
| Language | **Not implemented.** No storage or UI found anywhere. |

### Music Rights Profile — the one real, substantial piece of Settings-owned data

This is real and already fully documented in `ARTIST_PROFILE_CARD_PUBLISHING_SCHEMA.md` — reproduced here for ownership completeness, not re-derived:

| Field | Status |
|---|---|
| PRO | **Real.** `profiles.music_rights_profile.performing_rights.pro`, captured via `public/onboarding.html` (3-question flow), written by `api/save-music-rights-profile.js`. |
| Publishing Administrator / Publisher / Organization Name | **Real**, derived from the `publishing_management` enum (`self`/`admin`/`publisher`) + `organization_name`, same onboarding flow. |
| Record Label | **Not artist-supplied.** Per `api/save-music-rights-profile.js:11-13`'s own comment, this is an "intelligence-auto-populated" field, sourced from Apple Music catalog data post-scan — not a Settings-owned field despite living in the same `music_rights_profile` JSON blob. Ownership boundary: Settings owns what the *artist* supplies; this specific sub-field is Scan-owned data merged into the same storage object. |
| Mechanical Rights Organization | **Not implemented.** Confirmed absent in the Publishing Intelligence trace — no onboarding question, no storage. |
| CMO / Rights Society | **Not implemented.** No such field or terminology found anywhere in `onboarding.html` or `save-music-rights-profile.js`. |
| Future Rights fields | Explicitly out of current scope — tracked as Future Constitutional Architecture below, not invented here. |

**Real storage location and mechanism:** Supabase `profiles` table, `music_rights_profile` JSON column, written via `PUT`-style `update()` in `api/save-music-rights-profile.js:87-90`, authenticated via Bearer token (`supabase.auth.getUser()`), gated to the requesting user's own row (`.eq('id', user.id)`). `onboarding_completed_at` and `updated_at` are also real, tracked columns.

### Account

| Field | Status |
|---|---|
| Password | **Exists via Supabase Auth** (the platform authentication layer), but no dedicated Settings UI to change it was found anywhere in `public/`. |
| Authentication | Real — Bearer-token/session-based via Supabase Auth, confirmed used across multiple endpoints (`save-music-rights-profile.js`, `claim-scan.js`). |
| 2FA | **Not implemented.** Zero references anywhere in the codebase. |
| Connected Services | **Not implemented** as a user-facing concept. (Provider *connection status* exists, but as Backend Intelligence™ data — `ARTIST_PROFILE_CARD_BACKEND_SCHEMA.md` — not as a Settings-managed list of connected accounts.) |
| API Tokens | **Not implemented.** Zero references. |
| Billing / Subscription | **Not implemented as payment/billing.** The only real "subscription" concept in the codebase is `monitoring_subscriptions` (`api/_lib/persist-os-scan.js:330-355`) — a per-(user, artist) row controlling whether monitoring is active for that artist. This is unrelated to payment plans or billing and should not be conflated with the Board brief's "Billing / Subscription" concept, which does not exist. |
| Export Data | **Not implemented.** Zero references. |
| Delete Account | **Not implemented.** Zero references. |

### Platform Preferences

Notifications, Theme, Workspace Preferences, Privacy, Beta Features, Accessibility — **none implemented.** No storage, no UI, no references found anywhere in `public/` or `api/`. Documented here as a complete category for Future Constitutional Architecture, not partially invented.

---

## Relationship to Other Workspaces

Per the Board's stated model — confirmed against what's actually real today, not assumed:

- **Identity Intelligence reads Settings**: not confirmed in current code. Identity Intelligence's real inputs (`ARTIST_PROFILE_CARD_IDENTITY_SCHEMA.md`) are Scan-sourced; no code path was found reading `profiles.music_rights_profile` into Identity Intelligence.
- **Publishing Intelligence reads Settings**: **real, confirmed.** `music_rights_profile` (PRO, publishing relationship, MLC self-report) is exactly the onboarding data documented as real in `ARTIST_PROFILE_CARD_PUBLISHING_SCHEMA.md` §"Rights Profile"/"Publishing Relationships" — merged client-side at the Runtime Context layer via `__mcPopulate()`.
- **Health evaluates Settings**: not directly — Health Intelligence™'s `derivePublishingScore()` (`ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md` §5) reads Publishing Intelligence's already-assembled output, which in turn incorporates Settings-sourced MRP data. Indirect, not direct.
- **Monitoring Timeline records Settings changes**: **not implemented.** Confirmed in `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §3 — the real delta engine has zero change-detection for Settings (one of the six domains with no coverage at all).
- **ATHENA reads Settings**: not applicable today — real ATHENA (`api/athena/`) has zero production callers, confirmed repeatedly across this series.

**Ownership boundary, as it exists today:** Settings' only real owned data is the Music Rights Profile JSON blob in `profiles.music_rights_profile`, populated once at onboarding via `onboarding.html` → `save-music-rights-profile.js`. No other workspace currently writes to it. No workspace currently owns Profile Information, Account, or Platform Preferences fields, because none of those fields exist as stored data anywhere.

---

## Future Constitutional Architecture (documentation only — no implementation implied)

- **Settings Change Detection**: would require new emitter logic in the delta engine (`api/_lib/delta-engine.js`), following the same pattern already used for territory/catalog/video changes — tracked as part of the broader six-domain gap already logged in `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §3 / task #56.
- **Timeline integration**: Settings would publish events into the proposed Monitoring Event Engine per the Phase 1 blueprint already documented in `ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §4 — not built, not authorized here.
- **Audit history**: a record of what changed, when, and by whom (user vs. system) — depends on the same not-yet-built canonical event model.
- **Future user preferences**: Profile Information, Account, and Platform Preferences fields listed above, none of which exist today, would need real design (storage schema, UI, validation) before any of them could move from Future Architecture to Current Implementation.

None of the above is implemented by this document.

---

## Rules

1. Settings owns configuration; it does not discover, compute, or interpret data — confirmed by what real Settings data exists today (artist-supplied MRP fields only).
2. No field is described as implemented unless a real storage location and write path were found and cited.
3. Fields with zero evidence anywhere in the codebase (2FA, API Tokens, Billing, Export Data, Delete Account, all Platform Preferences, most Profile Information) are documented as entirely unimplemented — not partially built, not assumed to exist.
4. The distinction between Settings-owned data (artist-supplied) and Scan-owned data that happens to share the same storage object (`record_label` inside `music_rights_profile`) is preserved, not blurred.
5. This document does not authorize building the missing Settings page, any of the unimplemented fields, or Settings change detection.

---

## Deliverable Status

- ✅ Constitutional purpose defined
- ✅ Every named field traced against real storage/UI, or confirmed absent
- ✅ Headline finding: no dedicated Settings page exists anywhere — every workspace's Settings nav link points to `/mission-control.html`
- ✅ Only one real Settings-owned dataset found: Music Rights Profile (PRO, publishing relationship, MLC self-report), already documented in the Publishing Intelligence schema
- ✅ Relationship to other workspaces checked against real code, not assumed from the Board's stated model
- ✅ Future Constitutional Architecture section kept clearly separate from current findings
- ✅ No production code changed; no Mission Control changes

**Settings Constitutional Ownership ready for Board review.**
