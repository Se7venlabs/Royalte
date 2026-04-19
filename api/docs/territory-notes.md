# Royalté Territory Availability Engine — Implementation Notes (Revised)

## Files

- `api/territory-scan.js` — main serverless function
- `territory-schema.sql` — run in your existing Supabase SQL editor

---

## What Changed from V1

| Area | V1 | V2 |
|---|---|---|
| Coverage score denominator | Merged dataset length (misleading) | Fixed evaluation universe (transparent) |
| Apple validation | Artist-only search for all entity types | Entity-aware: track→song, album→album, artist→artist |
| "Verified unavailable" | Was possible | Removed — absence ≠ confirmed absence |
| Status values | `available`, `unavailable` | + `not_confirmed`, `unknown` |
| `appleUrl` param | Accepted but unused | Removed from request contract |
| `generateAppleToken()` | Called synchronously | Wrapped in `await Promise.resolve()` for safety |
| Next scan date | 30 days | 7 days (weekly monitoring model) |
| Fetch timeouts | Absent | Added to all Spotify and Apple calls |
| 429 handling | Not handled | Explicit detection + graceful fallback |
| Free tier cap | Implied | Hard cap at 5 via `.slice(0, 5)` |
| Artist scan labeling | Silent | Explicit `scan_note` in response |
| DB schema | `status` = available/unavailable only | + `not_confirmed`, `unknown` |
| DB schema | No coverage context fields | + `coverage_basis`, `total_countries_evaluated` |
| DB schema | No uniqueness constraint | UNIQUE on `(scan_id, country_code)` |

---

## Environment Variables Required

All already in Vercel — no new variables needed:

| Variable | Used For |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify token |
| `SPOTIFY_CLIENT_SECRET` | Spotify token |
| `SUPABASE_URL` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase writes (server-side only) |
| `APPLE_TEAM_ID` | Apple Music JWT |
| `APPLE_KEY_ID` | Apple Music JWT |
| `APPLE_PRIVATE_KEY` | Apple Music JWT |

---

## Deploy Steps

**GitHub:**
- Upload `api/territory-scan.js` → `api/territory-scan.js`

**Supabase SQL editor:**
- Paste and run `territory-schema.sql`
- If V1 tables already exist, drop them first or run `ALTER TABLE` migrations manually

---

## Sample POST Request

```json
POST /api/territory-scan
Content-Type: application/json

{
  "url": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
  "planTier": "free",
  "userId": null
}
```

Note: `appleUrl` has been removed from the request contract.

---

## Sample Responses

### Free Scan (max 5 countries — anchors + contrast)

```json
{
  "success": true,
  "entity": {
    "name": "Black Alternative",
    "type": "track",
    "platform": "spotify",
    "id": "4cOdK2wGLETKBW3PvgPWqT",
    "trackTitle": "Everything Is Over",
    "isrc": "CAUM72400123",
    "scan_note": null
  },
  "planTier": "free",
  "scannedAt": "2026-04-19T14:00:00.000Z",
  "coverage_score": 74,
  "coverage_basis": "evaluated territories",
  "total_countries_evaluated": 93,
  "territories": [
    {
      "country_code": "US",
      "country_name": "United States",
      "spotify_available": true,
      "apple_available": true,
      "status": "available",
      "confidence": "Verified"
    },
    {
      "country_code": "GB",
      "country_name": "United Kingdom",
      "spotify_available": true,
      "apple_available": null,
      "status": "available",
      "confidence": "Inferred"
    },
    {
      "country_code": "CA",
      "country_name": "Canada",
      "spotify_available": true,
      "apple_available": true,
      "status": "available",
      "confidence": "Verified"
    },
    {
      "country_code": "JP",
      "country_name": "Japan",
      "spotify_available": false,
      "apple_available": false,
      "status": "not_confirmed",
      "confidence": "Inferred"
    },
    {
      "country_code": "DE",
      "country_name": "Germany",
      "spotify_available": false,
      "apple_available": null,
      "status": "not_confirmed",
      "confidence": "Inferred"
    }
  ],
  "selection_basis": "priority markets — anchors (US, GB, CA) + problem market contrast",
  "insights": [
    "Coverage across evaluated territories is estimated at 74% — some markets appear limited.",
    "Not confirmed available in the following key markets: Japan, Germany."
  ],
  "upgrade_available": true,
  "upgrade_message": "Upgrade to see full territory breakdown, missing key markets, and historical tracking."
}
```

### One-Time Audit (priority-ordered, up to 50 countries)

