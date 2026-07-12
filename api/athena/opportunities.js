// Canonical Intelligence Platform(tm) -- ATHENA(tm) Opportunity Analysis(tm)
// Identifies executive opportunities from canonical domain intelligence.
// Opportunities are interpretive observations — not canonical facts.

import { randomUUID }         from 'node:crypto';
import { OPPORTUNITY_TYPES, RECOMMENDATION_PRIORITIES, ANALYSIS_TYPES } from './types.js';
import { computeConfidence, computeDomainDataCompleteness } from './confidence.js';
import { ATHENA_ENGINE_VERSION } from './version.js';

function extractData(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status !== 'SUCCESS') return {};
  return response.data || {};
}

function makeOpportunity(type, title, description, affectedDomain, potentialImpact, recommendedAction, priority, domains, completeness) {
  return Object.freeze({
    opportunityId:    randomUUID(),
    type,
    title,
    description,
    affectedDomain,
    potentialImpact,
    confidence:       computeConfidence({ supportingDomains: domains, dataCompleteness: completeness }),
    recommendedAction,
    priority,
  });
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };

export function identifyRegistrationOpportunities(musicRightsResponse) {
  const data        = extractData(musicRightsResponse);
  const completeness = computeDomainDataCompleteness(data);
  const opps        = [];

  if (!data.pro) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.MISSING_REGISTRATION,
      'Join a Performing Rights Organization',
      'PRO membership is required to collect performance royalties from broadcasts, streams, and public performances.',
      'rights', 'HIGH',
      'Register with ASCAP, BMI, SESAC, or an equivalent international PRO.',
      RECOMMENDATION_PRIORITIES.URGENT, ['rights'], completeness
    ));
  }

  if (!data.iswc) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.MISSING_REGISTRATION,
      'Register Compositions for ISWC',
      'Registering compositions for ISWC identifiers enables international royalty tracking and collection.',
      'rights', 'HIGH',
      'Register all compositions with your PRO to obtain ISWC identifiers.',
      RECOMMENDATION_PRIORITIES.HIGH, ['rights'], completeness
    ));
  }

  return opps;
}

export function identifyMetadataOpportunities(apiResponses) {
  const identityData  = extractData(apiResponses.identity);
  const catalogData   = extractData(apiResponses.catalog);
  const opps          = [];

  if (!identityData.biography) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.METADATA_IMPROVEMENT,
      'Add Artist Biography',
      'A complete artist biography improves discoverability and editorial placement on major DSPs.',
      'identity', 'MEDIUM',
      'Write and submit an official artist biography to Apple Music for Artists and Spotify for Artists.',
      RECOMMENDATION_PRIORITIES.LOW, ['identity'], computeDomainDataCompleteness(identityData)
    ));
  }

  if (!catalogData.genre) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.METADATA_IMPROVEMENT,
      'Assign Genre to Catalog Releases',
      'Genre classification improves algorithmic playlist placement and genre chart eligibility.',
      'catalog', 'MEDIUM',
      'Assign primary and secondary genre tags to all catalog releases.',
      RECOMMENDATION_PRIORITIES.MEDIUM, ['catalog'], computeDomainDataCompleteness(catalogData)
    ));
  }

  return opps;
}

export function identifyDistributionOpportunities(distributionResponse) {
  const data        = extractData(distributionResponse);
  const completeness = computeDomainDataCompleteness(data);
  const opps        = [];

  if (data.distributor && data.dspCoverage !== undefined && data.dspCoverage > 0 && data.dspCoverage < 1.0) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.DISTRIBUTION_OPPORTUNITY,
      'Expand DSP Coverage',
      `Current DSP coverage is ${Math.round((data.dspCoverage || 0) * 100)}%. Additional platforms represent incremental streaming revenue.`,
      'distribution', 'HIGH',
      'Review distribution agreement and expand coverage to all major streaming platforms.',
      RECOMMENDATION_PRIORITIES.MEDIUM, ['distribution'], completeness
    ));
  }

  return opps;
}

