// Royalté Territory Availability Engine — /api/territory-scan.js
//
// PURPOSE: Check and confirm what countries a song, album, or artist
// is available in.
//
// Phase 5.2 (dataSourceVersion 'territory-intelligence-engine-v1.0-apple-only')
// — rewired onto the Territory Intelligence Engine™, the platform's single
// authoritative territory source (Board-ratified architecture). Two contract
// changes from this endpoint's original design, both explicitly versioned
// per Board Decision 3 rather than shipped silently:
//   1. Spotify is no longer a territory-acquisition input. Spotify removed
//      bulk available_markets in Feb 2026; exhaustive per-market Spotify
//      acquisition is out of scope for Phase 5.2 (Board Decision 1). Spotify
//      is still used to resolve the input URL to an artist/track/album.
//   2. Apple-side evaluation is now artist-level catalog-presence (the same
//      probe-album mechanism the Engine uses everywhere else), not the
//      entity-aware exact-title/ISRC matching this endpoint used to do.
//      "Territory Intelligence Engine becomes the single authoritative
//      source of all territory intelligence. No other module computes,
//      derives, or reconciles territory/availability data" (Board-ratified
//      architecture, decree §2.1) — this endpoint no longer runs its own
//      Apple search logic.
//
// HONESTY RULES:
// - Coverage score is calculated against a fixed evaluation universe, not total
//   countries in the world. It is NOT a true global percentage.
// - Confidence labels are conservative: "Inferred" is the ceiling in this phase
//   (single-source, Apple-only) — "Verified" (2+ sources agreeing) cannot occur
//   until a future phase adds a second territory-acquisition provider.
// - Artist scans are SAMPLE-BASED estimates from top tracks — not full catalog guarantees.
// - "not_confirmed" and "unknown" are valid statuses — we do not force availability claims.
//
// PLAN TIERS (request-based gating — auth enforcement to be added in a future phase):
//   free         — teaser: coverage score + max 5 countries + 2 insights
//   audit        — broader snapshot: priority-ordered 25–50 countries
//   subscription — full dataset, structured for weekly re-scan comparison

import { acquireAppleEvidence } from './_lib/apple-pal-acquisition.js';
import { assembleTerritoryIntelligence, TerritoryState } from './_lib/territory-intelligence.js';
import { createClient } from '@supabase/supabase-js';

const DATA_SOURCE_VERSION = 'territory-intelligence-engine-v1.0-apple-only';

// ── SUPABASE CLIENT ───────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

// ── FIXED EVALUATION UNIVERSE ─────────────────────────────────────────────────
// Coverage score is calculated against this stable list, not against all countries
// on earth. This prevents misleading "78% global coverage" claims.
const PRIORITY_MARKETS = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
];

