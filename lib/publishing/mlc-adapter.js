// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing Intelligence Adapter™ — MLC source
// ─────────────────────────────────────────────────────────────────────
//
//  CONSTITUTIONAL ROLE
//    - Canonical object served: Publishing (Canonical Payload V2, the
//      twelve-object Royaltē Intelligence Model).
//    - Sole owner of MLC response-shape parsing across the codebase.
//      No other module may read MLC field names directly; downstream
//      consumers receive PublishingWork objects from this adapter and
//      this adapter alone.
//    - Pure transformation. No I/O. No network calls. No DB writes.
//      No business logic beyond normalization + provenance stamping.
//
//  CONSTITUTIONAL PRINCIPLES INHERITED
//    - "One Truth. One Engine. One Platform." (Engineering Doctrine,
//      Master Constitution §7) — MLC → PublishingWork is computed in
//      exactly one place.
//    - "Compute once, consume everywhere." (Principle 2) — every
//      Royaltē surface that needs publishing data reads PublishingWork
//      from this module; nothing else touches MLC field names.
//    - "No speculative metrics." (Principle 5) — every surfaced field
//      is a verified MLC value, a mechanical derivation (trim,
//      concatenation), or null. The `confidence` value is a
//      deterministic function of which raw fields were populated; no
//      guesses, no probabilistic scoring.
//    - "Identity Graph separation" (Governance Directive 2026-06-09)
//      — this adapter produces canonical objects; persistence into
//      api/_lib/identity-graph.js happens in a separate phase.
//
//  SPEC SOURCE OF TRUTH
//    https://public-api.themlc.com/api/doc
//    (SearchWork response schema; see also the SearchWriter sub-schema)
//
//  PHASE 1 CONNECTIVITY PROOF
//    api/mlc-test.js — live probe endpoint, currently returns 200 OK
//    with real publishing data (EA082P · S831QA · ED SHEERAN writer
//    entries) via POST /search/songcode with the idToken bearer and
//    a populated writers[] body.
//
//  CONSUMERS (Phase 3+)
//    - api/_lib/identity-graph.js (Royaltē Identity Graph™)
//    - Canonical Payload V2 `publishing` object population
//    - DOES NOT FLOW INTO the Royaltē Scan Experience V1 (DESIGN
//      FROZEN per Board directive 2026-06-10; that PR holds at #122
//      until intelligence wiring is complete)
// ─────────────────────────────────────────────────────────────────────

const SOURCE_NAME = 'mlc';

// ─── Internal helpers ───────────────────────────────────────────────

// safeTrim: return null for nullish/non-string/empty-after-trim,
// otherwise the trimmed string. Following the brief's "null for missing
// fields, never undefined" rule.
function safeTrim(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// normalizeWriter: project one raw MLC writer entry into the canonical
// PublishingWriter shape. Names are never transformed beyond trim().
// fullName is the only synthetic field — mechanical concatenation
// (first + ' ' + last), or whichever of the two is present, else null.
function normalizeWriter(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const firstName = safeTrim(raw.writerFirstName);
  const lastName  = safeTrim(raw.writerLastName);
  let fullName;
  if (firstName && lastName) fullName = `${firstName} ${lastName}`;
  else if (firstName)        fullName = firstName;
  else if (lastName)         fullName = lastName;
  else                       fullName = null;
  return {
    firstName,
    lastName,
    fullName,
    writerIPI: safeTrim(raw.writerIPI),
    writerId:  safeTrim(raw.writerId),
    role:      safeTrim(raw.writerRoleCode),
  };
}

// deriveConfidence: deterministic function of which raw signals were
// populated. No probabilities, no thresholds — just data presence.
//   HIGH    — ISWC present AND at least one writer carries an IPI
//   MEDIUM  — ISWC present OR at least one writer carries an IPI
//   LOW     — work has writers but neither ISWC nor any IPI
//   UNKNOWN — reserved for indeterminate cases (currently unreachable;
//             returns null instead at the work level)
function deriveConfidence(iswc, normalizedWriters) {
  const iswcPresent = iswc !== null;
  const anyIpi = normalizedWriters.some((w) => w.writerIPI !== null);
  if (iswcPresent && anyIpi) return 'HIGH';
  if (iswcPresent || anyIpi) return 'MEDIUM';
  if (normalizedWriters.length > 0) return 'LOW';
  return 'UNKNOWN';
}

// ─── Public API ─────────────────────────────────────────────────────

// normalizeMlcWork: take one raw MLC work object, return one
// PublishingWork object — or null if the input cannot yield a valid
// canonical work. Never throws.
export function normalizeMlcWork(rawMlcWork) {
  if (!rawMlcWork || typeof rawMlcWork !== 'object' || Array.isArray(rawMlcWork)) {
    return null;
  }

  const title       = safeTrim(rawMlcWork.workTitle);
  const mlcSongCode = safeTrim(rawMlcWork.mlcSongCode);
  if (!title || !mlcSongCode) return null;

  const writersRaw = Array.isArray(rawMlcWork.writers) ? rawMlcWork.writers : [];
  const writers = writersRaw.map(normalizeWriter).filter((w) => w !== null);
  if (writers.length === 0) return null;

  const iswc = safeTrim(rawMlcWork.iswc);

  return {
    // Core identity
    title,
    canonicalTitle: title,    // whitespace-trimmed (reserved API surface;
                              // future canonical-matching rules apply here)
    mlcSongCode,
    iswc,                     // string | null

    // Writers
    writers,

    // Publishers — placeholder until MLC publisher data flows through
    publishers: [],

    // Provenance
    source:         SOURCE_NAME,
    rawMlcResponse: rawMlcWork,
    lastUpdated:    new Date().toISOString(),
    confidence:     deriveConfidence(iswc, writers),
  };
}

// normalizeMlcWorks: take an array of raw MLC works, return an array of
// PublishingWork objects. Nulls (invalid inputs) are filtered out so
// downstream consumers can safely iterate. Never throws.
export function normalizeMlcWorks(rawMlcWorks) {
  if (!Array.isArray(rawMlcWorks)) return [];
  return rawMlcWorks
    .map((w) => normalizeMlcWork(w))
    .filter((w) => w !== null);
}

// validatePublishingWork: structural validation against the PublishingWork
// contract. Returns { valid, errors }. Errors are stable machine-readable
// strings so downstream tooling can match on them.
export function validatePublishingWork(work) {
  const errors = [];
  if (!work || typeof work !== 'object' || Array.isArray(work)) {
    return { valid: false, errors: ['not_an_object'] };
  }
  if (!work.title       || typeof work.title       !== 'string') errors.push('missing_title');
  if (!work.mlcSongCode || typeof work.mlcSongCode !== 'string') errors.push('missing_mlcSongCode');
  if (!Array.isArray(work.writers) || work.writers.length === 0) errors.push('writers_array_empty');
  if (!Array.isArray(work.publishers))                            errors.push('publishers_array_missing');
  if (work.source !== SOURCE_NAME)                                errors.push('source_mismatch');
  return { valid: errors.length === 0, errors };
}
