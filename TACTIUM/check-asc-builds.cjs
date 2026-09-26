// Lista los builds recientes en App Store Connect (para ver si el 1.0(11)
// ya está subido / procesando tras el "error" del submit).
const crypto = require('crypto');
const fs = require('fs');

const KEY_ID = 'VDW5XZ2YM6';
const ISSUER = '1946c360-e369-44c8-ac44-7b74fd432763';
const APP_ID = '6769825905';
const pem = fs.readFileSync('./AuthKey_VDW5XZ2YM6.p8', 'utf8');

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function makeJWT() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const der = crypto.createSign('SHA256').update(signingInput)
    .sign({ key: pem, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(der)}`;
}

(async () => {
  const token = makeJWT();
  const r = await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&sort=-version&limit=8&fields[builds]=version,processingState,uploadedDate,expired`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const j = await r.json();
  if (j.errors) { console.log('ERROR:', JSON.stringify(j.errors).slice(0, 500)); return; }
  for (const b of j.data || []) {
    const a = b.attributes || {};
    console.log(`build ${a.version}  state=${a.processingState}  expired=${a.expired}  uploaded=${a.uploadedDate}`);
  }
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
