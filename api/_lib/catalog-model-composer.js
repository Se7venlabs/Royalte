// ─────────────────────────────────────────────────────────────────────
//  Royaltē Catalog Model Composer™ — Phase 6C
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Provider Adapter™  →  Scan Engine™  →  Catalog Model Composer™
//        ↓
//    Canonical Catalog Model™
//        ↓
//    Canonical Intelligence Object™  →  Rule Library™  →  Catalog Intelligence™
//
//  This module is the sole owner of Canonical Catalog Model™ assembly.
//  The Scan Engine™ (run-scan.js) orchestrates: it calls provider adapters,
//  then calls this composer, then stores the result. Orchestration belongs
//  to the engine; assembly belongs here.
//
//  This module may:
//    • assemble releases[]
//    • assemble recordings[]
//    • delegate release type classification to catalog-classifier.js
//    • delegate releaseId generation to catalog-id.js
//    • derive byProvider counts from assembled releases[]
//    • derive canonical summary facts (releasesCount, earliestYear, etc.)
//    • normalise catalogSync from provider catalogComparison shape
//    • normalise storefrontCoverage from provider storefrontAvailability shape
//
//  This module shall NEVER:
//    • evaluate Rule Library™ conditions
//    • detect orphan recordings (Rule Library™ Phase 6D)
//    • detect duplicate releases (Rule Library™ Phase 6D)
//    • generate recommendations
//    • compute Royaltē Health™ scores
//    • interpret catalog meaning
//    • perform I/O or network calls
//    • mutate inputs
// ─────────────────────────────────────────────────────────────────────

import { classifyRelease } from './catalog-classifier.js';
import { generateReleaseId } from './catalog-id.js';

/**
 * buildCatalogModel(albumsData, appleMusicData, appleSongs, artistName)
 *
 * Pure composition function. Assembles the Canonical Catalog Model™ from
 * already-normalized provider facts supplied by the Scan Engine.
 *
 * Always returns a structurally-valid model object. Never throws.
 *
 * @param {object} albumsData      raw Spotify albums response ({ items: [] })
 * @param {object} appleMusicData  normalized Apple Music adapter output
 * @param {Array}  appleSongs      ISRC-bearing songs from getArtistSongs()
 * @param {string} artistName      canonical artist name
 * @returns {object}               Canonical Catalog Model™
 */
