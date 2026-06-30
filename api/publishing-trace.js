// Royaltē Publishing Intelligence — Live Trace
//
// Diagnostic endpoint. Runs the complete Publishing Intelligence pipeline
// for a single artist + song list and returns every intermediate result
// inline so failures can be identified without Vercel log access.
//
// Usage:
//   GET /api/publishing-trace?artist=Ed+Sheeran&songs=Shape+of+You,Perfect
//   GET /api/publishing-trace?artist=Taylor+Swift
//   GET /api/publishing-trace?artist=The+Weeknd&songs=Blinding+Lights
//
//   artist  — artist name (default "Ed Sheeran")
//   songs   — comma-separated song titles to search (default: "Shape of You")
//
// Security:
//   - Credential values NEVER echoed — presence booleans only
//   - Bearer/id/access tokens NEVER echoed
//   - No DB writes — pure diagnostic read path

import { normalizeMlcWorks }             from '../lib/publishing/mlc-adapter.js';
import { assemblePublishingIntelligence } from './_lib/publishing-intelligence.js';

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const TOKEN_PATH           = '/oauth/token';
const SEARCH_PATH          = '/search/songcode';
const DEFAULT_ARTIST       = 'Ed Sheeran';
const DEFAULT_SONGS        = 'Shape of You';
const SONG_TITLE_CAP       = 5;
const WORK_CAP             = 20;

// Mirror of mlc-client.js buildWriterEntry — keep in sync if strategy changes.
function buildWriterEntry(artistName) {
  const trimmed   = artistName.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return { writerLastName: trimmed };
  }
  return {
    writerFirstName: trimmed.slice(0, lastSpace),
    writerLastName:  trimmed.slice(lastSpace + 1),
  };
}

