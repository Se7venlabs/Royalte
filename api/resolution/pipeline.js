// Canonical Intelligence Platform(tm) -- Resolution Pipeline(tm)
// Stateless. Deterministic. Replayable. Never mutates inputs. Never throws.

import { randomUUID } from 'crypto';
import { RESOLUTION_ENGINE_VERSION } from './version.js';
import { RESOLUTION_RULES, CONFLICT_TYPES, RESOLUTION_ERROR_CODES } from './types.js';
import { detectConflict } from './conflicts.js';
import { computeConfidence, confidenceLevel } from './confidence.js';
import { createFieldProvenance } from './provenance.js';
import { createResolutionRecord } from './resolution-record.js';
import { createResolutionManifest } from './manifest.js';

// Extract a provider ID from a Normalized Record.
// Provider lives at normalizedEvidence.provider per Sprint 4 output shape.
function extractProvider(record) {
  return record?.normalizedEvidence?.provider ?? null;
}

// Extract the evidence sub-object from a Normalized Record.
function extractEvidence(record) {
  return record?.normalizedEvidence?.evidence ?? null;
}

// Extract the value of a specific field from a Normalized Record.
function extractFieldValue(record, fieldName) {
  const evidence = extractEvidence(record);
  if (!evidence) return undefined;
  return Object.prototype.hasOwnProperty.call(evidence, fieldName)
    ? evidence[fieldName]
    : undefined;
}

// Build a { [providerId]: value } map from the set of normalized records.
function buildProviderValueMap(normalizedRecords, fieldName) {
  const map = {};
  for (const record of normalizedRecords) {
    const provider = extractProvider(record);
    if (!provider) continue;
    const value = extractFieldValue(record, fieldName);
    map[provider] = (value === undefined) ? null : value;
  }
  return map;
}

// Select the canonical provider+value by walking the policy's providerOrder.
// Returns { selectedProvider, canonicalValue, selectedRank } or null if no data.
function applyPolicyPriority(policy, providerValueMap) {
  for (let rank = 0; rank < policy.providerOrder.length; rank++) {
    const provider = policy.providerOrder[rank];
    if (Object.prototype.hasOwnProperty.call(providerValueMap, provider)) {
      const value = providerValueMap[provider];
      if (value !== null && value !== undefined) {
        return { selectedProvider: provider, canonicalValue: value, selectedRank: rank };
      }
    }
  }
  return null;
}

// Derive supporting (agree with selected) and conflicting (disagree) providers.
function classifyProviders(providerValueMap, selectedProvider, canonicalValue) {
  const supporting   = [];
  const conflicting  = [];
  const canonicalStr = String(canonicalValue);
  for (const [provider, value] of Object.entries(providerValueMap)) {
    if (provider === selectedProvider) continue;
    if (value === null || value === undefined) continue;
    if (String(value) === canonicalStr) {
      supporting.push(provider);
    } else {
      conflicting.push(provider);
    }
  }
  return { supporting, conflicting };
}

