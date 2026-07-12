// Canonical Intelligence Platform(tm) -- Scan Scheduler(tm)
// Manages concurrency limits and scan slot allocation.

const DEFAULT_MAX_CONCURRENT = 5;

export function createScanScheduler({ maxConcurrentScans } = {}) {
  const _maxConcurrent = (typeof maxConcurrentScans === 'number' && maxConcurrentScans > 0)
    ? maxConcurrentScans
    : DEFAULT_MAX_CONCURRENT;

  const _active = new Set();

  function canStart() {
    return _active.size < _maxConcurrent;
  }

  function markStarted(scanId) {
    if (_active.size >= _maxConcurrent) {
      throw new Error(`[scan-scheduler] Max concurrent scans (${_maxConcurrent}) reached`);
    }
    _active.add(scanId);
  }

  function markCompleted(scanId) {
    _active.delete(scanId);
  }

  function activeCount() {
    return _active.size;
  }

  function maxConcurrent() {
    return _maxConcurrent;
  }

  function isActive(scanId) {
    return _active.has(scanId);
  }

  return Object.freeze({ canStart, markStarted, markCompleted, activeCount, maxConcurrent, isActive });
}
