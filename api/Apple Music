const { generateAppleToken } = require('./apple-token');

const APPLE_MUSIC_API = 'https://api.music.apple.com/v1';
const STOREFRONT = 'us';

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
 * Fetch Apple Music tracks for an artist by their Apple Music artist ID
 */
async function getArtistAlbums(appleArtistId) {
  try {
    const data = await appleRequest(
      `/catalog/${STOREFRONT}/artists/${appleArtistId}/albums?limit=25`
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

    // Try to find exact or close match
    const match =
      songs.find(
        (s) =>
          s.attributes?.name?.toLowerCase() === trackName.toLowerCase() &&
          s.attributes?.artistName?.toLowerCase().includes(artistName.toLowerCase())
      ) || songs[0];

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

module.exports = {
  searchArtist,
  getArtistAlbums,
  lookupByISRC,
  searchTrack,
  compareSpotifyToApple,
};
