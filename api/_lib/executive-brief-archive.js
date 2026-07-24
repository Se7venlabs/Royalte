// Executive Brief Archive™ — ATHENA™ Phase 3A
//
// Sole write path into public.executive_brief_archive. Called exclusively
// from api/executive-intelligence.js, server-side, after the Executive
// Intelligence Object™ has been generated. Never called from the browser.
//
// See governance/ATHENA_PHASE3A_EXECUTIVE_BRIEF_ARCHIVE_ARCHITECTURE.md for
// the full design (idempotency, integrity hash, failure handling).
//
// Contract: never throws. Always resolves to
//   { archived: true,  executiveBriefId, archiveIntegrityHash, idempotentReplay? }
// or
//   { archived: false, archiveError }
// so a persistence failure can never prevent the already-generated Executive
// Intelligence Object from being returned to the caller.

import { createHash } from 'node:crypto';
import { generateExecutiveBriefId } from '../athena/executive-intelligence-object.js';

const TABLE = 'executive_brief_archive';
const ARTIST_SCAN_CONSTRAINT = 'uq_executive_brief_archive_artist_scan';
const BRIEF_ID_CONSTRAINT    = 'uq_executive_brief_archive_brief_id';
const MAX_ID_RETRY_ATTEMPTS  = 3;
const UNIQUE_VIOLATION_CODE  = '23505'; // Postgres

// Canonical (order-independent) JSON serialization — Board Validation 1,
// 2026-07-24. Plain JSON.stringify() serializes object keys in insertion
// order, which is NOT guaranteed to survive a round-trip: Postgres jsonb
// reorders object keys internally (sorted by length then lexicographically,
// not insertion order) when storing and returning a value. Recomputing a
// hash with plain JSON.stringify() over a value retrieved from jsonb would
// not match the hash computed at insert time -- a false integrity failure,
// not a real one. Sorting keys recursively here makes the digest stable
// across storage, export, and re-import, independent of how any given
// runtime happens to order object keys.
function canonicalStringify(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(v => canonicalStringify(v) ?? 'null').join(',') + ']';
  }
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

function computeIntegrityHash(eio) {
  return createHash('sha256').update(canonicalStringify(eio)).digest('hex');
}

// Postgres/PostgREST surfaces the violated constraint name in the error
// message/details -- this is a text match, not a documented stable API, but
// it's the same mechanism this codebase already relies on for RPC-based
// conflict handling (api/_lib/rate-limit.js's ON CONFLICT usage) and is the
// only signal Supabase's client exposes for "which constraint fired".
function isUniqueViolation(error, constraintName) {
  if (!error || error.code !== UNIQUE_VIOLATION_CODE) return false;
  const text = `${error.message || ''} ${error.details || ''}`;
  return text.includes(constraintName);
}

function buildRow(eio, artistProfileId, executiveBriefId, integrityHash) {
  return {
    executive_brief_id:      executiveBriefId,
    artist_profile_id:       artistProfileId,
    scan_id:                 eio.scanId || null,
    generated_at:             eio.generatedAt,
    executive_version:        eio.metadata.executiveVersion,
    schema_version:            eio.metadata.schemaVersion,
    pipeline_version:          eio.metadata.pipelineVersion,
    athena_version:            eio.metadata.athenaVersion,
    runtime_context_version:   eio.metadata.runtimeContextVersion,
    confidence_level:          (eio.confidence && eio.confidence.level) || 'INSUFFICIENT_DATA',
    critical_issue_count:      eio.executiveBriefing.criticalIssues || 0,
    risk_count:                 (eio.risks || []).length,
    opportunity_count:          (eio.opportunities || []).length,
    recommendation_count:       (eio.recommendations || []).length,
    executive_intelligence_object: eio,
    archive_integrity_hash:     integrityHash,
    // comparison_group_id intentionally omitted -- always NULL in Phase 3A.
  };
}

