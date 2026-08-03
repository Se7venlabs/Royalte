// ─────────────────────────────────────────────────────────────────────
//  Content Publishing Engine™ — Registry schema
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No I/O. No mutation. No fs, no network.
//
//  A registry entry (one JSON file per article, content-registry/articles/
//  <slug>.json) is the single source of truth for an article's publishing
//  state. It never contains article body content -- that stays in Layer 1
//  (public/blog/*.html, public/education/*.html), reviewed and merged by a
//  human like any other content PR. This registry only tracks WHETHER and
//  WHEN that already-merged (or about-to-be-merged) content goes live.
//
//  approvalStatus and publishStatus are deliberately separate fields:
//  approvalStatus is a one-time Board sign-off; publishStatus is the
//  lifecycle state machine the Autonomous Publishing Engine drives.
//  Eligible for publishing: approvalStatus === 'approved' &&
//  publishStatus === 'scheduled' && publishDate <= today.
// ─────────────────────────────────────────────────────────────────────

export const REGISTRY_SCHEMA_VERSION = '1.0';

export const CONTENT_TYPES = Object.freeze(['blog', 'education']);

export const APPROVAL_STATUSES = Object.freeze(['pending', 'approved']);

export const PUBLISH_STATUSES = Object.freeze(['draft', 'scheduled', 'published', 'archived']);

// Lowercase, hyphen-separated, ASCII-only -- matches the slug convention
// already documented in public/blog/README.md and public/education/README.md
// (on its content branch).
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length > 0 && SLUG_PATTERN.test(slug);
}

const REQUIRED_FIELDS = Object.freeze([
  'slug', 'title', 'type', 'category', 'excerpt', 'author', 'readTime',
  'contentPath', 'approvalStatus', 'publishStatus', 'articleVersion',
  'createdAt', 'lastModified',
]);

// validateArticleShape(entry) -> string[] of problems, empty if valid.
// Pure structural validation only -- does not check the filesystem (that's
// validate.mjs's job, which has I/O).
export function validateArticleShape(entry) {
  const problems = [];
  if (!entry || typeof entry !== 'object') {
    return ['entry must be an object'];
  }
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      problems.push(`missing required field: ${field}`);
    }
  }
  if (entry.slug != null && !isValidSlug(entry.slug)) {
    problems.push(`invalid slug format: "${entry.slug}" (must be lowercase, hyphen-separated, ASCII-only)`);
  }
  if (entry.type != null && !CONTENT_TYPES.includes(entry.type)) {
    problems.push(`invalid type: "${entry.type}" (must be one of ${CONTENT_TYPES.join(', ')})`);
  }
  if (entry.approvalStatus != null && !APPROVAL_STATUSES.includes(entry.approvalStatus)) {
    problems.push(`invalid approvalStatus: "${entry.approvalStatus}" (must be one of ${APPROVAL_STATUSES.join(', ')})`);
  }
  if (entry.publishStatus != null && !PUBLISH_STATUSES.includes(entry.publishStatus)) {
    problems.push(`invalid publishStatus: "${entry.publishStatus}" (must be one of ${PUBLISH_STATUSES.join(', ')})`);
  }
  if (entry.publishStatus === 'scheduled' && !entry.publishDate) {
    problems.push('publishStatus is "scheduled" but publishDate is missing');
  }
  return problems;
}

// isEligibleForPublishing(entry, today) -> boolean. Pure, deterministic --
// `today` is always passed in (never reads the clock itself), so this
// function is trivially testable and never has hidden time-of-day drift.
export function isEligibleForPublishing(entry, today) {
  if (!entry) return false;
  if (entry.approvalStatus !== 'approved') return false;
  if (entry.publishStatus !== 'scheduled') return false;
  if (!entry.publishDate) return false;
  return entry.publishDate <= today;
}
