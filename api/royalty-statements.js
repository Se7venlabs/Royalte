// /api/royalty-statements — Royalty Statements™ metadata + audit API.
//
// File bytes are uploaded directly from the browser to Supabase Storage
// (bucket "royalty-statements", private, RLS-scoped to the caller's own
// auth.uid() folder — see supabase/migrations/20260718140000_royalty_statements.sql).
// This endpoint never receives file bytes — only metadata, and only after
// the client has already uploaded to Storage. It verifies the claimed
// object actually exists under the caller's own folder before trusting it,
// then writes the metadata row and an audit log entry using the service
// role (so the audit log can never be skipped or forged by the client).
//
// GET  /api/royalty-statements
//   List the caller's own active (non-deleted) statements.
//
// POST /api/royalty-statements   { action, ... }
//   action: "register"  — { filePath, fileName, fileType, fileSizeBytes, sourceCategory, sourceName, reportingPeriod?, currency?, statementDate?, notes? }
//   action: "replace"   — { statementId, filePath, fileName, fileType, fileSizeBytes, ...same metadata fields }
//   action: "delete"    — { statementId }
//   action: "download"  — { statementId }  -> { url } (60s signed URL)
//
// Every action requires Authorization: Bearer <user_access_token>.
//
// Constitutional note (Board brief, "Out of Scope"): this endpoint stores
// and retrieves statements only. No parsing, OCR, royalty calculation, or
// analysis of file contents happens here or anywhere in this Build Pass.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'royalty-statements';
const SOURCE_CATEGORIES = new Set(['pro', 'publishing_admin', 'distributor', 'label', 'neighboring_rights', 'sync_agency']);
const FILE_TYPES = new Set(['pdf', 'csv', 'xlsx']);
const SIGNED_URL_TTL_SECONDS = 60;

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

async function authenticate(req, supabase) {
  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return { error: 401, message: 'Authorization required' };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: 401, message: 'Invalid or expired session' };
  return { user };
}

// Verifies the claimed storage object actually exists under the caller's
// own folder — never trust a client-supplied path without checking.
async function verifyOwnedObjectExists(supabase, userId, filePath) {
  if (!isNonEmptyString(filePath)) return false;
  const [folder, ...rest] = filePath.split('/');
  if (folder !== userId || rest.length === 0) return false; // must live under the caller's own folder
  const objectName = rest.join('/');
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { search: objectName });
  if (error) return false;
  return Array.isArray(data) && data.some(f => f.name === objectName);
}

async function logAudit(supabase, { statementId, userId, action, detail }) {
  const { error } = await supabase.from('royalty_statement_audit_log').insert({
    statement_id: statementId || null,
    user_id: userId,
    action,
    detail: detail || null,
  });
  if (error) console.error('[royalty-statements] audit log write failed (non-blocking):', error.message);
}

function validateMetadata(body) {
  if (!SOURCE_CATEGORIES.has(body.sourceCategory)) return 'Invalid sourceCategory';
  if (!isNonEmptyString(body.sourceName)) return 'sourceName is required';
  if (!isNonEmptyString(body.filePath)) return 'filePath is required';
  if (!isNonEmptyString(body.fileName)) return 'fileName is required';
  if (!FILE_TYPES.has(body.fileType)) return 'Invalid fileType';
  return null;
}

export default async function handler(req, res) {
  const supabase = getAdminClient();
  if (!supabase) return res.status(500).json({ error: 'Server configuration error' });

  const auth = await authenticate(req, supabase);
  if (auth.error) return res.status(auth.error).json({ error: auth.message });
  const userId = auth.user.id;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('royalty_statements')
      .select('id, source_category, source_name, reporting_period, currency, statement_date, notes, file_name, file_type, file_size_bytes, status, version, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'List failed', detail: error.message });
    return res.status(200).json({ statements: data });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const action = body.action;

  if (action === 'register' || action === 'replace') {
    const err = validateMetadata(body);
    if (err) return res.status(400).json({ error: err });

    const exists = await verifyOwnedObjectExists(supabase, userId, body.filePath);
    if (!exists) return res.status(400).json({ error: 'Uploaded file not found at the claimed path' });

    let replacesId = null;
    let version = 1;

    if (action === 'replace') {
      if (!isNonEmptyString(body.statementId)) return res.status(400).json({ error: 'statementId is required for replace' });
      const { data: prior, error: priorErr } = await supabase
        .from('royalty_statements')
        .select('id, user_id, version')
        .eq('id', body.statementId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();
      if (priorErr || !prior) return res.status(404).json({ error: 'Statement not found' });

      const { error: markErr } = await supabase
        .from('royalty_statements')
        .update({ status: 'replaced' })
        .eq('id', prior.id)
        .eq('user_id', userId);
      if (markErr) return res.status(500).json({ error: 'Replace failed', detail: markErr.message });

      replacesId = prior.id;
      version = (prior.version || 1) + 1;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('royalty_statements')
      .insert({
        user_id: userId,
        source_category: body.sourceCategory,
        source_name: body.sourceName.trim(),
        reporting_period: isNonEmptyString(body.reportingPeriod) ? body.reportingPeriod.trim() : null,
        currency: isNonEmptyString(body.currency) ? body.currency.trim() : null,
        statement_date: isNonEmptyString(body.statementDate) ? body.statementDate : null,
        notes: isNonEmptyString(body.notes) ? body.notes.trim() : null,
        file_path: body.filePath,
        file_name: body.fileName,
        file_type: body.fileType,
        file_size_bytes: Number.isFinite(body.fileSizeBytes) ? body.fileSizeBytes : null,
        status: 'active',
        version,
        replaces_statement_id: replacesId,
      })
      .select('id')
      .single();

    if (insertErr) return res.status(500).json({ error: 'Save failed', detail: insertErr.message });

    await logAudit(supabase, {
      statementId: inserted.id, userId, action,
      detail: { filePath: body.filePath, replacesStatementId: replacesId },
    });

    return res.status(200).json({ ok: true, statementId: inserted.id });
  }

  if (action === 'delete') {
    if (!isNonEmptyString(body.statementId)) return res.status(400).json({ error: 'statementId is required' });
    const { data: row, error: rowErr } = await supabase
      .from('royalty_statements')
      .select('id, user_id')
      .eq('id', body.statementId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (rowErr || !row) return res.status(404).json({ error: 'Statement not found' });

    // Soft delete only — the storage object is intentionally left in place
    // for audit/recovery purposes, per "maintain version history where practical".
    const { error: delErr } = await supabase
      .from('royalty_statements')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('user_id', userId);
    if (delErr) return res.status(500).json({ error: 'Delete failed', detail: delErr.message });

    await logAudit(supabase, { statementId: row.id, userId, action: 'delete' });
    return res.status(200).json({ ok: true });
  }

  if (action === 'download') {
    if (!isNonEmptyString(body.statementId)) return res.status(400).json({ error: 'statementId is required' });
    const { data: row, error: rowErr } = await supabase
      .from('royalty_statements')
      .select('id, user_id, file_path')
      .eq('id', body.statementId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (rowErr || !row) return res.status(404).json({ error: 'Statement not found' });

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed) return res.status(500).json({ error: 'Could not generate download link', detail: signErr?.message });

    await logAudit(supabase, { statementId: row.id, userId, action: 'download' });
    return res.status(200).json({ url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
