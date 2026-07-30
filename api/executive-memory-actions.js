// POST /api/executive-memory-actions
//
// Executive Memory™ write endpoint — ATHENA™ Phase 3C. Authenticated;
// thin wrapper over api/_lib/executive-memory-store.js, which owns every
// lifecycle rule (including Memory Promotion™). This endpoint only routes
// { action, ...fields } to the matching store function — it enforces
// nothing itself beyond auth and shape validation.
//
// Body: { action: 'create'|'confirm'|'correct'|'supersede'|'expire', ...fields }
// artistProfileId is never read from the request body — always the
// Bearer-authenticated caller's own auth.uid().

import { createClient } from '@supabase/supabase-js';
import {
  createMemoryItem, confirmMemoryItem, correctMemoryItem,
  supersedeMemoryItem, expireMemoryItem,
} from './_lib/executive-memory-store.js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const ACTIONS = Object.freeze({
  create: createMemoryItem,
  confirm: confirmMemoryItem,
  correct: correctMemoryItem,
  supersede: supersedeMemoryItem,
  expire: expireMemoryItem,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
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
  const action = body.action;
  const fn = ACTIONS[action];
  if (!fn) {
    return res.status(400).json({ error: `action must be one of: ${Object.keys(ACTIONS).join(', ')}` });
  }

  try {
    const result = await fn({ ...body, supabase, artistProfileId: user.id });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[executive-memory-actions] unexpected error:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
