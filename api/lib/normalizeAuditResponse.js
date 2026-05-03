// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZE AUDIT RESPONSE
// Transforms raw runAudit() internals into the canonical AuditResponse shape.
// This is the ONLY place where raw engine field names / module outputs are
// translated to the canonical contract. Every renderer reads from the result.
// ─────────────────────────────────────────────────────────────────────────────

import {
  AUDIT_RESPONSE_VERSION,
  PLATFORM_AVAILABILITY,
  MODULE_AVAILABILITY,
  SEVERITY,
  RISK_LEVEL,
  COVERAGE_STATUS,
  MODULE_KEYS,
} from '../schema/auditResponse.js';

import { randomUUID, createHash } from 'node:crypto';

// ── Public API ───────────────────────────────────────────────────────────────
export function normalizeAuditResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[normalizeAuditResponse] raw input missing');
  }

  const scanId    = raw.scanId || randomUUID();
  const scannedAt = raw.scannedAt || new Date().toISOString();

  const source   = _normalizeSource(raw);
  const subject  = _normalizeSubject(raw);
  const metrics  = _normalizeMetrics(raw);
  const catalog  = _normalizeCatalog(raw);
  const platforms     = _normalizePlatforms(raw);
  const auditCoverage = _normalizeAuditCoverage(raw);
  const auditCoverageRaw = _deriveCoverageRaw(auditCoverage);
  const modules  = _normalizeModules(raw);
  const ownership = _normalizeOwnership(raw);
  const score    = _computeScore(raw, modules, ownership);
  const issues   = _normalizeIssues(raw, modules);
  const royaltyGap = _normalizeRoyaltyGap(raw);
  const proGuide = _normalizeProGuide(raw);

  return {
    schemaVersion: AUDIT_RESPONSE_VERSION,
    scanId,
    scannedAt,
    source,
    subject,
    metrics,
    catalog,
    platforms,
    auditCoverage,
    auditCoverageRaw,
    modules,
    issues,
    score,
    royaltyGap,
    proGuide,
    ownership,
    territoryCoverage: null,
    isrcValidation:    null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────

function _normalizeSource(r) {
  return {
    platform:     r.sourcePlatform || (r.platform === 'apple' ? 'apple_music' : 'spotify'),
    urlType:      r.type || 'artist',
    resolvedFrom: r.resolvedFrom || r.type || 'artist',
    originalUrl:  r._originalUrl || r.originalUrl || '',
    storefront:   r._storefront || r.storefront || null,
  };
}

function _normalizeSubject(r) {
  const spotifyId = _nullableString(r.artistId);
  const appleId   = _nullableString(r.appleMusic?.artistId);
  if (!spotifyId && !appleId) {
    throw new Error('[normalizeAuditResponse] Scan requires at least one platform artist ID (Spotify or Apple)');
  }
  return {
    artistName:      _requireString(r.artistName, 'subject.artistName'),
    artistId:        spotifyId,
    trackTitle:      _nullableString(r.trackTitle),
    trackIsrc:       _nullableString(r.trackIsrc),
    trackIsrcSource: _nullableString(r.trackIsrcSource),
    albumName:       _nullableString(r.appleMusicSource?.albumName),
  };
}

function _normalizeMetrics(r) {
  return {
    followers:       _num(r.followers),
    popularity:      _num(r.popularity),
    genres:          Array.isArray(r.genres) ? r.genres.filter(g => typeof g === 'string') : [],
    lastfmPlays:     _num(r.lastfmPlays),
    lastfmListeners: _num(r.lastfmListeners),
    deezerFans:      _num(r.deezerFans),
    tidalPopularity: _num(r.tidalPopularity),
    discogsReleases: _num(r.discogsReleases),
    country:         _nullableString(r.country),
    wikipediaUrl:    _nullableString(r.wikipediaUrl),
  };
}

function _normalizeCatalog(r) {
  const c = r.catalog || {};
  return {
    totalReleases:          _num(c.totalReleases),
    earliestYear:           c.earliestYear ?? null,
    latestYear:             c.latestYear ?? null,
    catalogAgeYears:        _num(c.catalogAgeYears),
    estimatedAnnualStreams: _num(c.estimatedAnnualStreams),
    recentActivity:         Boolean(c.recentActivity),
  };
}

// Platform availability map.
// The raw engine exposes booleans on `platforms.*` AND richer objects
// (appleMusic, youtube, tidal) on root-level keys. We merge them into
// a consistent { availability, details } shape.
function _normalizePlatforms(r) {
  const p = r.platforms || {};

  // spotify is always reachable at this point — getting past runAudit means it verified
  const spotify = {
    availability: PLATFORM_AVAILABILITY.VERIFIED,
    details: null,
  };

  const appleMusicDetails = r.appleMusic || {};
  const appleMusic = {
    availability: appleMusicDetails.error
      ? PLATFORM_AVAILABILITY.ERROR
      : (p.appleMusic ? PLATFORM_AVAILABILITY.VERIFIED : PLATFORM_AVAILABILITY.NOT_FOUND),
    details: p.appleMusic ? {
      artistId:          appleMusicDetails.artistId || null,
      artistUrl:         appleMusicDetails.artistUrl || null,
      albumCount:        _num(appleMusicDetails.albumCount),
      catalogComparison: appleMusicDetails.catalogComparison || null,
      isrcLookup:        appleMusicDetails.isrcLookup || null,
    } : null,
  };

  const youtubeDetails = r.youtube || {};
  let youtubeAvailability;
  if (youtubeDetails.reason === 'API key not configured') {
    youtubeAvailability = PLATFORM_AVAILABILITY.AUTH_UNAVAILABLE;
  } else if (youtubeDetails.found) {
    youtubeAvailability = PLATFORM_AVAILABILITY.VERIFIED;
  } else if (youtubeDetails.reason) {
    youtubeAvailability = PLATFORM_AVAILABILITY.ERROR;
  } else {
    youtubeAvailability = PLATFORM_AVAILABILITY.NOT_FOUND;
  }
  const youtube = {
    availability: youtubeAvailability,
    details: youtubeDetails.found ? {
      officialChannel: youtubeDetails.officialChannel || null,
      ugc:             youtubeDetails.ugc || null,
      subscriberCount: _num(youtubeDetails.subscriberCount),
    } : null,
  };

  // simple boolean-mapped platforms
  const simple = (flag) => ({
    availability: flag ? PLATFORM_AVAILABILITY.VERIFIED : PLATFORM_AVAILABILITY.NOT_FOUND,
    details: null,
  });

  return {
    spotify,
    appleMusic,
    musicbrainz: simple(p.musicbrainz),
    deezer:      simple(p.deezer),
    audiodb:     simple(p.audiodb),
    discogs:     simple(p.discogs),
    soundcloud:  simple(p.soundcloud),
    lastfm:      simple(p.lastfm),
    wikipedia:   simple(p.wikipedia),
    youtube,
    tidal:       simple(p.tidal),
  };
}

function _normalizeAuditCoverage(r) {
  const ac = r.auditCoverage || {};
  const ensure = (entry) => {
    if (!entry || !entry.status) {
      return { status: COVERAGE_STATUS.NOT_CONFIRMED, tier: null };
    }
    // status values come straight from the engine; validate they're in the enum
    const valid = Object.values(COVERAGE_STATUS).includes(entry.status);
    return {
      status: valid ? entry.status : COVERAGE_STATUS.NOT_CONFIRMED,
      tier:   entry.tier || null,
    };
  };
  return {
    spotify:       ensure(ac.spotify),
    appleMusic:    ensure(ac.appleMusic),
    publishing:    ensure(ac.publishing),
    soundExchange: ensure(ac.soundExchange),
  };
}

function _deriveCoverageRaw(auditCoverage) {
  return {
    _deprecated: true,
    spotify:     { connected: auditCoverage.spotify.status    === COVERAGE_STATUS.VERIFIED },
    apple_music: { connected: auditCoverage.appleMusic.status === COVERAGE_STATUS.VERIFIED },
  };
}

// Module shape standardization.
// Raw engine: modules[key] = { name, score, flags }
// Canonical:  { key, name, score, grade, availability, issueCount, flags }
function _normalizeModules(r) {
  const rawModules = r.modules || {};
  const out = {};
  for (const key of MODULE_KEYS) {
    const m = rawModules[key];
    if (!m) {
      // Engine didn't produce this module — mark as auth-unavailable, score null
      out[key] = {
        key,
        name: _defaultModuleName(key),
        score: null,
        grade: null,
        availability: MODULE_AVAILABILITY.AUTH_UNAVAILABLE,
        issueCount: 0,
        flags: [],
      };
      continue;
    }

    // Special case: youtube module is auth-unavailable if the API key wasn't set
    let availability = MODULE_AVAILABILITY.AVAILABLE;
    if (key === 'youtube' && r.youtube?.reason === 'API key not configured') {
      availability = MODULE_AVAILABILITY.AUTH_UNAVAILABLE;
    }

    const flags = Array.isArray(m.flags) ? m.flags : [];
    const score = availability === MODULE_AVAILABILITY.AUTH_UNAVAILABLE ? null : _num(m.score);

    out[key] = {
      key,
      name: m.name || _defaultModuleName(key),
      score,
      grade: score == null ? null : _grade(score),
      availability,
      issueCount: flags.length,
      flags,
    };
  }
  return out;
}

function _defaultModuleName(key) {
  return ({
    metadata:   'Metadata Integrity',
    coverage:   'Platform Coverage',
    publishing: 'Publishing Risk',
    duplicates: 'Duplicate Detection',
    youtube:    'YouTube / UGC',
    sync:       'Sync Readiness',
  })[key] || key;
}

// Severity normalization: engine emits lowercase high/medium/low.
// Canonical uses CRITICAL/HIGH/WARNING/INFO.
// Rule: if the source module has score < 40 AND severity is 'high',
// escalate to CRITICAL. This surfaces the most severe issues visibly.
function _normalizeSeverity(rawSeverity, moduleScore) {
  const sev = (rawSeverity || '').toLowerCase();
  if (sev === 'high') {
    if (moduleScore != null && moduleScore < 40) return SEVERITY.CRITICAL;
    return SEVERITY.HIGH;
  }
  if (sev === 'medium') return SEVERITY.WARNING;
  return SEVERITY.INFO;
}

function _normalizeIssues(r, modules) {
  const rawFlags = Array.isArray(r.flags) ? r.flags : [];
  const moduleKeyByName = Object.fromEntries(
    Object.values(modules).map(m => [m.name, m.key])
  );

  return rawFlags.map(f => {
    const moduleKey = moduleKeyByName[f.module] || _inferModuleKey(f.module);
    const mod = modules[moduleKey];
    const modScore = mod?.score ?? null;
    const severity = _normalizeSeverity(f.severity, modScore);
    const title = _deriveIssueTitle(f.description);
    const detail = f.description || '';
    return {
      id:         _issueId(moduleKey, detail),
      module:     moduleKey,
      moduleName: f.module || (mod?.name) || moduleKey,
      severity,
      title,
      detail,
      source:     _issueSource(f.module, moduleKey),
    };
  });
}

function _inferModuleKey(displayName) {
  if (!displayName) return 'metadata';
  const n = displayName.toLowerCase();
  if (n.includes('metadata'))   return 'metadata';
  if (n.includes('coverage') || n.includes('platform')) return 'coverage';
  if (n.includes('publishing') || n.includes('ownership')) return 'publishing';
  if (n.includes('duplicate'))  return 'duplicates';
  if (n.includes('youtube') || n.includes('ugc')) return 'youtube';
  if (n.includes('sync'))       return 'sync';
  return 'metadata';
}

function _issueSource(displayName, moduleKey) {
  if (!displayName) return 'module';
  const n = displayName.toLowerCase();
  if (n.includes('ownership')) return 'ownership';
  if (n.includes('platform'))  return 'platform';
  if (moduleKey === 'publishing' && n.includes('catalog')) return 'catalog';
  return 'module';
}

function _deriveIssueTitle(description) {
  if (!description) return 'Issue detected';
  // Prefer the part before the first em-dash or colon (these are the engine's
  // natural "headline — body" separators). Fall back to the first 80 chars.
  const match = description.match(/^(.+?)(?: — | – |: )/);
  if (match) {
    const t = match[1].trim();
    return t.length > 80 ? t.slice(0, 77) + '…' : t;
  }
  // No natural separator → collapse to a short headline up to first sentence break or 60 chars.
  const short = description.length > 60 ? description.slice(0, 57) + '…' : description;
  return short;
}

function _issueId(moduleKey, detail) {
  return createHash('sha1').update(`${moduleKey}::${detail}`).digest('hex').slice(0, 12);
}

function _normalizeOwnership(r) {
  const ov = r.ownershipVerification || {};
  return {
    status:      ov.ownership_status || 'unverified',
    confidence:  _ownershipConfidence(ov),
    scoreImpact: _num(ov.score_impact),
    render:      r.ownershipVerificationRender || null,
  };
}

function _ownershipConfidence(ov) {
  const c = ov.confidence || ov.overall_confidence;
  if (c === 'HIGH' || c === 'MEDIUM' || c === 'LOW' || c === 'AUTH_UNAVAILABLE') return c;
  // Fallback derivation from spotify_confidence / apple_confidence if present
  if (ov.spotify_confidence === 'HIGH' && ov.apple_confidence === 'HIGH') return 'HIGH';
  if (ov.spotify_confidence === 'AUTH_UNAVAILABLE' || ov.apple_confidence === 'AUTH_UNAVAILABLE') {
    return 'AUTH_UNAVAILABLE';
  }
  return 'LOW';
}

function _computeScore(r, modules, ownership) {
  // Module average (excluding AUTH_UNAVAILABLE modules)
  const availableScores = Object.values(modules)
    .filter(m => m.availability !== MODULE_AVAILABILITY.AUTH_UNAVAILABLE && m.score != null)
    .map(m => m.score);
  const moduleAverage = availableScores.length
    ? Math.round(availableScores.reduce((a, b) => a + b, 0) / availableScores.length)
    : 0;

  const ownershipImpact = _num(ownership.scoreImpact);
  const overall = Math.max(0, Math.min(100, moduleAverage + ownershipImpact));

  // Prefer engine's overallScore if it exists AND matches within a tolerance —
  // otherwise use our computed value. This protects against divergence.
  const engineOverall = _num(r.overallScore);
  const finalOverall = Math.abs(engineOverall - overall) <= 2 ? engineOverall : overall;

  return {
    overall:         finalOverall,
    riskLevel:       _riskLevel(finalOverall),
    riskSummary:     _riskSummary(finalOverall, r.flags),
    moduleAverage,
    ownershipImpact,
  };
}

function _riskLevel(overall) {
  if (overall >= 80) return RISK_LEVEL.LOW;
  if (overall >= 60) return RISK_LEVEL.MODERATE;
  if (overall >= 40) return RISK_LEVEL.HIGH;
  return RISK_LEVEL.CRITICAL;
}

function _riskSummary(overall, rawFlags) {
  const flags = Array.isArray(rawFlags) ? rawFlags : [];
  const highs = flags.filter(f => f.severity === 'high').slice(0, 2);
  const level = _riskLevel(overall);
  const prefix = {
    LOW:      'Low risk — catalog signals look healthy.',
    MODERATE: 'Moderate risk — some gaps detected.',
    HIGH:     'High risk — multiple issues need attention.',
    CRITICAL: 'Critical risk — major gaps in royalty pathways.',
  }[level];
  if (highs.length === 0) return prefix;
  // Split only on em-dash / hyphen-dash / colon (NOT period — breaks numbers like "234,567,890")
  const leads = highs
    .map(f => {
      const desc = (f.description || '').trim();
      const cut = desc.split(/ — | – |: /)[0].trim();
      // Cap each lead at 90 chars to keep the summary readable
      return cut.length > 90 ? cut.slice(0, 87) + '…' : cut;
    })
    .filter(Boolean);
  return leads.length ? `${prefix} Top concerns: ${leads.join('; ')}.` : prefix;
}

function _normalizeRoyaltyGap(r) {
  const g = r.royaltyGap || {};
  return {
    estAnnualStreams:     _num(g.estAnnualStreams),
    estLifetimeStreams:   _num(g.estLifetimeStreams),
    estSpotifyRoyalties:  _num(g.estSpotifyRoyalties),
    estPROEarnings:       _num(g.estPROEarnings),
    estTotalRoyalties:    _num(g.estTotalRoyalties),
    potentialGapLow:      _num(g.potentialGapLow),
    potentialGapHigh:     _num(g.potentialGapHigh),
    catalogYears:         _num(g.catalogYears),
    ugcUnmonetisedViews:  _num(g.ugcUnmonetisedViews),
    ugcPotentialRevenue:  _num(g.ugcPotentialRevenue),
    disclaimer:           g.disclaimer || 'Estimates only. Verify with your distributor and PRO.',
  };
}

function _normalizeProGuide(r) {
  const p = r.proGuide || {};
  return {
    pro:     p.pro     || 'Your local PRO',
    url:     p.url     || 'https://www.cisac.org',
    steps:   Array.isArray(p.steps) ? p.steps : [],
    note:    p.note    || '',
    country: p.country || null,
  };
}

// ── Utilities ────────────────────────────────────────────────────────────────
function _num(v) {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function _nullableString(v) { return (v == null || v === '') ? null : String(v); }
function _requireString(v, path) {
  if (typeof v !== 'string' || !v) throw new Error(`[normalizeAuditResponse] required field missing: ${path}`);
  return v;
}
function _grade(n) {
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 70) return 'C';
  if (n >= 60) return 'D';
  return 'F';
}
