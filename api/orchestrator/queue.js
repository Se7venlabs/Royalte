// Canonical Intelligence Platform(tm) -- Scan Queue(tm)
// Manages all scan states indexed by scanId.

import { SCAN_STATUSES } from './types.js';
import { markCancelRequested } from './state.js';

export function createScanQueue() {
  const _scans = new Map();   // scanId → ScanState (always latest frozen state)

  function enqueue(scanState) {
    if (_scans.has(scanState.scanId)) {
      throw new Error(`[scan-queue] Scan ${scanState.scanId} is already queued`);
    }
    _scans.set(scanState.scanId, scanState);
    return scanState;
  }

  function update(scanId, newState) {
    if (!_scans.has(scanId)) {
      throw new Error(`[scan-queue] Scan ${scanId} not found in queue`);
    }
    _scans.set(scanId, newState);
    return newState;
  }

  function get(scanId) {
    return _scans.get(scanId) ?? null;
  }

  function cancel(scanId) {
    const state = _scans.get(scanId);
    if (!state) throw new Error(`[scan-queue] Scan ${scanId} not found`);
    const cancelled = markCancelRequested(state);
    _scans.set(scanId, cancelled);
    return cancelled;
  }

  function list() {
    return Array.from(_scans.values());
  }

  function listByStatus(status) {
    return list().filter(s => s.status === status);
  }

  function pending()   { return listByStatus(SCAN_STATUSES.PENDING); }
  function running()   { return listByStatus(SCAN_STATUSES.RUNNING); }
  function completed() { return listByStatus(SCAN_STATUSES.COMPLETED); }
  function failed()    { return listByStatus(SCAN_STATUSES.FAILED); }

  function size()      { return _scans.size; }
  function has(scanId) { return _scans.has(scanId); }

  return Object.freeze({ enqueue, update, get, cancel, list, listByStatus, pending, running, completed, failed, size, has });
}
