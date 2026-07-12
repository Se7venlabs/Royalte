// Canonical Intelligence Platform(tm) -- Normalization Report Factory
//
// Every normalization operation produces a Normalization Report.
// The report is audit metadata: it records exactly what happened,
// what rules were applied, what changed, and what was skipped.
//
// Reports are immutable once created.

import { randomUUID } from 'node:crypto';
import { NORMALIZATION_ENGINE_VERSION } from './version.js';

// Create a record of one rule application that changed a value.
export function createAppliedEntry(ruleId, ruleName, ruleVersion, field, inputValue, outputValue) {
  return Object.freeze({ ruleId, ruleName, ruleVersion: ruleVersion ?? null, field, inputValue, outputValue });
}

// Create a record of a rule that was deliberately skipped (applicable but bypassed).
export function createSkippedEntry(ruleId, ruleName, reason) {
  return Object.freeze({ ruleId, ruleName, reason });
}

// Create an error entry for a rule that threw during execution.
export function createErrorEntry(ruleId, field, error) {
  return Object.freeze({ ruleId, field, error: String(error) });
}

// Create an immutable Normalization Manifest™.
//
// The Manifest is the constitutional audit record that permanently explains HOW
// normalization occurred. It is the companion artifact to the Normalized Record.
//
// The Manifest links backward to the source Registry Record (inputRegistryRecordId)
// and forward to the produced Normalized Record (outputNormalizedRecordId).
//
// params:
//   manifestId               -- UUID (caller supplies so Record and Manifest can cross-link)
//   inputRegistryRecordId    -- Sprint 3 registryRecordId (may be null)
//   outputNormalizedRecordId -- normalizedRecordId of the produced Normalized Record
//   rulesApplied             -- array of createAppliedEntry results
//   rulesSkipped             -- array of createSkippedEntry results
//   ruleVersions             -- { [ruleId]: version } for all rules that ran
//   engineVersion            -- NORMALIZATION_ENGINE_VERSION.version
//   warnings                 -- array of warning strings
//   errors                   -- array of createErrorEntry results
//   processingTime           -- milliseconds elapsed during normalization
//   createdAt                -- ISO timestamp
//   (plus backward-compat fields from the original NormalizationReport)
export function createNormalizationManifest({
  manifestId,
  inputRegistryRecordId,
  outputNormalizedRecordId,
  rulesApplied,
  rulesSkipped,
  ruleVersions,
  engineVersion,
  warnings,
  errors,
  processingTime,
  createdAt,
  sourceEnvelopeId,
  evidenceEnvelopeId,
  contractId,
  providerId,
  inputFieldCount,
  transformedFieldCount,
}) {
  const id  = manifestId ?? randomUUID();
  const now = createdAt  ?? new Date().toISOString();
  return Object.freeze({
    manifestId:               id,
    reportId:                 id,      // backward-compat alias: reportId === manifestId
    inputRegistryRecordId:    inputRegistryRecordId    ?? null,
    outputNormalizedRecordId: outputNormalizedRecordId ?? null,
    rulesApplied:             Object.freeze([...(rulesApplied  ?? [])]),
    rulesSkipped:             Object.freeze([...(rulesSkipped  ?? [])]),
    ruleVersions:             Object.freeze({ ...(ruleVersions ?? {}) }),
    engineVersion:            engineVersion ?? NORMALIZATION_ENGINE_VERSION.version,
    warnings:                 Object.freeze([...(warnings ?? [])]),
    errors:                   Object.freeze([...(errors   ?? [])]),
    processingTime:           processingTime ?? 0,
    createdAt:                now,
    normalizedAt:             now,     // backward-compat alias: normalizedAt === createdAt
    sourceEnvelopeId:         sourceEnvelopeId   ?? null,
    evidenceEnvelopeId:       evidenceEnvelopeId  ?? null,
    contractId:               contractId  ?? null,
    providerId:               providerId  ?? null,
    inputFieldCount:          inputFieldCount      ?? 0,
    transformedFieldCount:    transformedFieldCount ?? 0,
    success:                  (errors?.length ?? 0) === 0,
  });
}

// Create the Normalization Report for one normalization run.
//
// params:
//   reportId           -- UUID for this report (caller generates)
//   normalizedAt       -- ISO timestamp of normalization
//   engineVersion      -- from NORMALIZATION_ENGINE_VERSION
//   sourceEnvelopeId   -- Sprint 2 envelope.envelopeId (may be null)
//   evidenceEnvelopeId -- Sprint 3 registry evidenceEnvelopeId (may be null)
//   contractId         -- evidence contract identifier (may be null)
//   providerId         -- provider identifier (may be null)
//   rulesApplied       -- array of createAppliedEntry results
//   rulesSkipped       -- array of createSkippedEntry results
//   warnings           -- array of warning strings
//   errors             -- array of createErrorEntry results
//   inputFieldCount    -- number of fields evaluated
//   transformedFieldCount -- fields where at least one rule changed the value
export function createNormalizationReport({
  reportId,
  normalizedAt,
  engineVersion,
  sourceEnvelopeId,
  evidenceEnvelopeId,
  contractId,
  providerId,
  rulesApplied,
  rulesSkipped,
  warnings,
  errors,
  inputFieldCount,
  transformedFieldCount,
}) {
  return Object.freeze({
    reportId:             reportId ?? randomUUID(),
    normalizedAt:         normalizedAt ?? new Date().toISOString(),
    engineVersion:        engineVersion ?? NORMALIZATION_ENGINE_VERSION.version,
    sourceEnvelopeId:     sourceEnvelopeId   ?? null,
    evidenceEnvelopeId:   evidenceEnvelopeId ?? null,
    contractId:           contractId  ?? null,
    providerId:           providerId  ?? null,
    rulesApplied:         Object.freeze([...(rulesApplied  ?? [])]),
    rulesSkipped:         Object.freeze([...(rulesSkipped  ?? [])]),
    warnings:             Object.freeze([...(warnings      ?? [])]),
    errors:               Object.freeze([...(errors        ?? [])]),
    inputFieldCount:      inputFieldCount      ?? 0,
    transformedFieldCount: transformedFieldCount ?? 0,
    success:              (errors?.length ?? 0) === 0,
  });
}
