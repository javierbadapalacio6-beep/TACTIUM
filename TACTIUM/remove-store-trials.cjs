// Quita la PRUEBA GRATIS de 14 días de las tiendas (Google Play + App Store),
// porque desde el build de octubre de 2026 la prueba es nuestra: empieza sola
// y SIN TARJETA al crear el primer equipo o club (start_subscription_trial).
// Sin esto, quien se suscribe al acabar nuestra prueba tendría otros 14 días.
//
// ⚠️ EJECUTAR EL MISMO DÍA QUE SE PUBLIQUE EL BUILD con la prueba sin tarjeta.
//    Antes, los usuarios de la versión vieja se quedarían sin ninguna prueba.
//
// Uso (desde TACTIUM/):
//   node remove-store-trials.cjs              → DRY-RUN (solo lista, no cambia nada)
//   node remove-store-trials.cjs --apply      → desactiva en Play y borra en Apple
//   node remove-store-trials.cjs --restore    → reactiva en Play y recrea en Apple
//                                               desde la copia store-trials-backup.json
//
// Play: la oferta `freetrial14` se DESACTIVA (no se borra) → reversible.
// Apple: las ofertas de introducción se BORRAN tras guardar copia en
// store-trials-backup.json (territorio, duración, modo) → --restore las recrea.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PKG = 'io.tactium.app';
const APP_ID = '6769825905';
const OFFER_ID = 'freetrial14';
const BACKUP = path.join(__dirname, 'store-trials-backup.json');
const PRODUCTS = [
  'tactium_captain_monthly', 'tactium_captain_yearly',
  'tactium_club_starter_monthly', 'tactium_club_starter_yearly',
  'tactium_club_pro_monthly', 'tactium_club_pro_yearly',
  'tactium_club_elite_monthly', 'tactium_club_elite_yearly',
];
const APPLY = process.argv.includes('--apply');
const RESTORE = process.argv.includes('--restore');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function playToken() {
  const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-service-account.json'), 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${body}.${sig}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Play auth: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

function ascToken() {
  const key = fs.readFileSync(path.join(__dirname, 'AuthKey_VDW5XZ2YM6.p8'), 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: 'VDW5XZ2YM6', typ: 'JWT' });
  const body = b64({ iss: '1946c360-e369-44c8-ac44-7b74fd432763', iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

async function play() {
  const H = { Authorization: `Bearer ${await playToken()}`, 'Content-Type': 'application/json' };
  const action = RESTORE ? 'activate' : 'deactivate';
  for (const p of PRODUCTS) {
    const bp = p.endsWith('monthly') ? 'monthly' : 'yearly';
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${p}/basePlans/${bp}/offers/${OFFER_ID}`;
    const cur = await (await fetch(url, { headers: H })).json();
    if (cur.error) { console.log(`  ${p}: ERROR ${cur.error.message}`); continue; }
    if (!APPLY && !RESTORE) { console.log(`  ${p}: ${OFFER_ID} está ${cur.state} → se ${action === 'deactivate' ? 'desactivaría' : 'activaría'}`); continue; }
    const r = await (await fetch(`${url}:${action}`, { method: 'POST', headers: H, body: JSON.stringify({ packageName: PKG, productId: p, basePlanId: bp, offerId: OFFER_ID }) })).json();
    console.log(`  ${p}: ${r.error ? 'ERROR ' + r.error.message : r.state}`);
  }
}

async function apple() {
  const H = { Authorization: `Bearer ${ascToken()}`, 'Content-Type': 'application/json' };
  const API = 'https://api.appstoreconnect.apple.com/v1';
  const get = async (u) => (await fetch(u.startsWith('http') ? u : API + u, { headers: H })).json();

  // Suscripciones de la app
  const subs = [];
  const groups = await get(`/apps/${APP_ID}/subscriptionGroups?limit=10`);
  for (const g of groups.data || []) {
    const s = await get(`/subscriptionGroups/${g.id}/subscriptions?limit=50`);
    for (const x of s.data || []) subs.push({ id: x.id, productId: x.attributes.productId });
  }

  if (RESTORE) {
    const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
    for (const s of subs) {
      const offers = backup[s.productId] || [];
      let ok = 0;
      for (const o of offers) {
        const r = await (await fetch(`${API}/subscriptionIntroductoryOffers`, {
          method: 'POST', headers: H,
          body: JSON.stringify({ data: { type: 'subscriptionIntroductoryOffers',
            attributes: { duration: o.duration, offerMode: o.offerMode, numberOfPeriods: o.numberOfPeriods },
            relationships: { subscription: { data: { type: 'subscriptions', id: s.id } },
                             territory: { data: { type: 'territories', id: o.territory } } } } }),
        })).json();
        if (!r.errors) ok++;
      }
      console.log(`  ${s.productId}: recreadas ${ok}/${offers.length}`);
    }
    return;
  }

  const backup = fs.existsSync(BACKUP) ? JSON.parse(fs.readFileSync(BACKUP, 'utf8')) : {};
  for (const s of subs) {
    const list = [];
    let url = `/subscriptions/${s.id}/introductoryOffers?limit=200&include=territory`;
    while (url) {
      const page = await get(url);
      for (const o of page.data || []) list.push({ id: o.id, ...o.attributes, territory: o.relationships?.territory?.data?.id });
      url = page.links?.next || null;
    }
    if (list.length && !backup[s.productId]) backup[s.productId] = list.map(({ id, ...rest }) => rest);
    if (!APPLY) { console.log(`  ${s.productId}: ${list.length} ofertas de introducción → se borrarían`); continue; }
    fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2)); // copia ANTES de borrar
    let ok = 0;
    for (const o of list) {
      const r = await fetch(`${API}/subscriptionIntroductoryOffers/${o.id}`, { method: 'DELETE', headers: H });
      if (r.status === 204) ok++;
    }
    console.log(`  ${s.productId}: borradas ${ok}/${list.length}`);
  }
}

(async () => {
  console.log(RESTORE ? '== RESTAURAR PRUEBAS ==' : APPLY ? '== QUITAR PRUEBAS (aplica) ==' : '== DRY-RUN (no cambia nada) ==');
  console.log('Google Play:'); await play();
  console.log('App Store:'); await apple();
})().catch((e) => { console.error(e); process.exit(1); });
