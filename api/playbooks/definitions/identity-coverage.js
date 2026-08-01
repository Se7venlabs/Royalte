// Playbook Definition™: Identity Coverage — Phase 4A reference playbook.
//
// Trigger evidence: ctx.identity.coverage / verifiedProviders / totalProviders
// (real, already-computed CIM fields -- the same ones
// api/_lib/canonical-domain-fingerprints.js's extractIdentity() reads).

import { registerPlaybook } from '../registry.js';

const PLAYBOOK_ID = 'identity-coverage';
const ELIGIBLE_BELOW_COVERAGE = 100; // any real, confirmed gap is eligible
const HIGH_CONFIDENCE_BELOW = 50;
const MEDIUM_CONFIDENCE_BELOW = 80;

function coverage(rawInputs) {
  const identity = rawInputs?.identity;
  return (identity && typeof identity.coverage === 'number') ? identity.coverage : null;
}

function isEligible(rawInputs) {
  const c = coverage(rawInputs);
  return c !== null && c < ELIGIBLE_BELOW_COVERAGE;
}

function evidenceConfidence(rawInputs) {
  const c = coverage(rawInputs);
  if (c === null) return 'INSUFFICIENT_DATA';
  if (c < HIGH_CONFIDENCE_BELOW) return 'HIGH';
  if (c < MEDIUM_CONFIDENCE_BELOW) return 'MEDIUM';
  return 'LOW';
}

const DEFINITION = Object.freeze({
  playbookId: PLAYBOOK_ID,
  playbookVersion: '1.0',
  definitionSchema: 1,
  title: 'Improve Identity Coverage',
  executiveSummary: 'Claim and verify your artist profile across major platforms to close gaps in your Identity Coverage™ score.',
  whyItMatters: 'Unclaimed or unverified provider profiles mean Royaltē (and the platforms themselves) cannot confidently confirm you as the rights holder for your catalog — this affects royalty routing, verification badges, and discoverability.',
  metrics: Object.freeze({
    difficulty: 'LOW',
    estimatedMinutes: 20,
    estimatedRevenueImpact: 'LOW',
  }),
  prerequisites: Object.freeze(['Access to the email/phone used for your artist accounts on each platform']),
  requiredDocumentation: Object.freeze([]),
  affectedDomain: 'identity',
  steps: Object.freeze([
    Object.freeze({ stepId: 'IDC-001', stepNumber: 1, title: 'Review your current coverage', instructions: 'Check which providers show as unverified on your Identity Intelligence workspace.', resources: Object.freeze(['/workspaces/identity-intelligence.html']) }),
    Object.freeze({ stepId: 'IDC-002', stepNumber: 2, title: 'Claim your Apple Music for Artists profile', instructions: 'Visit artists.apple.com and claim/verify your artist page.', resources: Object.freeze(['https://artists.apple.com']) }),
    Object.freeze({ stepId: 'IDC-003', stepNumber: 3, title: 'Claim your Spotify for Artists profile', instructions: 'Visit artists.spotify.com and claim/verify your artist page.', resources: Object.freeze(['https://artists.spotify.com']) }),
    Object.freeze({ stepId: 'IDC-004', stepNumber: 4, title: 'Confirm on your next scan', instructions: 'Run a new scan to confirm improved provider coverage.', resources: Object.freeze([]) }),
  ]),
  helpfulResources: Object.freeze([]),
  completionVerification: 'Artist confirms provider profiles were claimed. A future scan independently re-verifies coverage via the same identity providers — this playbook\'s completion is self-report, not automated re-verification.',
  isEligible,
  evidenceConfidence,
});

registerPlaybook({
  playbookId: PLAYBOOK_ID,
  playbookVersion: DEFINITION.playbookVersion,
  definitionSchema: DEFINITION.definitionSchema,
  load: () => DEFINITION,
});
