// Canonical Intelligence Platform(tm) -- Orchestrator Event System(tm)

import { randomUUID } from 'crypto';
import { ORCHESTRATOR_VERSION } from './version.js';

export function createScanEvent({ eventType, scanId, stage, payload, engineVersion } = {}) {
  return Object.freeze({
    eventId:       randomUUID(),
    eventType:     eventType      ?? null,
    scanId:        scanId         ?? null,
    stage:         stage          ?? null,
    payload:       payload        ? Object.freeze({ ...payload }) : null,
    timestamp:     new Date().toISOString(),
    engineVersion: engineVersion  ?? ORCHESTRATOR_VERSION.version,
  });
}

export function createEventEmitter() {
  const _handlers = new Map();   // eventType → Set<handler>
  const _wild     = new Set();   // '*' wildcard handlers

  function on(eventType, handler) {
    if (typeof handler !== 'function') throw new Error('[event-emitter] handler must be a function');
    if (eventType === '*') {
      _wild.add(handler);
      return;
    }
    if (!_handlers.has(eventType)) _handlers.set(eventType, new Set());
    _handlers.get(eventType).add(handler);
  }

  function off(eventType, handler) {
    if (eventType === '*') { _wild.delete(handler); return; }
    _handlers.get(eventType)?.delete(handler);
  }

  function emit(eventType, payload, scanId, stage) {
    const event = createScanEvent({ eventType, scanId, stage, payload });
    const specific = _handlers.get(eventType);
    if (specific) for (const h of specific) { try { h(event); } catch { /* handlers must not throw */ } }
    for (const h of _wild)                  { try { h(event); } catch { /* handlers must not throw */ } }
    return event;
  }

  function listenerCount(eventType) {
    if (eventType === '*') return _wild.size;
    return _handlers.get(eventType)?.size ?? 0;
  }

  function clear() {
    _handlers.clear();
    _wild.clear();
  }

  return Object.freeze({ on, off, emit, listenerCount, clear });
}
