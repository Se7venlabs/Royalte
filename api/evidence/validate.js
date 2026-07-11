// Canonical Intelligence Platform(tm) -- Evidence Validation
//
// Pure validation function. Called by the Contract Registry when evidence
// is submitted by a connector.
//
// Validation rules:
//   1.  All required base metadata fields present
//   2.  contractId matches a known contract
//   3.  provider matches a known provider in the Provider Registry
//   4.  evidenceStatus is a valid EVIDENCE_STATUS value
//   5.  confidence is a valid EVIDENCE_CONFIDENCE value
//   6.  retrievedAt is a non-empty string (ISO 8601 date)
//   7.  scanId is a non-empty string
//   8.  artistId is a non-empty string
//   9.  contractVersion is a non-empty string
//  10.  evidence payload is present (object, not null)
//  11.  Required evidence fields for the matched contract are present
//  12.  Evidence field data types match contract definitions
//  13.  Provider has the capability to contribute to this contract's category
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
// Never throws; pure function over the passed-in evidence and contract map.
//
// contractMap is Map<contractId -> contract> -- injected by the Contract Registry
// to avoid circular imports.

import {
  VALID_EVIDENCE_STATUSES,
  VALID_EVIDENCE_CONFIDENCES,
} from './types.js';
import { VALID_PROVIDER_IDS, PROVIDER_BY_ID } from './providers.js';
import { REQUIRED_BASE_FIELD_IDS }            from './contracts/base.js';

// Runtime type checker for evidence field values.
function matchesDataType(value, dataType) {
  if (value === null || value === undefined) return true;  // null handled by required check
  switch (dataType) {
    case 'string':  return typeof value === 'string';
    case 'number':  return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'url':     return typeof value === 'string';   // URL is a string at evidence layer
    case 'date':    return typeof value === 'string';   // date is an ISO string at evidence layer
    case 'array':   return Array.isArray(value);
    case 'object':  return typeof value === 'object' && !Array.isArray(value);
    default:        return false;
  }
}

export function validateEvidence(evidence, contractMap) {
  const errors   = [];
  const warnings = [];

  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, errors: ['Evidence must be a non-null object'], warnings };
  }

  const eid = evidence.contractId ?? '(unknown)';

  // Rule 1 -- all required base fields present.
  // null is a valid declared value; only undefined (key absent or explicitly unset) fails.
  for (const fieldId of REQUIRED_BASE_FIELD_IDS) {
    if (evidence[fieldId] === undefined) {
      errors.push(`Evidence "${eid}": missing required base field "${fieldId}"`);
    }
  }

  // Rule 2 -- contractId matches a known contract
  if (evidence.contractId && !contractMap.has(evidence.contractId)) {
    errors.push(`Evidence "${eid}": unknown contractId "${evidence.contractId}"`);
  }

  // Rule 3 -- provider matches a known provider
  if (evidence.provider && !VALID_PROVIDER_IDS.has(evidence.provider)) {
    errors.push(`Evidence "${eid}": unknown provider "${evidence.provider}"`);
  }

  // Rule 4 -- evidenceStatus is valid
  if (evidence.evidenceStatus && !VALID_EVIDENCE_STATUSES.has(evidence.evidenceStatus)) {
    errors.push(`Evidence "${eid}": unknown evidenceStatus "${evidence.evidenceStatus}"`);
  }

  // Rule 5 -- confidence is valid
  if (evidence.confidence && !VALID_EVIDENCE_CONFIDENCES.has(evidence.confidence)) {
    errors.push(`Evidence "${eid}": unknown confidence "${evidence.confidence}"`);
  }

  // Rule 6 -- retrievedAt is a non-empty string
  if (evidence.retrievedAt !== undefined && evidence.retrievedAt !== null) {
    if (typeof evidence.retrievedAt !== 'string' || evidence.retrievedAt.trim() === '') {
      errors.push(`Evidence "${eid}": retrievedAt must be a non-empty ISO 8601 date string`);
    }
  }

  // Rule 7 -- scanId is a non-empty string
  if (evidence.scanId !== undefined && evidence.scanId !== null) {
    if (typeof evidence.scanId !== 'string' || evidence.scanId.trim() === '') {
      errors.push(`Evidence "${eid}": scanId must be a non-empty string`);
    }
  }

  // Rule 8 -- artistId is a non-empty string
  if (evidence.artistId !== undefined && evidence.artistId !== null) {
    if (typeof evidence.artistId !== 'string' || evidence.artistId.trim() === '') {
      errors.push(`Evidence "${eid}": artistId must be a non-empty string`);
    }
  }

  // Rule 9 -- contractVersion is a non-empty string
  if (evidence.contractVersion !== undefined && evidence.contractVersion !== null) {
    if (typeof evidence.contractVersion !== 'string' || evidence.contractVersion.trim() === '') {
      errors.push(`Evidence "${eid}": contractVersion must be a non-empty string`);
    }
  }

  // Rule 10 -- evidence payload is present
  if (evidence.evidence === undefined || evidence.evidence === null) {
    errors.push(`Evidence "${eid}": missing required "evidence" payload object`);
  } else if (typeof evidence.evidence !== 'object' || Array.isArray(evidence.evidence)) {
    errors.push(`Evidence "${eid}": "evidence" must be a non-null, non-array object`);
  }

  // Rules 11-13 require a known contract -- only proceed if it resolves
  const contract = evidence.contractId ? contractMap.get(evidence.contractId) : undefined;

  // Statuses where no evidence data is expected; waive required evidence field checks.
  const statusHasNoData = new Set(['NOT_FOUND', 'ERROR', 'UNVERIFIED', 'CONFLICT', 'UNKNOWN']);
  const evidenceIsAbsent = evidence.evidenceStatus && statusHasNoData.has(evidence.evidenceStatus);

  if (contract && evidence.evidence && typeof evidence.evidence === 'object') {
    const payload = evidence.evidence;

    for (const field of contract.evidenceFields) {
      const value = payload[field.id];

      // Rule 11 -- required evidence fields must be present when status implies data was found.
      if (field.required && !evidenceIsAbsent && (value === undefined || value === null)) {
        errors.push(
          `Evidence "${eid}": missing required evidence field "${field.id}" (${contract.contractId})`
        );
        continue;
      }

      // Rule 12 -- data type must match if value is present
      if (value !== undefined && value !== null) {
        if (!matchesDataType(value, field.dataType)) {
          errors.push(
            `Evidence "${eid}": field "${field.id}" expected ${field.dataType}, ` +
            `got ${Array.isArray(value) ? 'array' : typeof value}`
          );
        }
      }
    }

    // Rule 13 -- provider must have capability for this contract's category
    const provider = evidence.provider ? PROVIDER_BY_ID.get(evidence.provider) : undefined;
    if (provider && !provider.capabilities.includes(contract.category)) {
      warnings.push(
        `Evidence "${eid}": provider "${evidence.provider}" does not list "${contract.category}" ` +
        `as a capability -- verify this is intentional`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