export default async function handler(req, res) {
  const artistName = (req.query.artist || DEFAULT_ARTIST).toString().trim();
  const songsRaw   = (req.query.songs  || DEFAULT_SONGS).toString();
  const songTitles = songsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, SONG_TITLE_CAP);

  const baseUrl    = (process.env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');

  const trace = {
    artist:     artistName,
    songTitles,
    strategy:   'POST /search/songcode per song — Board-approved 2026-06-30',
    stages:     {},
  };

  // ─── Stage 0 — Credentials ────────────────────────────────────────
  const username     = process.env.MLC_USERNAME;
  const password     = process.env.MLC_PASSWORD;
  const refreshToken = process.env.MLC_REFRESH_TOKEN;
  const hasPwdCreds  = !!(username && password);
  const hasRefresh   = !!refreshToken;

  trace.stages.credentials = {
    hasMlcUsername:     !!username,
    hasMlcPassword:     !!password,
    hasMlcRefreshToken: !!refreshToken,
    mode:       hasPwdCreds ? 'username+password' : hasRefresh ? 'refreshToken' : 'MISSING',
    canProceed: hasPwdCreds || hasRefresh,
  };

  if (!trace.stages.credentials.canProceed) {
    trace.failedAt = 'credentials';
    return res.status(200).json(trace);
  }

  // ─── Stage 1 — Token exchange ─────────────────────────────────────
  const tokenEndpoint = `${baseUrl}${TOKEN_PATH}`;
  const tokenBody     = hasPwdCreds ? { username, password } : { refreshToken };
  const tokenMode     = hasPwdCreds ? 'username+password' : 'refreshToken';

  let bearer, tokenStatus, tokenOk, tokenError;
  try {
    const tokenResp = await fetch(tokenEndpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Royalte/1.0 (publishing-trace)',
      },
      body: JSON.stringify(tokenBody),
    });

    tokenStatus = tokenResp.status;
    tokenOk     = tokenResp.ok;

    let tokenJson;
    try { tokenJson = await tokenResp.json(); } catch { tokenJson = null; }

    if (tokenResp.ok) {
      bearer = tokenJson?.idToken;
      if (typeof bearer !== 'string' || bearer === '') {
        tokenError = {
          problem:   'idToken_absent',
          tokenKeys: tokenJson && typeof tokenJson === 'object' ? Object.keys(tokenJson) : null,
          tokenType: tokenJson?.tokenType ?? null,
          expiresIn: tokenJson?.expiresIn ?? null,
        };
        tokenOk = false;
      } else {
        // Surface only non-sensitive metadata
        trace.stages.tokenExchange = {
          endpoint:       tokenEndpoint,
          mode:           tokenMode,
          httpStatus:     tokenStatus,
          ok:             true,
          bearerAcquired: true,
          tokenType:      tokenJson?.tokenType ?? null,
          expiresIn:      tokenJson?.expiresIn ?? null,
        };
      }
    } else {
      tokenError = {
        httpStatus:       tokenStatus,
        error:            tokenJson?.error            ?? null,
        errorDescription: tokenJson?.errorDescription ?? null,
        message:          tokenJson?.message          ?? null,
      };
    }
  } catch (err) {
    tokenStatus = null;
    tokenOk     = false;
    tokenError  = { transportError: err?.message || String(err) };
  }

  if (!tokenOk || !bearer) {
    trace.stages.tokenExchange = {
      endpoint:   tokenEndpoint,
      mode:       tokenMode,
      httpStatus: tokenStatus,
      ok:         false,
      error:      tokenError ?? null,
    };
    trace.failedAt = 'tokenExchange';
    return res.status(200).json(trace);
  }

  // ─── Stage 2 — Per-song /search/songcode ──────────────────────────
  // Mirrors mlc-client.js exactly (sequential, dedup by mlcSongCode).
  const searchEndpoint = `${baseUrl}${SEARCH_PATH}`;
  const writerEntry    = buildWriterEntry(artistName);
  const songCodeSet    = new Set();
  const rawWorks       = [];
  const perSongResults = [];

  for (const songTitle of songTitles) {
    if (songCodeSet.size >= WORK_CAP) break;

    const searchBody = { title: songTitle, writers: [writerEntry] };
    let searchStatus, searchOk, searchError, worksReturned, newAdded, sample;
    try {
      const searchResp = await fetch(searchEndpoint, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'User-Agent':    'Royalte/1.0 (publishing-trace)',
        },
        body: JSON.stringify(searchBody),
      });

      searchStatus = searchResp.status;
      searchOk     = searchResp.ok;

      if (!searchOk) {
        searchError = {
          httpStatus:          searchStatus,
          retryAfter:          searchResp.headers.get('retry-after')          ?? null,
          xRateLimitLimit:     searchResp.headers.get('x-ratelimit-limit')    ?? null,
          xRateLimitRemaining: searchResp.headers.get('x-ratelimit-remaining') ?? null,
          xRateLimitReset:     searchResp.headers.get('x-ratelimit-reset')    ?? null,
        };
        worksReturned = 0;
        newAdded      = 0;
      } else {
        let searchJson;
        try { searchJson = await searchResp.json(); } catch { searchJson = null; }
        const works = Array.isArray(searchJson) ? searchJson : [];
        worksReturned = works.length;
        newAdded      = 0;
        sample        = works.slice(0, 2);
        for (const work of works) {
          if (songCodeSet.size >= WORK_CAP) break;
          const code = work?.mlcSongCode;
          if (typeof code === 'string' && code.trim() !== '' && !songCodeSet.has(code)) {
            songCodeSet.add(code);
            rawWorks.push(work);
            newAdded++;
          }
        }
      }
    } catch (err) {
      searchStatus  = null;
      searchOk      = false;
      searchError   = { transportError: err?.message || String(err) };
      worksReturned = 0;
      newAdded      = 0;
    }

    perSongResults.push({
      songTitle,
      requestBody:  searchBody,
      httpStatus:   searchStatus,
      ok:           searchOk,
      worksReturned,
      newAdded,
      totalSoFar:   rawWorks.length,
      sample:       sample ?? null,
      error:        searchError ?? null,
    });
  }

  trace.stages.songSearch = {
    endpoint:         searchEndpoint,
    writerEntry,
    songsSearched:    perSongResults.length,
    uniqueWorksTotal: rawWorks.length,
    perSong:          perSongResults,
  };

  if (rawWorks.length === 0) {
    trace.failedAt = perSongResults.every((r) => !r.ok)
      ? 'songSearch:allFailed'
      : 'songSearch:noResults';
    return res.status(200).json(trace);
  }

  // ─── Stage 3 — normalizeMlcWorks ─────────────────────────────────
  // /search/songcode returns workTitle, mlcSongCode, iswc, writers[]
  // directly — the shape mlc-adapter.js normalizeMlcWorks() expects.
  // No field mapping needed (unlike the /work/id path).
  const normalizedWorks = normalizeMlcWorks(rawWorks);

  trace.stages.normalization = {
    worksEntering:    rawWorks.length,
    worksLeaving:     normalizedWorks.length,
    dropped:          rawWorks.length - normalizedWorks.length,
    rawSample:        rawWorks.slice(0, 2).map((w) => ({
      workTitle:    w.workTitle,
      mlcSongCode:  w.mlcSongCode,
      iswc:         w.iswc,
      writersCount: Array.isArray(w.writers) ? w.writers.length : 0,
      firstWriter:  Array.isArray(w.writers) ? w.writers[0] ?? null : null,
    })),
    normalizedSample: normalizedWorks.slice(0, 2).map((w) => ({
      title:        w.title,
      mlcSongCode:  w.mlcSongCode,
      iswc:         w.iswc,
      writersCount: w.writers.length,
      firstWriter:  w.writers[0] ?? null,
      confidence:   w.confidence,
    })),
    droppedWorks: rawWorks
      .filter((w) => !normalizedWorks.find((n) => n.mlcSongCode === w.mlcSongCode))
      .map((w) => ({
        mlcSongCode: w.mlcSongCode,
        workTitle:   w.workTitle,
        problem:     !w.workTitle    ? 'workTitle_null'
                   : !w.mlcSongCode ? 'mlcSongCode_null'
                   : (!Array.isArray(w.writers) || w.writers.length === 0) ? 'writers_empty'
                   : 'unknown',
      })),
  };

  if (normalizedWorks.length === 0) {
    trace.failedAt = 'normalization:allDropped';
    return res.status(200).json(trace);
  }

  // ─── Stage 4 — Publishing Intelligence simulation ─────────────────
  const worksCount  = normalizedWorks.length;
  const ipiSet      = new Set();
  for (const work of normalizedWorks) {
    for (const writer of (work.writers || [])) {
      if (writer && typeof writer.writerIPI === 'string' && writer.writerIPI !== '') {
        ipiSet.add(writer.writerIPI);
      }
    }
  }
  const writerIPIs  = Array.from(ipiSet);
  const writerCount = writerIPIs.length;

  const simulatedObservation = {
    availability: 'VERIFIED',
    details: {
      worksCount,
      iswcCount:   normalizedWorks.filter((w) => typeof w.iswc === 'string' && w.iswc.trim() !== '').length,
      writerCount: normalizedWorks.reduce((n, w) => n + (w.writers?.length ?? 0), 0),
    },
  };
  const simulatedCio = {
    publishing: { worksCount, writerIPIs, writerCount, workRoyalteIds: [] },
    observations: { publishingSources: { mlc: simulatedObservation } },
  };

  trace.stages.cioPrepare = {
    simulatedCioPublishing:   simulatedCio.publishing,
    simulatedMlcObservation:  simulatedObservation,
  };

  const publishingIntelligence = assemblePublishingIntelligence(null, simulatedCio);

  trace.stages.publishingIntelligence = {
    registrations:   publishingIntelligence.registrations,
    metrics:         publishingIntelligence.metrics,
    registeredCount: publishingIntelligence.registeredCount,
    totalChecked:    publishingIntelligence.totalChecked,
    coverage:        publishingIntelligence.coverage,
    strengths:       publishingIntelligence.strengths,
    issues:          publishingIntelligence.issues,
  };

  // ─── Summary ──────────────────────────────────────────────────────
  trace.summary = {
    songsSearched:       perSongResults.length,
    uniqueWorksCollected: rawWorks.length,
    worksNormalized:     normalizedWorks.length,
    publishingCoverage:  publishingIntelligence.coverage,
    registeredCount:     publishingIntelligence.registeredCount,
    allStagesGreen:      normalizedWorks.length > 0,
    note: 'To verify audit_scans.payload, run a full scan and check Vercel function logs for: [mlc] Stage 7 — result: VERIFIED',
  };

  return res.status(200).json(trace);
}
