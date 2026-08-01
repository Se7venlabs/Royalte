// Playbook Registry™ — Phase 4A, Executive Actions™
//
// Discovery and registration only — the Registry never contains Playbook
// content (Board Final Refinement #1). A registration record is
// deliberately lightweight: {playbookId, playbookVersion, definitionSchema,
// load}. `load()` is the only way to reach the actual content; the Registry
// itself never holds steps, summaries, or any other definition field.
//
// Adding a future playbook is: create one new file in
// api/playbooks/definitions/, call registerPlaybook() on import, add one
// import line to definitions/index.js. Zero changes to this file, ever —
// this is the whole point of separating discovery from content.

const registrations = new Map(); // playbookId -> {playbookId, playbookVersion, definitionSchema, load}

export function registerPlaybook({ playbookId, playbookVersion, definitionSchema, load }) {
  if (typeof playbookId !== 'string' || !playbookId) {
    throw new Error('registerPlaybook requires a string playbookId');
  }
  if (typeof playbookVersion !== 'string' || !playbookVersion) {
    throw new Error(`registerPlaybook(${playbookId}) requires a string playbookVersion`);
  }
  if (typeof definitionSchema !== 'number') {
    throw new Error(`registerPlaybook(${playbookId}) requires a numeric definitionSchema`);
  }
  if (typeof load !== 'function') {
    throw new Error(`registerPlaybook(${playbookId}) requires a load() function`);
  }
  registrations.set(playbookId, {
    playbookId,
    currentVersion: playbookVersion,
    definitionSchema,
    load,
    registeredAt: new Date().toISOString(),
  });
}

// getPlaybook(id) -> the full Definition object (via the registration's
// load() accessor), or null if unregistered. This is the one place a
// registration record and its content meet -- callers never need to know
// the Registry stored them separately.
export function getPlaybook(playbookId) {
  const reg = registrations.get(playbookId);
  return reg ? reg.load() : null;
}

// getAllPlaybooks() -> every registered Definition's full content.
export function getAllPlaybooks() {
  return [...registrations.values()].map(reg => reg.load());
}

// getRegistrations() -> the lightweight registration records only (no
// content) -- for callers that only need to know what's registered, not
// what it contains (e.g. a future admin/listing view).
export function getRegistrations() {
  return [...registrations.values()].map(({ playbookId, currentVersion, definitionSchema, registeredAt }) =>
    ({ playbookId, currentVersion, definitionSchema, registeredAt }));
}

// Test/diagnostic only.
export function _resetForTests() {
  registrations.clear();
}
