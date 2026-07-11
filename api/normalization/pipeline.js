// Canonical Intelligence Platform(tm) -- Normalization Pipeline
//
// The pipeline converts provider-specific evidence into standardized,
// provider-neutral normalized evidence.
//
// Constitutional guarantee:
//   The pipeline NEVER modifies Evidence Registry records.
//   It reads immutable evidence and produces a new normalized result.
//   Input objects are never mutated.
//
// Pipeline stages per Evidence Envelope:
//   1. Validation       -- input must be a non-null object
//   2. Rule Selection   -- determine which rules apply to each field
//   3. Transformation   -- apply rules, collect applied/skipped/error entries
//   4. Validation       -- normalized output must be a non-null object
//   5. Report           -- produce immutable Normalization Report

import { randomUUID } from 'node:crypto';
import { NORMALIZATION_ENGINE_VERSION } from './version.js';
import { NORMALIZER_INPUT_TYPES } from './types.js';
import { createNormalizationReport, createAppliedEntry, createSkippedEntry, createErrorEntry } from './report.js';

// ---------- Rule selection --------------------------------------------------

// Determine whether a rule should be applied to a given field+value combination.
function ruleAppliesTo(rule, value, fieldName) {
  if (rule.status !== 'ACTIVE') return false;

  // Type matching: does the value type match what this rule targets?
  const typeMatch = (() => {
    switch (rule.inputType) {
      case NORMALIZER_INPUT_TYPES.STRING:
        return typeof value === 'string';
      case NORMALIZER_INPUT_TYPES.NUMBER:
        return typeof value === 'number' ||
               (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()));
      case NORMALIZER_INPUT_TYPES.BOOLEAN:
        return typeof value === 'boolean' ||
               (typeof value === 'string' && /^(true|false|yes|no|1|0)$/i.test(value.trim()));
      case NORMALIZER_INPUT_TYPES.DATE_STRING:
        // Only apply to strings that look like dates/datetimes
        return typeof value === 'string' &&
               /\d{4}/.test(value) &&
               !/^[A-Za-z0-9_-]+$/.test(value); // exclude plain IDs
      case NORMALIZER_INPUT_TYPES.URL:
        return typeof value === 'string' && /^https?:\/\//i.test(value);
      case NORMALIZER_INPUT_TYPES.ISRC:
        // Strings that could be ISRCs: ~12 chars, alphanumeric+hyphen
        return typeof value === 'string' && /^[A-Z]{2}[-]?[A-Z0-9]{3}[-]?\d{7}$/i.test(value.replace(/[-\s]/g, '').concat('00000000000000').slice(0,12));
      case NORMALIZER_INPUT_TYPES.UPC:
        return typeof value === 'string' && /^\d{12,13}$/.test(value.replace(/[-\s]/g, ''));
      case NORMALIZER_INPUT_TYPES.COUNTRY_CODE:
        return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value.trim());
      case NORMALIZER_INPUT_TYPES.LANGUAGE_CODE:
        return typeof value === 'string' && /^[A-Za-z]{2}$/.test(value.trim());
      case NORMALIZER_INPUT_TYPES.NULLABLE:
        return value === null || value === undefined;
      case NORMALIZER_INPUT_TYPES.ANY:
        return true;
      default:
        return false;
    }
  })();

  if (!typeMatch) return false;

  // Field pattern matching: if rule has fieldPatterns, at least one must match.
  if (rule.fieldPatterns && rule.fieldPatterns.length > 0) {
    return rule.fieldPatterns.some((pattern) => pattern.test(fieldName));
  }

  return true;
}

// ---------- Single-value normalization --------------------------------------

// Apply all applicable rules from the registry to a single value.
// Records applied rules (those that changed the value) and errors.
function applyRulesToValue(value, fieldPath, registry, applied, errors) {
  const activeRules = registry.listActiveRules();
  let current = value;

  for (const rule of activeRules) {
    if (!ruleAppliesTo(rule, current, fieldPath)) continue;
    try {
      const before = current;
      current = rule.normalize(current);
      // Only record rules that made an observable change
      if (JSON.stringify(before) !== JSON.stringify(current)) {
        applied.push(createAppliedEntry(rule.ruleId, rule.ruleName, fieldPath, before, current));
      }
    } catch (err) {
      errors.push(createErrorEntry(rule.ruleId, fieldPath, err.message));
    }
  }

  return current;
}

// ---------- Object traversal ------------------------------------------------

// Normalize a plain object (one level deep or recursively for nested objects).
// Returns a new object; input is never mutated.
function normalizeObject(obj, pathPrefix, registry, applied, errors, fieldCount) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    fieldCount.n += 1;

    if (val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val)) {
      // Recurse into nested objects
      out[key] = normalizeObject(val, fieldPath, registry, applied, errors, fieldCount);
    } else if (Array.isArray(val)) {
      // Normalize each element of arrays
      out[key] = val.map((item, i) => {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
          return applyRulesToValue(item, `${fieldPath}[${i}]`, registry, applied, errors);
        }
        if (item && typeof item === 'object') {
          return normalizeObject(item, `${fieldPath}[${i}]`, registry, applied, errors, fieldCount);
        }
        return item;
      });
    } else {
      out[key] = applyRulesToValue(val, fieldPath, registry, applied, errors);
    }
  }

  return out;
}

