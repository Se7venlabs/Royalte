// Canonical Intelligence Platform(tm) -- Evidence Contract Registry
//
// THE ONLY mechanism for loading Evidence Contracts and validating evidence.
// No connector or downstream module may import contracts directly.
//
// Public API:
//
//   getContract(contractId)
//     Returns the Evidence Contract for a given contractId.
//     Returns undefined if not found.
//
//   listContracts()
//     Returns a frozen array of all registered Evidence Contracts.
//
//   validateEvidence(evidence)
//     Validates an evidence object against the contract it declares.
//     Returns { valid, errors, warnings }.
//
//   validateEnvelope(envelope)
//     Validates an Evidence Envelope structure.
//     Returns { valid, errors, warnings }.
//
//   createEnvelope(params)
//     Factory for Evidence Envelopes. The sole way to construct one.
//
//   EVIDENCE_REGISTRY
//     .version       -- EVIDENCE_VERSION metadata
//     .contracts     -- frozen array of all registered contracts
//     .providers     -- frozen array of all registered providers
//     .categories    -- array of all evidence category values
//
// Startup contract:
//   If the contract registry fails internal consistency checks, this module
//   throws at import time. A broken contract registry is a broken platform.

import { EVIDENCE_VERSION }          from './version.js';
import { PROVIDERS }                 from './providers.js';
import { VALID_EVIDENCE_CATEGORIES } from './types.js';
import { validateEvidence as _validateEvidence } from './validate.js';
import {
  createEnvelope     as _createEnvelope,
  validateEnvelope   as _validateEnvelope,
} from './envelope.js';

import { ARTIST_IDENTITY_CONTRACT }   from './contracts/identity.js';
import { MUSIC_RIGHTS_CONTRACT }      from './contracts/rights.js';
import { CATALOG_CONTRACT }           from './contracts/catalog.js';
import { DISTRIBUTION_CONTRACT }      from './contracts/distribution.js';
import { MONITORING_CONTRACT }        from './contracts/monitoring.js';
import { SYSTEM_OPERATIONS_CONTRACT } from './contracts/operations.js';

// All registered contracts in canonical category order.
const ALL_CONTRACTS = Object.freeze([
  ARTIST_IDENTITY_CONTRACT,
  MUSIC_RIGHTS_CONTRACT,
  CATALOG_CONTRACT,
  DISTRIBUTION_CONTRACT,
  MONITORING_CONTRACT,
  SYSTEM_OPERATIONS_CONTRACT,
]);

// Internal consistency check at load time -- broken registry = startup failure.
(function assertRegistryIntegrity() {
  const seenIds = new Set();

  for (const contract of ALL_CONTRACTS) {
    for (const prop of ['contractId', 'displayName', 'category', 'version', 'status', 'evidenceFields']) {
      if (!contract[prop]) {
        throw new Error(
          `[evidence-registry] FATAL: Contract missing required property "${prop}": ${contract.contractId ?? '?'}`
        );
      }
    }

    if (seenIds.has(contract.contractId)) {
      throw new Error(`[evidence-registry] FATAL: Duplicate contractId "${contract.contractId}"`);
    }
    seenIds.add(contract.contractId);

    if (!VALID_EVIDENCE_CATEGORIES.has(contract.category)) {
      throw new Error(
        `[evidence-registry] FATAL: Contract "${contract.contractId}" has unknown category "${contract.category}"`
      );
    }

    for (const field of contract.evidenceFields) {
      for (const prop of ['id', 'dataType', 'required', 'description']) {
        if (field[prop] === undefined || field[prop] === null) {
          throw new Error(
            `[evidence-registry] FATAL: Field "${field.id ?? '?'}" in "${contract.contractId}" ` +
            `missing required property "${prop}"`
          );
        }
      }
    }
  }
})();

// Build lookup map keyed by contractId.
const contractMap = new Map(ALL_CONTRACTS.map((c) => [c.contractId, c]));

// Public accessor functions.

export function getContract(contractId) {
  return contractMap.get(contractId);
}

export function listContracts() {
  return ALL_CONTRACTS;
}

export function validateEvidence(evidence) {
  return _validateEvidence(evidence, contractMap);
}

export function validateEnvelope(envelope) {
  return _validateEnvelope(envelope);
}

export function createEnvelope(params) {
  return _createEnvelope(params);
}

// Canonical read-only registry interface.
export const EVIDENCE_REGISTRY = Object.freeze({
  version:    EVIDENCE_VERSION,
  contracts:  ALL_CONTRACTS,
  providers:  Object.freeze([...PROVIDERS]),
  categories: Object.freeze([...VALID_EVIDENCE_CATEGORIES]),
});
