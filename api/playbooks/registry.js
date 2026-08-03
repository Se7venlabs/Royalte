// Playbook Registry™ — Phase 4A, Executive Actions™
//
// Discovery and registration only — the Registry never contains Playbook
// content (Board Final Refinement #1). A registration record is
// lightweight metadata for filtering, reporting, analytics, and governance
// (Executive Change Request 2) — never step/summary content. `load()` is
// the only way to reach the actual content.
//
// Adding a future playbook is: create one new file in
// api/playbooks/definitions/, call registerPlaybook() on import, add one
// import line to definitions/index.js. Zero changes to this file, ever —
// this is the whole point of separating discovery from content.

const registrations = new Map(); // playbookId -> registration record

export function registerPlaybook({
  playbookId, playbookVersion, definitionSchema, load,
  domain, owner, status = 'active', introducedInPhase, deprecated = false,
}) {
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
  if (typeof domain !== 'string' || !domain) {
    throw new Error(`registerPlaybook(${playbookId}) requires a string domain`);
  }
  if (typeof owner !== 'string' || !owner) {
    throw new Error(`registerPlaybook(${playbookId}) requires a string owner`);
  }
  if (typeof introducedInPhase !== 'string' || !introducedInPhase) {
    throw new Error(`registerPlaybook(${playbookId}) requires a string introducedInPhase`);
  }
  registrations.set(playbookId, {
    playbookId,
    currentVersion: playbookVersion,
    definitionSchema,
    domain,
    owner,
    status,
    introducedInPhase,
    deprecated: !!deprecated,
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
// Excludes deprecated playbooks by default (a deprecated playbook should
// not be newly recommendable, though existing artist instances referencing
// it remain fully readable via getPlaybook() -- Executive History™ never
// vanishes, per Executive Change Request 10).
export function getAllPlaybooks({ includeDeprecated = false } = {}) {
  return [...registrations.values()]
    .filter(reg => includeDeprecated || !reg.deprecated)
    .map(reg => reg.load());
}

// getRegistrations() -> the lightweight registration records only (no
// content) -- for filtering, reporting, analytics, and governance
// (Executive Change Request 2) without ever touching Playbook content.
export function getRegistrations() {
  return [...registrations.values()].map(({ load, ...meta }) => meta);
}

// Test/diagnostic only.
export function _resetForTests() {
  registrations.clear();
}
