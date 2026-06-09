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

export async function persistCanonicalScan(rawResponse, originalUrl, urlType, scanId, sessionId = null) {
  const supabase = getAuditScansSupabase();
  if (!supabase) {
    throw new Error('audit_scans persistence unavailable: Supabase not configured');
  }

  // Pass handler-generated scanId in so canonical.scanId === scanId.
  const canonical = normalizeAuditResponse({ ...rawResponse, scanId, _originalUrl: originalUrl });

  // VALIDATION GATE — fires before any DB write. handleSchemaViolation either
  // logs + persists to schema_violations and returns (prod/preview), or
  // re-throws the AuditSchemaError (dev/test/CI). See helper for env policy.
  try {
    validateAuditResponse(canonical);
  } catch (err) {
    await handleSchemaViolation({ scanId, canonical, err });
  }

  const spotifyArtistId = rawResponse.artistId || null;
  const appleArtistId   = rawResponse.appleMusic?.artistId || null;

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

    // ── PERSIST ──
    let canonical = null;
    try {
      const persisted = await persistCanonicalScan(result.rawResponse, url, result.urlType, scanId, sessionId);
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
    try {
      const supabaseForOS = getAuditScansSupabase();
      if (supabaseForOS && canonical) {
        const userId = await resolveUserIdFromAuthHeader(req, supabaseForOS);
        if (userId) {
          await persistOSScanSnapshot({
            canonical,
            urlType: result.urlType,
            userId,
            supabase: supabaseForOS,
            warnings: result.warnings,
          });
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

    // Canonical Payload V2 Phase 1.5 — Board Option B (2026-06-09).
    // Wire shape: legacy raw fields at root (back-compat for every
    // existing browser consumer) + the full Canonical Payload™ under
    // `canonical`. Consumers migrate one Royaltē Intelligence Object
    // at a time by reading `data.canonical.<object>.<field>`.
    // Required to unblock Canonical Health Object Phase 5/6.
    return res.status(200).json({ ...result.rawResponse, scanId, canonical });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}
