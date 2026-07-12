// Canonical Intelligence Platform(tm) -- Resolution Engine Validation

import {
  POLICY_REQUIRED_FIELDS,
  VALID_RESOLUTION_CATEGORIES,
  VALID_POLICY_STATUSES,
  VALID_RESOLUTION_RULES,
} from './types.js';

export function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object') {
    return [{ field: 'policy', message: 'Policy must be a non-null object' }];
  }
  for (const field of POLICY_REQUIRED_FIELDS) {
    if (policy[field] === undefined || policy[field] === null) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }
  if (policy.category && !VALID_RESOLUTION_CATEGORIES.has(policy.category)) {
    errors.push({ field: 'category', message: `Invalid category: ${policy.category}` });
  }
  if (policy.status && !VALID_POLICY_STATUSES.has(policy.status)) {
    errors.push({ field: 'status', message: `Invalid status: ${policy.status}` });
  }
  if (policy.resolutionRule && !VALID_RESOLUTION_RULES.has(policy.resolutionRule)) {
    errors.push({ field: 'resolutionRule', message: `Invalid resolutionRule: ${policy.resolutionRule}` });
  }
  if (policy.providerOrder !== undefined && !Array.isArray(policy.providerOrder)) {
    errors.push({ field: 'providerOrder', message: 'providerOrder must be an array' });
  }
  return errors;
}

export function validateResolutionRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return [{ field: 'record', message: 'Resolution record must be a non-null object' }];
  }
  const required = ['resolutionRecordId', 'resolvedField', 'engineVersion', 'createdAt'];
  for (const field of required) {
    if (!record[field]) errors.push({ field, message: `Missing required field: ${field}` });
  }
  if (!Array.isArray(record.normalizedRecordIds)) {
    errors.push({ field: 'normalizedRecordIds', message: 'normalizedRecordIds must be an array' });
  }
  if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
    errors.push({ field: 'confidence', message: 'confidence must be a number between 0 and 1' });
  }
  return errors;
}

export function validateResolutionManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return [{ field: 'manifest', message: 'Resolution manifest must be a non-null object' }];
  }
  const required = ['manifestId', 'engineVersion', 'createdAt'];
  for (const field of required) {
    if (!manifest[field]) errors.push({ field, message: `Missing required field: ${field}` });
  }
  if (!Array.isArray(manifest.inputNormalizedRecordIds)) {
    errors.push({ field: 'inputNormalizedRecordIds', message: 'inputNormalizedRecordIds must be an array' });
  }
  return errors;
}

export function validateNormalizedRecords(records) {
  if (!Array.isArray(records)) return [{ field: 'records', message: 'normalizedRecords must be an array' }];
  if (records.length === 0)   return [{ field: 'records', message: 'normalizedRecords must not be empty' }];
  const errors = [];
  records.forEach((rec, i) => {
    if (!rec || typeof rec !== 'object') {
      errors.push({ field: `records[${i}]`, message: 'Each record must be a non-null object' });
      return;
    }
    if (!rec.normalizedRecordId) {
      errors.push({ field: `records[${i}].normalizedRecordId`, message: 'Missing normalizedRecordId' });
    }
    if (!rec.normalizedEvidence || typeof rec.normalizedEvidence !== 'object') {
      errors.push({ field: `records[${i}].normalizedEvidence`, message: 'Missing or invalid normalizedEvidence' });
    }
  });
  return errors;
}