const COUNTRY_NAMES = {
  US:'United States',CA:'Canada',GB:'United Kingdom',DE:'Germany',FR:'France',
  AU:'Australia',JP:'Japan',BR:'Brazil',MX:'Mexico',SE:'Sweden',NL:'Netherlands',
  IT:'Italy',ES:'Spain',KR:'South Korea',IN:'India',ZA:'South Africa',NG:'Nigeria',
  NZ:'New Zealand',NO:'Norway',DK:'Denmark',FI:'Finland',PL:'Poland',BE:'Belgium',
  CH:'Switzerland',AT:'Austria',PT:'Portugal',GR:'Greece',HU:'Hungary',CZ:'Czechia',
  RO:'Romania',SK:'Slovakia',BG:'Bulgaria',HR:'Croatia',SI:'Slovenia',EE:'Estonia',
  LV:'Latvia',LT:'Lithuania',IE:'Ireland',IS:'Iceland',LU:'Luxembourg',CY:'Cyprus',
  MT:'Malta',TR:'Turkey',IL:'Israel',AE:'UAE',SA:'Saudi Arabia',QA:'Qatar',
  KW:'Kuwait',BH:'Bahrain',OM:'Oman',EG:'Egypt',MA:'Morocco',TN:'Tunisia',
  AR:'Argentina',CL:'Chile',CO:'Colombia',PE:'Peru',VE:'Venezuela',EC:'Ecuador',
  UY:'Uruguay',PY:'Paraguay',BO:'Bolivia',DO:'Dominican Republic',GT:'Guatemala',
  HN:'Honduras',SV:'El Salvador',CR:'Costa Rica',PA:'Panama',JM:'Jamaica',
  TT:'Trinidad and Tobago',HK:'Hong Kong',SG:'Singapore',TW:'Taiwan',MY:'Malaysia',
  TH:'Thailand',ID:'Indonesia',PH:'Philippines',VN:'Vietnam',PK:'Pakistan',
  BD:'Bangladesh',LK:'Sri Lanka',NP:'Nepal',KH:'Cambodia',MM:'Myanmar',
  GH:'Ghana',KE:'Kenya',TZ:'Tanzania',UG:'Uganda',ET:'Ethiopia',CM:'Cameroon',
  CI:"Côte d'Ivoire",SN:'Senegal',RW:'Rwanda',ZW:'Zimbabwe',BW:'Botswana',
  NA:'Namibia',MZ:'Mozambique',MG:'Madagascar',MW:'Malawi',ZM:'Zambia',
};

// Fixed evaluation universe — all codes we measure coverage against
const EVALUATION_UNIVERSE = [...new Set([
  ...PRIORITY_MARKETS.map(m => m.code),
  ...Object.keys(COUNTRY_NAMES),
])];

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  // appleUrl removed from public contract — not yet implemented
  const { url, planTier = 'free', userId = null } = req.body || {};

  if (!url) return res.status(400).json({ error: 'url is required' });

  const tier = ['free', 'audit', 'subscription'].includes(planTier) ? planTier : 'free';

  try {
    const parsed = parseUrl(url);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid or unsupported URL. Please submit a Spotify track, album, or artist URL.',
      });
    }

    const token = await getSpotifyToken();

    const spotifyData = await fetchSpotifyData(parsed, token);
    if (!spotifyData) {
      return res.status(422).json({
        error: 'Could not retrieve data from Spotify. Please check the URL and try again.',
        parsed,
      });
    }

    // Territory Intelligence Engine™ — Apple-only in Phase 5.2 (Board
    // Decision 1). acquireAppleEvidence() never throws; if Apple is
    // unreachable or the artist can't be resolved, assembleTerritoryIntelligence
    // degrades honestly to NOT_EVALUATED/UNKNOWN across the board rather than
    // failing the request — matching this endpoint's existing non-blocking
    // philosophy for Apple validation.
    const appleAcquisition = await acquireAppleEvidence({
      artistName: spotifyData.entityName,
      isrc: spotifyData.isrc || null,
    });
    const territoryIntelligence = assembleTerritoryIntelligence(appleAcquisition.evidencePackages);

    const allMarkets = buildTerritoryDataset(territoryIntelligence, COUNTRY_NAMES);

    const scoring = computeCoverageScore(allMarkets);

    const insights = generateInsights(allMarkets, scoring);

    const gatedResponse = applyTierGating(tier, allMarkets, scoring, insights, parsed);

    // Persist non-blocking — scan response is never delayed by DB write
    persistScan({
      userId,
      sourceUrl: url,
      sourceType: parsed.type,
      sourcePlatform: parsed.platform,
      entityId: parsed.id,
      entityName: spotifyData.entityName,
      coverageScore: scoring.coverage_score,
      coverageBasis: scoring.coverage_basis,
      totalCountriesEvaluated: scoring.total_countries_evaluated,
      planTier: tier,
      allMarkets,
    }).catch(err => console.error('[Territory] Supabase persist error:', err.message));

    return res.status(200).json({
      success: true,
      entity: {
        name: spotifyData.entityName,
        type: parsed.type,
        platform: parsed.platform,
        id: parsed.id,
        trackTitle: spotifyData.trackTitle || null,
        isrc: spotifyData.isrc || null,
        // Explicit per HONESTY RULES — the Territory Intelligence Engine
        // evaluates artist-level Apple Music catalog presence regardless of
        // entity type (a real behavior change from this endpoint's prior
        // entity-aware matching and top-track sampling — see Phase 5.2
        // header note).
        scan_note: 'Territory availability reflects artist-level Apple Music catalog presence via the Territory Intelligence Engine, not track/album-specific matching or top-track sampling.',
      },
      planTier: tier,
      scannedAt: new Date().toISOString(),
      dataSourceVersion: DATA_SOURCE_VERSION,
      ...gatedResponse,
    });

  } catch (err) {
    console.error('[Territory] Handler error:', err.message);
    return res.status(500).json({
      error: 'Territory scan failed. Please try again.',
      detail: err.message,
    });
  }
}

