// Response Contract™ — ATHENA™ Phase 3E, Intelligence Layer™
//
// The merged Executive Response Schema™ every Ask ATHENA answer conforms to
// -- whether produced by the Executive Reasoning Engine's deterministic
// exit or the full AI-required pipeline. The UI never needs to know which
// path produced an answer.
//
// Explainability Framework™ (Board directive): every entry in
// `recommendations` answers Why? / Evidence? / Assumptions? / What could
// change? -- {statement, why, evidence, assumptions, whatCouldChange} -- not
// a bare string, in both the deterministic and AI-required paths.

export const RESPONSE_STATUS = Object.freeze({
  OK:                    'OK',
  UNAVAILABLE:           'UNAVAILABLE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
});

// Safety Layer™ classification for `answerType`.
export const ANSWER_TYPES = Object.freeze({
  CONFIRMED_FACT:        'Confirmed Fact',
  DERIVED_CONCLUSION:    'Derived Conclusion',
  RECOMMENDATION:        'Recommendation',
  UNKNOWN:               'Unknown',
  UNAVAILABLE:           'Unavailable',
  INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
});

// Board-mandated exact sentence -- never paraphrased.
export const INSUFFICIENT_EVIDENCE_SENTENCE =
  'There is currently insufficient verified evidence to answer that question.';

const REQUIRED_FIELDS = Object.freeze([
  'status', 'summary', 'answer', 'answerType', 'confidence', 'recommendations',
  'evidence', 'citations', 'limitations', 'followUpQuestions', 'relatedWorkspaces',
  'relatedBriefIds', 'relatedMemoryIds', 'questionCategory', 'questionIntent',
  'generatedAt', 'providerVersion',
]);

const REQUIRED_RECOMMENDATION_FIELDS = Object.freeze(['statement', 'why', 'evidence', 'assumptions', 'whatCouldChange']);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) deepFreeze(val);
  }
  return obj;
}

// buildResponseContract(fields) -> frozen Response Contract object.
// Fills structural defaults for anything omitted so every caller doesn't
// have to repeat empty-array/empty-string boilerplate; does not fill in
// `answer`/`summary`/`status` -- those are always the caller's own content.
export function buildResponseContract(fields = {}) {
  const contract = {
    status:            fields.status || RESPONSE_STATUS.OK,
    summary:           fields.summary || '',
    answer:            fields.answer || '',
    answerType:        fields.answerType || ANSWER_TYPES.UNKNOWN,
    confidence:        fields.confidence || 'MEDIUM',
    recommendations:   fields.recommendations || [],
    evidence:          fields.evidence || [],
    citations:         fields.citations || [],
    limitations:       fields.limitations || [],
    followUpQuestions: fields.followUpQuestions || [],
    relatedWorkspaces: fields.relatedWorkspaces || [],
    relatedBriefIds:   fields.relatedBriefIds || [],
    relatedMemoryIds:  fields.relatedMemoryIds || [],
    questionCategory:  fields.questionCategory || 'General',
    questionIntent:    fields.questionIntent || 'Analyze',
    generatedAt:       fields.generatedAt || new Date().toISOString(),
    providerVersion:   fields.providerVersion || 'unknown',
  };
  return deepFreeze(contract);
}

// makeInsufficientEvidenceResponse -- the one, exact, Board-required sentence.
export function makeInsufficientEvidenceResponse({ questionCategory, questionIntent, providerVersion = 'deterministic' } = {}) {
  return buildResponseContract({
    status: RESPONSE_STATUS.INSUFFICIENT_EVIDENCE,
    summary: INSUFFICIENT_EVIDENCE_SENTENCE,
    answer: INSUFFICIENT_EVIDENCE_SENTENCE,
    answerType: ANSWER_TYPES.INSUFFICIENT_EVIDENCE,
    confidence: 'INSUFFICIENT_DATA',
    limitations: [INSUFFICIENT_EVIDENCE_SENTENCE],
    questionCategory, questionIntent, providerVersion,
  });
}

// makeUnavailableResponse -- graceful degradation when the provider fails or
// times out. Never a hang, never an opaque 500.
export function makeUnavailableResponse({ questionCategory, questionIntent, reason, providerVersion = 'unknown' } = {}) {
  const message = `ATHENA is temporarily unavailable to answer this question${reason ? ` (${reason})` : ''}. Please try again shortly.`;
  return buildResponseContract({
    status: RESPONSE_STATUS.UNAVAILABLE,
    summary: message,
    answer: message,
    answerType: ANSWER_TYPES.UNAVAILABLE,
    confidence: 'INSUFFICIENT_DATA',
    limitations: [message],
    questionCategory, questionIntent, providerVersion,
  });
}

function checkFields(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined) errors.push(`${label} missing required field: ${f}`);
  }
  return errors;
}

// validateResponseContract(obj) -> {valid, errors} -- used by tests and, if
// ever needed, defensive checks before returning a contract to the client.
export function validateResponseContract(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['response contract must be a non-null object'] };
  }
  const errors = checkFields(obj, REQUIRED_FIELDS, 'response contract');
  if (obj.answerType && !Object.values(ANSWER_TYPES).includes(obj.answerType)) {
    errors.push(`unknown answerType: ${obj.answerType}`);
  }
  if (obj.status && !Object.values(RESPONSE_STATUS).includes(obj.status)) {
    errors.push(`unknown status: ${obj.status}`);
  }
  if (Array.isArray(obj.recommendations)) {
    obj.recommendations.forEach((rec, i) => {
      const recErrors = checkFields(rec, REQUIRED_RECOMMENDATION_FIELDS, `recommendations[${i}]`);
      errors.push(...recErrors);
    });
  } else {
    errors.push('recommendations must be an array');
  }
  return { valid: errors.length === 0, errors };
}
