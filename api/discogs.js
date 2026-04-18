// /api/discogs.js
// Royalte Discogs Client — Secondary metadata enrichment only
//
// IMPORTANT: Discogs is NOT a source of truth for royalties, ownership,
// publishing, or payout data. It is used solely for release context,
// metadata enrichment, and confidence boosting.
//
// Discogs should NEVER override verified data from Spotify, Apple Music,
// ISRC, UPC, or user-uploaded statements.

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = process.env.DISCOGS_USER_AGENT || 'RoyalteAudit/1.0 (audit@royalte.ai)';

// Simple in-memory cache to avoid duplicate lookups within the same process
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.value;
}

function _cacheSet(key, value) {
  _cache.set(key, { value, ts: Date.now() });
}

// ── AUTH HEADERS ─────────────────────────────────────────────────────────────
// Using Consumer Key/Secret (OAuth 1.0 header-less auth — Discogs allows this
// for read-only unauthenticated searches). Swap to full OAuth later if needed.
function _getHeaders() {
  const key = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers = { 'User-Agent': USER_AGENT };
  if (key && secret) {
    headers['Authorization'] = `Discogs key=${key}, secret=${secret}`;
  }
  return headers;
}

// ── FETCH WITH RETRY + BACKOFF ────────────────────────────────────────────────
async function _fetch(url, retries = 2) {
  const headers = _getHeaders();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (resp.status === 429) {
        // Rate limited — back off before retry
        const wait = (attempt + 1) * 1500;
        console.warn(`[Discogs] Rate limited. Waiting ${wait}ms before retry ${attempt + 1}`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!resp.ok) {
        console.warn(`[Discogs] HTTP ${resp.status} for ${url}`);
        return null;
      }
      return await resp.json();
    } catch (err) {
      if (attempt === retries) {
        console.error(`[Discogs] Fetch failed after ${retries + 1} attempts: ${err.message}`);
        return null;
      }
      await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
    }
  }
  return null;
}

// ── NORMALIZATION HELPERS ─────────────────────────────────────────────────────
// Normalize strings before comparison — preserve originals for reporting
const _STRIP_SUFFIXES = [
  /\(remaster(ed)?\)/gi, /\(radio edit\)/gi, /\(clean\)/gi, /\(explicit\)/gi,
  /\(extended( mix)?\)/gi, /\(live( at .+)?\)/gi, /\(instrumental\)/gi,
  /\(remix\)/gi, /\s*-\s*remaster(ed)?$/gi, /\s*-\s*radio edit$/gi,
];

