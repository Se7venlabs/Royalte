// Royalte Audit API — /api/audit.js
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata + YouTube + Apple Music
// Features: Royalty gap estimate, catalog age analysis, country PRO guide, real YouTube UGC detection, Apple Music catalog comparison

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { normalizeAuditResponse } from './lib/normalizeAuditResponse.js';
import { validateAuditResponse } from './schema/auditResponse.js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import { runScan } from './_lib/run-scan.js';
import { persistOSScanSnapshot, resolveUserIdFromAuthHeader } from './_lib/persist-os-scan.js';

// ─── Phase 3.1: OS intelligence pipeline ────────────────────────────
//
//   Website Scan is now a thin client of the Royaltē Operating System.
//   Intelligence is requested from the OS — never computed here.
//
//   CONSTITUTIONAL INVARIANT (Phase 3.1):
//     The Website Scan NEVER computes, reconciles, or interprets intelligence.
//     It requests a Certified Canonical Intelligence Model from the OS and
//     renders from it. runRIE() is the sole intelligence entrypoint.
//
//   runRIE()             — sole OS entrypoint; produces the certified CIM
//   buildCimEnrichment() — maps CIM → canonical fields (migration bridge only)
//   fetchMlcWorksByArtist — provider data collection; feeds the OS, not audit.js
//
//   Retained for two-phase monitoring write (post-scan, outside RIE boundary):
//   assembleMonitoringIntelligence, assembleHealthIntelligence
import { runRIE }            from '../lib/rie/index.js';
import { buildCimEnrichment } from '../lib/rie/CimAdapter.js';
import { assembleMonitoringIntelligence } from './_lib/monitoring-intelligence.js';
import { assembleHealthIntelligence }     from './_lib/health-intelligence.js';
import { fetchMlcWorksByArtist }          from '../lib/publishing/mlc-client.js';
import { normalizeMlcWorks }              from '../lib/publishing/mlc-adapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT_SCANS PERSISTENCE
//
// Two-shape emission (deliberate, per the v1.0.0 migration plan):
//   - HTTP response body  → raw legacy shape (the frontend reads this and
//                           must NOT change yet — see FRONTEND_MIGRATION.md)
//   - audit_scans.payload → canonical AuditResponse v1.0.0 (PDF renderer
//                           and any future canonical consumer reads from
//                           here; this is the single source of truth)
//
// Failure is fatal: persistCanonicalScan throws on any persistence
// failure (Supabase unavailable, normalizer throws, insert fails after
// 3 retries). The handler catches and returns HTTP 500 so the wire
// scanId always points to a real audit_scans row.
// ─────────────────────────────────────────────────────────────────────────────
function getAuditScansSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA VIOLATION HANDLER
// Env-aware failure mode for canonical-shape drift:
//   - production / preview          → log + best-effort insert into
//                                      schema_violations, then continue (the
//                                      audit_scans insert still runs so
//                                      user-facing scans never break)
//   - anything else (dev/test/CI)   → re-throw the original AuditSchemaError so
//                                      drift surfaces immediately in tests
//
// validateAuditResponse throws on the first failure (no collect mode), so
// validation_errors is always a single-item array.
// ─────────────────────────────────────────────────────────────────────────────
async function handleSchemaViolation({ scanId, canonical, err }) {
  const vercelEnv  = process.env.VERCEL_ENV || null;
  const isProdLike = vercelEnv === 'production' || vercelEnv === 'preview';

  const validationErrors = [{
    name:    err.name,
    message: err.message,
    path:    err.path,
    detail:  err.detail,
  }];

  console.error('[schema-violation]', JSON.stringify({
    scan_id:             scanId,
    vercel_env:          vercelEnv,
    subject_artist_name: canonical?.subject?.artistName || null,
    subject_artist_id:   canonical?.subject?.artistId   || null,
    source_platform:     canonical?.source?.platform    || null,
    validation_errors:   validationErrors,
  }));

  if (!isProdLike) {
    // Dev / test / CI: surface the failure immediately. Do NOT persist.
    throw err;
  }

  // Prod-like: best-effort insert into schema_violations. Secondary failures
  // log but don't throw — the audit_scans insert downstream must still run.
  try {
    const supabase = getAuditScansSupabase();
    if (!supabase) {
      console.error('[schema-violation] schema_violations insert skipped: Supabase not configured');
      return;
    }
    const { error } = await supabase.from('schema_violations').insert({
      scan_id:             scanId,
      vercel_env:          vercelEnv,
      validation_errors:   validationErrors,
      canonical_snapshot:  canonical,
      subject_artist_name: canonical?.subject?.artistName || null,
      subject_artist_id:   canonical?.subject?.artistId   || null,
      source_platform:     canonical?.source?.platform    || null,
    });
    if (error) {
      console.error('[schema-violation] schema_violations insert failed:', error.message);
    }
  } catch (insertErr) {
    console.error('[schema-violation] schema_violations insert threw:', insertErr.message);
  }
}