// ---------- Public pipeline -------------------------------------------------

// Normalize a parsedEvidence object from the Evidence Registry.
//
// The pipeline normalizes:
//   - parsedEvidence.evidence.*     (contract-specific provider fields)
//   - parsedEvidence.sourceUrl      (URL normalization)
//   - parsedEvidence.retrievedAt    (date normalization)
//
// The pipeline does NOT normalize system fields:
//   contractId, contractVersion, provider, providerVersion, connectorVersion,
//   scanId, artistId, confidence, evidenceStatus
//
// Returns: { success, normalizedEvidence, report }
export function normalizeParsedEvidence(parsedEvidence, registry, context = {}) {
  if (!parsedEvidence || typeof parsedEvidence !== 'object') {
    const report = createNormalizationReport({
      reportId:         randomUUID(),
      normalizedAt:     new Date().toISOString(),
      engineVersion:    NORMALIZATION_ENGINE_VERSION.version,
      errors:           [createErrorEntry('(none)', '(input)', 'parsedEvidence must be a non-null object')],
    });
    return { success: false, normalizedEvidence: null, report: Object.freeze(report) };
  }

  const applied  = [];
  const skipped  = [];
  const warnings = [];
  const errors   = [];
  const fieldCount = { n: 0 };
  const appliedCountBefore = () => applied.length;

  // Copy top-level structure; we normalize specific sub-trees below.
  const output = { ...parsedEvidence };

  // Normalize sourceUrl if present
  if (output.sourceUrl !== null && output.sourceUrl !== undefined) {
    fieldCount.n += 1;
    const before = appliedCountBefore();
    output.sourceUrl = applyRulesToValue(output.sourceUrl, 'sourceUrl', registry, applied, errors);
    if (applied.length === before && output.sourceUrl === parsedEvidence.sourceUrl) {
      // no rules applied — that's fine
    }
  }

  // Normalize retrievedAt if present
  if (typeof output.retrievedAt === 'string') {
    fieldCount.n += 1;
    output.retrievedAt = applyRulesToValue(output.retrievedAt, 'retrievedAt', registry, applied, errors);
  }

  // Normalize evidence sub-object (the provider-contributed fields)
  if (output.evidence && typeof output.evidence === 'object') {
    output.evidence = normalizeObject(output.evidence, 'evidence', registry, applied, errors, fieldCount);
  }

  const transformedFieldCount = new Set(applied.map(e => e.field)).size;

  const report = createNormalizationReport({
    reportId:             randomUUID(),
    normalizedAt:         new Date().toISOString(),
    engineVersion:        NORMALIZATION_ENGINE_VERSION.version,
    sourceEnvelopeId:     context.sourceEnvelopeId   ?? parsedEvidence.sourceEnvelopeId ?? null,
    evidenceEnvelopeId:   context.evidenceEnvelopeId ?? null,
    contractId:           parsedEvidence.contractId  ?? null,
    providerId:           parsedEvidence.provider    ?? null,
    rulesApplied:         applied,
    rulesSkipped:         skipped,
    warnings,
    errors,
    inputFieldCount:      fieldCount.n,
    transformedFieldCount,
  });

  return {
    success:           errors.length === 0,
    normalizedEvidence: Object.freeze(output),
    report:             Object.freeze(report),
  };
}

// Normalize a full Evidence Registry record (Sprint 3 format).
// Extracts parsedEvidence; returns the normalized result without mutating the record.
export function normalizeRegistryRecord(record, registry, options = {}) {
  if (!record || typeof record !== 'object') {
    const report = createNormalizationReport({
      reportId:      randomUUID(),
      normalizedAt:  new Date().toISOString(),
      engineVersion: NORMALIZATION_ENGINE_VERSION.version,
      errors:        [createErrorEntry('(none)', '(input)', 'Registry record must be a non-null object')],
    });
    return { success: false, normalizedEvidence: null, report: Object.freeze(report) };
  }

  const context = {
    sourceEnvelopeId:   record.sourceEnvelopeId   ?? null,
    evidenceEnvelopeId: record.evidenceEnvelopeId  ?? null,
    ...options,
  };

  return normalizeParsedEvidence(record.parsedEvidence, registry, context);
}

// Normalize a Sprint 2 Evidence Envelope directly.
export function normalizeEnvelope(envelope, registry, options = {}) {
  if (!envelope || typeof envelope !== 'object') {
    const report = createNormalizationReport({
      reportId:      randomUUID(),
      normalizedAt:  new Date().toISOString(),
      engineVersion: NORMALIZATION_ENGINE_VERSION.version,
      errors:        [createErrorEntry('(none)', '(input)', 'Envelope must be a non-null object')],
    });
    return { success: false, normalizedEvidence: null, report: Object.freeze(report) };
  }

  const context = {
    sourceEnvelopeId:   envelope.envelopeId ?? null,
    evidenceEnvelopeId: options.evidenceEnvelopeId ?? null,
    ...options,
  };

  return normalizeParsedEvidence(envelope.parsedEvidence, registry, context);
}

// Normalize an array of Registry records. Never throws; errors are captured per-record.
export function normalizeMany(records, registry, options = {}) {
  if (!Array.isArray(records)) {
    return { results: [], errors: ['normalizeMany: input must be an array'] };
  }
  const results = records.map((record) => normalizeRegistryRecord(record, registry, options));
  return { results };
}
