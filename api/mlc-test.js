// Royalte MLC connectivity probe — /api/mlc-test
//
// Phase 1 of the intelligence-wiring sprint. Sole objective: prove Royaltē
// can authenticate against the MLC Public Search API and receive valid
// musical-work JSON.
//
//   no normalization · no business logic · no DB write · no UI consumer
//
// ─── Implemented strictly from the official MLC OpenAPI specification ───
//   Spec UI:   https://public-api.themlc.com/api/doc
//   Base URL:  https://public-api.themlc.com/
//
// Two-step documented auth flow:
//
//   Step 1.  POST /oauth/token
//              body  { "username": "...", "password": "..." }
//              or    { "refreshToken": "..." }
//              ←     { "accessToken", "idToken", "refreshToken",
//                      "tokenType", "expiresIn" }
//
//   Step 2.  POST /search/songcode
//              header  Authorization: Bearer <accessToken from step 1>
//              body    { "title": "<title>" }
//              ←       [ { iswc, mlcSongCode, workTitle, writers[…] }, … ]
//
// `MLC_API_KEY` (the original env var) is NOT a bearer token — the bearer
// JWT is obtained at runtime via the /oauth/token exchange. The CEO must
// configure ONE of the credential sets below in Vercel env:
//
//   Preferred (initial login):
//     MLC_USERNAME    the MLC-issued username (or email)
//     MLC_PASSWORD    the MLC-issued password
//
//   Alternate (refresh flow, after a username/password login was done
//   manually once and the refresh token was captured):
//     MLC_REFRESH_TOKEN
//
//   Optional:
//     MLC_API_URL     override the documented base URL (rare)
//
// Optional query-string overrides for follow-up probes:
//   ?title=<song title>    — default "Shape of You" (returns Ed Sheeran
//                             in the writers array; use ?title=Retrograde
//                             for James Blake)
//   ?bearer=id|access      — which JWT from /oauth/token to send as the
//                             Authorization: Bearer ... value on the
//                             search call. Default 'id' (idToken). The
//                             OpenAPI spec returns BOTH accessToken and
//                             idToken without stating which to use; the
//                             response shape matches AWS Cognito + API
//                             Gateway, where authorizers almost always
//                             validate the idToken. Empirical: 'access'
//                             returned HTTP 401 from /search/songcode
//                             with a valid /oauth/token exchange, so the
//                             default flipped to 'id'.
//
// Security: this endpoint never echoes the password, refresh token,
// access token, or id token in its response. On the token-exchange
// failure path it surfaces only MLC's `message` / `error` text and a
// truncated raw-body fallback. On success it surfaces only `tokenType`
// and `expiresIn` — the JWT itself stays server-side.

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const TOKEN_PATH           = '/oauth/token';
const SEARCH_PATH          = '/search/songcode';
const DEFAULT_TITLE        = 'Shape of You';

