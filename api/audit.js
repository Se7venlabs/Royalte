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

// ─── Phase 4B-2 + Phase 5B: eager-assembly imports ─────────────────
//   Identity Intelligence™ (Phase 4B-2) AND Publishing Intelligence™
//   (Phase 5B Board D2 2026-06-17) are assembled exactly once during
//   the scan lifecycle, persisted alongside the canonical payload,
//   and reused by every downstream consumer. No consumer recomputes.
//
//   Per Phase 5B "orchestration over new infrastructure" — the
//   publishing pipeline uses the EXISTING MLC adapter (locked),
//   EXISTING Identity Graph publishing layer (locked), and EXISTING
//   CIO Assembler publishingWorks slot (locked) to feed the new
//   Publishing Intelligence™ assembler.
import { assembleCio } from './_lib/cio-assembler.js';
import { runIntelligenceEngine } from './_lib/intelligence-engine.js';
import { ALL_RULES } from './rules/index.js';
import { assembleIdentityIntelligence } from './_lib/identity-intelligence.js';
import { assemblePublishingIntelligence } from './_lib/publishing-intelligence.js';
import { assembleCatalogIntelligence } from './_lib/catalog-intelligence.js';
import { assembleGlobalMusicFootprint } from './_lib/global-music-footprint.js';
import { assembleRoyalteAI } from './_lib/royalte-ai-assembler.js';
import { fetchMlcWorksByArtist } from '../lib/publishing/mlc-client.js';
import { normalizeMlcWorks } from '../lib/publishing/mlc-adapter.js';
import { computeHealthScore, generateHealthReport } from './_lib/health-engine.js';
import { generateExecutiveBrief } from './_lib/executive-brief-engine.js';

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

