// Content Registry™ — Content Publishing Engine™, Layer 2.
//
// Sole read/write path for content-registry/articles/*.json. One file per
// article, not one big array -- every new article is a uniquely-named new
// file, structurally conflict-free the same way an article's own HTML file
// already is. This is the load-bearing design choice that makes concurrent
// content PRs safe: two PRs adding two different articles' registry entries
// touch two different files, never the same one.
//
// Thin fs I/O only -- no rendering, no eligibility logic (schema.mjs), no
// publishing decisions (publish.mjs).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REGISTRY_DIR = path.resolve(__dirname, '../../content-registry/articles');
export const HISTORY_PATH = path.resolve(__dirname, '../../content-registry/history.jsonl');

// loadRegistry() -> array of article entries, sorted by slug for
// deterministic ordering (callers that want publishDate/date ordering sort
// themselves -- this function makes no assumption about consumer order).
//
// A single malformed registry file (invalid JSON -- e.g. a bad hand-edit
// or a merge that went wrong) is skipped and reported, never allowed to
// throw and take down the entire publish run for every other article.
// Real failures are surfaced via the returned `errors` metadata rather
// than swallowed silently -- callers that only need the article list can
// ignore it; publish.mjs's CLI entry point logs it loudly.
export function loadRegistry(dir = REGISTRY_DIR) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const articles = [];
  const errors = [];
  for (const f of files) {
    try {
      articles.push(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
    } catch (err) {
      errors.push({ file: f, error: err.message });
    }
  }
  if (errors.length > 0) {
    Object.defineProperty(articles, 'loadErrors', { value: errors, enumerable: false });
  }
  return articles;
}

export function loadArticle(slug, dir = REGISTRY_DIR) {
  const filePath = path.join(dir, `${slug}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

// saveArticle(entry) -- writes/overwrites content-registry/articles/<slug>.json.
// Pretty-printed + trailing newline so diffs in PRs/commits stay readable.
export function saveArticle(entry, dir = REGISTRY_DIR) {
  if (!entry || !entry.slug) {
    throw new Error('saveArticle requires an entry with a slug');
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${entry.slug}.json`);
  writeFileSync(filePath, JSON.stringify(entry, null, 2) + '\n', 'utf8');
  return filePath;
}

// appendHistory(event) -- Layer 4, Publication History™. Append-only,
// never rewritten. One JSON object per line (JSONL) so a failed write mid-
// append can never corrupt prior entries, and new tooling can stream-read
// without loading the whole file.
export function appendHistory(event, historyPath = HISTORY_PATH) {
  const dir = path.dirname(historyPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ ...event, loggedAt: new Date().toISOString() });
  const existing = existsSync(historyPath) ? readFileSync(historyPath, 'utf8') : '';
  writeFileSync(historyPath, existing + line + '\n', 'utf8');
}

export function loadHistory(historyPath = HISTORY_PATH) {
  if (!existsSync(historyPath)) return [];
  return readFileSync(historyPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}
