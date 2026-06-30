import { generateAppleToken } from './apple-token.js';

const APPLE_MUSIC_API = 'https://api.music.apple.com/v1';
const STOREFRONT = 'us';

// Brief 011 — BIG 6 storefronts: the seven regions that represent the
// majority of global streaming revenue. Order is region-grouped so that
// downstream consumers (dashboard, tests) can iterate predictably.
const BIG6_STOREFRONTS = ['us', 'ca', 'gb', 'de', 'fr', 'jp', 'au', 'br'];

// Global Music Footprint™ — complete Apple Music storefront universe.
// Source: Apple MusicKit documentation + storefronts API (2026-06).
// 167 storefronts. Organized by region for readability; the order
// does not affect correctness. Update when Apple adds new markets
// (verify against GET /v1/storefronts). Named constant — change only
// through a Board directive.
const ALL_APPLE_STOREFRONTS = Object.freeze([
  // Americas (36)
  'ag','ai','bb','bm','bo','br','bs','bz','ca','cl',
  'co','cr','dm','do','ec','gd','gt','gy','hn','jm',
  'kn','ky','lc','mx','ni','pa','pe','py','sr','sv',
  'tc','tt','us','uy','vc','vg',
  // Europe (44)
  'al','am','at','az','be','bg','by','ch','cy','cz',
  'de','dk','ee','es','fi','fr','gb','gr','hr','hu',
  'ie','is','it','kg','kz','lt','lu','lv','md','mk',
  'mt','nl','no','pl','pt','ro','ru','se','si','sk',
  'tj','tr','ua','uz',
  // Middle East & Africa (55)
  'ae','ao','bf','bh','bj','bw','cd','cg','ci','cm',
  'cv','dj','dz','eg','et','ga','gh','gm','gn','gq',
  'gw','il','jo','ke','kw','lb','lr','ly','ma','mg',
  'ml','mr','mu','mw','mz','na','ne','ng','om','qa',
  'rw','sa','sc','sl','sn','st','sz','td','tn','tz',
  'ug','ye','za','zm','zw',
  // Asia Pacific (32)
  'au','bt','cn','fj','fm','hk','id','in','jp','kh',
  'kr','la','lk','mn','mo','mv','my','np','nr','nz',
  'pg','ph','pw','sb','sg','th','tl','to','tw','vn',
  'vu','ws',
]);