async function fetchExistingByArtistScan(supabase, artistProfileId, scanId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('executive_brief_id, archive_integrity_hash')
    .eq('artist_profile_id', artistProfileId)
    .eq('scan_id', scanId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// archiveExecutiveBrief({ eio, artistProfileId, supabase })
//
// `supabase` is an already-constructed Supabase client (service-role key —
// the caller owns credential/client setup; this module never reads env vars
// or constructs its own client, which keeps it trivially unit-testable with
// an injected mock).
export async function archiveExecutiveBrief({ eio, artistProfileId, supabase }) {
  if (!eio || typeof eio !== 'object') {
    return { archived: false, archiveError: 'eio is required' };
  }
  if (!artistProfileId) {
    return { archived: false, archiveError: 'anonymous scan — not archived' };
  }
  if (!supabase) {
    return { archived: false, archiveError: 'archive storage unavailable' };
  }
  if (!eio.scanId) {
    // scan_id anchors the idempotency guarantee (§5 of the architecture
    // note) -- without one, duplicate-write protection can't be enforced,
    // so this is a hard requirement, not a soft preference.
    return { archived: false, archiveError: 'eio.scanId is required to archive' };
  }

  let currentId = eio.executiveBriefId;

  try {
    for (let attempt = 1; attempt <= MAX_ID_RETRY_ATTEMPTS; attempt++) {
      // Board Validation 3, 2026-07-24: on a regenerated id (currentId !==
      // eio.executiveBriefId), the row's executive_brief_id column, the
      // stored executive_intelligence_object.executiveBriefId, and the
      // integrity hash must all reference the SAME final id — all three are
      // derived from eioForHash below, never the stale original eio.
      const eioForHash = currentId === eio.executiveBriefId ? eio : { ...eio, executiveBriefId: currentId };
      const hash = computeIntegrityHash(eioForHash);
      const row = buildRow(eioForHash, artistProfileId, currentId, hash);

      const { error } = await supabase.from(TABLE).insert(row);

      if (!error) {
        return { archived: true, executiveBriefId: currentId, archiveIntegrityHash: hash };
      }

      if (isUniqueViolation(error, ARTIST_SCAN_CONSTRAINT)) {
        // Idempotent replay: a prior attempt (client retry, Vercel
        // re-invocation, duplicate generation) already archived this exact
        // (artist, scan) pair. Return its real, original identity — never a
        // new row, never a different id for the same scan.
        const existing = await fetchExistingByArtistScan(supabase, artistProfileId, eio.scanId);
        if (existing) {
          return {
            archived: true,
            executiveBriefId: existing.executive_brief_id,
            archiveIntegrityHash: existing.archive_integrity_hash,
            idempotentReplay: true,
          };
        }
        console.error('[executive-brief-archive] artist/scan conflict but existing row not found');
        return { archived: false, archiveError: 'archive conflict could not be resolved' };
      }

      if (isUniqueViolation(error, BRIEF_ID_CONSTRAINT)) {
        // Rare random-suffix collision (flagged, ATHENA_EXECUTIVE_INTELLIGENCE_PHASE1_IMPLEMENTATION.md §15).
        // Mint a replacement id for the same content and retry, bounded.
        currentId = generateExecutiveBriefId(eio.generatedAt);
        continue;
      }

      console.error('[executive-brief-archive] write failed:', error.message || error);
      return { archived: false, archiveError: 'archive write failed' };
    }

    console.error('[executive-brief-archive] exhausted retries regenerating executiveBriefId');
    return { archived: false, archiveError: 'archive write failed after retries' };
  } catch (err) {
    // Contract: never throws (see module header). A malformed eio or an
    // unexpected client shape surfaces as a reported failure, never an
    // exception that could take down the caller's response.
    console.error('[executive-brief-archive] unexpected error:', err?.message || err);
    return { archived: false, archiveError: 'unexpected archive error' };
  }
}

// Exported for testing.
export { computeIntegrityHash, isUniqueViolation, buildRow };