export function identifyCatalogOpportunities(catalogResponse) {
  const data        = extractData(catalogResponse);
  const completeness = computeDomainDataCompleteness(data);
  const opps        = [];

  if (data.isrcCoverage !== undefined && data.isrcCoverage < 1.0) {
    const missingPct = Math.round((1 - (data.isrcCoverage || 0)) * 100);
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.CATALOG_ENHANCEMENT,
      'Complete ISRC Assignment',
      `${missingPct}% of releases lack ISRC identifiers, limiting streaming royalty tracking and payment.`,
      'catalog', 'HIGH',
      'Obtain ISRCs for all releases through your distributor or directly from an ISRC agency.',
      RECOMMENDATION_PRIORITIES.HIGH, ['catalog'], completeness
    ));
  }

  return opps;
}

export function identifyVerificationOpportunities(identityResponse) {
  const data        = extractData(identityResponse);
  const completeness = computeDomainDataCompleteness(data);
  const opps        = [];

  if (!data.ipi) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.VERIFICATION_OPPORTUNITY,
      'Obtain IPI Number',
      'An IPI (Interested Party Information) number is required for international royalty collection and rights management.',
      'identity', 'HIGH',
      'Register with a PRO to obtain an IPI number.',
      RECOMMENDATION_PRIORITIES.HIGH, ['identity'], completeness
    ));
  }

  if (!data.isni) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.VERIFICATION_OPPORTUNITY,
      'Register for ISNI',
      'ISNI (International Standard Name Identifier) improves cross-platform identity resolution and attribution.',
      'identity', 'MEDIUM',
      'Apply for an ISNI through the ISNI International Agency.',
      RECOMMENDATION_PRIORITIES.LOW, ['identity'], completeness
    ));
  }

  return opps;
}

export function identifyGrowthOpportunities(apiResponses) {
  const catalogData  = extractData(apiResponses.catalog);
  const distData     = extractData(apiResponses.distribution);
  const opps         = [];
  const completeness = Math.max(
    computeDomainDataCompleteness(catalogData),
    computeDomainDataCompleteness(distData)
  );

  if ((catalogData.releaseCount || 0) > 0 && (!distData.dspCoverage || distData.dspCoverage < 0.7)) {
    opps.push(makeOpportunity(
      OPPORTUNITY_TYPES.GROWTH_OPPORTUNITY,
      'Increase Streaming Platform Reach',
      'Expanding distribution to additional DSPs can increase overall streaming revenue and fan discovery.',
      'distribution', 'HIGH',
      'Evaluate and expand distribution to all major streaming platforms.',
      RECOMMENDATION_PRIORITIES.MEDIUM, ['catalog', 'distribution'], completeness
    ));
  }

  return opps;
}

export function generateOpportunityAnalysis(apiResponses = {}) {
  const allOpportunities = [
    ...identifyRegistrationOpportunities(apiResponses.musicRights),
    ...identifyMetadataOpportunities(apiResponses),
    ...identifyDistributionOpportunities(apiResponses.distribution),
    ...identifyCatalogOpportunities(apiResponses.catalog),
    ...identifyVerificationOpportunities(apiResponses.identity),
    ...identifyGrowthOpportunities(apiResponses),
  ];

  const sorted = [...allOpportunities].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
  );

  return Object.freeze({
    opportunityAnalysisId: randomUUID(),
    analysisType:          ANALYSIS_TYPES.OPPORTUNITY_ANALYSIS,
    artistId:              apiResponses.identity?.artistId || null,
    scanId:                apiResponses.identity?.scanId   || null,
    timestamp:             new Date().toISOString(),
    opportunities:         Object.freeze(sorted),
    totalOpportunities:    sorted.length,
    engineVersion:         ATHENA_ENGINE_VERSION.engineId,
  });
}