export function buildCatalogModel(albumsData, appleMusicData, appleSongs, artistName) {
  const safeAppleAlbums  = Array.isArray(appleMusicData && appleMusicData.albums) ? appleMusicData.albums : [];
  const safeSpotifyItems = Array.isArray(albumsData && albumsData.items)          ? albumsData.items      : [];
  const safeAppleSongs   = Array.isArray(appleSongs)                              ? appleSongs            : [];
  const safeArtistName   = typeof artistName === 'string' ? artistName : '';

  // ── 1. Release inventory ─────────────────────────────────────────────────
  // Apple is canonical per the Royaltē Constitution. Spotify is the fallback
  // when Apple did not find the artist or returned no albums for this scan.
  const releases = [];
  if (safeAppleAlbums.length > 0) {
    for (const a of safeAppleAlbums) {
      const releaseYear = a.releaseDate
        ? parseInt(String(a.releaseDate).slice(0, 4), 10)
        : null;
      releases.push({
        releaseId:   generateReleaseId(safeArtistName, a.name || '', Number.isFinite(releaseYear) ? releaseYear : null),
        externalIds: { apple: a.id || null, spotify: null },
        title:       a.name        || null,
        releaseType: classifyRelease(a.trackCount, null), // Apple has no album_type
        releaseDate: a.releaseDate || null,
        trackCount:  typeof a.trackCount === 'number' ? a.trackCount : null,
        artwork:     a.artwork     || null,
        upc:         null,                               // v2.0: requires per-release API call
        providers:   ['apple'],
      });
    }
  } else {
    // Spotify fallback — raw items carry name, id, total_tracks, album_type
    for (const item of safeSpotifyItems) {
      const dateStr     = item.release_date || '';
      const releaseYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : null;
      releases.push({
        releaseId:   generateReleaseId(safeArtistName, item.name || '', Number.isFinite(releaseYear) ? releaseYear : null),
        externalIds: { apple: null, spotify: item.id || null },
        title:       item.name     || null,
        releaseType: classifyRelease(item.total_tracks, item.album_type),
        releaseDate: dateStr       || null,
        trackCount:  typeof item.total_tracks === 'number' ? item.total_tracks : null,
        artwork:     null,
        upc:         null,
        providers:   ['spotify'],
      });
    }
  }

  // ── 2. Title → releaseId lookup for recording linkage ───────────────────
  const titleToReleaseId = new Map();
  for (const r of releases) {
    if (r.title) titleToReleaseId.set(r.title.toLowerCase().trim(), r.releaseId);
  }

  // ── 3. Recording inventory ───────────────────────────────────────────────
  //
  // PHASE 6C HEURISTIC — recording-to-release linkage:
  //   song.albumName (string)  →  release.title (string), case-insensitive.
  //
  // This is a temporary heuristic for Phase 6C v1.0. Future phases will
  // replace it with deterministic provider-ID linkage (e.g. Apple Music's
  // song relationship → album ID → Release.externalIds.apple), eliminating
  // false negatives caused by title variations across editions or regions.
  //
  // An empty releaseIds[] is a canonical fact — it records that no confirmed
  // linkage was found for this recording in this scan. It is NOT an
  // intelligence conclusion. The Rule Library™ (Phase 6D) decides what
  // no-linkage means.
  const recordings = safeAppleSongs.map((s) => {
    const albumKey  = s.albumName ? s.albumName.toLowerCase().trim() : '';
    const matchedId = titleToReleaseId.get(albumKey) || null;
    return {
      isrc:       s.isrc,
      title:      s.name      || null,
      albumName:  s.albumName || null,
      releaseIds: matchedId ? [matchedId] : [],
      providers:  ['apple'],
    };
  });

  // ── 4. byProvider — derived from assembled releases[] (not provider totals) ─
  // Board directive 2026-06-20: byProvider represents Royaltē's assembled
  // knowledge, not raw provider-reported counts. Count releases by their
  // providers[] membership so the value is always consistent with the
  // inventory actually assembled. 0 → null: null = "no confirmed presence"
  // which is distinct from 0 implying a checked-and-empty state.
  // (0 || null evaluates to null since 0 is falsy.)
  const byProvider = {
    apple:   releases.filter((r) => r.providers.includes('apple')).length   || null,
    spotify: releases.filter((r) => r.providers.includes('spotify')).length || null,
  };

  // ── 5. Canonical summary facts — derived from assembled releases[] ────────
  // Board directive 2026-06-20: summary facts belong inside the model and
  // must be derived from the assembled inventory, not from raw provider data.
  const releaseYears = releases
    .map((r) => r.releaseDate ? parseInt(String(r.releaseDate).slice(0, 4), 10) : null)
    .filter((y) => typeof y === 'number' && Number.isFinite(y) && y > 1950);

  const earliestYear    = releaseYears.length ? Math.min(...releaseYears) : null;
  const latestYear      = releaseYears.length ? Math.max(...releaseYears) : null;
  const currentYear     = new Date().getUTCFullYear();
  const catalogAgeYears = earliestYear ? (currentYear - earliestYear) : 0;
  const recentActivity  = releaseYears.some((y) => y >= currentYear - 2);

  // ── 6. Catalog synchronization ───────────────────────────────────────────
  // Derived from Apple's Spotify-top-tracks cross-reference (computed inside
  // getAppleMusic by the adapter). Shape is normalised into the canonical
  // CatalogSync object; the `source` field documents the comparison method.
  const rawSync     = (appleMusicData && appleMusicData.catalogComparison) || null;
  const catalogSync = rawSync ? {
    tracksChecked: typeof rawSync.tracksChecked === 'number'
      ? rawSync.tracksChecked
      : ((typeof rawSync.matched === 'number' ? rawSync.matched : 0)
          + (Array.isArray(rawSync.notFound) ? rawSync.notFound.length : 0)),
    matched:   typeof rawSync.matched   === 'number' ? rawSync.matched   : 0,
    notFound:  Array.isArray(rawSync.notFound)       ? rawSync.notFound  : [],
    matchRate: typeof rawSync.matchRate === 'number' ? rawSync.matchRate : 0,
    source:    'spotify-top-tracks-vs-apple',
  } : null;

  // ── 7. Storefront coverage ───────────────────────────────────────────────
  // Derived from Apple's Big-6 storefront availability check (computed in
  // getAppleMusic). Raw shape:
  //   { us: { available: [albumId,...], unavailable: [...] }, gb: {...}, ... }
  // A storefront is "available" when at least one album was confirmed there.
  const rawSf = (appleMusicData && appleMusicData.storefrontAvailability) || null;
  let storefrontCoverage = null;
  if (rawSf && typeof rawSf === 'object' && !Array.isArray(rawSf)) {
    const checked = Object.keys(rawSf);
    if (checked.length > 0) {
      const available   = checked.filter((sf) => {
        const e = rawSf[sf];
        return e && Array.isArray(e.available) && e.available.length > 0;
      });
      const unavailable = checked.filter((sf) => !available.includes(sf));
      storefrontCoverage = {
        checked,
        available,
        unavailable,
        coverageRate: Math.round((available.length / checked.length) * 100),
      };
    }
  }

  return {
    modelVersion:       '1.0.0',
    catalogVersion:     null,          // RESERVED — Change Detection™ defines this
    releases,
    recordings,
    byProvider,
    releasesCount:      releases.length,
    earliestYear,
    latestYear,
    catalogAgeYears,
    recentActivity,
    catalogSync,
    storefrontCoverage,
    upcCoverage:        null,          // v2.0: requires per-release API call
    contributorData:    null,          // v2.0: MusicBrainz release-level data
  };
}
