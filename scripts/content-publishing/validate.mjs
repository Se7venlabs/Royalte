#!/usr/bin/env node
// Content Publishing Engine™ — Layer 3 support, Workflow A (Content
// Validation). Runs on every PR touching public/blog/**, public/education/**,
// or content-registry/**. Checks the registry is internally consistent and
// every referenced file actually exists -- it never merges or publishes
// anything, it only fails the PR check if something is wrong.
//
// Replaces tests/blog-index-sync-test.mjs's purpose (detecting drift
// between hand-authored blog.html cards and blog-posts.js): that drift is
// now structurally impossible once blog.html is generated, not
// hand-authored, so this validates the registry itself instead.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './registry.mjs';
import { validateArticleShape, isValidSlug } from './schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// validateRegistry(articles) -> string[] of problems, empty if valid.
// Pure except for the two existsSync file-reference checks, which are the
// entire point of this function (confirming referenced files are real).
export function validateRegistry(articles, repoRoot = REPO_ROOT) {
  const problems = [];
  const seenSlugs = new Set();

  for (const article of articles) {
    const shapeProblems = validateArticleShape(article);
    for (const p of shapeProblems) {
      problems.push(`[${article?.slug || 'unknown'}] ${p}`);
    }

    if (article?.slug) {
      if (seenSlugs.has(article.slug)) {
        problems.push(`[${article.slug}] duplicate slug across registry`);
      }
      seenSlugs.add(article.slug);
    }

    // A 'scheduled'/'draft' article's content legitimately may not be
    // merged yet -- content PRs are reviewed and merged independently of
    // the registry entry (this plan's Content Merge Gate decision).
    // publish.mjs's own runtime check is what actually enforces "must
    // exist by the time it's due," with retry -- that's the correct place
    // for this to be a hard requirement, not a PR-time lint. A *published*
    // article, by contrast, must always have real content -- there's no
    // legitimate reason for that file to be missing.
    if (article?.publishStatus === 'published') {
      if (article.contentPath && !existsSync(path.join(repoRoot, article.contentPath))) {
        problems.push(`[${article.slug}] published but contentPath does not exist: ${article.contentPath}`);
      }
      if (article.heroImagePath && !existsSync(path.join(repoRoot, article.heroImagePath))) {
        problems.push(`[${article.slug}] published but heroImagePath does not exist: ${article.heroImagePath}`);
      }
    }
  }

  return problems;
}

export { isValidSlug };

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const articles = loadRegistry();
  const problems = validateRegistry(articles);

  if (problems.length === 0) {
    console.log(`✅ Content registry valid — ${articles.length} article(s) checked.`);
    process.exit(0);
  }

  console.error(`❌ Content registry validation failed — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
