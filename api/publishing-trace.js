// Royaltē Publishing Intelligence — 6-Stage Live Trace
//
// Diagnostic endpoint. Runs the complete Publishing Intelligence pipeline
// for a single artist and returns every intermediate result inline so
// the exact failure point can be identified without log access.
//
// Usage: GET /api/publishing-trace?artist=Ed+Sheeran
//        GET /api/publishing-trace?artist=Taylor+Swift&cap=5
//
// Security: same rules as mlc-test.js
//   - Credential values are NEVER echoed in the response
//   - Tokens are NEVER echoed in the response
//   - Presence booleans only
//
// Never modifies production data. Pure read path, no DB writes.

import { normalizeMlcWorks }             from '../lib/publishing/mlc-adapter.js';
import { assemblePublishingIntelligence } from './_lib/publishing-intelligence.js';

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const TOKEN_PATH           = '/oauth/token';
const RECORDINGS_PATH      = '/search/recordings';
const WORK_DETAIL_PATH     = '/work/id';
const DEFAULT_ARTIST       = 'Ed Sheeran';
const DEFAULT_CAP          = 5;

export default async function handler(req, res) {
  const artistName = (req.query.artist || DEFAULT_ARTIST).toString().trim();
  const cap        = Math.min(20, Math.max(1, parseInt(req.query.cap || DEFAULT_CAP, 10) || DEFAULT_CAP));
  const baseUrl    = (process.env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');

  const trace = {
    artist:  artistName,
    cap,
    baseUrl: baseUrl.replace(/\/\/.*@/, '//***@'), // sanitize any embedded creds
    stages: {},
  };

  // ─── Stage 0 — Credentials ────────────────────────────────────────
  const username     = process.env.MLC_USERNAME;
  const password     = process.env.MLC_PASSWORD;
  const refreshToken = process.env.MLC_REFRESH_TOKEN;
  const hasPwdCreds  = !!(username && password);
  const hasRefresh   = !!refreshToken;

  trace.stages.credentials = {
    hasMlcUsername:    !!username,
    hasMlcPassword:    !!password,
    hasMlcRefreshToken: !!refreshToken,
    mode: hasPwdCreds ? 'username+password' : hasRefresh ? 'refreshToken' : 'MISSING',
    canProceed: hasPwdCreds || hasRefresh,
  };

  if (!trace.stages.credentials.canProceed) {
    trace.failedAt = 'credentials';
    return res.status(200).json(trace);
  }

  // ─── Stage 1.5 — Token exchange (needed before any MLC call) ────────
  // All MLC endpoints require auth — /search/recordings returns 401
  // without a bearer token despite API docs indicating otherwise.
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
      }
    } else {
      tokenError = {
        httpStatus:        tokenStatus,
        error:             tokenJson?.error ?? null,
        errorDescription:  tokenJson?.errorDescription ?? null,
        message:           tokenJson?.message ?? null,
      };
    }
  } catch (err) {
    tokenStatus = null;
    tokenOk     = false;
    tokenError  = { transportError: err?.message || String(err) };
  }

  trace.stages.tokenExchange = {
    endpoint:  tokenEndpoint,
    mode:      tokenMode,
    httpStatus: tokenStatus,
    ok:        tokenOk,
    bearerAcquired: typeof bearer === 'string' && bearer !== '',
    error:     tokenError ?? null,
  };

  if (!tokenOk || !bearer) {
    trace.failedAt = 'tokenExchange';
    return res.status(200).json(trace);
  }

  // ─── Stage 1 — Recording discovery (bearer required) ─────────────
  // POST /search/recordings { artist: artistName }
  // Note: MLC API docs say no auth required, but live endpoint returns
  // 401 without bearer (confirmed 2026-06-30). Bearer sent on all calls.
  const recordingsEndpoint = `${baseUrl}${RECORDINGS_PATH}`;
  let recordingsStatus, recordingsOk, recordingsCount, songCodes, recordingsError, recordingsSample;

  try {
    const recordingsResp = await fetch(recordingsEndpoint, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Royalte/1.0 (publishing-trace)',
      },
      body: JSON.stringify({ artist: artistName }),
    });

    recordingsStatus = recordingsResp.status;
    recordingsOk     = recordingsResp.ok;

    let recordingsJson;
    try { recordingsJson = await recordingsResp.json(); } catch { recordingsJson = null; }

    const recordings = Array.isArray(recordingsJson) ? recordingsJson : [];
    recordingsCount  = recordings.length;
    recordingsSample = recordings.slice(0, 2);

    const songCodeSet = new Set();
    for (const rec of recordings) {
      if (!rec || typeof rec !== 'object') continue;
      const code = rec.mlcSongCode || rec.mlcsongCode;
      if (typeof code === 'string' && code.trim() !== '') {
        songCodeSet.add(code.trim());
        if (songCodeSet.size >= cap) break;
      }
    }
    songCodes = Array.from(songCodeSet);

    if (!recordingsOk) {
      let rawBody;
      try { rawBody = JSON.stringify(recordingsJson); } catch { rawBody = null; }
      recordingsError = { httpStatus: recordingsStatus, rawBody };
    }
  } catch (err) {
    recordingsStatus = null;
    recordingsOk     = false;
    recordingsError  = { transportError: err?.message || String(err) };
    songCodes        = [];
    recordingsCount  = 0;
  }

  trace.stages.recordingDiscovery = {
    endpoint:          recordingsEndpoint,
    requestBody:       { artist: artistName },
    httpStatus:        recordingsStatus,
    ok:                recordingsOk,
    recordingsCount,
    songCodesExtracted: songCodes.length,
    songCodes,
    sample:            recordingsSample,
    error:             recordingsError ?? null,
  };

  if (!recordingsOk || songCodes.length === 0) {
    trace.failedAt = recordingsOk
      ? 'recordingDiscovery:noSongCodes'
      : 'recordingDiscovery:httpError';
    return res.status(200).json(trace);
  }

  // ─── Stage 2 — Work detail lookup ─────────────────────────────────
  const workDetailBase = `${baseUrl}${WORK_DETAIL_PATH}`;
  const workResults    = await Promise.allSettled(
    songCodes.map(async (code) => {
      const resp = await fetch(`${workDetailBase}/${encodeURIComponent(code)}`, {
        method:  'GET',
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Accept':        'application/json',
          'User-Agent':    'Royalte/1.0 (publishing-trace)',
        },
      });
      const status = resp.status;
      let body;
      try { body = await resp.json(); } catch { body = null; }
      return { code, httpStatus: status, ok: resp.ok, body };
    })
  );

  const workDetailResults = workResults.map((r) => {
    if (r.status === 'rejected') {
      return { fulfilled: false, error: r.reason?.message || String(r.reason) };
    }
    const { code, httpStatus, ok, body } = r.value;
    return {
      fulfilled: true,
      code,
      httpStatus,
      ok,
      // Show full raw body for the first result; summarise the rest.
      body: body,
    };
  });

  const workDetailSuccessful = workDetailResults.filter((r) => r.fulfilled && r.ok);
  const workDetailFailed     = workDetailResults.filter((r) => !r.fulfilled || !r.ok);

  trace.stages.workDetail = {
    codesRequested:    songCodes.length,
    successful:        workDetailSuccessful.length,
    failed:            workDetailFailed.length,
    results:           workDetailResults,
  };

  if (workDetailSuccessful.length === 0) {
    trace.failedAt = 'workDetail:allFailed';
    return res.status(200).json(trace);
  }

  // ─── Stage 3 — normalizeMlcWorks ──────────────────────────────────
  // Map /work/id response shape to adapter-expected shape (primaryTitle → workTitle).
  const mappedForAdapter = workDetailSuccessful
    .map((r) => {
      const w = r.body;
      if (!w || typeof w !== 'object') return null;
      return {
        workTitle:   typeof w.primaryTitle === 'string' ? w.primaryTitle
                   : typeof w.workTitle    === 'string' ? w.workTitle
                   : null,
        mlcSongCode: w.mlcSongCode || w.mlcsongCode || null,
        iswc:        typeof w.iswc === 'string' ? w.iswc : null,
        writers:     Array.isArray(w.writers) ? w.writers : [],
      };
    })
    .filter((w) => w !== null);

  const normalizedWorks = normalizeMlcWorks(mappedForAdapter);

  trace.stages.normalization = {
    worksEntering:   mappedForAdapter.length,
    worksLeaving:    normalizedWorks.length,
    dropped:         mappedForAdapter.length - normalizedWorks.length,
    mappedSamples:   mappedForAdapter.slice(0, 2).map((w) => ({
      workTitle:   w.workTitle,
      mlcSongCode: w.mlcSongCode,
      iswc:        w.iswc,
      writersCount: w.writers.length,
      firstWriter:  w.writers[0] ?? null,
    })),
    normalizedSample: normalizedWorks.slice(0, 2).map((w) => ({
      title:       w.title,
      mlcSongCode: w.mlcSongCode,
      iswc:        w.iswc,
      writersCount: w.writers.length,
      firstWriter:  w.writers[0] ?? null,
      confidence:   w.confidence,
    })),
    droppedReasons: mappedForAdapter
      .filter((w, i) => normalizedWorks.findIndex((n) => n.mlcSongCode === w.mlcSongCode) === -1)
      .map((w) => ({
        mlcSongCode: w.mlcSongCode,
        workTitle:   w.workTitle,
        hasWriters:  w.writers.length > 0,
        iswc:        w.iswc,
        problem: !w.workTitle ? 'workTitle_null'
               : !w.mlcSongCode ? 'mlcSongCode_null'
               : w.writers.length === 0 ? 'writers_array_empty'
               : 'unknown',
      })),
  };

  if (normalizedWorks.length === 0) {
    trace.failedAt = 'normalization:allDropped';
    return res.status(200).json(trace);
  }

  // ─── Stage 4 — Publishing Intelligence simulation ─────────────────
  // Simulate what assembleCio() + assemblePublishingIntelligence()
  // would do without running the full scan engine.
  const worksCount = normalizedWorks.length;
  const ipiSet     = new Set();
  for (const work of normalizedWorks) {
    for (const writer of (work.writers || [])) {
      if (writer && typeof writer.writerIPI === 'string' && writer.writerIPI !== '') {
        ipiSet.add(writer.writerIPI);
      }
    }
  }
  const writerIPIs   = Array.from(ipiSet);
  const writerCount  = writerIPIs.length;

  // Simulate CIO.publishing + CIO.observations.publishingSources.mlc
  const simulatedObservation = {
    availability: 'VERIFIED',
    details: {
      worksCount,
      iswcCount: normalizedWorks.filter((w) => typeof w.iswc === 'string' && w.iswc.trim() !== '').length,
      writerCount: normalizedWorks.reduce((n, w) => n + (w.writers?.length ?? 0), 0),
    },
  };
  const simulatedSummary = {
    worksCount,
    writerIPIs,
    writerCount,
    workRoyalteIds: [],
  };

  trace.stages.cioPrepare = {
    simulatedCioPublishing: simulatedSummary,
    simulatedMlcObservation: simulatedObservation,
  };

  // Run assemblePublishingIntelligence with a simulated CIO to verify
  // the assembler would produce populated states.
  const simulatedCio = {
    publishing: simulatedSummary,
    observations: {
      publishingSources: {
        mlc: simulatedObservation,
      },
    },
  };

  const publishingIntelligence = assemblePublishingIntelligence(null, simulatedCio);

  trace.stages.publishingIntelligence = {
    registrations:    publishingIntelligence.registrations,
    metrics:          publishingIntelligence.metrics,
    registeredCount:  publishingIntelligence.registeredCount,
    totalChecked:     publishingIntelligence.totalChecked,
    coverage:         publishingIntelligence.coverage,
    strengthsCount:   publishingIntelligence.strengths.length,
    issuesCount:      publishingIntelligence.issues.length,
    strengths:        publishingIntelligence.strengths,
    issues:           publishingIntelligence.issues,
  };

  // ─── Stage 5 — Payload storage note ──────────────────────────────
  // Cannot verify audit_scans.payload without running a full scan.
  // This trace proves the intelligence assembles correctly from live
  // MLC data. A full scan with audit.js logs would prove the DB write.
  trace.stages.payloadNote = {
    note: 'This trace proves live MLC data flows through all pipeline stages correctly. To verify audit_scans.payload, run a full scan and check Vercel function logs for [mlc] Stage 7 — result: VERIFIED.',
  };

  // ─── Stage 6 — Mission Control renderer note ──────────────────────
  trace.stages.missionControlNote = {
    note: 'MC reads payload.publishingIntelligence.registrations.* and payload.publishingIntelligence.metrics.*. If all prior stages are green, MC should display populated values on next full scan.',
  };

  // ─── Summary ──────────────────────────────────────────────────────
  trace.summary = {
    recordingsFound:        recordingsCount,
    songCodesExtracted:     songCodes.length,
    workDetailSuccessful:   workDetailSuccessful.length,
    workDetailFailed:       workDetailFailed.length,
    normalizedWorks:        normalizedWorks.length,
    publishingCoverage:     publishingIntelligence.coverage,
    registeredCount:        publishingIntelligence.registeredCount,
    totalChecked:           publishingIntelligence.totalChecked,
    allStagesGreen:         normalizedWorks.length > 0,
  };

  return res.status(200).json(trace);
}