export async function persistCanonicalScan(rawResponse, originalUrl, urlType, scanId, sessionId = null, enrichmentFn = null, userId = null) {
  const supabase = getAuditScansSupabase();
  if (!supabase) {
    throw new Error('audit_scans persistence unavailable: Supabase not configured');
  }

  // Pass handler-generated scanId in so canonical.scanId === scanId.
  let canonical = normalizeAuditResponse({ ...rawResponse, scanId, _originalUrl: originalUrl });

  // Phase 4B-2 + Phase 5B enrichment hook (Board R5 + R10 + D2). The
  // handler passes a callback that folds Identity Intelligence™ and
  // Publishing Intelligence™ (and, in future phases, additional
  // intelligence objects) into the canonical payload BEFORE validate
  // + insert. Enrichment failures are non-blocking: the original
  // canonical persists and the scan succeeds. The enrichment contract
  // accepts both sync and async functions; `await` resolves the
  // sync case transparently to the same value. Any throw or non-object
  // return is logged and discarded.
  if (typeof enrichmentFn === 'function') {
    try {
      const enriched = await enrichmentFn(canonical);
      if (enriched && typeof enriched === 'object' && !Array.isArray(enriched)) {
        canonical = enriched;
      }
    } catch (enrichErr) {
      console.error('[audit] canonical enrichment failed (non-blocking):', enrichErr.message);
    }
  }

  // VALIDATION GATE — fires before any DB write. handleSchemaViolation either
  // logs + persists to schema_violations and returns (prod/preview), or
  // re-throws the AuditSchemaError (dev/test/CI). See helper for env policy.
  // Enrichment fields (e.g. identityIntelligence) are forward-compat extras:
  // validateAuditResponse warns on unknown root keys but does not throw,
  // so the enriched payload passes the gate. No AUDIT_RESPONSE_VERSION bump.
  try {
    validateAuditResponse(canonical);
  } catch (err) {
    await handleSchemaViolation({ scanId, canonical, err });
  }

  const spotifyArtistId = rawResponse.artistId || null;
  const appleArtistId   = rawResponse.appleMusic?.artistId || null;

  // DIAGNOSTIC — remove after ownership trace confirmed
  console.log(`[audit-diag] insert scanId=${scanId} artist="${canonical.subject?.artistName}" userId=${userId || 'NULL'} sessionId=${sessionId || 'NULL'}`);

  const insertRow = {
    id:                scanId,
    source_url:        originalUrl,
    url_type:          urlType,
    artist_name:       canonical.subject.artistName,
    spotify_artist_id: spotifyArtistId,
    apple_artist_id:   appleArtistId,
    payload:           canonical,
    // Optional anonymous-session id — set when the browser passed one.
    // Bridges this scan to a user account via migrate_anonymous_scans.
    session_id:        sessionId || null,
    // Authenticated user — resolved from Bearer token before this call.
    // NULL for anonymous scans; claimed later via migrate_anonymous_scans.
    user_id:           userId || null,
  };

  const MAX_ATTEMPTS = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await supabase.from('audit_scans').insert(insertRow);
      if (!error) return { scanId, canonical };
      // Duplicate-key on retry → row was inserted on a prior attempt; treat as success.
      if (error.code === '23505') return { scanId, canonical };
      lastError = error;
      console.warn(`[audit] audit_scans insert attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error.message);
    } catch (err) {
      lastError = err;
      console.warn(`[audit] audit_scans insert attempt ${attempt}/${MAX_ATTEMPTS} threw:`, err.message);
    }
  }
  throw new Error(`audit_scans persistence failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`);
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const scanId = randomUUID();
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  // Optional anonymous-session id from the browser. Length-capped defensively
  // before it touches the DB. Absent → scan still saves with session_id NULL.
  const sessionId = typeof req.query.session_id === 'string'
    ? req.query.session_id.slice(0, 100)
    : null;

  try {
    // ── ANTI-ABUSE: blocked-IP check + per-IP rate limit ──
    // Both helpers fail-open on Supabase errors (per documented policy in
    // api/_lib/rate-limit.js) — a DB outage degrades to no-rate-limiting,
    // not to locking out legit traffic.
    const clientIp = extractIp(req);
    const blocked = await checkBlocked(clientIp);
    if (blocked.blocked) {
      const retryAfter = Math.max(1, Math.ceil((new Date(blocked.expiresAt).getTime() - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: 'blocked', retryAfter });
    }
    const limit = await checkRateLimit(clientIp, 'audit', {
      burst: { max: 2 },
      hour:  { max: 30 },
      day:   { max: 100 },
    });
    if (!limit.allowed) {
      await recordViolation(clientIp, 'audit', limit.reason);
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: limit.reason, retryAfter: limit.retryAfter });
    }

    // ── SCAN ──
    // The scan pipeline lives in api/_lib/run-scan.js. runScan throws on fatal
    // errors, tagging them with `scanErrorKind`; the classification below
    // reproduces the exact HTTP responses the pre-extraction handler returned.
    let result;
    try {
      result = await runScan(url);
    } catch (scanErr) {
      const m = scanErr.message || '';
      const kind = scanErr.scanErrorKind;

      if (kind === 'unknown_input') {
        return res.status(400).json({ error: 'Invalid URL. Please paste a Spotify or Apple Music link.' });
      }
      if (kind === 'unresolved') {
        return res.status(400).json({ error: 'Could not resolve this link to an artist. Please try a different link.' });
      }
      if (kind === 'spotify_token') {
        const isAuthMissing = /credentials not configured/i.test(m);
        if (isAuthMissing) {
          return res.status(500).json({
            error: 'Audit failed. Please check the link and try again.',
            detail: m,
          });
        }
        return res.status(503).json({
          error: 'Spotify is temporarily unavailable. Please try again in a moment.',
          detail: m,
        });
      }
      if (kind === 'resolve') {
        if (/has no associated artist/.test(m)) {
          return res.status(400).json({
            error: "This Spotify link doesn't have a linked artist. Try pasting the artist's page directly.",
            detail: m,
          });
        }
        if (/Could not resolve artist from Apple Music/.test(m)) {
          return res.status(503).json({
            error: 'Apple Music is temporarily unavailable. Please try again in a moment.',
            detail: m,
          });
        }
        if (/Could not parse Spotify/.test(m)) {
          return res.status(400).json({
            error: 'Could not read this Spotify link. Please paste an artist, track, or album URL.',
            detail: m,
          });
        }
        if (/Spotify (artist|track|album) fetch failed/.test(m)) {
          return res.status(503).json({
            error: 'Spotify is temporarily unavailable. Please try again in a moment.',
            detail: m,
          });
        }
        // Unclassified resolve error — fall through to the generic 500 below.
      }
      // Unclassified / mid-pipeline error — generic 500 (same as the old
      // outer catch).
      console.error('Audit error:', scanErr);
      return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: m });
    }

    // ── PERSIST + OS INTELLIGENCE REQUEST ──
    //
    // Phase 3.1 — Website Scan is now a thin client of the Royaltē Operating System.
    //
    // CONSTITUTIONAL INVARIANT (Phase 3.1):
    //   The Website Scan NEVER computes intelligence.
    //   It requests a Certified Canonical Intelligence Model from the OS.
    //   runRIE() is the sole intelligence entrypoint — one call, one CIM,
    //   all consumers read from it.
    //
    // Execution sequence:
    //   1. normalizeAuditResponse(rawResponse)  — inside persistCanonicalScan
    //   2. OS enrichmentFn receives canonicalForEnrichment
    //   3. MLC provider data collected  — feeds the OS, not audit.js
    //   4. runRIE(canonicalForEnrichment + publishing data)  → certified CIM
    //   5. buildCimEnrichment(cim)  — maps CIM → legacy fields (migration bridge)
    //   6. canonical.cim = cim  — authoritative source for Phase 3.2 consumers
    //
    // Monitoring Intelligence is assembled post-scan in the two-phase OS write
    // below (it depends on scan_snapshots data unavailable until after step 6).
    // The monitoring patch updates legacy fields only; canonical.cim is not
    // re-certified in Phase 3.1 (addressed in Phase 3.2 Mission Control migration).
    const osEnrichmentFn = async (canonicalForEnrichment) => {
      const artistName = canonicalForEnrichment.subject?.artistName;

      // ── Provider data collection: MLC publishing source ──
      // MLC is a provider call that feeds evidence into the OS — audit.js
      // collects it here and passes it to runRIE(). Intelligence is never
      // computed from it directly in audit.js.
      let publishingSourceObservations = null;
      let publishingWorks              = null;
      try {
        const mlcResult              = await fetchMlcWorksByArtist(artistName);
        publishingSourceObservations = { mlc: mlcResult.observation };
        publishingWorks              = normalizeMlcWorks(mlcResult.rawWorks);
      } catch (mlcErr) {
        console.error('[audit] MLC source fetch failed (non-blocking):', mlcErr.message);
      }

      // ── Request the Certified Canonical Intelligence Model from the OS ──
      // runRIE() is the sole OS entrypoint. It accepts canonicalForEnrichment
      // via the Phase 1 (legacy evidence) path — the same path tested in
      // Phase 1 certification. Never throws; assembly failures return an
      // empty certified CIM.
      let cim = null;
      try {
        cim = await runRIE({
          canonicalForEnrichment,
          publishingWorks,
          publishingSourceObservations,
        });
      } catch (osErr) {
        // runRIE is documented never-throws; this is belt-and-suspenders.
        console.error('[audit] OS intelligence request failed (non-blocking):', osErr.message);
        return canonicalForEnrichment;
      }

      if (!cim || typeof cim !== 'object') {
        return canonicalForEnrichment;
      }

      // ── Map CIM → canonical enrichment fields (backward-compat bridge) ──
      // CimAdapter maps each CIM domain object to its canonical legacy field.
      // Intelligence sourced from CIM — no duplication, no re-computation.
      // canonical.cim carries the full certified CIM for Phase 3.2 consumers.
      return buildCimEnrichment(cim, canonicalForEnrichment);
    };

    // ── Resolve authenticated user before persistence ──
    // userId must be known before persistCanonicalScan so that audit_scans
    // rows are written with the correct user_id from creation. Anonymous
    // callers (no Bearer token) get null; their rows are later claimed via
    // migrate_anonymous_scans using the session_id. The Supabase client is
    // created once here and reused for both the V1 insert and the V2 path.
    const supabaseForOS = getAuditScansSupabase();
    const authenticatedUserId = supabaseForOS
      ? await resolveUserIdFromAuthHeader(req, supabaseForOS).catch(() => null)
      : null;
    // DIAGNOSTIC — remove after ownership trace confirmed
    const _authHeader = req.headers && (req.headers['authorization'] || req.headers['Authorization']);
    console.log(`[audit-diag] auth resolution: header=${_authHeader ? 'PRESENT' : 'ABSENT'} userId=${authenticatedUserId || 'NULL'}`);

    // ── Ownership gate: authenticated request with unresolvable token ────────
    // An authenticated workflow must never silently downgrade to an anonymous
    // scan. If a Bearer token was sent but the server cannot resolve a user_id
    // from it (expired, invalid, or revoked), reject the request. The caller
    // must re-authenticate before the scan proceeds.
    //
    // No audit_scans row is created — data integrity over silent failure.
    //
    // Note: requests with NO Authorization header are public scans and
    // continue through the anonymous path below, unchanged.
    if (_authHeader && !authenticatedUserId) {
      return res.status(401).json({
        error: 'Authentication required',
        detail: 'Your session could not be verified. Please log in and try again.',
        code: 'AUTH_INVALID',
      });
    }

    let canonical = null;
    try {
      const persisted = await persistCanonicalScan(
        result.rawResponse,
        url,
        result.urlType,
        scanId,
        sessionId,
        osEnrichmentFn,
        authenticatedUserId
      );
      canonical = persisted.canonical;
    } catch (persistErr) {
      console.error('[audit] persistence failed:', persistErr.message);
      return res.status(500).json({
        error: 'Failed to persist audit scan',
        detail: persistErr.message,
      });
    }

    // ── V2 OS SCAN-WRITE PATH (Brief 003) ──
    // Authenticated callers get a scan_snapshots row + delta-engine alerts +
    // monitoring_subscriptions upsert. Anonymous callers (no Bearer token)
    // skip this entirely. Failures here are logged and swallowed — the
    // user-facing scan response must NEVER depend on V2 monitoring work.
    //
    // Monitoring Intelligence™ (Phase Monitoring v1.0 — Option A):
    //   After persistOSScanSnapshot returns its generatedAlerts, assemble
    //   monitoringIntelligence and PATCH audit_scans.payload to include it.
    //   Two-phase write is required because the delta runs AFTER the initial
    //   payload is persisted. Non-blocking — a patch failure never aborts
    //   the scan response.
    try {
      if (supabaseForOS && canonical) {
        const userId = authenticatedUserId;
        if (userId) {
          const osResult = await persistOSScanSnapshot({
            canonical,
            urlType: result.urlType,
            userId,
            supabase: supabaseForOS,
            warnings: result.warnings,
          });

          // ── Monitoring + Health Intelligence™ — two-phase payload patch ──
          // Both objects are (re-)assembled here now that monitoringIntelligence
          // is known. Health Intelligence is re-assembled with real monitoring
          // data so the final persisted payload has the complete score.
          if (osResult && osResult.written) {
            try {
              const monitoringIntelligence = assembleMonitoringIntelligence({
                scanNumber: osResult.scanNumber,
                alerts:     osResult.alerts || [],
              });
              if (monitoringIntelligence && canonical) {
                canonical.monitoringIntelligence = monitoringIntelligence;
                // Re-assemble Health Intelligence™ with real monitoringIntelligence.
                // canonical.healthScore is the canonical authority — passed verbatim.
                try {
                  const finalHealthIntelligence = assembleHealthIntelligence(
                    canonical.healthScore            || null,
                    canonical.identityIntelligence   || null,
                    canonical.publishingIntelligence || null,
                    canonical.catalogIntelligence    || null,
                    canonical.globalMusicFootprint   || null,
                    canonical.backendIntelligence    || null,
                    monitoringIntelligence,
                    canonical.royalteAI              || null,
                  );
                  if (finalHealthIntelligence) {
                    canonical.healthIntelligence = finalHealthIntelligence;
                  }
                } catch (hiPatchErr) {
                  console.error('[audit] health intelligence re-assembly failed (non-blocking):', hiPatchErr.message);
                }
                const { error: miPatchErr } = await supabaseForOS
                  .from('audit_scans')
                  .update({ payload: canonical })
                  .eq('id', scanId);
                if (miPatchErr) {
                  console.error('[audit] monitoring+health intelligence patch failed (non-blocking):', miPatchErr.message);
                }
              }
            } catch (miErr) {
              console.error('[audit] monitoring intelligence assembly/patch failed (non-blocking):', miErr.message);
            }
          }
        }
      }
    } catch (osErr) {
      console.error('[os-scan] V2 write path failed (non-blocking):', osErr.message);
    }

    // Inject wire-only degradation signal AFTER persistence so the canonical
    // payload stays clean (AUDIT_RESPONSE_VERSION 1.0.0, no schema change).
    // Fields only appear when degradation actually occurred — happy-path
    // responses are byte-identical to pre-change behavior.
    if (result.warnings.length > 0) {
      result.rawResponse.degraded = true;
      result.rawResponse.warnings = result.warnings;
    }

    // Phase 3.1 — Wire shape:
    //   legacy raw fields (backward-compat for existing frontend)
    //   + canonical  (AuditResponse + CIM-sourced intelligence fields)
    //   + cim        (the Certified Canonical Intelligence Model — Phase 3.2+ reads from here)
    //   + intelligence aliases (same reference as canonical.*Intelligence)
    //
    // CONSTITUTIONAL INVARIANT:
    //   response.identityIntelligence    === response.canonical.identityIntelligence
    //   response.publishingIntelligence  === response.canonical.publishingIntelligence
    //   Both sourced from canonical.cim — one CIM, one computation, no duplication.
    //
    // Phase 3.2 consumers: read from response.cim directly.
    // Legacy consumers: read from response.canonical.*Intelligence (unchanged behavior).
    const identityIntelligence   = canonical?.identityIntelligence   ?? null;
    const publishingIntelligence = canonical?.publishingIntelligence ?? null;
    return res.status(200).json({
      ...result.rawResponse,
      scanId,
      canonical,
      cim:                  canonical?.cim ?? null,
      identityIntelligence,
      publishingIntelligence,
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}
