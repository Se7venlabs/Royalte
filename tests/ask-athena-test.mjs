// Ask ATHENA™ — ATHENA™ Phase 3E test suite. Pure-logic unit tests against
// each pipeline module (Intent Engine, Question Classifier, Reasoning
// Engine, Capability Registry, Context Builder, Evidence Attribution,
// Prompt Assembly, Response Contract, ATHENA Service) plus the conversation
// store against an in-memory mock Supabase. No real database, no real AI
// provider — matches the house pattern in tests/executive-memory-store-test.mjs.

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

import { classifyIntent, INTENTS } from '../api/athena/ask/intent-engine.js';
import { classifyQuestion, CATEGORIES } from '../api/athena/ask/question-classifier.js';
import { attemptDeterministicAnswer } from '../api/athena/ask/reasoning-engine.js';
import '../api/athena/ask/capabilities/index.js';
import { getCapabilities, getCapability } from '../api/athena/ask/capabilities/registry.js';
import { buildExecutiveContext } from '../api/athena/ask/context-builder.js';
import { attributeEvidence, deriveOverallConfidence } from '../api/athena/ask/evidence-attribution.js';
import { assemblePrompt, MAX_PROMPT_CHARS } from '../api/athena/ask/prompt-assembly.js';
import {
  buildResponseContract, validateResponseContract, makeInsufficientEvidenceResponse,
  makeUnavailableResponse, INSUFFICIENT_EVIDENCE_SENTENCE, RESPONSE_STATUS,
} from '../api/athena/ask/response-contract.js';
import { generateAnswer } from '../api/athena/ask/athena-service.js';
import { placeholderProvider } from '../api/athena/ask/providers/placeholder-provider.js';
import { assertValidProvider } from '../api/athena/ask/provider-interface.js';
import {
  startConversation, getConversation, appendTurn, getRecentTurns,
} from '../api/_lib/athena-conversation-store.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  })();
}

