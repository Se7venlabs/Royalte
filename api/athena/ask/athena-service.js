// ATHENA Service™ — ATHENA™ Phase 3E orchestration layer
//
// Sits between Prompt Assembly and the Provider Interface. The one file in
// api/athena/ask/ permitted to perform network I/O (invoking the configured
// Provider) -- everything else in this tree stays pure. Owns provider
// selection, bounded retry, a hard timeout, response normalization into the
// Response Contract (the one place a provider's raw output becomes the
// Board's shape -- providers themselves stay ignorant of it), and
// structured log-based telemetry (no external telemetry vendor decided or
// installed -- a documented seam, not a fabricated dashboard).

import { createAthenaProvider } from './provider-factory.js';
import { buildResponseContract, makeUnavailableResponse, ANSWER_TYPES } from './response-contract.js';

const TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2; // one retry on transient failure

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`provider timeout after ${ms}ms`)), ms)),
  ]);
}

function relatedWorkspacesFrom(citations) {
  const workspaces = citations.map(c => c.workspace).filter(Boolean);
  return [...new Set(workspaces)];
}

// generateAnswer({assembledPrompt, meta, overallConfidence, citations, provider}) ->
// ResponseContract. `citations` (from context-builder.js, threaded through
// by the caller rather than through Prompt Assembly -- they're response
// metadata, not part of the LLM-facing prompt) become both the Response
// Contract's `citations` and, per Deep Mission Control Integration™, its
// `relatedWorkspaces`. `provider` is injectable for tests (provider
// replacement proof); production callers omit it and get
// createAthenaProvider()'s result.
export async function generateAnswer({ assembledPrompt, meta = {}, overallConfidence = 'MEDIUM', citations = [], provider = null }) {
  const activeProvider = provider || createAthenaProvider();
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await withTimeout(activeProvider.generate(assembledPrompt), TIMEOUT_MS);
      console.info('[athena-service] generate ok', {
        attempt, providerVersion: activeProvider.providerVersion, questionCategory: meta.questionCategory,
      });
      return buildResponseContract({
        ...meta,
        answer: raw.text,
        summary: raw.text,
        answerType: ANSWER_TYPES.DERIVED_CONCLUSION,
        confidence: overallConfidence,
        evidence: assembledPrompt.evidence || [],
        citations,
        relatedWorkspaces: relatedWorkspacesFrom(citations),
        providerVersion: activeProvider.providerVersion || 'unknown',
      });
    } catch (err) {
      lastError = err;
      console.error('[athena-service] generate failed', { attempt, error: err?.message || err });
    }
  }

  return makeUnavailableResponse({
    ...meta,
    reason: lastError?.message || 'unknown provider error',
    providerVersion: activeProvider.providerVersion || 'unknown',
  });
}