export function normalize(str) {
  if (!str) return '';
  let s = str.toLowerCase().trim();
  // Normalize ampersands and featuring patterns
  s = s.replace(/\s*&\s*/g, ' and ');
  s = s.replace(/\bfeat\.?\s*/gi, 'featuring ');
  s = s.replace(/\bft\.?\s*/gi, 'featuring ');
  // Strip version/edition noise
  _STRIP_SUFFIXES.forEach(re => { s = s.replace(re, ''); });
  // Remove punctuation (keep spaces)
  s = s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

// Levenshtein distance for fuzzy matching
function _levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

export function fuzzyScore(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  const dist = _levenshtein(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

// ── CANDIDATE SCORING ─────────────────────────────────────────────────────────
// Weighted confidence approach — Discogs has LIGHT influence only
export function scoreDiscogsCandidate({ candidate, artistName, trackTitle, albumTitle, year, label }) {
  let score = 0;
  const notes = [];
  const evidence = {
    artist_match: false,
    title_match: false,
    label_match: false,
    year_match: false,
    fuzzy_score: 0,
  };

  // Artist name matching
  const artistFuzz = fuzzyScore(candidate.artist || candidate.title, artistName);
  evidence.fuzzy_score = artistFuzz;
  if (artistFuzz === 1.0) { score += 30; evidence.artist_match = true; notes.push('Exact artist name match'); }
  else if (artistFuzz >= 0.85) { score += 20; evidence.artist_match = true; notes.push('Close artist name match'); }
  else if (artistFuzz >= 0.65) { score += 8; notes.push('Partial artist name match'); }
  else if (artistFuzz < 0.4) { score -= 20; notes.push('Weak artist name match — possible wrong artist'); }

  // Title matching (track or release)
  if (trackTitle || albumTitle) {
    const titleToMatch = trackTitle || albumTitle;
    const candidateTitle = candidate.title || '';
    const titleFuzz = fuzzyScore(candidateTitle, titleToMatch);
    if (titleFuzz === 1.0) { score += 30; evidence.title_match = true; notes.push('Exact title match'); }
    else if (titleFuzz >= 0.85) { score += 18; evidence.title_match = true; notes.push('Close title match'); }
    else if (titleFuzz >= 0.65) { score += 8; notes.push('Partial title match'); }
    else { score -= 5; notes.push('Title mismatch'); }
  }

  // Year proximity (small positive)
  if (year && candidate.year) {
    const diff = Math.abs(parseInt(year) - parseInt(candidate.year));
    if (diff === 0) { score += 8; evidence.year_match = true; notes.push('Year matches exactly'); }
    else if (diff <= 1) { score += 4; evidence.year_match = true; notes.push('Year within 1 year'); }
    else if (diff <= 2) { score += 2; notes.push('Year within 2 years'); }
  }

  // Label matching (small positive)
  if (label && candidate.label) {
    const labelFuzz = fuzzyScore(candidate.label, label);
    if (labelFuzz >= 0.8) { score += 5; evidence.label_match = true; notes.push('Label match'); }
  }

  // Negative signals — version/live/remix mismatches
  const titleLower = (candidate.title || '').toLowerCase();
  if (trackTitle && !titleLower.includes('remix') && titleLower.includes('remix')) {
    score -= 10; notes.push('Remix version mismatch');
  }
  if (trackTitle && titleLower.includes('live') && !trackTitle.toLowerCase().includes('live')) {
    score -= 8; notes.push('Live version mismatch');
  }
  if (candidate.type === 'compilation' && trackTitle) {
    score -= 5; notes.push('Compilation-only entry');
  }

  // Determine status
  let status;
  if (score >= 45) status = 'matched';
  else if (score >= 20) status = 'possible_match';
  else status = 'no_confident_match';

  return { score: Math.max(0, Math.min(100, score)), status, notes, evidence };
}

// ── NORMALIZE DISCOGS RESULT ──────────────────────────────────────────────────
export function normalizeDiscogsResult(raw, matchMeta = {}) {
  if (!raw) return null;
  return {
    status: matchMeta.status || 'not_found',
    confidence: matchMeta.score || 0,
    matched_entity_type: raw.type || null,
    artist_name: raw.artist || raw.title || null,
    release_title: raw.title || null,
    label: Array.isArray(raw.label) ? raw.label[0] : (raw.label || null),
    year: raw.year || null,
    formats: Array.isArray(raw.format) ? raw.format : [],
    country: raw.country || null,
    discogs_url: raw.uri ? `https://www.discogs.com${raw.uri}` : null,
    notes: matchMeta.notes || [],
    evidence: matchMeta.evidence || {},
  };
}

// ── SEARCH ARTIST ─────────────────────────────────────────────────────────────
export async function searchDiscogsArtist(artistName) {
  const cacheKey = `artist:${normalize(artistName)}`;
  const cached = _cacheGet(cacheKey);
  if (cached) { console.log(`[Discogs] Cache hit: ${cacheKey}`); return cached; }

  console.log(`[Discogs] Searching artist: ${artistName}`);
  const query = encodeURIComponent(artistName);
  const data = await _fetch(`${DISCOGS_BASE}/database/search?q=${query}&type=artist&per_page=5`);

  if (!data || !data.results?.length) {
    const result = { found: false, releases: 0, status: 'not_found' };
    _cacheSet(cacheKey, result);
    return result;
  }

  // Score candidates and pick best
  const scored = data.results.map(r => ({
    raw: r,
    ...scoreDiscogsCandidate({ candidate: r, artistName }),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.status === 'no_confident_match') {
    const result = { found: false, releases: 0, status: 'no_confident_match', notes: best.notes };
    _cacheSet(cacheKey, result);
    return result;
  }

  // Fetch release count for best match
  const relData = await _fetch(`${DISCOGS_BASE}/artists/${best.raw.id}/releases?per_page=1`);
  const releaseCount = relData?.pagination?.items || 0;

  const result = {
    found: true,
    artistId: best.raw.id,
    name: best.raw.title,
    releases: releaseCount,
    link: `https://www.discogs.com/artist/${best.raw.id}`,
    status: best.status,
    confidence: best.score,
    notes: best.notes,
    evidence: best.evidence,
    // Known aliases if present
    aliases: best.raw.aliases || [],
  };

  _cacheSet(cacheKey, result);
  return result;
}

// ── SEARCH RELEASE ────────────────────────────────────────────────────────────
export async function searchDiscogsRelease({ artistName, trackTitle, albumTitle, releaseTitle, year, label }) {
  const titleQuery = trackTitle || albumTitle || releaseTitle;
  if (!titleQuery && !artistName) return { found: false, status: 'skipped', notes: ['Insufficient metadata for Discogs release search'] };

  const cacheKey = `release:${normalize(artistName)}:${normalize(titleQuery)}:${year || ''}`;
  const cached = _cacheGet(cacheKey);
  if (cached) { console.log(`[Discogs] Cache hit: ${cacheKey}`); return cached; }

  console.log(`[Discogs] Searching release: ${artistName} — ${titleQuery}`);

  const parts = [];
  if (artistName) parts.push(`artist=${encodeURIComponent(artistName)}`);
  if (titleQuery) parts.push(`release_title=${encodeURIComponent(titleQuery)}`);
  if (year) parts.push(`year=${year}`);
  parts.push('type=release&per_page=5');

  const data = await _fetch(`${DISCOGS_BASE}/database/search?${parts.join('&')}`);

  if (!data || !data.results?.length) {
    const result = { found: false, status: 'not_found', notes: ['No Discogs release results returned'] };
    _cacheSet(cacheKey, result);
    return result;
  }

  const scored = data.results.map(r => ({
    raw: r,
    ...scoreDiscogsCandidate({ candidate: r, artistName, trackTitle, albumTitle: albumTitle || releaseTitle, year, label }),
  })).sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (best.status === 'no_confident_match') {
    const result = {
      found: false,
      status: 'no_confident_match',
      notes: best.notes,
      evidence: best.evidence,
    };
    _cacheSet(cacheKey, result);
    return result;
  }

  const normalized = normalizeDiscogsResult(best.raw, best);
  const result = { found: true, ...normalized };
  _cacheSet(cacheKey, result);
  return result;
}

// ── GET RELEASE BY ID ─────────────────────────────────────────────────────────
export async function getDiscogsReleaseById(id) {
  const cacheKey = `release_id:${id}`;
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  const data = await _fetch(`${DISCOGS_BASE}/releases/${id}`);
  if (!data) return null;

  const result = {
    id: data.id,
    title: data.title,
    artists: (data.artists || []).map(a => a.name),
    year: data.year,
    label: (data.labels || [])[0]?.name || null,
    formats: (data.formats || []).map(f => f.name),
    country: data.country || null,
    url: data.uri ? `https://www.discogs.com${data.uri}` : null,
    genres: data.genres || [],
    styles: data.styles || [],
  };

  _cacheSet(cacheKey, result);
  return result;
}

// ── MAIN ENRICHMENT FUNCTION — called from audit.js ──────────────────────────
// This is the single entry point for the scan pipeline.
// Replaces the old getDiscogs() function in audit.js.
export async function enrichWithDiscogs({ artistName, trackTitle, albumTitle, year, isrc }) {
  // Guard: skip if no artist name
  if (!artistName) {
    return {
      found: false,
      discogs: {
        status: 'skipped',
        confidence: 0,
        matched_entity_type: null,
        artist_name: null,
        release_title: null,
        label: null,
        year: null,
        formats: [],
        country: null,
        discogs_url: null,
        notes: ['Skipped — no artist name available'],
        evidence: {},
        summary: 'Discogs match skipped due to insufficient metadata',
      },
      releases: 0,
    };
  }

  try {
    // Step 1: Artist search — always run
    const artistResult = await searchDiscogsArtist(artistName);

    // Step 2: Release search — run if we have a track or album title
    let releaseResult = null;
    if (trackTitle || albumTitle) {
      releaseResult = await searchDiscogsRelease({
        artistName,
        trackTitle,
        albumTitle,
        year,
      });
    }

    // Step 3: Merge results — release match wins if confident, artist is fallback
    const primaryResult = (releaseResult?.found && releaseResult.status === 'matched')
      ? releaseResult
      : artistResult;

    const status = primaryResult?.status || 'not_found';
    const confidence = primaryResult?.confidence || 0;

    // Step 4: Build summary string for frontend display
    let summary;
    if (status === 'matched') summary = 'Discogs found a likely matching release';
    else if (status === 'possible_match') summary = 'Discogs found possible catalog context but no confident track-level match';
    else if (status === 'not_found') summary = 'No Discogs match found';
    else if (status === 'skipped') summary = 'Discogs match skipped due to insufficient metadata';
    else summary = 'Discogs match unavailable';

    const discogsBlock = {
      status,
      confidence,
      matched_entity_type: releaseResult?.found ? 'release' : (artistResult?.found ? 'artist' : null),
      artist_name: artistResult?.name || null,
      release_title: releaseResult?.release_title || null,
      label: releaseResult?.label || null,
      year: releaseResult?.year || null,
      formats: releaseResult?.formats || [],
      country: releaseResult?.country || null,
      discogs_url: releaseResult?.discogs_url || artistResult?.link || null,
      notes: [
        ...(artistResult?.notes || []),
        ...(releaseResult?.notes || []),
      ],
      evidence: releaseResult?.evidence || artistResult?.evidence || {},
      summary,
    };

    console.log(`[Discogs] enrichWithDiscogs result: ${status} (confidence: ${confidence}) for "${artistName}"`);

    return {
      found: artistResult.found || false,
      releases: artistResult.releases || 0,
      artistId: artistResult.artistId || null,
      name: artistResult.name || null,
      link: artistResult.link || null,
      discogs: discogsBlock,
    };

  } catch (err) {
    console.error(`[Discogs] enrichWithDiscogs error: ${err.message}`);
    return {
      found: false,
      releases: 0,
      discogs: {
        status: 'error',
        confidence: 0,
        matched_entity_type: null,
        artist_name: null,
        release_title: null,
        label: null,
        year: null,
        formats: [],
        country: null,
        discogs_url: null,
        notes: [`Discogs error: ${err.message}`],
        evidence: {},
        summary: 'Discogs scan failed — full audit continues without Discogs data',
      },
    };
  }
}