export async function persistCanonicalScan(rawResponse, originalUrl, urlType, scanId, sessionId = null, enrichmentFn = null) {
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

    // ── PERSIST + EAGER INTELLIGENCE ASSEMBLY ──
    // Phase 4B-2 (Identity Intelligence™) + Phase 5B (Publishing
    // Intelligence™) + Phase 5B Board Architectural Review (2026-06-17,
    // "One Scan → One CIO → Many Consumers").
    //
    // CONSTITUTIONAL INVARIANT:
    //
    //   exactly ONE assembleCio() call per scan
    //   exactly ONE runIntelligenceEngine() call per scan
    //   every intelligence domain consumes the SAME (cio, report)
    //
    // The CIO is the kernel of the platform; multiple assemblies for
    // the same scan would create divergent kernels and violate the
    // single-source-of-truth principle. The runtime sequence is:
    //
    //   1. Fetch every external-source dataset BEFORE CIO assembly
    //      (today: MLC via fetchMlcWorksByArtist; future: SOCAN,
    //      ASCAP, BMI, MusicBrainz Publishing, …).
    //   2. Assemble the ONE CIO with ALL source inputs at once.
    //   3. Run the Intelligence Engine ONCE against that CIO.
    //   4. Each domain assembler reads from the SAME (cio, report).
    //
    // Failure-mode contract (inherited from Phase 4B-2):
    //   - If an external source (e.g. MLC) is unavailable, its
    //     observation surfaces AUTH_UNAVAILABLE/ERROR/NOT_FOUND and
    //     downstream resolves to UNABLE_TO_CONFIRM, never NOT_FOUND.
    //   - If CIO assembly or engine evaluation throws, the scan
    //     succeeds with NO intelligence objects — never blocks an audit.
    //   - If a per-domain assembler throws, the OTHER domain's
    //     intelligence still ships.
    //
    // The persisted canonical at audit_scans.payload carries:
    //   audit_scans.payload.identityIntelligence
    //   audit_scans.payload.publishingIntelligence
    //   audit_scans.payload.healthScore      (computeHealthScore output)
    //   audit_scans.payload.healthReport     (generateHealthReport output)
    //   audit_scans.payload.executiveBrief   (generateExecutiveBrief output)
    // Mission Control™ / Royaltē AI™ / Executive Brief™ / Priority
    // Actions™ all read the same persisted objects; none recompute.
    const assembleIntelligenceForScan = async (canonicalForEnrichment) => {
      const artistName = canonicalForEnrichment.subject?.artistName;

      // ── 1. Fetch external publishing sources BEFORE CIO assembly ──
      // MLC client is documented never-throws. On any failure the
      // observation surfaces availability='AUTH_UNAVAILABLE'/'ERROR'/
      // 'NOT_FOUND' and rawWorks = []; the CIO assembly succeeds and
      // downstream metrics resolve to UNABLE_TO_CONFIRM (per Board D5
      // four-state invariant).
      let publishingSourceObservations = null;
      let publishingWorks              = null;
      try {
        const mlcResult              = await fetchMlcWorksByArtist(artistName);
        publishingSourceObservations = { mlc: mlcResult.observation };
        publishingWorks              = normalizeMlcWorks(mlcResult.rawWorks);
      } catch (mlcErr) {
        // Defensive — the client contract is never-throws; this catch
        // is belt-and-suspenders.
        console.error('[audit] MLC source fetch failed (non-blocking):', mlcErr.message);
      }

      // ── 2 + 3. Assemble THE ONE CIO and run the engine ONCE ──
      let cio    = null;
      let report = null;
      try {
        cio = assembleCio(artistName, {
          scanPayload:                  canonicalForEnrichment,
          publishingWorks,
          publishingSourceObservations,
        });
        report = runIntelligenceEngine(cio, ALL_RULES);
      } catch (kernelErr) {
        console.error('[audit] CIO / Intelligence Engine failed (non-blocking):', kernelErr.message);
        return canonicalForEnrichment;
      }

      // ── 4. Each domain consumes the SAME (cio, report). One CIO,
      //       many consumers. Domain failures are isolated — Identity
      //       failure does not block Publishing and vice versa. ──
      let identityIntelligence = null;
      try {
        identityIntelligence = assembleIdentityIntelligence(report, cio);
      } catch (assemblyErr) {
        console.error('[audit] Identity Intelligence™ assembly failed (non-blocking):', assemblyErr.message);
      }

      let publishingIntelligence = null;
      try {
        publishingIntelligence = assemblePublishingIntelligence(report, cio);
      } catch (assemblyErr) {
        console.error('[audit] Publishing Intelligence™ assembly failed (non-blocking):', assemblyErr.message);
      }

      let catalogIntelligence = null;
      try {
        catalogIntelligence = assembleCatalogIntelligence(report, cio, canonicalForEnrichment);
      } catch (assemblyErr) {
        console.error('[audit] Catalog Intelligence™ assembly failed (non-blocking):', assemblyErr.message);
      }

      let globalMusicFootprint = null;
      try {
        globalMusicFootprint = assembleGlobalMusicFootprint(report, cio, canonicalForEnrichment);
      } catch (assemblyErr) {
        console.error('[audit] Global Music Footprint™ assembly failed (non-blocking):', assemblyErr.message);
      }

      // ── 5. Royaltē AI™ — reads the four assembled domain objects ──
      // Must run AFTER all four domain assemblers (Identity, Publishing,
      // Catalog, GMF) so it can read their outputs. Fail-isolated.
      let royalteAI = null;
      try {
        royalteAI = assembleRoyalteAI(
          identityIntelligence,
          publishingIntelligence,
          catalogIntelligence,
          globalMusicFootprint,
        );
      } catch (assemblyErr) {
        console.error('[audit] Royaltē AI™ assembly failed (non-blocking):', assemblyErr.message);
      }

      // ── 6. Health & Executive Brief pipeline ──
      // computeHealthScore() called exactly once; result passed to both
      // generateHealthReport() and generateExecutiveBrief() so the
      // canonical Health object is computed only once per scan.
      let healthScore    = null;
      let healthReport   = null;
      let executiveBrief = null;
      try {
        healthScore    = computeHealthScore(report);
        healthReport   = generateHealthReport(cio, report);
        executiveBrief = generateExecutiveBrief(cio, report, healthReport, healthScore);
      } catch (healthErr) {
        console.error('[audit] Health / Executive Brief pipeline failed (non-blocking):', healthErr.message);
      }

      const enriched = { ...canonicalForEnrichment };
      if (identityIntelligence)   enriched.identityIntelligence   = identityIntelligence;
      if (publishingIntelligence) enriched.publishingIntelligence = publishingIntelligence;
      if (catalogIntelligence)    enriched.catalogIntelligence    = catalogIntelligence;
      if (globalMusicFootprint)   enriched.globalMusicFootprint   = globalMusicFootprint;
      if (royalteAI)              enriched.royalteAI              = royalteAI;
      if (healthScore)            enriched.healthScore            = healthScore;
      if (healthReport)           enriched.healthReport           = healthReport;
      if (executiveBrief)         enriched.executiveBrief         = executiveBrief;
      return enriched;
    };

    let canonical = null;
    try {
      const persisted = await persistCanonicalScan(
        result.rawResponse,
        url,
        result.urlType,
        scanId,
        sessionId,
        assembleIntelligenceForScan
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
    //
    // ─── Intelligence alias rule (Board Final Amendments,
    //     Stage 4B-2 + Phase 5B 2026-06-17) ─────────────────────────
    //
    // CONSTITUTIONAL INVARIANT — applies to EVERY intelligence
    // domain Mission Control consumes:
    //
    //   response.identityIntelligence    === response.canonical.identityIntelligence
    //   response.publishingIntelligence  === response.canonical.publishingIntelligence
    //
    // One assembly per domain. One object per domain. Two access
    // paths. `canonical.<x>Intelligence` is the SOLE source of truth.
    // The top-level field is a CONVENIENCE MIRROR — same reference,
    // not a copy, not a clone, not a re-frozen rebuild.
    //
    // FAILURE-MODE ASYMMETRY (Board design):
    //   success →  canonical.<x>Intelligence: {...}
    //              <x>Intelligence:           same reference
    //   failure →  canonical.<x>Intelligence: OMITTED (key absent)
    //              <x>Intelligence:           null   (client can
    //                                                  distinguish "tried
    //                                                  and failed" from
    //                                                  "did not try")
    //
    // Do NOT replace these reads with structuredClone / JSON round-trip
    // / Object.freeze rebuild — any of those would break the invariant
    // by producing a separate object. The wiring tests in
    // tests/identity-wiring-test.mjs and tests/publishing-wiring-test.mjs
    // guard against that drift.
    const identityIntelligence = (canonical && canonical.identityIntelligence)
      ? canonical.identityIntelligence   // same reference — alias, not copy
      : null;
    const publishingIntelligence = (canonical && canonical.publishingIntelligence)
      ? canonical.publishingIntelligence // same reference — alias, not copy
      : null;
    return res.status(200).json({
      ...result.rawResponse,
      scanId,
      canonical,
      identityIntelligence,
      publishingIntelligence,
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}
