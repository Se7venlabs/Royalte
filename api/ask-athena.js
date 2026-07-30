// POST /api/ask-athena
//
// Ask ATHENA™ — ATHENA™ Phase 3E. The Executive Intelligence Advisor™.
// Full pipeline: rate-limit guard -> Bearer auth -> validatePromptSafety ->
// Intent Engine -> Question Classifier -> Reasoning Engine (deterministic
// exit, or fall through) -> Capability Registry -> Context Builder (incl.
// Conversation Memory™) -> Evidence Attribution -> Prompt Assembly ->
// ATHENA Service -> persist conversation turn -> return the Response
// Contract.
//
// Body: { question: string, conversationId?: string }. artistProfileId is
// never read from the request body -- always the Bearer-authenticated
// caller's own auth.uid(), matching every other Phase 3 endpoint.
//
// Security-critical: nothing in this file writes to executive_memory_items
// -- Memory Promotion™ stays a separate, deliberate action against
// /api/executive-memory-actions.

import { createClient } from '@supabase/supabase-js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import { listBriefs, countBriefs } from './_lib/executive-brief-archive-reader.js';
import { buildExecutiveMemory } from './_lib/executive-memory.js';
import { startConversation, getConversation, appendTurn, getRecentTurns } from './_lib/athena-conversation-store.js';
import { validatePromptSafety } from './athena/validate.js';
import { classifyIntent } from './athena/ask/intent-engine.js';
import { classifyQuestion } from './athena/ask/question-classifier.js';
import { attemptDeterministicAnswer } from './athena/ask/reasoning-engine.js';
import './athena/ask/capabilities/index.js';
import { buildExecutiveContext } from './athena/ask/context-builder.js';
import { attributeEvidence, deriveOverallConfidence } from './athena/ask/evidence-attribution.js';
import { assemblePrompt } from './athena/ask/prompt-assembly.js';
import { generateAnswer } from './athena/ask/athena-service.js';

const RATE_LIMITS = { burst: { max: 2 }, hour: { max: 30 }, day: { max: 100 } };
const ENDPOINT_KEY = 'ask-athena';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// buildRawInputs -- fetches the scan/brief/memory context every Capability
// and the Reasoning Engine read from. Best-effort throughout: a missing or
// unreadable piece degrades that piece to unavailable rather than failing
// the whole request (matches this codebase's honest-empty-state convention).
async function buildRawInputs(supabase, artistProfileId, conversationTurns) {
  const briefs = await listBriefs(supabase, artistProfileId, { limit: 2, full: true, order: 'desc' }).catch(() => []);
  const [latestBrief = null, previousBrief = null] = briefs;
  const briefCount = await countBriefs(supabase, artistProfileId).catch(() => 0);

  let scanPayload = null, previousScanPayload = null, schemaVersion = null, previousSchemaVersion = null;
  const scanIds = [latestBrief?.scan_id, previousBrief?.scan_id].filter(Boolean);
  if (scanIds.length > 0) {
    const { data: scanRows } = await supabase
      .from('audit_scans')
      .select('id, payload, schema_version')
      .in('id', scanIds);
    const byId = Object.fromEntries((scanRows || []).map(r => [r.id, r]));
    if (latestBrief?.scan_id && byId[latestBrief.scan_id]) {
      scanPayload = byId[latestBrief.scan_id].payload;
      schemaVersion = byId[latestBrief.scan_id].schema_version;
    }
    if (previousBrief?.scan_id && byId[previousBrief.scan_id]) {
      previousScanPayload = byId[previousBrief.scan_id].payload;
      previousSchemaVersion = byId[previousBrief.scan_id].schema_version;
    }
  }

  const memory = await buildExecutiveMemory(supabase, artistProfileId, { limit: 20 }).catch(() => null);

  return {
    artistProfileId,
    scanPayload, previousScanPayload, schemaVersion, previousSchemaVersion,
    latestBrief, previousBrief, briefCount,
    memoryItems: memory?.allItems || [],
    recurringIssues: memory?.recurringIssues || [],
    resolvedIssues: memory?.resolvedIssues || [],
    conversationTurns,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ip = extractIp(req);
  const blocked = await checkBlocked(ip);
  if (blocked.blocked) {
    return res.status(429).json({ error: 'Too many requests', reason: 'blocked' });
  }
  const rateResult = await checkRateLimit(ip, ENDPOINT_KEY, RATE_LIMITS);
  if (!rateResult.allowed) {
    await recordViolation(ip, ENDPOINT_KEY, rateResult.reason);
    return res.status(429).json({ error: 'Too many requests', reason: rateResult.reason, retryAfter: rateResult.retryAfter });
  }

  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = req.body || {};
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  const safety = validatePromptSafety(question);
  if (!safety.safe) {
    return res.status(400).json({ error: 'Question failed safety validation', reasons: safety.reasons });
  }

  try {
    // Conversation lifecycle -- resume an owned conversation, or start a new one.
    let conversationId = body.conversationId || null;
    if (conversationId) {
      const existing = await getConversation({ supabase, artistProfileId: user.id, conversationId });
      if (!existing.ok) conversationId = null; // not found/not owned -- start fresh rather than 404
    }
    if (!conversationId) {
      const started = await startConversation({ supabase, artistProfileId: user.id });
      conversationId = started.ok ? started.conversation.id : null;
    }

    const recentTurnsResult = conversationId
      ? await getRecentTurns({ supabase, artistProfileId: user.id, conversationId })
      : { ok: false, turns: [] };
    const conversationTurns = recentTurnsResult.turns.map(t => ({ role: t.role === 'athena' ? 'athena' : 'user', content: t.content }));

    const rawInputs = await buildRawInputs(supabase, user.id, conversationTurns);

    const { intent } = classifyIntent(question);
    const { category, domains } = classifyQuestion(question, intent);

    let responseContract = attemptDeterministicAnswer({ question, intent, category, rawInputs });

    if (!responseContract) {
      const built = buildExecutiveContext({ domains, rawInputs });
      const overallConfidence = deriveOverallConfidence(built.confidenceLevels);
      const attributed = attributeEvidence(built.evidence, { evidenceConfidence: overallConfidence });
      const assembled = assemblePrompt({ question, contextSections: built.sections, attributedEvidence: attributed });
      responseContract = await generateAnswer({
        assembledPrompt: assembled,
        meta: { questionCategory: category, questionIntent: intent },
        overallConfidence,
        citations: built.citations,
      });
    }

    // Persist turns -- best-effort, never blocks the response (the store's
    // own never-throws contract already guarantees this; conversationId
    // may be null if conversation start failed, in which case we simply
    // don't persist, degrading gracefully).
    if (conversationId) {
      await appendTurn({ supabase, artistProfileId: user.id, conversationId, role: 'user', content: question });
      await appendTurn({ supabase, artistProfileId: user.id, conversationId, role: 'athena', content: responseContract.answer, responseContract });
    }

    return res.status(200).json({ ...responseContract, conversationId });
  } catch (err) {
    console.error('[ask-athena] unexpected error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
