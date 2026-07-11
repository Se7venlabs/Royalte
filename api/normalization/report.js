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
export function createAppliedEntry(ruleId, ruleName, field, inputValue, outputValue) {
  return Object.freeze({ ruleId, ruleName, field, inputValue, outputValue });
}

// Create a record of a rule that was deliberately skipped (applicable but bypassed).
export function createSkippedEntry(ruleId, ruleName, reason) {
  return Object.freeze({ ruleId, ruleName, reason });
}

// Create an error entry for a rule that threw during execution.
export function createErrorEntry(ruleId, field, error) {
  return Object.freeze({ ruleId, field, error: String(error) });
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