export function resolveField(normalizedRecords, fieldName, policyRegistry, options = {}) {
  const startTime = Date.now();

  // Pre-allocate cross-linked IDs
  const resolutionRecordId = options.resolutionRecordId ?? randomUUID();
  const provenanceId       = options.provenanceId       ?? randomUUID();
  const manifestId         = options.manifestId         ?? randomUUID();

  const normalizedRecordIds = normalizedRecords
    .map(r => r?.normalizedRecordId)
    .filter(Boolean);

  const warnings = [];
  const errors   = [];

  // Policy lookup
  const policy = policyRegistry.getPolicyForField(fieldName);
  if (!policy) {
    const manifest = createResolutionManifest({
      manifestId,
      resolvedField:            fieldName,
      inputNormalizedRecordIds: normalizedRecordIds,
      errors: [{ code: RESOLUTION_ERROR_CODES.NO_POLICY_FOUND, message: `No policy for field: ${fieldName}` }],
      processingTime: Date.now() - startTime,
    });
    return { success: false, resolutionRecord: null, manifest, error: RESOLUTION_ERROR_CODES.NO_POLICY_FOUND };
  }

  // Build provider value map
  const providerValueMap = buildProviderValueMap(normalizedRecords, fieldName);

  // Conflict detection
  const conflictRecord = detectConflict(providerValueMap);

  // Resolution
  let selection = null;

  if (policy.resolutionRule === RESOLUTION_RULES.POLICY_PRIORITY || policy.resolutionRule === RESOLUTION_RULES.FIRST_AVAILABLE) {
    selection = applyPolicyPriority(policy, providerValueMap);
  } else if (policy.resolutionRule === RESOLUTION_RULES.CONSENSUS) {
    // Only resolve if ALL providers with data agree
    if (conflictRecord.conflictType === CONFLICT_TYPES.ALL_AGREE || conflictRecord.conflictType === CONFLICT_TYPES.SINGLE_SOURCE) {
      selection = applyPolicyPriority(policy, providerValueMap);
    } else {
      warnings.push(`CONSENSUS required but conflict detected for field: ${fieldName}`);
    }
  }

  // No data path
  if (!selection) {
    const confidence     = 0;
    const confLevel      = 'UNCERTAIN';
    const provenanceObj  = createFieldProvenance({
      provenanceId, resolvedField: fieldName, canonicalValue: null,
      selectedProvider: null, supportingProviders: [], conflictingProviders: [],
      resolutionRule: policy.resolutionRule, resolutionPolicyId: policy.policyId,
      confidence: 0, confidenceLevel: confLevel,
      normalizedRecordIds, conflictType: conflictRecord.conflictType,
    });
    const record = createResolutionRecord({
      resolutionRecordId, normalizedRecordIds, resolvedField: fieldName,
      canonicalValue: null, confidence, confidenceLevel: confLevel,
      selectedProvider: null, selectedRule: policy.resolutionRule,
      resolutionPolicyId: policy.policyId, provenanceId, resolutionManifestId: manifestId,
      conflictType: conflictRecord.conflictType,
    });
    const manifest = createResolutionManifest({
      manifestId, resolvedField: fieldName, inputNormalizedRecordIds: normalizedRecordIds,
      policyId: policy.policyId, policyName: policy.policyName,
      resolutionRule: policy.resolutionRule, conflictRecord,
      confidenceCalculation: { selectedProviderRank: -1, conflictType: conflictRecord.conflictType, hasValue: false, confidence: 0 },
      outputResolutionRecordId: resolutionRecordId, outputProvenanceId: provenanceId,
      processingTime: Date.now() - startTime, warnings, errors,
    });
    return { success: true, resolutionRecord: record, manifest, provenance: provenanceObj };
  }

  // Confidence
  const { selectedProvider, canonicalValue, selectedRank } = selection;
  const confidenceCalc = {
    selectedProviderRank: selectedRank,
    conflictType: conflictRecord.conflictType,
    hasValue: true,
  };
  const confidence  = computeConfidence(confidenceCalc);
  const confLevel   = confidenceLevel(confidence);

  // Classify supporting / conflicting providers
  const { supporting, conflicting } = classifyProviders(providerValueMap, selectedProvider, canonicalValue);

  const provenanceObj = createFieldProvenance({
    provenanceId, resolvedField: fieldName, canonicalValue,
    selectedProvider, supportingProviders: supporting, conflictingProviders: conflicting,
    resolutionRule: policy.resolutionRule, resolutionPolicyId: policy.policyId,
    confidence, confidenceLevel: confLevel,
    normalizedRecordIds, conflictType: conflictRecord.conflictType,
  });

  const record = createResolutionRecord({
    resolutionRecordId, normalizedRecordIds, resolvedField: fieldName,
    canonicalValue, confidence, confidenceLevel: confLevel,
    selectedProvider, selectedRule: policy.resolutionRule,
    resolutionPolicyId: policy.policyId, provenanceId, resolutionManifestId: manifestId,
    conflictType: conflictRecord.conflictType,
  });

  const manifest = createResolutionManifest({
    manifestId, resolvedField: fieldName, inputNormalizedRecordIds: normalizedRecordIds,
    policyId: policy.policyId, policyName: policy.policyName,
    resolutionRule: policy.resolutionRule, conflictRecord,
    confidenceCalculation: { ...confidenceCalc, confidence, confidenceLevel: confLevel },
    outputResolutionRecordId: resolutionRecordId, outputProvenanceId: provenanceId,
    processingTime: Date.now() - startTime, warnings, errors,
  });

  return { success: true, resolutionRecord: record, manifest, provenance: provenanceObj };
}

export function resolveManyFields(normalizedRecords, fieldNames, policyRegistry, options = {}) {
  const results = [];
  for (const fieldName of fieldNames) {
    try {
      const result = resolveField(normalizedRecords, fieldName, policyRegistry, options);
      results.push({ fieldName, ...result });
    } catch (err) {
      results.push({
        fieldName,
        success: false,
        resolutionRecord: null,
        manifest: createResolutionManifest({
          resolvedField: fieldName,
          inputNormalizedRecordIds: normalizedRecords.map(r => r?.normalizedRecordId).filter(Boolean),
          errors: [{ code: RESOLUTION_ERROR_CODES.PIPELINE_FAILURE, message: err?.message ?? String(err) }],
          processingTime: 0,
        }),
        error: RESOLUTION_ERROR_CODES.PIPELINE_FAILURE,
      });
    }
  }
  return Object.freeze({ results: Object.freeze(results) });
}

export function resolveAllFields(normalizedRecords, policyRegistry, options = {}) {
  // Collect all unique field names from all records' evidence sub-objects
  const fieldSet = new Set();
  for (const record of normalizedRecords) {
    const evidence = extractEvidence(record);
    if (evidence) Object.keys(evidence).forEach(k => fieldSet.add(k));
  }
  return resolveManyFields(normalizedRecords, Array.from(fieldSet), policyRegistry, options);
}
