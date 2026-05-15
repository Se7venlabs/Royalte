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
//   3. show a static "Welcome to Royaltē OS" holding page — no redirect
//
// Chunk 3 evolves this same handler into the cinematic initialization
// sequence (checkmark boot). The route stays; only the page body changes.

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Welcome to Royaltē OS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#03030a; --text:#e8e4f4; --muted:#b0abd0;
    --pur:#8a5cff; --pnk:#e040c8; --red:#f05060;
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
    margin-bottom:28px;
  }
  h1{
    font-family:'Rajdhani',sans-serif; font-weight:700;
    font-size:30px; letter-spacing:0.06em; text-transform:uppercase;
    margin:0 0 12px; line-height:1.15;
  }
  p{ font-size:14px; color:var(--muted); margin:0; line-height:1.6; }
  .err{ color:var(--red); }
  .spinner{
    width:26px; height:26px; margin:0 auto 22px;
    border:2px solid rgba(138,92,255,0.25);
    border-top-color:var(--pur); border-radius:50%;
    animation:spin 0.8s linear infinite;
  }
  .spinner.hidden{ display:none; }
  @keyframes spin{ to{ transform:rotate(360deg); } }
</style>
</head>
<body>
<div class="box">
  <div class="brand">Royaltē OS</div>
  <div class="spinner" id="spinner"></div>
  <h1 id="headline">Signing you in</h1>
  <p id="status">Verifying your secure link…</p>
</div>
<script type="module">
import { getSupabase } from '/js/supabase-client.js';

(async () => {
  const spinner = document.getElementById('spinner');
  const headline = document.getElementById('headline');
  const status = document.getElementById('status');

  function fail(msg) {
    spinner.classList.add('hidden');
    headline.textContent = 'Something went wrong';
    status.textContent = msg;
    status.className = 'err';
  }

  const supabase = getSupabase();
  if (!supabase) {
    fail('Auth client unavailable. Please request a new link from the homepage.');
    return;
  }

  // detectSessionInUrl (set in createClient) consumes the hash on load.
  // Give it a tick to settle, then read the session.
  await new Promise(r => setTimeout(r, 150));

  let session = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    session = data.session;
  } catch (e) {
    console.error('[auth/callback] getSession error', e);
  }

  if (!session) {
    fail('Verification failed. Please request a new link from the homepage.');
    return;
  }

  // Claim the anonymous scan if signInWithOtp stashed a session_id in the
  // user's metadata. Non-fatal: sign-in succeeds regardless — the scan just
  // doesn't migrate this round.
  const sessionId = session.user?.user_metadata?.session_id;
  if (sessionId) {
    try {
      const { error: rpcErr } = await supabase.rpc('migrate_anonymous_scans', {
        p_session_id: sessionId,
        p_user_id: session.user.id,
      });
      if (rpcErr) console.error('[auth/callback] migrate_anonymous_scans error', rpcErr);
    } catch (e) {
      console.error('[auth/callback] migrate exception', e);
    }
  }

  spinner.classList.add('hidden');
  headline.textContent = 'Welcome to Royaltē OS';
  status.textContent = 'Your account is ready — your audit workspace is initializing.';
})();
</script>
</body>
</html>`);
}