// ── URL PARSER ────────────────────────────────────────────────────────────────
function parseUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('spotify.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const typeIdx = parts.findIndex(p => ['artist', 'album', 'track'].includes(p));
      if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
      return {
        platform: 'spotify',
        type: parts[typeIdx],
        id: parts[typeIdx + 1].split('?')[0],
      };
    }
    return null;
  } catch { return null; }
}

// ── SPOTIFY TOKEN ─────────────────────────────────────────────────────────────
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });
  if (resp.status === 429) throw new Error('Spotify rate limit hit — try again shortly');
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Spotify token');
  return data.access_token;
}

// ── SPOTIFY DATA FETCH ────────────────────────────────────────────────────────
// Phase 5.2 — used for entity resolution only (name/title/ISRC needed to
// drive Apple acquisition via the Territory Intelligence Engine). Spotify's
// available_markets is no longer fetched: it is not read anywhere, since
// Spotify does not contribute territory-acquisition evidence in this phase
// (Board Decision 1), and Spotify itself removed bulk available_markets in
// Feb 2026.
async function fetchSpotifyData(parsed, token) {
  const headers = { 'Authorization': `Bearer ${token}` };
  const BASE = 'https://api.spotify.com/v1';
  const timeout = { signal: AbortSignal.timeout(8000) };

  try {
    if (parsed.type === 'track') {
      const resp = await fetch(`${BASE}/tracks/${parsed.id}`, { headers, ...timeout });
      if (resp.status === 429) { console.warn('[Territory] Spotify 429 on track fetch'); return null; }
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        entityName: data.artists?.[0]?.name || data.name,
        trackTitle: data.name,
        isrc: data.external_ids?.isrc || null,
        albumName: data.album?.name || null,
      };
    }

    if (parsed.type === 'album') {
      const resp = await fetch(`${BASE}/albums/${parsed.id}`, { headers, ...timeout });
      if (resp.status === 429) { console.warn('[Territory] Spotify 429 on album fetch'); return null; }
      if (!resp.ok) return null;
      const data = await resp.json();
      return {
        entityName: data.artists?.[0]?.name || data.name,
        trackTitle: null,
        isrc: null,
        albumName: data.name,
      };
    }

    if (parsed.type === 'artist') {
      const artistResp = await fetch(`${BASE}/artists/${parsed.id}`, { headers, ...timeout });
      if (artistResp.status === 429) { console.warn('[Territory] Spotify 429 on artist fetch'); return null; }
      if (!artistResp.ok) return null;
      const artistData = await artistResp.json();

      return {
        entityName: artistData.name,
        trackTitle: null,
        isrc: null,
        albumName: null,
      };
    }

    return null;
  } catch (err) {
    console.error('[Territory] Spotify fetch error:', err.message);
    return null;
  }
}

