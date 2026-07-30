// Executive Intelligence Bus™ — ATHENA™ Phase 3C
//
// A small, real, in-process publish/subscribe primitive. Executive Memory™
// is its first production publisher (api/_lib/executive-memory-store.js
// publishes executive_memory.created/.confirmed/.corrected/.superseded/
// .expired after every successful write).
//
// Honest scoping: Vercel serverless functions are stateless per invocation
// -- there is no persistent cross-request bus today, and building one would
// require real infrastructure (a queue, webhooks, or a cron-polling worker
// like api/cron/rescan.js) that hasn't been decided. This module is
// deliberately scoped to what that constraint actually allows: synchronous,
// in-process pub/sub within a single request lifecycle, useful for
// decoupling "this was written" from "who reacts to it" inside the same
// invocation (e.g. a future consumer avoiding a re-read of data it was just
// handed). It is the correct, real extension point for genuine async
// delivery later -- not a simulation of infrastructure that doesn't exist.
//
// Never throws: a misbehaving subscriber must never break the publisher's
// own work (the write already succeeded before publish() is called).

const subscribers = new Map(); // eventType -> Set<handler>

export function subscribe(eventType, handler) {
  if (typeof eventType !== 'string' || !eventType || typeof handler !== 'function') return () => {};
  if (!subscribers.has(eventType)) subscribers.set(eventType, new Set());
  subscribers.get(eventType).add(handler);
  return () => unsubscribe(eventType, handler);
}

export function unsubscribe(eventType, handler) {
  const set = subscribers.get(eventType);
  if (set) set.delete(handler);
}

// publish(eventType, payload) -- synchronous, best-effort. Every handler
// runs; one handler throwing never prevents the others from running or
// propagates back to the publisher.
export function publish(eventType, payload) {
  const set = subscribers.get(eventType);
  if (!set || set.size === 0) return { delivered: 0 };
  let delivered = 0;
  for (const handler of set) {
    try {
      handler(payload, eventType);
      delivered++;
    } catch (err) {
      console.error(`[executive-intelligence-bus] subscriber threw for "${eventType}":`, err?.message || err);
    }
  }
  return { delivered };
}

// Test/diagnostic only -- clears every registered subscriber. Never called
// from production code paths.
export function _resetForTests() {
  subscribers.clear();
}
