// /api/royalty-statements — Royalty Statements™ metadata + audit API.
//
// File bytes are uploaded directly from the browser to Supabase Storage
// (bucket "royalty-statements", private, RLS-scoped to the caller's own
// auth.uid() folder — see supabase/migrations/20260718140000_royalty_statements.sql
// and .../20260719120000_royalty_statements_status_expansion.sql).
// This endpoint never receives file bytes — only metadata, and only after
// the client has already uploaded to Storage. It verifies the claimed
// object actually exists under the caller's own folder before trusting it,
// then writes the metadata row and an audit log entry using the service
// role (so the audit log can never be skipped or forged by the client).
//
// GET  /api/royalty-statements
//   List the caller's own *current* statements — status not 'replaced', not
//   soft-deleted. Superseded versions are fetched separately via the
//   "version_history" action, not mixed into the main archive list.
//
// POST /api/royalty-statements   { action, ... }
//   action: "register"        — { filePath, fileName, fileType, fileSizeBytes, sourceCategory, sourceName, reportingPeriod?, currency?, statementDate?, notes? }
//   action: "replace"         — { statementId, filePath, fileName, fileType, fileSizeBytes, ...same metadata fields }
//   action: "delete"          — { statementId }
//   action: "download"        — { statementId, intent? }  -> { url } (60s signed URL). intent: 'view' | 'download' (default 'download') — same signed-URL mechanism, different audit event and Content-Disposition.
//   action: "check_duplicate" — { sourceCategory, sourceName, reportingPeriod?, statementDate?, fileName?, fileSizeBytes? } -> { duplicates: [...] }. Metadata-only pre-flight check, run before the file upload.
//   action: "version_history" — { statementId } -> { versions: [...] }. Walks the replaces_statement_id chain back from the given statement.
//
// Every action requires Authorization: Bearer <user_access_token>.
//
// Constitutional note (Board brief, "Out of Scope"): this endpoint stores
// and retrieves statements only. No parsing, OCR, royalty calculation, or
// analysis of file contents happens here or anywhere in this Build Pass.
// `ai_readiness_state` is always 'not_processed' for statements created by
// this Build Pass — it is never read from the client, only ever set by the
// database default.

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'royalty-statements';
const SOURCE_CATEGORIES = new Set(['pro', 'publishing_admin', 'distributor', 'label', 'neighboring_rights', 'sync_agency']);
const FILE_TYPES = new Set(['pdf', 'csv', 'xlsx']);
const SIGNED_URL_TTL_SECONDS = 60;
const MAX_FILE_SIZE_BYTES = 26214400; // 25 MB — mirrors the Storage bucket's file_size_limit
const MAX_REPORTING_PERIOD_LENGTH = 60;

const LIST_SELECT = 'id, source_category, source_name, reporting_period, currency, statement_date, notes, file_name, file_type, file_size_bytes, status, ai_readiness_state, version, replaces_statement_id, created_at';
const VERSION_SELECT = 'id, version, status, created_at, file_name, file_size_bytes, replaces_statement_id, source_name, reporting_period';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidCurrencyCode(v) {
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v);
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
  if (Number.isFinite(body.fileSizeBytes) && body.fileSizeBytes > MAX_FILE_SIZE_BYTES) return 'File exceeds the 25 MB maximum';
  if (isNonEmptyString(body.currency) && !isValidCurrencyCode(body.currency.trim().toUpperCase())) return 'Currency must be a valid 3-letter ISO code';
  if (isNonEmptyString(body.reportingPeriod) && body.reportingPeriod.trim().length > MAX_REPORTING_PERIOD_LENGTH) return 'Reporting period is too long';
  return null;
}