// ── TERRITORY MERGE — Territory Intelligence Engine™ consumer ────────────────
// Iterates over the FULL EVALUATION_UNIVERSE — one row per evaluated country,
// every scan, every tier. This ensures:
//   - Free tier always has anchor countries available to select from
//   - Audit tier selection is consistent across all scans
//   - Subscription truly returns the full evaluated dataset
//   - DB stores exactly one row per evaluated country per scan
//
// Maps the Engine's 5-state model (AVAILABLE/UNAVAILABLE/UNKNOWN/
// NOT_EVALUATED/ERROR) down onto this endpoint's existing 3-status shape.
// UNAVAILABLE maps to 'not_confirmed', not 'unavailable' — consistent with
// this endpoint's own pre-existing honesty convention (see status values
// below): "unavailable" is reserved for an explicit distributor block, which
// no current source confirms; a confirmed-empty catalog probe on one
// provider is exactly the kind of signal "not_confirmed" was designed for.
//
// Status values (active):
//   available     — Engine state AVAILABLE
//   not_confirmed — Engine state UNAVAILABLE (confirmed-empty on the one
//                   available provider; absence ≠ confirmed distributor block)
//   unknown       — Engine state UNKNOWN, NOT_EVALUATED, or ERROR
//
// Note: `unavailable` is reserved in the schema for future use when a distributor
// explicitly blocks a territory. No current API source provides that signal reliably,
// so it is not emitted by this function.
//
// Confidence values (Phase 5.2 — Apple-only, single source):
//   Inferred — Engine reached a definitive AVAILABLE/UNAVAILABLE state from
//              the one contributing provider. This is the ceiling in this
//              phase; "Verified" (2+ sources agreeing) cannot occur until a
//              future phase adds a second territory-acquisition provider.
//   Unknown  — no definitive signal (UNKNOWN/NOT_EVALUATED/ERROR)
function mapEngineStateToStatus(state) {
  if (state === TerritoryState.AVAILABLE)   return 'available';
  if (state === TerritoryState.UNAVAILABLE) return 'not_confirmed';
  return 'unknown'; // UNKNOWN, NOT_EVALUATED, ERROR
}

function mapEngineStateToConfidence(state) {
  if (state === TerritoryState.AVAILABLE || state === TerritoryState.UNAVAILABLE) return 'Inferred';
  return 'Unknown';
}

function buildTerritoryDataset(territoryIntelligence, countryNames) {
  const byCode = new Map(
    (territoryIntelligence?.territories || []).map(t => [String(t.code).toUpperCase(), t])
  );

  // Always iterate over the full evaluation universe — not just what the
  // Engine returned — so every evaluated country has a row regardless of
  // whether Apple's storefront list happens to cover it.
  return EVALUATION_UNIVERSE.map(code => {
    const entry = byCode.get(code);
    const state = entry?.state ?? TerritoryState.NOT_EVALUATED;

    return {
      country_code: code,
      country_name: countryNames[code] || code,
      // Spotify no longer contributes territory-acquisition evidence in
      // Phase 5.2 (Board Decision 1) — null, not false, so this column
      // honestly reflects "not sourced" rather than "confirmed absent".
      spotify_available: null,
      apple_available: state === TerritoryState.AVAILABLE ? true
                      : state === TerritoryState.UNAVAILABLE ? false
                      : null,
      status: mapEngineStateToStatus(state),
      confidence: mapEngineStateToConfidence(state),
    };
  }).sort((a, b) => {
    const pa = PRIORITY_MARKETS.findIndex(m => m.code === a.country_code);
    const pb = PRIORITY_MARKETS.findIndex(m => m.code === b.country_code);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.country_code.localeCompare(b.country_code);
  });
}

// ── COVERAGE SCORING ──────────────────────────────────────────────────────────
// Coverage score is calculated against the fixed EVALUATION_UNIVERSE.
// It is NOT a percentage of all countries on earth.
// coverage_basis and total_countries_evaluated are always returned for transparency.
function computeCoverageScore(territories) {
  const universeSize = EVALUATION_UNIVERSE.length;
  const available = territories.filter(t => t.status === 'available').length;
  const notConfirmed = territories.filter(t => t.status === 'not_confirmed').length;
  const unknown = territories.filter(t => t.status === 'unknown').length;

  // Score only counts confirmed available territories against the evaluation universe
  const coverage_score = universeSize > 0 ? Math.round((available / universeSize) * 100) : 0;

  const missingPriority = PRIORITY_MARKETS
    .filter(m => {
      const t = territories.find(t => t.country_code === m.code);
      return !t || t.status !== 'available';
    })
    .map(m => m.code);

  return {
    coverage_score,
    coverage_basis: 'evaluated territories',
    total_countries_evaluated: universeSize,
    total_available: available,
    total_not_confirmed: notConfirmed,
    total_unknown: unknown,
    missing_key_markets: missingPriority,
  };
}

