// ----------------------------------------------------
//
// Royaltē Golden Fixture Library™
//
// These fixtures define canonical
// reference states for the Royaltē
// Intelligence Platform.
//
// Future architecture must remain
// compatible with these fixtures.
//
// Fixtures are immutable.
//
// Version, never overwrite.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Public API (only):
//    loadFixture(name)  → deep-cloned fixture object | null
//    listFixtures()     → sorted string[] of fixture names
//
//  Loader behaviour:
//    - never throws (every error path returns null or [])
//    - never caches (each call reads fresh from disk; eliminates
//      the possibility of cross-test contamination)
//    - returns a deep clone, never the raw parsed object — so a
//      caller that mutates the returned value cannot affect a
//      subsequent load
//    - `listFixtures()` returns names without the `.json` extension,
//      sorted lexically so the order is deterministic across
//      filesystems

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR  = __dirname;
const JSON_EXT      = '.json';

function deepClone(value) {
  if (value === null || value === undefined) return value;
  // JSON-safe round-trip — fixtures are plain JSON data.
  return JSON.parse(JSON.stringify(value));
}

/**
 * Load a single fixture by name (without `.json` extension).
 * Returns a deep clone of the parsed JSON, or null if the fixture
 * does not exist, the name is invalid, or the file cannot be parsed.
 * Never throws.
 */
export function loadFixture(name) {
  if (typeof name !== 'string' || name === '') return null;
  // Reject path-traversal attempts and any non-leaf name.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;

  const path = join(FIXTURES_DIR, `${name}${JSON_EXT}`);
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch { return null; }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return null; }

  return deepClone(parsed);
}

/**
 * List every available fixture in this directory. Returns the names
 * without the `.json` extension, sorted lexically for determinism.
 * Never throws.
 */
export function listFixtures() {
  let entries;
  try { entries = readdirSync(FIXTURES_DIR); }
  catch { return []; }
  return entries
    .filter((entry) => entry.endsWith(JSON_EXT))
    .map((entry) => entry.slice(0, -JSON_EXT.length))
    .sort();
}
