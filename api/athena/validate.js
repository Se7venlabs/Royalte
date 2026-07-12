// Canonical Intelligence Platform(tm) -- ATHENA(tm) Validation
// Validates: input integrity, output schema, recommendation format,
// confidence structure, context integrity, and prompt safety.

import {
  ATHENA_ERROR_CODES,
  VALID_RECOMMENDATION_PRIORITIES,
  VALID_CONFIDENCE_LEVELS,
  REQUIRED_RISK_FIELDS,
  REQUIRED_OPPORTUNITY_FIELDS,
  REQUIRED_RECOMMENDATION_FIELDS,
  REQUIRED_CONFIDENCE_FIELDS,
  REQUIRED_CONTEXT_FIELDS,
} from './types.js';

// Patterns that indicate prompt injection attempts.
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /system\s*:\s*you\s+are/i,
  /\[\s*INST\s*\]/i,
  /<\s*\|?\s*(?:im_start|system|user|assistant)\s*\|?\s*>/i,
  /--\s*system\s*--/i,
];

const MAX_PROMPT_LENGTH = 10_000;

function checkFields(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      errors.push(`${label} missing required field: ${f}`);
    }
  }
  return errors;
}

export function validateAthenaInput(apiResponses) {
  if (!apiResponses || typeof apiResponses !== 'object') {
    return { valid: false, errors: ['apiResponses must be a non-null object'] };
  }
  const errors = [];
  const hasAnySuccess = Object.values(apiResponses).some(
    r => r && typeof r === 'object' && r.status === 'SUCCESS'
  );
  if (!hasAnySuccess) {
    errors.push('At least one API response must have status SUCCESS');
  }
  for (const [key, response] of Object.entries(apiResponses)) {
    if (response && typeof response === 'object' && response.apiVersion) {
      if (response.apiVersion !== 'v1') {
        errors.push(`Response "${key}" has unsupported apiVersion: ${response.apiVersion}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateAnalysisOutput(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return { valid: false, errors: ['analysis must be a non-null object'] };
  }
  const errors = checkFields(analysis,
    ['analysisId', 'timestamp', 'businessContext', 'healthSummary', 'domainInsights', 'engineVersion'],
    'analysis'
  );
  if (analysis.domainInsights !== undefined && !Array.isArray(analysis.domainInsights)) {
    errors.push('analysis.domainInsights must be an array');
  }
  return { valid: errors.length === 0, errors };
}

export function validateRisk(risk) {
  if (!risk || typeof risk !== 'object') {
    return { valid: false, errors: ['risk must be a non-null object'] };
  }
  return { valid: true, errors: checkFields(risk, REQUIRED_RISK_FIELDS, 'risk') };
}

export function validateOpportunity(opportunity) {
  if (!opportunity || typeof opportunity !== 'object') {
    return { valid: false, errors: ['opportunity must be a non-null object'] };
  }
  return { valid: true, errors: checkFields(opportunity, REQUIRED_OPPORTUNITY_FIELDS, 'opportunity') };
}

export function validateRecommendation(recommendation) {
  if (!recommendation || typeof recommendation !== 'object') {
    return { valid: false, errors: ['recommendation must be a non-null object'] };
  }
  const errors = checkFields(recommendation, REQUIRED_RECOMMENDATION_FIELDS, 'recommendation');
  if (recommendation.priority && !VALID_RECOMMENDATION_PRIORITIES.has(recommendation.priority)) {
    errors.push(`Unknown recommendation priority: ${recommendation.priority}`);
  }
  if (recommendation.sourceType && !['risk', 'opportunity'].includes(recommendation.sourceType)) {
    errors.push(`Unknown recommendation sourceType: ${recommendation.sourceType}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateConfidence(confidence) {
  if (!confidence || typeof confidence !== 'object') {
    return { valid: false, errors: ['confidence must be a non-null object'] };
  }
  const errors = checkFields(confidence, REQUIRED_CONFIDENCE_FIELDS, 'confidence');
  if (confidence.level && !VALID_CONFIDENCE_LEVELS.has(confidence.level)) {
    errors.push(`Unknown confidence level: ${confidence.level}`);
  }
  if (typeof confidence.score === 'number' && (confidence.score < 0 || confidence.score > 1)) {
    errors.push(`confidence.score must be between 0 and 1, got: ${confidence.score}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateContext(context) {
  if (!context || typeof context !== 'object') {
    return { valid: false, errors: ['context must be a non-null object'] };
  }
  const errors = checkFields(context, REQUIRED_CONTEXT_FIELDS, 'context');
  if (context.executivePriorities !== undefined && !Array.isArray(context.executivePriorities)) {
    errors.push('context.executivePriorities must be an array');
  }
  if (context.outstandingRisks !== undefined && !Array.isArray(context.outstandingRisks)) {
    errors.push('context.outstandingRisks must be an array');
  }
  return { valid: errors.length === 0, errors };
}

export function validatePromptSafety(text) {
  if (typeof text !== 'string') {
    return { safe: false, reasons: ['text must be a string'] };
  }
  const reasons = [];
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`Potential prompt injection pattern detected`);
    }
  }
  if (text.length > MAX_PROMPT_LENGTH) {
    reasons.push(`Text exceeds maximum safe length of ${MAX_PROMPT_LENGTH} characters`);
  }
  return { safe: reasons.length === 0, reasons };
}

export function assertInputValid(apiResponses) {
  const { valid, errors } = validateAthenaInput(apiResponses);
  if (!valid) {
    const err = new Error(`ATHENA input validation failed: ${errors.join('; ')}`);
    err.code = ATHENA_ERROR_CODES.INVALID_INPUT;
    throw err;
  }
}

export function assertOutputValid(analysis) {
  const { valid, errors } = validateAnalysisOutput(analysis);
  if (!valid) {
    const err = new Error(`ATHENA output validation failed: ${errors.join('; ')}`);
    err.code = ATHENA_ERROR_CODES.SCHEMA_VIOLATION;
    throw err;
  }
}