// ── INSIGHT GENERATION ────────────────────────────────────────────────────────
function generateInsights(territories, scoring) {
  const insights = [];

  if (scoring.coverage_score >= 85) {
    insights.push(`Coverage across evaluated territories is estimated at ${scoring.coverage_score}% — strong distribution signal.`);
  } else if (scoring.coverage_score >= 60) {
    insights.push(`Coverage across evaluated territories is estimated at ${scoring.coverage_score}% — some markets appear limited.`);
  } else {
    insights.push(`Coverage across evaluated territories is estimated at ${scoring.coverage_score}% — significant gaps detected.`);
  }

  // Phase 5.2 — Apple is the sole territory-acquisition provider this phase
  // (Board Decision 1). Surfaced as a visible insight, not just a metadata
  // field, per the decree's "explicitly versioned, not silently changed"
  // requirement.
  insights.push('Availability is evaluated using Apple Music data only in this release — Spotify market cross-validation is not currently available.');

  if (scoring.missing_key_markets.length > 0) {
    const names = scoring.missing_key_markets
      .map(c => COUNTRY_NAMES[c] || c)
      .slice(0, 4)
      .join(', ');
    insights.push(`Not confirmed available in the following key markets: ${names}.`);
  }

  const jp = territories.find(t => t.country_code === 'JP');
  if (jp && jp.status !== 'available') {
    insights.push('Japan does not appear in the confirmed available markets — a high-value streaming territory.');
  }

  return insights;
}

// ── FREE TIER SELECTION ───────────────────────────────────────────────────────
// Always: US, GB, CA (anchors)
// Then: up to 2 "problem" markets from JP, DE, BR, FR — prefer not_confirmed or unknown
// Hard cap: maximum 5 countries
function selectFreeCountries(territories) {
  const find = code => territories.find(t => t.country_code === code);
  const anchors = ['US', 'GB', 'CA'].map(find).filter(Boolean);

  const problemCandidates = ['JP', 'DE', 'BR', 'FR'];
  const notAvailable = problemCandidates.map(find).filter(t => t && t.status !== 'available');
  const availableFallback = problemCandidates.map(find).filter(t => t && t.status === 'available');
  const problemMarkets = [...notAvailable, ...availableFallback].slice(0, 2);

  const selected = [...anchors, ...problemMarkets];

  if (selected.length < 5) {
    const padCandidates = ['AU', 'MX', 'KR', 'IN', 'SE'];
    for (const code of padCandidates) {
      if (selected.length >= 5) break;
      const t = find(code);
      if (t && !selected.find(s => s.country_code === code)) selected.push(t);
    }
  }

  // Hard cap at 5
  return selected.slice(0, 5);
}

// ── AUDIT TIER SELECTION ──────────────────────────────────────────────────────
const AUDIT_TIER1 = ['US', 'GB', 'CA', 'DE', 'FR', 'AU', 'JP'];
const AUDIT_TIER2 = ['BR', 'MX', 'IN', 'KR', 'ZA'];
const AUDIT_TIER3 = [
  'SE','NO','DK','FI','NL','BE','CH','AT','PT','IE',
  'IT','ES','PL','CZ','HU','RO','TR','IL','AE','SA',
  'SG','HK','TW','TH','PH','ID','MY','VN','NG','GH',
  'KE','EG','MA','AR','CL','CO','PE','NZ','JM','PK',
];

