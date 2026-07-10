// Royaltē Certification Artist Library — Loader
//
// Mirrors the interface of tests/fixtures/fixture-loader.mjs.
// Returns deep-cloned objects; never throws; never caches.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath }             from 'node:url';
import { dirname, join }             from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT       = '.json';

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function loadArtist(name) {
  if (typeof name !== 'string' || name === '') return null;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  const path = join(__dirname, `${name}${EXT}`);
  try {
    const raw    = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return deepClone(parsed);
  } catch {
    return null;
  }
}

export function listArtists() {
  try {
    return readdirSync(__dirname)
      .filter(e => e.endsWith(EXT))
      .map(e => e.slice(0, -EXT.length))
      .sort();
  } catch {
    return [];
  }
}
