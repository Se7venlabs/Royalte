// Magic-link callback handler.
//
// Supabase redirects here after the user clicks the magic link in their
// email. The session token arrives in the URL hash (#access_token=...),
// which is client-side only — the server cannot read it. So this endpoint
// serves a small HTML page that runs the auth + migration logic in the
// browser:
//   1. supabase-js (detectSessionInUrl) exchanges the hash for a session
//   2. if the user's metadata carries a session_id, call the
//      migrate_anonymous_scans RPC to claim their anonymous scan
//   3. play the cinematic initialization sequence (5-step checkmark
//      progression), then redirect to /dashboard.html
//
// On any auth/session failure the sequence does not run — the page shows a
// "Verification failed" error state instead.

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Initializing Royaltē OS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#03030a; --text:#e8e4f4; --muted:#8480a8;
    --pur:#8a5cff; --pnk:#e040c8; --grn:#40f0a0; --red:#f05060;
  }
  *{box-sizing:border-box;}
  body{
    background:var(--bg); color:var(--text);
    font-family:'Space Grotesk',system-ui,sans-serif;
    display:flex; align-items:center; justify-content:center;
    min-height:100vh; margin:0; text-align:center; padding:24px;
  }
  .box{ max-width:420px; }
  .brand{
    font-family:'Rajdhani',sans-serif; font-weight:700;
    font-size:15px; letter-spacing:0.34em; text-transform:uppercase;
    background:linear-gradient(135deg,var(--pur),var(--pnk));
    -webkit-background-clip:text; background-clip:text;
    -webkit-text-fill-color:transparent;
    margin-bottom:24px;
  }
  h1{
    font-family:'Rajdhani',sans-serif; font-weight:700;
    font-size:28px; letter-spacing:0.06em; text-transform:uppercase;
    margin:0; line-height:1.15;
  }
  .steps{
    list-style:none; margin:30px 0 0; padding:0;
    display:inline-block; text-align:left;
  }
  .step{
    display:flex; align-items:center; gap:12px;
    font-family:'Space Mono',monospace; font-size:13px; letter-spacing:0.03em;
    color:var(--muted); margin:12px 0;
    opacity:0.55; transition:opacity 0.3s ease, color 0.3s ease;
  }
  .step-marker{
    width:18px; height:18px; flex-shrink:0;
    border:1.5px solid var(--muted); border-radius:3px;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; line-height:1; color:#fff;
    transition:border-color 0.3s ease, background 0.3s ease;
  }
  .step.active{ opacity:1; }
  .step.active .step-marker{
    border-color:var(--pur);
    animation:markerPulse 1s ease-in-out infinite;
  }
  .step.done{ opacity:1; color:var(--text); }
  .step.done .step-marker{
    border-color:transparent;
    background:linear-gradient(135deg,var(--pur),var(--pnk));
  }
  @keyframes markerPulse{
    0%,100%{ box-shadow:0 0 0 0 rgba(138,92,255,0.45); }
    50%{ box-shadow:0 0 0 6px rgba(138,92,255,0); }
  }
  .err{ color:var(--red); font-size:14px; line-height:1.6; margin:20px 0 0; }
  [hidden]{ display:none !important; }
</style>
</head>
<body>
<div class="box">
  <div class="brand">Royaltē OS</div>
  <h1 id="headline">Initializing Royaltē OS</h1>
  <ul class="steps" id="steps">
    <li class="step" data-step="0"><span class="step-marker"></span><span>Artist profile mapped</span></li>
    <li class="step" data-step="1"><span class="step-marker"></span><span>Platform coverage analyzed</span></li>
    <li class="step" data-step="2"><span class="step-marker"></span><span>Backend risk baseline generated</span></li>
    <li class="step" data-step="3"><span class="step-marker"></span><span>Revenue-risk profile created</span></li>
    <li class="step" data-step="4"><span class="step-marker"></span><span>Catalog visibility initialized</span></li>
  </ul>
  <p class="err" id="error" hidden></p>
</div>
<script type="module">
import { getSupabase } from '/js/supabase-client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const headline = document.getElementById('headline');
  const stepsEl = document.getElementById('steps');
  const errorEl = document.getElementById('error');

  function fail(msg) {
    stepsEl.hidden = true;
    headline.textContent = 'Verification failed';
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  // Init flow — auth, anonymous-scan migration, the cinematic sequence, and
  // the dashboard redirect. Wrapped in a function so it can be raced against
  // the watchdog below.
  async function runInit() {
    const supabase = getSupabase();
    if (!supabase) {
      fail('Auth client unavailable. Please request a new link from the homepage.');
      return;
    }

    // detectSessionInUrl (set in createClient) consumes the hash on load.
    // Give it a tick to settle, then read the session.
    await sleep(150);

    let session = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (e) {
      console.error('[auth/callback] getSession error', e);
    }

    if (!session) {
      fail('Your secure link could not be verified. Please request a new one from the homepage.');
      return;
    }

    // Claim the anonymous scan via the server-side endpoint (service role required).
    // session_id arrives on the redirect URL query param, or falls back to the
    // session_id embedded in user_metadata at signup. Non-fatal.
    const sessionId =
      new URLSearchParams(window.location.search).get('session_id') ||
      session.user?.user_metadata?.session_id;
    if (sessionId && session.access_token) {
      try {
        const claimRes = await fetch('/api/claim-scan', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + session.access_token,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (!claimRes.ok) {
          const claimErr = await claimRes.json().catch(() => ({}));
          console.error('[auth/callback] claim-scan failed:', claimErr);
        }
      } catch (e) {
        console.error('[auth/callback] claim exception', e);
      }
    }

    // Cinematic initialization sequence — each step holds active for 600ms,
    // then completes. ~4s total from load to dashboard redirect; deliberately
    // brief — users coming back from email want momentum.
    const steps = Array.from(stepsEl.querySelectorAll('.step'));
    for (const step of steps) {
      step.classList.add('active');
      await sleep(600);
      step.classList.remove('active');
      step.classList.add('done');
      step.querySelector('.step-marker').textContent = '✓';
    }

    await sleep(600);
    // Boot Mission Control. If the Vault activation flow stored a pending scan_id
    // (email confirmation path), pass it so MC loads the exact claimed scan.
    // Returning users (magic link) with no pending scan boot to the latest owned scan.
    let _bootDest = '/mission-control.html?boot=1';
    try {
      const _pendingScanId = localStorage.getItem('royalte_pending_scan_id');
      if (_pendingScanId) {
        localStorage.removeItem('royalte_pending_scan_id');
        _bootDest = '/mission-control.html?boot=1&scanId=' + encodeURIComponent(_pendingScanId);
      }
    } catch (_lsErr) { /* localStorage blocked — MC loads latest owned scan */ }
    window.location.href = _bootDest;
  }

  // 10s watchdog — a stalled getSession() or migrate RPC must never strand the
  // user on an infinite loading screen. Race the init flow against a timeout;
  // whichever settles first wins. On timeout, surface an actionable error.
  let timedOut = false;
  await Promise.race([
    runInit(),
    sleep(10000).then(() => { timedOut = true; }),
  ]);
  if (timedOut) {
    fail('Verification timed out — please refresh and try again.');
  }
})();
</script>
</body>
</html>`);
}
