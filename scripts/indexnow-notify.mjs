#!/usr/bin/env node
// Usage: node scripts/indexnow-notify.mjs <url1> <url2> ...
// Posts URLs to IndexNow API. Reads INDEXNOW_KEY from env.

import process from 'node:process';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const HOST = 'royalte.ai';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

async function main() {
  if (!INDEXNOW_KEY) {
    console.error('[indexnow] FAILED: INDEXNOW_KEY env var not set');
    process.exit(1);
  }

  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.log('[indexnow] No URLs to submit; exiting cleanly');
    process.exit(0);
  }

  console.log(`[indexnow] Submitting ${urls.length} URL(s) to IndexNow`);
  urls.forEach(url => console.log(`  - ${url}`));

  const body = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[indexnow] FAILED: fetch error — ${err.message}`);
    process.exit(1);
  }

  const status = response.status;
  const statusText = response.statusText;

  console.log(`[indexnow] HTTP status: ${status} ${statusText}`);

  if (status === 200 || status === 202) {
    console.log(`[indexnow] SUCCESS: IndexNow accepted ${urls.length} URL(s)`);
    process.exit(0);
  }

  const errText = await response.text().catch(() => '<unreadable>');
  console.error(`[indexnow] FAILED: unexpected status ${status}`);
  console.error(`[indexnow] body: ${errText.slice(0, 500)}`);
  process.exit(1);
}

main();
