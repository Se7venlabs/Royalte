// Password-reset page.
//
// Supabase redirects here after the user clicks the reset link in their
// email. The recovery token arrives in the URL hash (#access_token=...&
// type=recovery), which is client-side only — the server cannot read it. So
// this endpoint serves a small HTML page that runs the reset logic in the
// browser:
//   1. supabase-js (detectSessionInUrl) consumes the hash into a session
//   2. the page confirms it is specifically a recovery session
//   3. the user sets a new password via supabase.auth.updateUser({ password })
//   4. on success it redirects to /dashboard.html (the user is now signed in)
//
// Same hardening as /auth/callback: vendored supabase-js (no third-party CDN
// import), a 10s watchdog so a stalled init never leaves an infinite spinner,
// and calm error states on every failure path.

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Set a New Password — Royaltē OS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@400;500&family=Space+Mono&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#03030a; --text:#e8e4f4; --muted:#8480a8;
    --pur:#8a5cff; --pnk:#e040c8; --grn:#40f0a0; --red:#f05060;
    --border2:rgba(138,92,255,0.25);
  }
  *{box-sizing:border-box;}
  body{
    background:var(--bg); color:var(--text);
    font-family:'Space Grotesk',system-ui,sans-serif;
    display:flex; align-items:center; justify-content:center;
    min-height:100vh; margin:0; text-align:center; padding:24px;
  }
  .box{ max-width:420px; width:100%; }
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
  .intro{ color:var(--muted); font-size:13px; line-height:1.6; margin:14px 0 0; }
  form{ margin:26px 0 0; text-align:left; }
  label{
    display:block; font-family:'Space Mono',monospace;
    font-size:10px; font-weight:700; letter-spacing:0.14em;
    text-transform:uppercase; color:var(--muted); margin:14px 0 6px;
  }
  input{
    width:100%; padding:11px 13px; background:#0a0818; color:var(--text);
    border:1px solid var(--border2); border-radius:6px;
    font-family:'Space Grotesk',sans-serif; font-size:14px;
  }
  input:focus{ outline:none; border-color:var(--pur); }
  .hint{
    font-family:'Space Mono',monospace; font-size:10px;
    letter-spacing:0.04em; color:var(--muted); margin:10px 0 0;
  }
  .btn{
    width:100%; margin-top:18px; padding:12px;
    background:linear-gradient(135deg,var(--pur),var(--pnk));
    color:#fff; border:none; border-radius:6px; cursor:pointer;
    font-family:'Space Grotesk',sans-serif; font-size:13px;
    font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
    transition:opacity 0.2s;
  }
  .btn:disabled{ opacity:0.55; cursor:default; }
  .form-err{ color:var(--red); font-size:12.5px; line-height:1.5; margin:12px 0 0; }
  .err{ color:var(--red); font-size:14px; line-height:1.6; margin:20px 0 0; }
  .err a{ color:var(--pur); }
  .success{ color:var(--grn); font-size:15px; line-height:1.6; margin:22px 0 0; }
  .loading{
    font-family:'Space Mono',monospace; font-size:12px;
    letter-spacing:0.06em; color:var(--muted); margin:22px 0 0;
  }
  [hidden]{ display:none !important; }
</style>
</head>
<body>
<div class="box">
  <div class="brand">Royaltē OS</div>
  <h1 id="headline">Set a New Password</h1>

  <p class="loading" id="loading">Verifying your reset link…</p>

  <form id="reset-form" hidden novalidate>
    <p class="intro">Enter a new password for your Royaltē OS account.</p>
    <label for="new-password">New password</label>
    <input type="password" id="new-password" autocomplete="new-password" required>
    <label for="confirm-password">Confirm password</label>
    <input type="password" id="confirm-password" autocomplete="new-password" required>
    <p class="hint">Minimum 8 characters</p>
    <p class="form-err" id="form-err" hidden></p>
    <button type="submit" class="btn" id="save-btn">Save Password</button>
  </form>

  <p class="success" id="success" hidden>Password updated — taking you to your dashboard…</p>
  <p class="err" id="error" hidden></p>
</div>
<script type="module">
import { getSupabase } from '/js/supabase-client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Capture the hash BEFORE getSupabase() runs — supabase-js detectSessionInUrl
// strips the fragment once it consumes it, so type=recovery must be read first.
const initialHash = window.location.hash || '';

(async () => {
  const headline = document.getElementById('headline');
  const loadingEl = document.getElementById('loading');
  const formEl    = document.getElementById('reset-form');
  const errorEl   = document.getElementById('error');
  const successEl = document.getElementById('success');
  const formErr   = document.getElementById('form-err');
  const pwInput   = document.getElementById('new-password');
  const confirmInput = document.getElementById('confirm-password');
  const saveBtn   = document.getElementById('save-btn');

  function fail(msg) {
    loadingEl.hidden = true;
    formEl.hidden = true;
    headline.textContent = 'Reset link problem';
    errorEl.innerHTML = msg + ' <a href="/">Return to royalte.ai</a>';
    errorEl.hidden = false;
  }

  function showFormError(msg) {
    formErr.textContent = msg;
    formErr.hidden = false;
  }

  async function runInit() {
    const supabase = getSupabase();
    if (!supabase) {
      fail('Auth client unavailable. Please request a new password reset.');
      return;
    }

    // detectSessionInUrl consumes the recovery hash on load — give it a tick.
    await sleep(150);

    let session = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (e) {
      console.error('[reset-password] getSession error', e);
    }

    if (!session) {
      fail('Your password reset link is invalid or expired. Please request a new one.');
      return;
    }
    if (!initialHash.includes('type=recovery')) {
      fail('This link is not a password reset link. Please request a password reset from the Royaltē OS sign-in.');
      return;
    }

    // Recovery session confirmed — reveal the form.
    loadingEl.hidden = true;
    formEl.hidden = false;
    pwInput.focus();

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      formErr.hidden = true;
      const newPassword = pwInput.value;
      const confirmPassword = confirmInput.value;

      if (newPassword.length < 8) {
        showFormError('Password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        showFormError('Passwords do not match.');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) {
          showFormError(updateError.message || 'Could not save password. Please try again.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Password';
          return;
        }
        formEl.hidden = true;
        successEl.hidden = false;
        await sleep(1500);
        window.location.href = '/dashboard.html';
      } catch (err) {
        console.error('[reset-password] updateUser threw', err);
        showFormError('Something went wrong. Please try again.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Password';
      }
    });
  }

  // 10s watchdog — a stalled getSession()/init must never leave the user on an
  // infinite "Verifying…" spinner. Race init against a timeout.
  let timedOut = false;
  await Promise.race([
    runInit(),
    sleep(10000).then(() => { timedOut = true; }),
  ]);
  if (timedOut) {
    fail('Password reset is taking longer than expected. Please refresh and try again.');
  }
})();
</script>
</body>
</html>`);
}
