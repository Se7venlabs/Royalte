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
//   4. Normalization Fingerprint -- deterministic hash of normalized output
//   5. Normalized Record™       -- immutable output artifact
//   6. Normalization Manifest™  -- immutable audit companion

import { randomUUID } from 'node:crypto';
import { NORMALIZATION_ENGINE_VERSION } from './version.js';
import { NORMALIZER_INPUT_TYPES } from './types.js';
import { createNormalizationManifest, createNormalizationReport,
         createAppliedEntry, createSkippedEntry, createErrorEntry } from './report.js';
import { createNormalizedRecord } from './normalized-record.js';

// ---------- Rule selection --------------------------------------------------

function ruleAppliesTo(rule, value, fieldName) {
  if (rule.status !== 'ACTIVE') return false;

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
        return typeof value === 'string' &&
               /\d{4}/.test(value) &&
               !/^[A-Za-z0-9_-]+$/.test(value);
      case NORMALIZER_INPUT_TYPES.URL:
        return typeof value === 'string' && /^https?:\/\//i.test(value);
      case NORMALIZER_INPUT_TYPES.ISRC:
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

  if (rule.fieldPatterns && rule.fieldPatterns.length > 0) {
    return rule.fieldPatterns.some((pattern) => pattern.test(fieldName));
  }

  return true;
}

// ---------- Single-value normalization --------------------------------------

function applyRulesToValue(value, fieldPath, registry, applied, errors) {
  const activeRules = registry.listActiveRules();
  let current = value;

  for (const rule of activeRules) {
    if (!ruleAppliesTo(rule, current, fieldPath)) continue;
    try {
      const before = current;
      current = rule.normalize(current);
      if (JSON.stringify(before) !== JSON.stringify(current)) {
        applied.push(createAppliedEntry(rule.ruleId, rule.ruleName, rule.version, fieldPath, before, current));
      }
    } catch (err) {
      errors.push(createErrorEntry(rule.ruleId, fieldPath, err.message));
    }
  }

  return current;
}

// ---------- Object traversal ------------------------------------------------