// Walks the replaces_statement_id chain backward from `headId`, newest first.
async function getVersionChain(supabase, userId, headId) {
  const versions = [];
  let cursor = headId;
  let guard = 0;
  while (cursor && guard < 50) {
    guard++;
    const { data: row, error } = await supabase
      .from('royalty_statements')
      .select(VERSION_SELECT)
      .eq('id', cursor)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !row) break;
    versions.push(row);
    cursor = row.replaces_statement_id;
  }
  return versions;
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
      .select(LIST_SELECT)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'replaced')
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
        currency: isNonEmptyString(body.currency) ? body.currency.trim().toUpperCase() : null,
        statement_date: isNonEmptyString(body.statementDate) ? body.statementDate : null,
        notes: isNonEmptyString(body.notes) ? body.notes.trim() : null,
        file_path: body.filePath,
        file_name: body.fileName,
        file_type: body.fileType,
        file_size_bytes: Number.isFinite(body.fileSizeBytes) ? body.fileSizeBytes : null,
        status: 'uploaded',
        version,
        replaces_statement_id: replacesId,
        // ai_readiness_state intentionally omitted — the column default
        // ('not_processed') is the sole source of truth; never client-set.
      })
      .select('id')
      .single();

    if (insertErr) return res.status(500).json({ error: 'Save failed', detail: insertErr.message });

    await logAudit(supabase, {
      statementId: inserted.id, userId, action: action === 'replace' ? 'replace' : 'upload',
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
      .select('id, user_id, file_path, file_name')
      .eq('id', body.statementId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (rowErr || !row) return res.status(404).json({ error: 'Statement not found' });

    // View and Download share the same signed-URL mechanism — Download adds
    // a Content-Disposition hint via the `download` option, View omits it
    // so a PDF opens inline in the browser tab instead of saving to disk.
    const wantsInline = body.intent === 'view';
    const signOptions = wantsInline ? {} : { download: row.file_name };
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, SIGNED_URL_TTL_SECONDS, signOptions);
    if (signErr || !signed) return res.status(500).json({ error: 'Could not generate download link', detail: signErr?.message });

    await logAudit(supabase, { statementId: row.id, userId, action: wantsInline ? 'view' : 'download' });
    return res.status(200).json({ url: signed.signedUrl, expiresInSeconds: SIGNED_URL_TTL_SECONDS });
  }

  if (action === 'check_duplicate') {
    if (!SOURCE_CATEGORIES.has(body.sourceCategory) || !isNonEmptyString(body.sourceName)) {
      return res.status(400).json({ error: 'sourceCategory and sourceName are required' });
    }
    const { data, error } = await supabase
      .from('royalty_statements')
      .select('id, source_category, source_name, reporting_period, statement_date, file_name, file_size_bytes, version, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'replaced');
    if (error) return res.status(500).json({ error: 'Duplicate check failed', detail: error.message });

    const sourceName = body.sourceName.trim();
    const reportingPeriod = isNonEmptyString(body.reportingPeriod) ? body.reportingPeriod.trim() : null;
    const statementDate = isNonEmptyString(body.statementDate) ? body.statementDate : null;
    const fileName = isNonEmptyString(body.fileName) ? body.fileName : null;
    const fileSizeBytes = Number.isFinite(body.fileSizeBytes) ? body.fileSizeBytes : null;

    const duplicates = (data || []).filter(row => {
      const sameSource = row.source_category === body.sourceCategory && row.source_name === sourceName;
      const samePeriod = sameSource && reportingPeriod && row.reporting_period === reportingPeriod;
      const sameDate = sameSource && statementDate && row.statement_date === statementDate;
      const sameFile = fileName && row.file_name === fileName && fileSizeBytes !== null && row.file_size_bytes === fileSizeBytes;
      return samePeriod || sameDate || sameFile;
    });

    return res.status(200).json({ duplicates });
  }

  if (action === 'version_history') {
    if (!isNonEmptyString(body.statementId)) return res.status(400).json({ error: 'statementId is required' });
    const { data: head, error: headErr } = await supabase
      .from('royalty_statements')
      .select('id')
      .eq('id', body.statementId)
      .eq('user_id', userId)
      .single();
    if (headErr || !head) return res.status(404).json({ error: 'Statement not found' });

    const versions = await getVersionChain(supabase, userId, body.statementId);
    await logAudit(supabase, { statementId: body.statementId, userId, action: 'view_history' });
    return res.status(200).json({ versions });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