// ─── In-memory mock Supabase (matches tests/executive-memory-store-test.mjs) ─
function makeMockSupabase(initialRows = {}) {
  const store = {};
  for (const [table, rows] of Object.entries(initialRows)) {
    store[table] = rows.map(r => ({ ...r }));
  }
  let idCounter = 0;

  function from(table) {
    if (!store[table]) store[table] = [];
    const rows = store[table];
    let mode = null;
    let insertData = null, updateData = null, limitN = null;
    const filters = [];
    let orderCol = null, orderAsc = true;

    const builder = {
      select() { if (mode === null) mode = 'select'; return builder; },
      insert(data) { mode = 'insert'; insertData = data; return builder; },
      update(data) { mode = 'update'; updateData = data; return builder; },
      eq(col, val) { filters.push(r => r[col] === val); return builder; },
      order(col, opts) { orderCol = col; orderAsc = !(opts && opts.ascending === false); return builder; },
      limit(n) { limitN = n; return builder; },
      maybeSingle() { return resolveQuery({ single: true, maybe: true }); },
      single() { return resolveQuery({ single: true, maybe: false }); },
      then(resolve, reject) { return resolveQuery({ single: false }).then(resolve, reject); },
    };

    async function resolveQuery({ single, maybe }) {
      if (mode === 'insert') {
        const newRow = { id: `${table}-${++idCounter}`, created_at: new Date().toISOString(), ...insertData };
        rows.push(newRow);
        return single ? { data: newRow, error: null } : { data: [newRow], error: null };
      }
      if (mode === 'update') {
        const matches = rows.filter(r => filters.every(f => f(r)));
        if (matches.length === 0) return single ? { data: null, error: maybe ? null : { message: 'no rows' } } : { data: [], error: null };
        matches.forEach(r => Object.assign(r, updateData));
        return single ? { data: matches[0], error: null } : { data: matches, error: null };
      }
      let result = rows.filter(r => filters.every(f => f(r)));
      if (orderCol) {
        result = [...result].sort((a, b) => {
          if (a[orderCol] === b[orderCol]) return 0;
          const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
          return orderAsc ? cmp : -cmp;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);
      if (single) return result[0] ? { data: result[0], error: null } : { data: null, error: maybe ? null : { message: 'no rows' } };
      return { data: result, error: null };
    }

    return builder;
  }

  return { from };
}

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§1 Executive Intent Engine™');

await test('classifies a Compare question', async () => {
  assert.equal(classifyIntent('Compare my last two scans').intent, INTENTS.COMPARE);
});
await test('classifies a Diagnose question', async () => {
  assert.equal(classifyIntent('Why did my publishing score decrease?').intent, INTENTS.DIAGNOSE);
});
await test('classifies a Recommend question', async () => {
  assert.equal(classifyIntent('What should I focus on first?').intent, INTENTS.RECOMMEND);
});
await test('falls back to Analyze with LOW confidence for unmatched text', async () => {
  const result = classifyIntent('asdkjfh qwoeiru');
  assert.equal(result.intent, INTENTS.ANALYZE);
  assert.equal(result.confidence, 'LOW');
});
await test('handles non-string input without throwing', async () => {
  const result = classifyIntent(null);
  assert.equal(result.intent, INTENTS.ANALYZE);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§2 Question Classifier™');

await test('classifies a Publishing question and always includes continuity capabilities', async () => {
  const { category, domains } = classifyQuestion('What is my MLC registration status?', 'Explain');
  assert.equal(category, CATEGORIES.PUBLISHING);
  assert.ok(domains.includes('publishing'));
  assert.ok(domains.includes('executiveMemory'));
  assert.ok(domains.includes('executiveBriefArchive'));
  assert.ok(domains.includes('conversationHistory'));
});
await test('unmatched/General question includes every capability', async () => {
  const { category, domains } = classifyQuestion('asdkjfh qwoeiru', 'Analyze');
  assert.equal(category, CATEGORIES.GENERAL);
  assert.ok(domains.length >= 11);
});
await test('Strategy question includes every capability (null domains rule)', async () => {
  const { domains } = classifyQuestion('What should be my overall strategy?', 'Recommend');
  assert.ok(domains.includes('identity') && domains.includes('media'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§3 ATHENA Capability Registry™');

await test('all 11 capabilities are registered', async () => {
  const caps = getCapabilities();
  assert.equal(caps.length, 11);
  const names = caps.map(c => c.name).sort();
  assert.deepEqual(names, [
    'backend', 'catalog', 'conversationHistory', 'executiveBriefArchive', 'executiveMemory',
    'globalFootprint', 'health', 'identity', 'media', 'monitoring', 'publishing',
  ]);
});
await test('a fingerprint capability advertises unavailable with no scan payload', async () => {
  const cap = getCapability('identity');
  assert.equal(cap.advertiseAvailability({}), false);
});
await test('a fingerprint capability advertises available with a real scan payload', async () => {
  const cap = getCapability('identity');
  const rawInputs = { scanPayload: { cim: { identity: { coverage: 80, verifiedProviders: 4, totalProviders: 5 } } } };
  assert.equal(cap.advertiseAvailability(rawInputs), true);
  const evidence = cap.provideEvidence(rawInputs);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].sourceType, 'Canonical Domain');
});
await test('globalFootprint capability name matches question-classifier domain key (not the internal "footprint" fingerprint key)', async () => {
  assert.ok(getCapability('globalFootprint'));
  assert.equal(getCapability('footprint'), null);
});
await test('executiveMemory capability reflects passed-in memoryItems', async () => {
  const cap = getCapability('executiveMemory');
  const rawInputs = { memoryItems: [{ id: 'm1', statement: 'Test fact' }] };
  assert.equal(cap.advertiseAvailability(rawInputs), true);
  assert.equal(cap.provideEvidence(rawInputs)[0].fact, 'Test fact');
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§4 Executive Context Builder™ + Conversation Memory™');

await test('only builds sections for available capabilities among requested domains', async () => {
  const rawInputs = { memoryItems: [{ id: 'm1', statement: 'x' }] }; // no scanPayload
  const built = buildExecutiveContext({ domains: ['identity', 'executiveMemory'], rawInputs });
  const sectionNames = built.sections.map(s => s.section);
  assert.ok(!sectionNames.includes('identity'));
  assert.ok(sectionNames.includes('executiveMemory'));
});
await test('adds a recent_conversation section when conversationTurns present', async () => {
  const rawInputs = { conversationTurns: [{ role: 'user', content: 'Hi' }] };
  const built = buildExecutiveContext({ domains: [], rawInputs });
  assert.ok(built.sections.some(s => s.section === 'recent_conversation'));
});
await test('omits recent_conversation section when no turns', async () => {
  const built = buildExecutiveContext({ domains: [], rawInputs: {} });
  assert.ok(!built.sections.some(s => s.section === 'recent_conversation'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§5 Evidence Attribution™');

await test('defaults an unrecognized sourceType to Unknown', async () => {
  const [attributed] = attributeEvidence([{ fact: 'x', sourceType: 'Made Up Source', sourceId: null }]);
  assert.equal(attributed.sourceType, 'Unknown');
});
await test('preserves a recognized sourceType', async () => {
  const [attributed] = attributeEvidence([{ fact: 'x', sourceType: 'Executive Memory', sourceId: 'm1' }]);
  assert.equal(attributed.sourceType, 'Executive Memory');
});
await test('deriveOverallConfidence returns the worst (least confident) signal', async () => {
  assert.equal(deriveOverallConfidence(['HIGH', 'LOW', 'HIGH']), 'LOW');
  assert.equal(deriveOverallConfidence(['HIGH', 'HIGH']), 'HIGH');
});
await test('deriveOverallConfidence returns INSUFFICIENT_DATA for an empty list', async () => {
  assert.equal(deriveOverallConfidence([]), 'INSUFFICIENT_DATA');
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§6 Prompt Assembly™');

await test('always includes personality, question, and evidence sections', async () => {
  const assembled = assemblePrompt({ question: 'test?', contextSections: [], attributedEvidence: [] });
  const names = assembled.sections.map(s => s.section);
  assert.ok(names.includes('personality'));
  assert.ok(names.includes('question'));
  assert.ok(names.includes('evidence'));
});
await test('dedupes identical evidence entries', async () => {
  const dupe = { fact: 'x', sourceType: 'Unknown', sourceId: null };
  const assembled = assemblePrompt({ question: 'q', contextSections: [], attributedEvidence: [dupe, { ...dupe }] });
  assert.equal(assembled.evidence.length, 1);
});
await test('truncates oversized context sections, never the protected ones', async () => {
  const bigSection = { section: 'identity', text: 'x'.repeat(MAX_PROMPT_CHARS + 5000) };
  const assembled = assemblePrompt({ question: 'q', contextSections: [bigSection], attributedEvidence: [] });
  assert.equal(assembled.truncated, true);
  const names = assembled.sections.map(s => s.section);
  assert.ok(names.includes('personality') && names.includes('question') && names.includes('evidence'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§7 Response Contract™ + Explainability Framework™');

await test('makeInsufficientEvidenceResponse uses the exact Board-required sentence', async () => {
  const r = makeInsufficientEvidenceResponse({ questionCategory: 'General', questionIntent: 'Analyze' });
  assert.equal(r.answer, INSUFFICIENT_EVIDENCE_SENTENCE);
  assert.equal(r.status, RESPONSE_STATUS.INSUFFICIENT_EVIDENCE);
});
await test('makeUnavailableResponse returns UNAVAILABLE status, never throws', async () => {
  const r = makeUnavailableResponse({ questionCategory: 'General', questionIntent: 'Analyze', reason: 'timeout' });
  assert.equal(r.status, RESPONSE_STATUS.UNAVAILABLE);
});
await test('validateResponseContract accepts a well-formed contract', async () => {
  const r = buildResponseContract({ questionCategory: 'General', questionIntent: 'Analyze' });
  const { valid, errors } = validateResponseContract(r);
  assert.equal(valid, true, errors.join('; '));
});
await test('validateResponseContract rejects a recommendation missing Explainability fields', async () => {
  const r = buildResponseContract({ recommendations: [{ statement: 'Do X' }] });
  const { valid, errors } = validateResponseContract(r);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes('why')));
});
await test('a fully-explainable recommendation passes validation', async () => {
  const r = buildResponseContract({
    recommendations: [{ statement: 'Register with The MLC', why: 'Mechanical royalties uncollected', evidence: [], assumptions: [], whatCouldChange: 'Verified MLC registration' }],
  });
  assert.equal(validateResponseContract(r).valid, true);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§8 Executive Reasoning Engine™ — deterministic-vs-AI routing');

await test('unmatched question returns null (falls through to AI-required path)', async () => {
  const result = attemptDeterministicAnswer({ question: 'What is the meaning of life?', intent: 'Analyze', category: 'General', rawInputs: {} });
  assert.equal(result, null);
});
await test('"compare my last two scans" with no brief history returns Insufficient Evidence deterministically', async () => {
  const result = attemptDeterministicAnswer({ question: 'Compare my last two scans', intent: 'Compare', category: 'General', rawInputs: {} });
  assert.equal(result.status, RESPONSE_STATUS.INSUFFICIENT_EVIDENCE);
  assert.equal(result.providerVersion, 'deterministic');
});
await test('"compare my last two scans" with two briefs produces a Derived Conclusion, zero AI cost', async () => {
  const rawInputs = {
    latestBrief: {
      executive_brief_id: 'EB-2', generated_at: '2026-07-20', risk_count: 1, opportunity_count: 2,
      critical_issue_count: 0, executive_intelligence_object: { risks: [], opportunities: [], executiveBriefing: { overallLevel: 'STABLE', riskLevel: 'LOW' } },
    },
    previousBrief: {
      executive_brief_id: 'EB-1', generated_at: '2026-07-01', risk_count: 3, opportunity_count: 1,
      critical_issue_count: 1, executive_intelligence_object: { risks: [], opportunities: [], executiveBriefing: { overallLevel: 'AT_RISK', riskLevel: 'HIGH' } },
    },
  };
  const result = attemptDeterministicAnswer({ question: 'Compare my last two scans', intent: 'Compare', category: 'General', rawInputs });
  assert.equal(result.answerType, 'Derived Conclusion');
  assert.equal(result.providerVersion, 'deterministic');
  assert.ok(result.relatedBriefIds.includes('EB-1') && result.relatedBriefIds.includes('EB-2'));
});
await test('"show my executive memory" lists real items with zero AI cost', async () => {
  const rawInputs = { memoryItems: [{ id: 'm1', statement: 'Goal: release EP by Q4' }] };
  const result = attemptDeterministicAnswer({ question: 'Show my executive memory', intent: 'Summarize', category: 'General', rawInputs });
  assert.ok(result.answer.includes('release EP by Q4'));
  assert.equal(result.providerVersion, 'deterministic');
});
await test('"what registrations am I missing" with a matching risk answers deterministically', async () => {
  const rawInputs = {
    latestBrief: { executive_intelligence_object: { risks: [{ riskId: 'r1', affectedDomain: 'publishing', title: 'MLC registration missing' }] } },
  };
  const result = attemptDeterministicAnswer({ question: 'What registrations am I missing?', intent: 'Diagnose', category: 'Publishing', rawInputs });
  assert.ok(result.answer.includes('MLC registration missing'));
});
await test('"list recurring risks" answers from recurringIssues', async () => {
  const rawInputs = { recurringIssues: [{ title: 'No PRO registered', firstSeenExecutiveBriefId: 'EB-1' }] };
  const result = attemptDeterministicAnswer({ question: 'List recurring risks', intent: 'Diagnose', category: 'General', rawInputs });
  assert.ok(result.answer.includes('No PRO registered'));
});
await test('"display historical improvements" answers from resolvedIssues', async () => {
  const rawInputs = { resolvedIssues: [{ title: 'ISRC gap closed', firstSeenExecutiveBriefId: 'EB-1' }] };
  const result = attemptDeterministicAnswer({ question: 'Display historical improvements', intent: 'Summarize', category: 'General', rawInputs });
  assert.ok(result.answer.includes('ISRC gap closed'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§9 ATHENA Service™ + Provider Interface™ — graceful degradation & provider replacement');

await test('generateAnswer succeeds with the placeholder provider, threads citations/relatedWorkspaces through', async () => {
  const assembled = assemblePrompt({ question: 'q', contextSections: [], attributedEvidence: [{ fact: 'x', sourceType: 'Unknown', sourceId: null }] });
  const citations = [{ label: 'Identity Intelligence™', workspace: '/workspaces/identity-intelligence.html' }];
  const r = await generateAnswer({ assembledPrompt: assembled, meta: { questionCategory: 'General', questionIntent: 'Analyze' }, overallConfidence: 'HIGH', citations, provider: placeholderProvider });
  assert.equal(r.status, RESPONSE_STATUS.OK);
  assert.deepEqual(r.citations, citations);
  assert.deepEqual(r.relatedWorkspaces, ['/workspaces/identity-intelligence.html']);
  assert.equal(r.providerVersion, 'placeholder-1.0');
});

await test('generateAnswer degrades to UNAVAILABLE, never throws, when the provider fails', async () => {
  const failingProvider = {
    providerVersion: 'failing-test-1.0',
    async generate() { throw new Error('simulated provider outage'); },
    async healthCheck() { return { ok: false, detail: 'down' }; },
    estimateCost() { return 0; },
    estimateTokens() { return 0; },
  };
  const assembled = assemblePrompt({ question: 'q', contextSections: [], attributedEvidence: [] });
  const r = await generateAnswer({ assembledPrompt: assembled, meta: { questionCategory: 'General', questionIntent: 'Analyze' }, provider: failingProvider });
  assert.equal(r.status, RESPONSE_STATUS.UNAVAILABLE);
});

await test('Provider Independence™: a second dummy provider implementing the same contract produces an equally valid Response Contract', async () => {
  const dummyProvider = {
    providerVersion: 'dummy-test-1.0',
    async generate(prompt) { return { text: `dummy answer for: ${prompt.sections.find(s => s.section === 'question')?.text}`, raw: {} }; },
    async healthCheck() { return { ok: true, detail: 'dummy always healthy' }; },
    estimateCost() { return 0.001; },
    estimateTokens(prompt) { return prompt.sections.length; },
  };
  assertValidProvider(dummyProvider); // must not throw -- same contract as placeholder
  const assembled = assemblePrompt({ question: 'What is my status?', contextSections: [], attributedEvidence: [] });
  const rPlaceholder = await generateAnswer({ assembledPrompt: assembled, meta: { questionCategory: 'General', questionIntent: 'Analyze' }, provider: placeholderProvider });
  const rDummy = await generateAnswer({ assembledPrompt: assembled, meta: { questionCategory: 'General', questionIntent: 'Analyze' }, provider: dummyProvider });
  assert.equal(validateResponseContract(rPlaceholder).valid, true);
  assert.equal(validateResponseContract(rDummy).valid, true);
  assert.equal(Object.keys(rPlaceholder).sort().join(','), Object.keys(rDummy).sort().join(','));
  assert.notEqual(rPlaceholder.providerVersion, rDummy.providerVersion);
});

await test('assertValidProvider rejects a provider missing a required method', async () => {
  assert.throws(() => assertValidProvider({ generate: async () => {} }));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§10 Conversation Memory™ Store — ownership scoping & cross-artist isolation');

await test('startConversation then appendTurn then getRecentTurns round-trips correctly', async () => {
  const supabase = makeMockSupabase();
  const started = await startConversation({ supabase, artistProfileId: 'artist-1' });
  assert.equal(started.ok, true);
  const conversationId = started.conversation.id;

  await appendTurn({ supabase, artistProfileId: 'artist-1', conversationId, role: 'user', content: 'Hello' });
  await appendTurn({ supabase, artistProfileId: 'artist-1', conversationId, role: 'athena', content: 'Hi there', responseContract: { answer: 'Hi there' } });

  const recent = await getRecentTurns({ supabase, artistProfileId: 'artist-1', conversationId });
  assert.equal(recent.ok, true);
  assert.equal(recent.turns.length, 2);
  assert.equal(recent.turns[0].content, 'Hello');
  assert.equal(recent.turns[1].content, 'Hi there');
});

await test('appendTurn rejects an invalid role', async () => {
  const supabase = makeMockSupabase();
  const started = await startConversation({ supabase, artistProfileId: 'artist-1' });
  const result = await appendTurn({ supabase, artistProfileId: 'artist-1', conversationId: started.conversation.id, role: 'system', content: 'x' });
  assert.equal(result.ok, false);
});

await test('cross-artist isolation: artist-2 cannot read artist-1s conversation', async () => {
  const supabase = makeMockSupabase();
  const started = await startConversation({ supabase, artistProfileId: 'artist-1' });
  const result = await getConversation({ supabase, artistProfileId: 'artist-2', conversationId: started.conversation.id });
  assert.equal(result.ok, false);
});

await test('cross-artist isolation: artist-2 cannot read artist-1s conversation turns', async () => {
  const supabase = makeMockSupabase();
  const started = await startConversation({ supabase, artistProfileId: 'artist-1' });
  await appendTurn({ supabase, artistProfileId: 'artist-1', conversationId: started.conversation.id, role: 'user', content: 'secret' });
  const result = await getRecentTurns({ supabase, artistProfileId: 'artist-2', conversationId: started.conversation.id });
  assert.equal(result.ok, true); // never-throws contract
  assert.equal(result.turns.length, 0); // but scoped query returns nothing
});

await test('getRecentTurns never throws when the store is unavailable', async () => {
  const result = await getRecentTurns({ supabase: null, artistProfileId: 'artist-1', conversationId: 'c1' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.turns, []);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§11 Structural guarantee — Ask ATHENA never writes to executive_memory_items');

await test('athena-conversation-store.js never queries or writes the executive_memory_items table (the string appears only in its own disclosure comment, never in a .from() call)', async () => {
  const source = readFileSync(new URL('../api/_lib/athena-conversation-store.js', import.meta.url), 'utf8');
  assert.ok(!source.includes("from('executive_memory_items')"));
  assert.ok(!source.includes('from("executive_memory_items")'));
});
await test('reasoning-engine.js never references the executive_memory_items table', async () => {
  const source = readFileSync(new URL('../api/athena/ask/reasoning-engine.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('executive_memory_items'));
});
await test('ask-athena.js endpoint never writes to executive_memory_items (no insert/update call against that table)', async () => {
  const source = readFileSync(new URL('../api/ask-athena.js', import.meta.url), 'utf8');
  assert.ok(!source.includes("from('executive_memory_items')"));
  assert.ok(!source.includes('executive-memory-store.js'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