function normalizeObject(obj, pathPrefix, registry, applied, errors, fieldCount) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;

  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const fieldPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    fieldCount.n += 1;

    if (val !== null && val !== undefined && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = normalizeObject(val, fieldPath, registry, applied, errors, fieldCount);
    } else if (Array.isArray(val)) {
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

// Normalize a parsedEvidence object.
//
// Returns: { success, normalizedRecord, manifest, normalizedEvidence, report }
//   normalizedRecord   -- Normalized Record™ (constitutional output artifact)
//   manifest           -- Normalization Manifest™ (audit companion)
//   normalizedEvidence -- backward-compat alias for normalizedRecord.normalizedEvidence
//   report             -- backward-compat alias for manifest
export function normalizeParsedEvidence(parsedEvidence, registry, context = {}) {
  const startTime = Date.now();

  if (!parsedEvidence || typeof parsedEvidence !== 'object') {
    const manifestId        = randomUUID();
    const normalizedRecordId = randomUUID();
    const errorEntry = createErrorEntry('(none)', '(input)', 'parsedEvidence must be a non-null object');
    const manifest = Object.freeze(createNormalizationManifest({
      manifestId,
      outputNormalizedRecordId: normalizedRecordId,
      errors: [errorEntry],
      processingTime: Date.now() - startTime,
    }));
    const normalizedRecord = Object.freeze(createNormalizedRecord({
      normalizedRecordId,
      normalizationManifestId: manifestId,
      normalizedEvidence: null,
      registryRecordId:   context.registryRecordId   ?? null,
      sourceEvidenceEnvelopeId: context.sourceEnvelopeId ?? null,
    }));
    return { success: false, normalizedRecord, manifest, normalizedEvidence: null, report: manifest };
  }

  const applied    = [];
  const skipped    = [];
  const warnings   = [];
  const errors     = [];
  const fieldCount = { n: 0 };

  // Generate cross-linked IDs up front so Record and Manifest can reference each other.
  const normalizedRecordId = randomUUID();
  const manifestId         = randomUUID();

  // Copy top-level structure; normalize specific sub-trees only.
  const output = { ...parsedEvidence };

  if (output.sourceUrl !== null && output.sourceUrl !== undefined) {
    fieldCount.n += 1;
    output.sourceUrl = applyRulesToValue(output.sourceUrl, 'sourceUrl', registry, applied, errors);
  }

  if (typeof output.retrievedAt === 'string') {
    fieldCount.n += 1;
    output.retrievedAt = applyRulesToValue(output.retrievedAt, 'retrievedAt', registry, applied, errors);
  }

  if (output.evidence && typeof output.evidence === 'object') {
    output.evidence = normalizeObject(output.evidence, 'evidence', registry, applied, errors, fieldCount);
  }

  const frozenEvidence       = Object.freeze(output);
  const transformedFieldCount = new Set(applied.map(e => e.field)).size;
  const processingTime        = Date.now() - startTime;

  // Build ruleVersions map from applied entries.
  const ruleVersions = {};
  for (const entry of applied) {
    ruleVersions[entry.ruleId] = entry.ruleVersion ?? null;
  }

  const manifest = Object.freeze(createNormalizationManifest({
    manifestId,
    inputRegistryRecordId:    context.registryRecordId   ?? null,
    outputNormalizedRecordId: normalizedRecordId,
    rulesApplied:             applied,
    rulesSkipped:             skipped,
    ruleVersions,
    engineVersion:            NORMALIZATION_ENGINE_VERSION.version,
    warnings,
    errors,
    processingTime,
    sourceEnvelopeId:         context.sourceEnvelopeId   ?? parsedEvidence.sourceEnvelopeId ?? null,
    evidenceEnvelopeId:       context.evidenceEnvelopeId ?? null,
    contractId:               parsedEvidence.contractId  ?? null,
    providerId:               parsedEvidence.provider    ?? null,
    inputFieldCount:          fieldCount.n,
    transformedFieldCount,
  }));

  const normalizedRecord = Object.freeze(createNormalizedRecord({
    normalizedRecordId,
    sourceEvidenceEnvelopeId: context.sourceEnvelopeId   ?? null,
    registryRecordId:         context.registryRecordId   ?? null,
    normalizationManifestId:  manifestId,
    normalizedEvidence:       frozenEvidence,
    engineVersion:            NORMALIZATION_ENGINE_VERSION.version,
    ruleVersions,
  }));

  return {
    success:           errors.length === 0,
    normalizedRecord,
    manifest,
    normalizedEvidence: normalizedRecord.normalizedEvidence,  // backward compat
    report:             manifest,                             // backward compat
  };
}

// Normalize a full Evidence Registry record (Sprint 3 format).
export function normalizeRegistryRecord(record, registry, options = {}) {
  if (!record || typeof record !== 'object') {
    const manifestId         = randomUUID();
    const normalizedRecordId = randomUUID();
    const errorEntry = createErrorEntry('(none)', '(input)', 'Registry record must be a non-null object');
    const manifest = Object.freeze(createNormalizationManifest({
      manifestId,
      outputNormalizedRecordId: normalizedRecordId,
      errors: [errorEntry],
      processingTime: 0,
    }));
    const normalizedRecord = Object.freeze(createNormalizedRecord({
      normalizedRecordId,
      normalizationManifestId: manifestId,
      normalizedEvidence: null,
    }));
    return { success: false, normalizedRecord, manifest, normalizedEvidence: null, report: manifest };
  }

  const context = {
    sourceEnvelopeId:   record.sourceEnvelopeId   ?? null,
    evidenceEnvelopeId: record.evidenceEnvelopeId  ?? null,
    registryRecordId:   record.registryRecordId    ?? null,
    ...options,
  };

  return normalizeParsedEvidence(record.parsedEvidence, registry, context);
}

// Normalize a Sprint 2 Evidence Envelope directly.
export function normalizeEnvelope(envelope, registry, options = {}) {
  if (!envelope || typeof envelope !== 'object') {
    const manifestId         = randomUUID();
    const normalizedRecordId = randomUUID();
    const errorEntry = createErrorEntry('(none)', '(input)', 'Envelope must be a non-null object');
    const manifest = Object.freeze(createNormalizationManifest({
      manifestId,
      outputNormalizedRecordId: normalizedRecordId,
      errors: [errorEntry],
      processingTime: 0,
    }));
    const normalizedRecord = Object.freeze(createNormalizedRecord({
      normalizedRecordId,
      normalizationManifestId: manifestId,
      normalizedEvidence: null,
    }));
    return { success: false, normalizedRecord, manifest, normalizedEvidence: null, report: manifest };
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
