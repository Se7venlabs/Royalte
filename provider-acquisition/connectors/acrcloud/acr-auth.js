// ACRCloud request signer — Phase 3.9 (ACRCloud)
//
// Generates the HMAC-SHA1 request signature required by ACRCloud's Identify API.
// https://docs.acrcloud.com/reference/identification-api
//
// Accepts credentials as parameters (injectable) — does NOT read env vars and
// does NOT log or return the access secret. Production callers read
// ACR_ACCESS_KEY / ACR_ACCESS_SECRET / ACR_HOST from their environment and
// pass them in. Tests inject mock credentials.
//
// Signature scheme (per ACRCloud reference docs):
//   string_to_sign = "{method}\n{uri}\n{accessKey}\n{dataType}\n{signatureVersion}\n{timestamp}"
//   signature      = base64( HMAC-SHA1(string_to_sign, accessSecret) )

import { createHmac } from 'node:crypto';

export const SIGNATURE_VERSION = '1';
const DEFAULT_METHOD = 'POST';
const DEFAULT_URI    = '/v1/identify';

/**
 * @param {{
 *   accessKey: string,
 *   accessSecret: string,
 *   dataType: 'audio'|'fingerprint',
 *   timestamp: string,
 *   method?: string,
 *   uri?: string,
 *   signatureVersion?: string,
 * }} params
 * @returns {string} base64-encoded HMAC-SHA1 signature
 */
export function generateAcrSignature({
  accessKey,
  accessSecret,
  dataType,
  timestamp,
  method           = DEFAULT_METHOD,
  uri              = DEFAULT_URI,
  signatureVersion = SIGNATURE_VERSION,
}) {
  if (!accessKey)    throw new TypeError('acr-auth: accessKey is required');
  if (!accessSecret) throw new TypeError('acr-auth: accessSecret is required');
  if (!dataType)     throw new TypeError('acr-auth: dataType is required');
  if (!timestamp)    throw new TypeError('acr-auth: timestamp is required');

  const stringToSign = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
  return createHmac('sha1', accessSecret).update(stringToSign, 'utf8').digest('base64');
}

/**
 * Builds the full set of signed form fields for one Identify API request.
 * Returns the fields only — never the accessSecret itself.
 *
 * @param {{ accessKey: string, accessSecret: string, dataType: 'audio'|'fingerprint' }} credentials
 * @returns {{ access_key: string, data_type: string, signature_version: string, signature: string, timestamp: string }}
 */
export function buildSignedFields({ accessKey, accessSecret, dataType }) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature  = generateAcrSignature({ accessKey, accessSecret, dataType, timestamp });

  return {
    access_key:        accessKey,
    data_type:          dataType,
    signature_version: SIGNATURE_VERSION,
    signature,
    timestamp,
  };
}
