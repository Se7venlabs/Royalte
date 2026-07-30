// Provider Interface™ — ATHENA™ Phase 3E, Intelligence Layer™
//
// The simplified AthenaProvider contract (documented plain-JS, this repo has
// no TypeScript). No provider-specific logic may exist outside a file that
// implements this contract -- Context Builder, Reasoning Engine,
// Capabilities, Prompt Assembly, and every workspace stay entirely ignorant
// of which vendor (or whether any vendor) is configured.
//
// @typedef {Object} AssembledPrompt
// @property {{section: string, text: string}[]} sections
// @property {Array} evidence
//
// @typedef {Object} AthenaProvider
// @property {(prompt: AssembledPrompt) => Promise<{text: string, raw: Object}>} generate
// @property {() => Promise<{ok: boolean, detail: string}>} healthCheck
// @property {(prompt: AssembledPrompt) => number} estimateCost
// @property {(prompt: AssembledPrompt) => number} estimateTokens
// @property {string} providerVersion

const REQUIRED_METHODS = Object.freeze(['generate', 'healthCheck', 'estimateCost', 'estimateTokens']);

// assertValidProvider(provider) -- throws if a provider implementation is
// missing any required method. Called by provider-factory.js before a
// provider is ever handed to athena-service.js.
export function assertValidProvider(provider) {
  const missing = REQUIRED_METHODS.filter(fn => typeof provider?.[fn] !== 'function');
  if (missing.length > 0) {
    throw new Error(`AthenaProvider missing required method(s): ${missing.join(', ')}`);
  }
  if (typeof provider.providerVersion !== 'string' || !provider.providerVersion) {
    throw new Error('AthenaProvider must expose a non-empty string providerVersion');
  }
}

export { REQUIRED_METHODS };
