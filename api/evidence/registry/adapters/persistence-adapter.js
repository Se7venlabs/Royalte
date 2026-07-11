// Canonical Intelligence Platform(tm) -- Evidence Registry Persistence Adapter
//
// Interface stub for a future production persistence adapter.
// Replace each method body with the appropriate database operation when
// a production storage layer is selected.
//
// This adapter satisfies the repository interface contract (repository.js).
// All methods throw UnsupportedOperationError until implemented.
// Do not use this adapter in production without completing the implementation.

class UnsupportedOperationError extends Error {
  constructor(method) {
    super(`[persistence-adapter] "${method}" is not yet implemented. ` +
      'Replace this stub with a production database operation.');
    this.name = 'UnsupportedOperationError';
    this.method = method;
  }
}

export function createPersistenceAdapter(config = {}) {
  // config is reserved for connection strings, pool settings, etc.
  void config;

  return {
    insert(_record) {
      throw new UnsupportedOperationError('insert');
    },

    findById(_evidenceEnvelopeId) {
      throw new UnsupportedOperationError('findById');
    },

    findBySourceEnvelopeId(_sourceEnvelopeId) {
      throw new UnsupportedOperationError('findBySourceEnvelopeId');
    },

    findMany(_query) {
      throw new UnsupportedOperationError('findMany');
    },

    exists(_evidenceEnvelopeId) {
      throw new UnsupportedOperationError('exists');
    },

    sourceEnvelopeIdExists(_sourceEnvelopeId) {
      throw new UnsupportedOperationError('sourceEnvelopeIdExists');
    },

    fingerprintExists(_fingerprint) {
      throw new UnsupportedOperationError('fingerprintExists');
    },

    getActiveFingerprints() {
      throw new UnsupportedOperationError('getActiveFingerprints');
    },

    getActivePartialFingerprints() {
      throw new UnsupportedOperationError('getActivePartialFingerprints');
    },

    quarantine(_record, _validationResult) {
      throw new UnsupportedOperationError('quarantine');
    },

    findQuarantined(_evidenceEnvelopeId) {
      throw new UnsupportedOperationError('findQuarantined');
    },

    updateLineage(_evidenceEnvelopeId, _lineageUpdates) {
      throw new UnsupportedOperationError('updateLineage');
    },

    appendEventLog(_evidenceEnvelopeId, _event) {
      throw new UnsupportedOperationError('appendEventLog');
    },
  };
}
