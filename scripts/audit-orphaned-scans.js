// Royaltē — orphaned audit_scans diagnostic
//
// READ-ONLY. Does not modify any data.
//
// Reports all audit_scans rows where user_id IS NULL and groups them by
// session_id. For each session_id, the operator can run migrate_anonymous_scans
// manually (via the Supabase SQL Editor) to claim those rows if the session_id
// is known to belong to a specific user.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-orphaned-scans.js
//
// Output: a table of orphaned rows and a list of SQL statements that can be
// reviewed and executed manually to restore ownership.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  // Fetch all orphaned rows
  const { data: rows, error } = await supabase
    .from('audit_scans')
    .select('id, artist_name, session_id, created_at, source_url')
    .is('user_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No orphaned audit_scans rows found. user_id is populated on all rows.');
    return;
  }

  console.log(`\nOrphaned audit_scans rows (user_id IS NULL): ${rows.length} total\n`);
  console.log('scan_id                              | artist_name           | session_id                           | created_at');
  console.log('─'.repeat(110));

  const bySession = {};
  for (const row of rows) {
    console.log(`${row.id} | ${(row.artist_name || '(unknown)').padEnd(21)} | ${(row.session_id || 'NULL').padEnd(36)} | ${row.created_at}`);
    if (row.session_id) {
      if (!bySession[row.session_id]) bySession[row.session_id] = [];
      bySession[row.session_id].push(row);
    }
  }

  const sessionIds = Object.keys(bySession);
  if (sessionIds.length === 0) {
    console.log('\nNo session_ids present. Ownership cannot be restored automatically.');
    return;
  }

  console.log(`\n${'─'.repeat(110)}`);
  console.log(`\n${sessionIds.length} unique session_id(s) found on orphaned rows.\n`);
  console.log('To restore ownership for a known session_id, run the following in the Supabase SQL Editor');
  console.log('(replace <user_uuid> with the authenticated user\'s id from auth.users):\n');

  for (const sid of sessionIds) {
    const artists = bySession[sid].map(r => r.artist_name || '(unknown)').join(', ');
    console.log(`-- session_id: ${sid}`);
    console.log(`-- scans: ${artists}`);
    console.log(`SELECT migrate_anonymous_scans('${sid}', '<user_uuid>'::uuid);\n`);
  }

  console.log('IMPORTANT: Verify each session_id belongs to the named user before executing.');
  console.log('The migrate_anonymous_scans RPC only updates rows where user_id IS NULL,');
  console.log('so it is safe to run — it will not overwrite existing ownership.\n');
}

run().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
