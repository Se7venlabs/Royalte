// Canonical Intelligence Platform(tm) -- Evidence Registry Read Service
//
// Read-only public interface for Evidence Registry retrieval.
// No interpretation, normalization, or resolution logic lives here.
// All functions return raw stored records or null/empty.
//
// Public operations:
//   getEvidenceById(evidenceEnvelopeId, adapter)
//   getEvidenceByScan(scanId, adapter)
//   getEvidenceByArtist(artistId, adapter)
//   getEvidenceByProvider(providerId, adapter)
//   getEvidenceByContract(contractId, adapter)
//   getEvidenceByCategory(category, adapter)
//   getEvidenceByCorrelationId(correlationId, adapter)
//   listEvidence(query, adapter)

// Retrieve a single record by its permanent registry identity.
// Returns null if not found or if the record is quarantined/rejected.
export function getEvidenceById(evidenceEnvelopeId, adapter) {
  if (!evidenceEnvelopeId) return null;
  return adapter.findById(evidenceEnvelopeId) ?? null;
}

// Retrieve all active records for a scan.
export function getEvidenceByScan(scanId, adapter) {
  if (!scanId) return [];
  return adapter.findMany({ scanId });
}

// Retrieve all active records for an artist.
export function getEvidenceByArtist(artistId, adapter) {
  if (!artistId) return [];
  return adapter.findMany({ artistId });
}

// Retrieve all active records from a provider.
export function getEvidenceByProvider(providerId, adapter) {
  if (!providerId) return [];
  return adapter.findMany({ providerId });
}

// Retrieve all active records for a contract.
export function getEvidenceByContract(contractId, adapter) {
  if (!contractId) return [];
  return adapter.findMany({ contractId });
}

// Retrieve all active records for an evidence category.
export function getEvidenceByCategory(category, adapter) {
  if (!category) return [];
  return adapter.findMany({ category });
}

// Retrieve all active records sharing a correlation ID.
export function getEvidenceByCorrelationId(correlationId, adapter) {
  if (!correlationId) return [];
  return adapter.findMany({ correlationId });
}

// Retrieve active records matching a compound query.
//
// Supported query fields:
//   artistId, scanId, providerId, contractId, category,
//   evidenceStatus, correlationId, fromDate, toDate,
//   connectorVersion, contractVersion
export function listEvidence(query, adapter) {
  return adapter.findMany(query ?? {});
}
