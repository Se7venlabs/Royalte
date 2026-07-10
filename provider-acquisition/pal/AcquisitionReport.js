// AcquisitionReport — Phase 2.3
//
// Output envelope of a single PAL acquisition cycle.
// The Evidence Contract is carried UNCHANGED — the PAL never mutates it.
// This record exists only to add PAL-layer metadata (timing, providerName,
// derived convenience fields). It is not a canonical intelligence object.
//
// Constitutional constraint: no normalization, no interpretation.
// The report answers "did the PAL successfully acquire?" — nothing more.

import { randomUUID } from 'node:crypto';

/**
 * @param {{
 *   providerName:  string,
 *   requestId:     string,
 *   contract:      object,   — the frozen Evidence Contract from the connector
 *   elapsedMs:     number,
 *   acquiredAt?:   string,   — ISO timestamp (defaults to now)
 * }} params
 * @returns {Readonly<AcquisitionReport>}
 */
export function createAcquisitionReport({
  providerName,
  requestId,
  contract,
  elapsedMs,
  acquiredAt = new Date().toISOString(),
} = {}) {
  const missing = [];
  if (!providerName)  missing.push('providerName');
  if (!requestId)     missing.push('requestId');
  if (!contract)      missing.push('contract');
  if (elapsedMs == null) missing.push('elapsedMs');
  if (missing.length > 0) {
    throw new TypeError(`AcquisitionReport: missing required fields: ${missing.join(', ')}`);
  }

  return Object.freeze({
    reportId:     randomUUID(),
    providerName,
    requestId,
    contract,                          // unmodified Evidence Contract
    elapsedMs,
    acquiredAt,
    healthState:  contract.health.state,
    completeness: contract.completeness,
    acquired:     contract.completeness !== 'empty',
  });
}