function selectAuditCountries(territories) {
  const find = code => territories.find(t => t.country_code === code);
  const selected = [];

  for (const code of [...AUDIT_TIER1, ...AUDIT_TIER2, ...AUDIT_TIER3]) {
    if (selected.length >= 50) break;
    const t = find(code);
    if (t && !selected.find(s => s.country_code === code)) selected.push(t);
  }

  if (selected.length < 25) {
    for (const t of territories) {
      if (selected.length >= 50) break;
      if (!selected.find(s => s.country_code === t.country_code)) selected.push(t);
    }
  }

  return selected;
}

// ── PLAN TIER GATING ──────────────────────────────────────────────────────────
function applyTierGating(tier, territories, scoring, insights, parsed) {
  if (tier === 'free') {
    const sample = selectFreeCountries(territories);
    return {
      coverage_score: scoring.coverage_score,
      coverage_basis: scoring.coverage_basis,
      total_countries_evaluated: scoring.total_countries_evaluated,
      territories: sample,
      selection_basis: 'priority markets — anchors (US, GB, CA) + problem market contrast',
      insights: insights.slice(0, 2),
      upgrade_available: true,
      upgrade_message: 'Upgrade to see full territory breakdown, missing key markets, and historical tracking.',
    };
  }

  if (tier === 'audit') {
    const auditSet = selectAuditCountries(territories);
    return {
      coverage: scoring,
      territories: auditSet,
      selection_basis: 'priority-ordered: Tier 1 (key markets) → Tier 2 (growth markets) → Tier 3 (global mix)',
      data_scope: `${auditSet.length} countries from evaluated territory universe`,
      insights,
      upgrade_available: true,
      upgrade_message: 'Subscribe for full territory dataset, weekly re-scan tracking, and change alerts.',
    };
  }

  if (tier === 'subscription') {
    return {
      coverage: scoring,
      territories,
      selection_basis: 'full evaluated territory universe — one row per country, no filtering applied',
      data_scope: `${territories.length} countries — complete evaluated territory universe`,
      insights,
      upgrade_available: false,
      _meta: {
        total_territories_in_dataset: territories.length,
        scan_basis: parsed.type,
        history_ready: true,
        // Weekly monitoring: next scan recommended in 7 days (not 30)
        next_scan_recommended: getNextScanDate(7),
      },
    };
  }

  return applyTierGating('free', territories, scoring, insights, parsed);
}

// next scan in N days
function getNextScanDate(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── SUPABASE PERSISTENCE ──────────────────────────────────────────────────────
async function persistScan({ userId, sourceUrl, sourceType, sourcePlatform, entityId, entityName, coverageScore, coverageBasis, totalCountriesEvaluated, planTier, allMarkets }) {
  try {
    const supabase = getSupabase();

    const { data: scan, error: scanError } = await supabase
      .from('territory_scans')
      .insert({
        user_id: userId || null,
        source_url: sourceUrl,
        source_type: sourceType,
        source_platform: sourcePlatform,
        entity_id: entityId,
        entity_name: entityName,
        coverage_score: coverageScore,
        coverage_basis: coverageBasis,
        total_countries_evaluated: totalCountriesEvaluated,
        plan_tier: planTier,
      })
      .select('id')
      .single();

    if (scanError) {
      console.error('[Territory] Supabase scan insert error:', scanError.message);
      return;
    }

    const rows = allMarkets.map(t => ({
      scan_id: scan.id,
      country_code: t.country_code,
      country_name: t.country_name,
      spotify_available: t.spotify_available,
      apple_available: t.apple_available,
      status: t.status,
      confidence: t.confidence,
    }));

    const { error: resultsError } = await supabase
      .from('territory_results')
      .insert(rows);

    if (resultsError) {
      console.error('[Territory] Supabase results insert error:', resultsError.message);
    } else {
      console.log(`[Territory] Persisted scan ${scan.id} with ${rows.length} territory results`);
    }
  } catch (err) {
    console.error('[Territory] Supabase persist exception:', err.message);
  }
}