export default async function handler(req, res) {
  const username     = process.env.MLC_USERNAME;
  const password     = process.env.MLC_PASSWORD;
  const refreshToken = process.env.MLC_REFRESH_TOKEN;

  const hasPasswordCreds = !!(username && password);
  const hasRefreshToken  = !!refreshToken;

  if (!hasPasswordCreds && !hasRefreshToken) {
    return res.status(500).json({
      ok: false,
      stage: 'config',
      error: 'mlc_credentials_missing',
      need: 'Either (MLC_USERNAME + MLC_PASSWORD) or MLC_REFRESH_TOKEN must be set in Vercel env so POST /oauth/token can be called per the documented MLC auth flow.',
      have: {
        MLC_USERNAME:      !!username,
        MLC_PASSWORD:      !!password,
        MLC_REFRESH_TOKEN: !!refreshToken,
      },
    });
  }

  const baseUrl        = (process.env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');
  const tokenEndpoint  = `${baseUrl}${TOKEN_PATH}`;
  const searchEndpoint = `${baseUrl}${SEARCH_PATH}`;
  const title          = (req.query.title || DEFAULT_TITLE).toString();

  // Prefer password creds when both are available (matches the spec's
  // "initial login" intent); fall back to refresh-token mode otherwise.
  const tokenBody = hasPasswordCreds
    ? { username, password }
    : { refreshToken };
  const tokenMode = hasPasswordCreds ? 'username+password' : 'refreshToken';

  // ─── Step 1 — exchange credentials for an access-token JWT ─────────
  let tokenResp;
  try {
    tokenResp = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Royalte/1.0 (mlc-test)',
      },
      body: JSON.stringify(tokenBody),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      stage: 'token_exchange_transport',
      error: 'fetch_failed',
      message: e?.message || String(e),
      tokenEndpoint,
      tokenMode,
    });
  }

  const tokenText = await tokenResp.text();
  let tokenJson;
  try { tokenJson = JSON.parse(tokenText); } catch { tokenJson = null; }

  if (!tokenResp.ok) {
    // MLC failure shape (confirmed empirically against the docs):
    //   { error: "invalid_grant" | "Bad Request" | …,
    //     errorDescription: "Wrong email or password" | "Missing
    //                        username or password" | …,
    //     accessToken: null, refreshToken: null, idToken: null,
    //     scope: null, expiresIn: null, tokenType: null }
    return res.status(200).json({
      ok: false,
      stage: 'token_exchange',
      tokenEndpoint,
      tokenMode,
      tokenStatus:           tokenResp.status,
      tokenStatusText:       tokenResp.statusText,
      tokenError:            tokenJson?.error            ?? null,
      tokenErrorDescription: tokenJson?.errorDescription ?? null,
      tokenMessage:          tokenJson?.message          ?? null,
      tokenRawText:          tokenJson ? null : tokenText.slice(0, 500),
    });
  }

  const bearerChoice = (req.query.bearer || 'id').toString().toLowerCase();
  const bearerField  = bearerChoice === 'access' ? 'accessToken' : 'idToken';
  const bearer       = tokenJson?.[bearerField];
  if (!bearer || typeof bearer !== 'string') {
    return res.status(200).json({
      ok: false,
      stage: 'token_extract',
      error: `no_${bearerField}_in_response`,
      tokenEndpoint,
      tokenMode,
      bearerField,
      tokenResponseKeys:
        tokenJson && typeof tokenJson === 'object' ? Object.keys(tokenJson) : null,
    });
  }

  // ─── Step 2 — call the authenticated search endpoint with the JWT ──
  // Body shape per the OpenAPI SearchWork schema. Even though neither
  // `title` nor `writers` is in a required[] array, MLC's API Gateway
  // request validator rejected `{ title }` alone with an empty 400.
  // Sending writers as an empty array (or populated via ?writers=ed
  // for a known Ed Sheeran probe) usually satisfies AWS API Gateway
  // schema validators that demand all declared properties be present.
  // Research-phase query builder — supports arbitrary writer/title combos
  // for strategy validation. Never reaches production mlc-client.js.
  //   ?writers=ed            → [{ writerFirstName:'Ed', writerLastName:'Sheeran' }]
  //   ?writers=empty         → [] (returns 400 — documented failure mode)
  //   ?writers=omit          → field omitted entirely (returns 400 — documented)
  //   ?writerFirst=X&writerLast=Y → [{ writerFirstName:X, writerLastName:Y }]
  //   ?writerLast=Y          → [{ writerLastName:Y }] (last-name-only probe)
  //   ?writerFirst=X         → [{ writerFirstName:X }] (first-name-only probe)
  //   ?omitTitle=1           → omit title field (writer-only search)
  const writerFirst  = req.query.writerFirst  ? String(req.query.writerFirst).trim()  : null;
  const writerLast   = req.query.writerLast   ? String(req.query.writerLast).trim()   : null;
  const omitTitle    = req.query.omitTitle === '1';
  const writersChoice = (req.query.writers || 'empty').toString().toLowerCase();

  let writers;
  if (writerFirst !== null || writerLast !== null) {
    const entry = {};
    if (writerFirst) entry.writerFirstName = writerFirst;
    if (writerLast)  entry.writerLastName  = writerLast;
    writers = [entry];
  } else {
    switch (writersChoice) {
      case 'ed':
        writers = [{ writerFirstName: 'Ed', writerLastName: 'Sheeran' }];
        break;
      case 'omit':
        writers = undefined;
        break;
      case 'empty':
      default:
        writers = [];
    }
  }

  let searchBody;
  if (omitTitle) {
    searchBody = writers === undefined ? {} : { writers };
  } else {
    searchBody = writers === undefined ? { title } : { title, writers };
  }

  let searchResp;
  try {
    searchResp = await fetch(searchEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Royalte/1.0 (mlc-test)',
      },
      body: JSON.stringify(searchBody),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      stage: 'search_transport',
      error: 'fetch_failed',
      message: e?.message || String(e),
      searchEndpoint,
      bearerField,
    });
  }

  const searchText = await searchResp.text();
  let searchBodyParsed = searchText;
  try { searchBodyParsed = JSON.parse(searchText); } catch { /* keep as text */ }

  return res.status(200).json({
    ok: searchResp.ok,
    tokenExchange: {
      endpoint:  tokenEndpoint,
      mode:      tokenMode,
      status:    tokenResp.status,
      tokenType: tokenJson?.tokenType ?? null,
      expiresIn: tokenJson?.expiresIn ?? null,
      // accessToken / idToken / refreshToken are intentionally never echoed
    },
    search: {
      endpoint:    searchEndpoint,
      method:      'POST',
      bearerField,
      requestBody: searchBody,
      status:      searchResp.status,
      statusText:  searchResp.statusText,
      contentType: searchResp.headers.get('content-type'),
      body:        searchBodyParsed,
    },
  });
}