async function appleRequest(path) {
  const token = generateAppleToken();
  const res = await fetch(`${APPLE_MUSIC_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apple Music API error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Search Apple Music catalog by artist name
 * Returns top matching artists and their details
 */
async function searchArtist(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const data = await appleRequest(
      `/catalog/${STOREFRONT}/search?term=${query}&types=artists&limit=5`
    );

    const artists = data?.results?.artists?.data || [];

    if (artists.length === 0) {
      return { found: false, artistName, results: [] };
    }

    return {
      found: true,
      artistName,
      results: artists.map((a) => ({
        id: a.id,
        name: a.attributes?.name,
        url: a.attributes?.url,
        genreNames: a.attributes?.genreNames || [],
        artwork: a.attributes?.artwork?.url
          ? a.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
          : null,
      })),
    };
  } catch (err) {
    console.error('Apple Music searchArtist error:', err.message);
    return { found: false, artistName, error: err.message };
  }
}

/**
 * Fetch Apple Music tracks for an artist by their Apple Music artist ID.
 * storefront defaults to module-level STOREFRONT ('us') for back-compat;
 * pass the URL's source storefront (e.g. 'ca') to query that region's
 * catalog directly (used by the Apple-input degraded enrichment path).
 */
async function getArtistAlbums(appleArtistId, storefront = STOREFRONT) {
  try {
    const data = await appleRequest(
      `/catalog/${storefront}/artists/${appleArtistId}/albums?limit=25`
    );

    const albums = data?.data || [];
    return albums.map((a) => ({
      id: a.id,
      name: a.attributes?.name,
      releaseDate: a.attributes?.releaseDate,
      trackCount: a.attributes?.trackCount,
      url: a.attributes?.url,
      artwork: a.attributes?.artwork?.url
        ? a.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
        : null,
    }));
  } catch (err) {
    console.error('Apple Music getArtistAlbums error:', err.message);
    return [];
  }
}

/**
 * Fetch an artist's songs (with ISRCs) directly via Apple Music.
 * Used by the Apple→Spotify ISRC-bridge fallback in run-scan.js for
 * artist-URL inputs whose Spotify name-search misses (e.g. "Black
 * Alternative" doesn't surface in Spotify's top-5 generic search).
 * Returns only songs whose ISRC is populated, capped at `limit`.
 */
async function getArtistSongs(appleArtistId, storefront = STOREFRONT, limit = 25) {
  try {
    const data = await appleRequest(
      `/catalog/${storefront}/artists/${appleArtistId}/songs?limit=${limit}`
    );
    const songs = data?.data || [];
    return songs
      .map((s) => ({
        id:        s.id,
        name:      s.attributes?.name,
        isrc:      s.attributes?.isrc || null,
        albumName: s.attributes?.albumName,
      }))
      .filter((s) => s.isrc);
  } catch (err) {
    console.error('Apple Music getArtistSongs error:', err.message);
    return [];
  }
}

/**
 * Canonical Wiring Certification (2026-06-30) — Directive 1/2.
 * Look up the Apple Music artist ID for a given ISRC, with optional
 * name verification to prevent co-credit contamination.
 *
 * Used by the Spotify→Apple ISRC bridge in run-scan.js: when a Spotify
 * URL scan resolves an artist and fetches top-track ISRCs, this bridge
 * sets resolved.appleArtistId so the subsequent getAppleMusic() call uses
 * the ID-direct path — identical to Apple URL inputs. All three scan
 * entry paths converge to the same Apple Artist ID before enrichment.
 *
 * Returns the Apple Artist ID string, or null on any failure / mismatch.
 */
async function lookupAppleArtistIdByIsrc(isrc, canonicalArtistName) {
  try {
    const data = await appleRequest(
      `/catalog/${STOREFRONT}/songs?filter[isrc]=${encodeURIComponent(isrc)}&include=artists`
    );
    const song = data?.data?.[0];
    if (!song) return null;

    if (canonicalArtistName) {
      // Verify the canonical artist name appears at the start of the song's
      // display artist string. Primary artists always lead; a leading match
      // confirms the song belongs to the canonical artist rather than a
      // featured co-credit. Strict enough to prevent contamination; lenient
      // enough to pass "feat." and "&" variants.
      const norm            = (s) => (s || '').toLowerCase().trim();
      const songArtistLower = norm(song.attributes?.artistName);
      const canonicalLower  = norm(canonicalArtistName);
      const exactMatch      = songArtistLower === canonicalLower;
      const leadingMatch    = songArtistLower.startsWith(canonicalLower + ' ')
                           || songArtistLower.startsWith(canonicalLower + ',')
                           || songArtistLower.startsWith(canonicalLower + '&')
                           || songArtistLower.startsWith(canonicalLower + '+');
      if (!exactMatch && !leadingMatch) {
        console.log(`[apple] ISRC ${isrc}: artist mismatch — Apple="${song.attributes?.artistName}" vs canonical="${canonicalArtistName}" — skipping`);
        return null;
      }
    }

    // Artist ID lives in the included relationships array.
    const artistId = song.relationships?.artists?.data?.[0]?.id || null;
    return artistId;
  } catch (err) {
    console.error('Apple Music lookupAppleArtistIdByIsrc error:', err.message);
    return null;
  }
}

/**
 * Look up a track by ISRC
 * Returns Apple Music catalog entry if found
 */
async function lookupByISRC(isrc) {
  try {
    const data = await appleRequest(
      `/catalog/${STOREFRONT}/songs?filter[isrc]=${isrc}`
    );

    const songs = data?.data || [];

    if (songs.length === 0) {
      return { found: false, isrc };
    }

    const song = songs[0];
    return {
      found: true,
      isrc,
      id: song.id,
      name: song.attributes?.name,
      artistName: song.attributes?.artistName,
      albumName: song.attributes?.albumName,
      releaseDate: song.attributes?.releaseDate,
      durationMs: song.attributes?.durationInMillis,
      url: song.attributes?.url,
      previewUrl: song.attributes?.previews?.[0]?.url || null,
      artwork: song.attributes?.artwork?.url
        ? song.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
        : null,
      genreNames: song.attributes?.genreNames || [],
      composerName: song.attributes?.composerName || null,
    };
  } catch (err) {
    console.error('Apple Music lookupByISRC error:', err.message);
    return { found: false, isrc, error: err.message };
  }
}

/**
 * Search Apple Music for a specific track by name and artist
 */
async function searchTrack(trackName, artistName) {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const data = await appleRequest(
      `/catalog/${STOREFRONT}/search?term=${query}&types=songs&limit=5`
    );

    const songs = data?.results?.songs?.data || [];

    if (songs.length === 0) {
      return { found: false, trackName, artistName };
    }

    // 2026-06-05 identity-lock — strict exact-match only. Previously
    // `|| songs[0]` would substitute the top Apple search result if no
    // exact match existed, returning a different track's ISRC/album/etc.
    const match = songs.find(
      (s) =>
        s.attributes?.name?.toLowerCase() === trackName.toLowerCase() &&
        s.attributes?.artistName?.toLowerCase().includes(artistName.toLowerCase())
    ) || null;
    if (!match) {
      console.log(`[identity] Apple searchTrack: ${songs.length} candidates for "${trackName}" by "${artistName}" but no exact match — skipping`);
      return { found: false, trackName, artistName, reason: 'no_exact_match' };
    }

    return {
      found: true,
      trackName,
      artistName,
      id: match.id,
      name: match.attributes?.name,
      artist: match.attributes?.artistName,
      album: match.attributes?.albumName,
      url: match.attributes?.url,
      isrc: match.attributes?.isrc || null,
      durationMs: match.attributes?.durationInMillis,
      previewUrl: match.attributes?.previews?.[0]?.url || null,
    };
  } catch (err) {
    console.error('Apple Music searchTrack error:', err.message);
    return { found: false, trackName, artistName, error: err.message };
  }
}

/**
 * Compare Spotify tracks against Apple Music catalog
 * Pass in array of { name, isrc } objects from Spotify
 * Returns match rate and missing tracks
 */
async function compareSpotifyToApple(spotifyTracks = []) {
  const results = {
    totalTracks: spotifyTracks.length,
    matched: [],
    notFound: [],
    matchRate: 0,
  };

  for (const track of spotifyTracks) {
    let result;

    if (track.isrc) {
      result = await lookupByISRC(track.isrc);
    } else {
      result = await searchTrack(track.name, track.artistName || '');
    }

    if (result.found) {
      results.matched.push({
        spotifyTrack: track.name,
        appleMatch: result.name,
        appleUrl: result.url,
        isrc: track.isrc || result.isrc,
      });
    } else {
      results.notFound.push({
        spotifyTrack: track.name,
        isrc: track.isrc || null,
      });
    }
  }

  results.matchRate =
    results.totalTracks > 0
      ? Math.round((results.matched.length / results.totalTracks) * 100)
      : 0;

  return results;
}

/**
 * Brief 011 — Check album availability across the BIG 6 storefronts.
 *
 * Accepts a pre-built `headers` object (with the same Apple Music JWT used
 * by the caller) so all 7 parallel storefront calls share one token (Option
 * A from the Brief 011 findings report). Single-storefront errors are
 * isolated to that storefront (Option α) — that entry returns
 * `{ available: [], unavailable: [], error: <msg> }` and the other 6
 * continue. The dashboard renders an errored storefront as "—".
 *
 * @param {string[]} albumIds   Apple Music album IDs (≤ 25 — fits one batch
 *                              per storefront via `?ids=` query param).
 * @param {Object}   headers    Fetch headers with Authorization: Bearer.
 * @returns {Promise<Object>}   { us:{available,unavailable}, ca:{…}, … }
 */
async function checkStorefrontAvailability(albumIds, headers) {
  // Empty / invalid input → return shape-stable empty result for every
  // storefront so the consumer always sees the same key set.
  const empty = () => BIG6_STOREFRONTS.reduce((acc, sf) => {
    acc[sf] = { available: [], unavailable: [] };
    return acc;
  }, {});
  if (!Array.isArray(albumIds) || albumIds.length === 0) return empty();

  const idsParam = albumIds.join(',');

  const results = await Promise.all(BIG6_STOREFRONTS.map(async (sf) => {
    try {
      const res = await fetch(
        `${APPLE_MUSIC_API}/catalog/${sf}/albums?ids=${idsParam}`,
        { headers }
      );
      if (!res.ok) {
        return [sf, { available: [], unavailable: [], error: `HTTP ${res.status}` }];
      }
      const data = await res.json();
      const rows = (data && Array.isArray(data.data)) ? data.data : [];
      const available = rows.map((r) => r && r.id).filter(Boolean);
      const availableSet = new Set(available);
      const unavailable = albumIds.filter((id) => !availableSet.has(id));
      return [sf, { available, unavailable }];
    } catch (err) {
      return [sf, { available: [], unavailable: [], error: err.message }];
    }
  }));

  return Object.fromEntries(results);
}

/**
 * Global Music Footprint™ — Check one probe album ID across all 167 Apple
 * Music storefronts, batched in waves of WAVE_SIZE to avoid rate-limiting.
 *
 * Uses a single album ID as the availability probe: if the artist's catalog
 * is in a storefront, that album appears in the response; otherwise the
 * response is empty. Promise.allSettled within each wave isolates failures
 * — a bad storefront never aborts the remaining checks.
 *
 * Returns:
 *   {
 *     available:   string[],  // storefront IDs where album was found
 *     unavailable: string[],  // storefront IDs where album was absent
 *     errors:      Array<{sf, error}>,  // storefronts that errored
 *     total:       number,    // ALL_APPLE_STOREFRONTS.length (167)
 *   }
 *
 * Scope note: Global Music Footprint™ uses Apple Music storefront availability
 * as the canonical global availability signal for v1.0.
 */
async function checkGlobalStorefrontAvailability(probeAlbumId, headers) {
  const WAVE_SIZE = 50;
  const empty = { available: [], unavailable: ALL_APPLE_STOREFRONTS.slice(), errors: [], total: ALL_APPLE_STOREFRONTS.length };
  if (!probeAlbumId || typeof probeAlbumId !== 'string') return empty;

  const storefronts = ALL_APPLE_STOREFRONTS;
  const available   = [];
  const unavailable = [];
  const errors      = [];

  for (let i = 0; i < storefronts.length; i += WAVE_SIZE) {
    const wave = storefronts.slice(i, i + WAVE_SIZE);
    const results = await Promise.allSettled(
      wave.map(async (sf) => {
        try {
          const res = await fetch(
            `${APPLE_MUSIC_API}/catalog/${sf}/albums?ids=${probeAlbumId}`,
            { headers }
          );
          if (!res.ok) return [sf, false, `HTTP ${res.status}`];
          const data = await res.json();
          const rows = (data && Array.isArray(data.data)) ? data.data : [];
          return [sf, rows.length > 0, null];
        } catch (err) {
          return [sf, null, err.message];
        }
      })
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') {
        errors.push({ sf: 'unknown', error: r.reason?.message || 'unknown' });
        continue;
      }
      const [sf, found, errMsg] = r.value;
      if (errMsg) errors.push({ sf, error: errMsg });
      else if (found) available.push(sf);
      else unavailable.push(sf);
    }
  }

  return { available, unavailable, errors, total: storefronts.length };
}

export {
  searchArtist,
  getArtistAlbums,
  getArtistSongs,
  lookupByISRC,
  lookupAppleArtistIdByIsrc,
  searchTrack,
  compareSpotifyToApple,
  checkStorefrontAvailability,
  checkGlobalStorefrontAvailability,
  BIG6_STOREFRONTS,
  ALL_APPLE_STOREFRONTS,
};