```json
{
  "success": true,
  "entity": { "name": "Black Alternative", "type": "track", ... },
  "planTier": "audit",
  "scannedAt": "2026-04-19T14:00:00.000Z",
  "coverage": {
    "coverage_score": 74,
    "coverage_basis": "evaluated territories",
    "total_countries_evaluated": 93,
    "total_available": 69,
    "total_not_confirmed": 18,
    "total_unknown": 6,
    "missing_key_markets": ["JP", "DE"]
  },
  "territories": [
    { "country_code": "US", "status": "available", "confidence": "Verified", ... },
    { "country_code": "GB", "status": "available", "confidence": "Inferred", ... },
    { "country_code": "JP", "status": "not_confirmed", "confidence": "Inferred", ... },
    "... up to 50 countries in Tier 1 → Tier 2 → Tier 3 order ..."
  ],
  "selection_basis": "priority-ordered: Tier 1 (key markets) → Tier 2 (growth markets) → Tier 3 (global mix)",
  "data_scope": "48 countries from evaluated territory universe",
  "insights": [
    "Coverage across evaluated territories is estimated at 74% — some markets appear limited.",
    "Not confirmed available in the following key markets: Japan, Germany.",
    "Japan does not appear in the confirmed available markets — a high-value streaming territory.",
    "Most results are inferred from Spotify data only — Apple Music cross-validation was limited or unavailable."
  ],
  "upgrade_available": true,
  "upgrade_message": "Subscribe for full territory dataset, weekly re-scan tracking, and change alerts."
}
```

### Subscription (full dataset, weekly monitoring ready)

```json
{
  "success": true,
  "entity": {
    "name": "Black Alternative",
    "type": "artist",
    "scan_note": "Artist scan is a sample-based estimate derived from selected top tracks. It does not represent full catalog availability."
  },
  "planTier": "subscription",
  "scannedAt": "2026-04-19T14:00:00.000Z",
  "coverage": {
    "coverage_score": 81,
    "coverage_basis": "evaluated territories",
    "total_countries_evaluated": 93,
    "total_available": 75,
    "total_not_confirmed": 12,
    "total_unknown": 6,
    "missing_key_markets": ["JP"]
  },
  "territories": [
    "... full dataset, all countries, no filtering ..."
  ],
  "selection_basis": "full dataset — no filtering applied",
  "data_scope": "93 countries from evaluated territory universe",
  "insights": [
    "Coverage across evaluated territories is estimated at 81% — strong distribution signal.",
    "Artist scan is sample-based — derived from selected top tracks. Results may not represent full catalog availability.",
    "Japan does not appear in the confirmed available markets — a high-value streaming territory."
  ],
  "upgrade_available": false,
  "_meta": {
    "total_territories_in_dataset": 93,
    "scan_basis": "artist",
    "history_ready": true,
    "next_scan_recommended": "2026-04-26"
  }
}
```

---

## Does Frontend Need to Change?

**Yes — if the frontend assumes only `available` or `unavailable` as status values**, it needs to handle `not_confirmed` and `unknown` gracefully. Recommended treatment:
- `available` → show as available (green)
- `not_confirmed` → show as unconfirmed / grey
- `unknown` → show as no data / grey
- `unavailable` → show as unavailable (red) — rare, only used with strong signal

**No changes needed** if the frontend already renders unknown status values gracefully.

---

## Does Existing DB Insert Logic Need to Change?

**Yes** — `persistScan()` now passes two new fields:
- `coverage_basis` (TEXT)
- `total_countries_evaluated` (INTEGER)

These must exist in the `territory_scans` table — the revised schema adds them.

If you previously ran the V1 schema, run these ALTER statements:

```sql
ALTER TABLE territory_scans
  ADD COLUMN IF NOT EXISTS coverage_basis TEXT NOT NULL DEFAULT 'evaluated territories',
  ADD COLUMN IF NOT EXISTS total_countries_evaluated INTEGER NOT NULL DEFAULT 0;

ALTER TABLE territory_results
  DROP CONSTRAINT IF EXISTS territory_results_status_check,
  ADD CONSTRAINT territory_results_status_check
    CHECK (status IN ('available', 'unavailable', 'not_confirmed', 'unknown'));

ALTER TABLE territory_results
  ADD CONSTRAINT IF NOT EXISTS uq_territory_results_scan_country
    UNIQUE (scan_id, country_code);
```

---

## Rate Limit Notes

- **Spotify**: Fetch timeouts added (8s for primary calls, 5s for per-track fetches). 429 responses are caught and logged — scan fails gracefully with a clear error message.
- **Apple Music**: 429 responses per storefront are caught — that storefront returns `null` (unknown) rather than failing the whole scan. Apple validation is always non-blocking.
- **Supabase**: Writes are fire-and-forget. Scan response is never delayed by DB latency.

---

## Known Honest Limitations

1. **`coverage_score` is not a true global percentage.** It is calculated against a fixed evaluation universe of ~93 countries. It tells you coverage across the territories we evaluate — not coverage across every country on earth.

2. **`not_confirmed` ≠ unavailable.** If Spotify's market list does not include a country, that means the distributor has not enabled that territory — but it does not guarantee the release is actively blocked. It may simply not have been distributed there.

3. **Artist scans are sample-based.** Top-5 official tracks are used. Different tracks in the same catalog may have different distribution settings. The `scan_note` field in the response makes this explicit.

4. **Apple Music storefront validation** confirms catalog presence, not full playback rights for all users in that country.

5. **`apple_available: null`** means validation was not attempted or failed for that storefront — it is not evidence of unavailability.
