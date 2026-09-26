// Consulta los grupos de suscripción de iOS (App Store Connect API) para
// verificar que los 8 productos están en UN único grupo (clave para que el
// free trial sea único por usuario en todos los planes).
const crypto = require('crypto');
const fs = require('fs');

const KEY_ID = 'VDW5XZ2YM6';
const ISSUER = '1946c360-e369-44c8-ac44-7b74fd432763';
const APP_ID = '6769825905';
const pem = fs.readFileSync('./AuthKey_VDW5XZ2YM6.p8', 'utf8');

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJWT() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ISSUER,
    iat: now,
    exp: now + 600,
    aud: 'appstoreconnect-v1',
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  // ES256 needs the signature in JOSE (raw r||s) format
  const der = signer.sign({ key: pem, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(der)}`;
}

(async () => {
  const token = makeJWT();
  const H = { Authorization: `Bearer ${token}` };

  // Grupos de suscripción de la app
  const gr = await fetch(
    `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/subscriptionGroups?limit=200&include=subscriptions`,
    { headers: H },
  );
  const g = await gr.json();
  if (g.errors) {
    console.log('ERROR:', JSON.stringify(g.errors).slice(0, 500));
    return;
  }
  const groups = g.data || [];
  console.log(`Grupos de suscripción: ${groups.length}`);

  // Mapa id->productId de los incluidos
  const subsById = {};
  for (const inc of g.included || []) {
    if (inc.type === 'subscriptions') {
      subsById[inc.id] = inc.attributes?.productId || inc.id;
    }
  }

  for (const grp of groups) {
    const name = grp.attributes?.referenceName || grp.id;
    const subRefs = grp.relationships?.subscriptions?.data || [];
    console.log(`\n• Grupo: "${name}"  (${subRefs.length} suscripciones)`);
    for (const s of subRefs) {
      console.log(`    - ${subsById[s.id] || s.id}`);
    }
  }
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
