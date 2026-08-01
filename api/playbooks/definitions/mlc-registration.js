// Playbook Definition™: MLC Registration — Phase 4A reference playbook.
//
// Trigger evidence: ctx.publishingIntelligence.registrations.mlcRegistration
// (a real PUBLISHING_STATE value -- api/_lib/publishing-intelligence.js's
// deriveMlcRegistration(), itself sourced from the CIO's MLC PAL evidence,
// api/_lib/mlc-pal-acquisition.js). This is the same field
// api/athena/risk-analysis.js's MLC risk check reads (see that file) --
// eligibility here is never a second, competing derivation.
//
// UNABLE_TO_CONFIRM is deliberately treated as NOT eligible, matching
// publishing-intelligence.js's own stated principle: "we do not know --
// say nothing executive about it." Only a real, confirmed gap
// (ACTION_REQUIRED / NOT_FOUND) makes this playbook eligible.

import { registerPlaybook } from '../registry.js';

const PLAYBOOK_ID = 'mlc-registration';

function mlcState(rawInputs) {
  return rawInputs?.publishingIntelligence?.registrations?.mlcRegistration || null;
}

function isEligible(rawInputs) {
  const state = mlcState(rawInputs);
  return state === 'ACTION_REQUIRED' || state === 'NOT_FOUND';
}

function evidenceConfidence(rawInputs) {
  const state = mlcState(rawInputs);
  if (state === 'NOT_FOUND') return 'HIGH';
  if (state === 'ACTION_REQUIRED') return 'MEDIUM';
  return 'INSUFFICIENT_DATA';
}

const DEFINITION = Object.freeze({
  playbookId: PLAYBOOK_ID,
  playbookVersion: '1.0',
  definitionSchema: 1,
  title: 'Register with The MLC',
  executiveSummary: 'Register your musical works with The Mechanical Licensing Collective (The MLC) to become eligible for U.S. mechanical royalties from streaming services.',
  whyItMatters: 'Without an MLC registration, mechanical royalties owed on U.S. streams may go unclaimed. The MLC is the sole administrator of the U.S. blanket mechanical license created by the Music Modernization Act.',
  metrics: Object.freeze({
    difficulty: 'MEDIUM',
    estimatedMinutes: 30,
    estimatedRevenueImpact: 'MEDIUM',
  }),
  prerequisites: Object.freeze(['A list of your musical works (titles, writers, ISWC/ISRC where available)', 'Publisher information, if applicable']),
  requiredDocumentation: Object.freeze(['Work titles and writer credits', 'ISRC or ISWC identifiers for each work, where known']),
  affectedDomain: 'publishing',
  steps: Object.freeze([
    Object.freeze({ stepId: 'MLC-001', stepNumber: 1, title: 'Gather your work information', instructions: 'Compile a list of your musical works with writer credits and any known ISWC/ISRC identifiers.', resources: Object.freeze([]) }),
    Object.freeze({ stepId: 'MLC-002', stepNumber: 2, title: 'Create an MLC account', instructions: 'Go to themlc.com and create a rightsholder account.', resources: Object.freeze(['https://www.themlc.com']) }),
    Object.freeze({ stepId: 'MLC-003', stepNumber: 3, title: 'Register your works', instructions: 'Enter each musical work into the MLC portal, matching metadata as closely as possible to your recordings.', resources: Object.freeze([]) }),
    Object.freeze({ stepId: 'MLC-004', stepNumber: 4, title: 'Confirm registration status', instructions: 'Review your MLC dashboard to confirm each work shows as registered, and monitor for royalty statements.', resources: Object.freeze([]) }),
  ]),
  helpfulResources: Object.freeze(['https://www.themlc.com/resources']),
  completionVerification: 'Artist confirms each listed work shows a registered status in the MLC portal. A future scan independently re-verifies via the same MLC evidence source — this playbook\'s completion is self-report, not automated re-verification.',
  isEligible,
  evidenceConfidence,
});

registerPlaybook({
  playbookId: PLAYBOOK_ID,
  playbookVersion: DEFINITION.playbookVersion,
  definitionSchema: DEFINITION.definitionSchema,
  load: () => DEFINITION,
});
