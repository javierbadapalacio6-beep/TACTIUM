// Lee y cambia el precio de las suscripciones en App Store Connect.
//
// Hermano de `set-play-prices.cjs`, para el otro lado. Existe porque el precio
// que se cobra en la app lo fija la TIENDA, no `plans.ts`: el paywall pinta el
// offering de RevenueCat y `plans.ts` sólo se ve el segundo que tarda en cargar.
//
// Dependencias: `jsonwebtoken`. No está en package.json a propósito (esto no
// es código de la app): instálala suelta antes de usarlo, p. ej. en un
// directorio aparte y lanzando node con NODE_PATH apuntando a su node_modules.
//
// Uso:
//   node set-asc-prices.cjs list                       → qué hay hoy (no escribe)
//   node set-asc-prices.cjs points <productId> <eur>   → puntos de precio cercanos
//   node set-asc-prices.cjs set <productId> <eur>          → DRY-RUN
//   node set-asc-prices.cjs set <productId> <eur> --apply  → escribe
//
// Apple no acepta un importe libre: hay que elegir uno de sus «price points».
// Por eso `points` existe — si 49,99 no es un punto válido en España, te dice
// cuál es el más cercano por arriba y por abajo, y decides tú.
//
// El territorio base es España: se fija ahí y Apple deriva el resto de países
// por su tabla de equivalencias. `preserveCurrentPrice: true` deja a los
// suscriptores actuales en su precio viejo, que es lo que evita el flujo de
// «consentimiento de subida» de Apple y los correos a los clientes.
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Las credenciales salen de `eas.json`, que ya las tiene para `eas submit` y
// está fuera del control de versiones. Así este fichero puede vivir en git sin
// llevar dentro ni el issuer id ni la ruta de la clave.
const SUBMIT = JSON.parse(fs.readFileSync('./eas.json', 'utf8')).submit.production.ios;
const KEY_ID = SUBMIT.ascApiKeyId;
const ISSUER_ID = SUBMIT.ascApiKeyIssuerId;
const APP_ID = SUBMIT.ascAppId;
const KEY_PATH = SUBMIT.ascApiKeyPath;
const TERRITORY = 'ESP';
const API = 'https://api.appstoreconnect.apple.com';

function token() {
  const key = fs.readFileSync(KEY_PATH, 'utf8');
  return jwt.sign({}, key, {
    algorithm: 'ES256',
    expiresIn: '15m',
    issuer: ISSUER_ID,
    audience: 'appstoreconnect-v1',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}

const T = token();
const H = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(path.startsWith('http') ? path : `${API}${path}`, { headers: H });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 500));
  return j;
}

/** Recorre la paginación de Apple, que corta a 200 por página. */
async function getAll(path) {
  let out = [];
  let next = path;
  while (next) {
    const j = await get(next);
    out = out.concat(j.data || []);
    next = j.links && j.links.next ? j.links.next : null;
  }
  return out;
}

/** Todas las suscripciones de la app, con su grupo. */
async function subscriptions() {
  const groups = await getAll(`/v1/apps/${APP_ID}/subscriptionGroups?limit=200`);
  const out = [];
  for (const g of groups) {
    const subs = await getAll(`/v1/subscriptionGroups/${g.id}/subscriptions?limit=200`);
    for (const s of subs) out.push({ ...s, groupId: g.id });
  }
  return out;
}

/** Precio vigente en el territorio base, ya formateado. */
async function currentPrice(subId) {
  const j = await get(
    `/v1/subscriptions/${subId}/prices` +
      `?include=subscriptionPricePoint,territory&limit=200` +
      `&filter[territory]=${TERRITORY}`,
  );
  const pp = (j.included || []).filter((i) => i.type === 'subscriptionPricePoints');
  if (!pp.length) return null;
  return pp.map((p) => p.attributes.customerPrice).join(' / ');
}

async function pricePoints(subId) {
  return getAll(
    `/v1/subscriptions/${subId}/pricePoints?filter[territory]=${TERRITORY}&limit=200`,
  );
}

function eur(p) {
  return Number(p.attributes.customerPrice);
}

async function findSub(productId) {
  const subs = await subscriptions();
  const s = subs.find((x) => x.attributes.productId === productId);
  if (!s) {
    throw new Error(
      `No existe «${productId}». Los que hay:\n  ` +
        subs.map((x) => x.attributes.productId).join('\n  '),
    );
  }
  return s;
}

(async () => {
  const cmd = process.argv[2];
  const APPLY = process.argv.includes('--apply');

  if (cmd === 'list') {
    const subs = await subscriptions();
    console.log(`${subs.length} suscripciones en la app ${APP_ID}:\n`);
    for (const s of subs) {
      const price = await currentPrice(s.id).catch((e) => `error: ${e.message.slice(0, 60)}`);
      console.log(
        `  ${s.attributes.productId.padEnd(32)} ${String(s.attributes.name).padEnd(22)} ` +
          `${s.attributes.state.padEnd(22)} ES: ${price ?? '—'}`,
      );
    }
    return;
  }

  const productId = process.argv[3];
  const target = Number(process.argv[4]);

  if (cmd === 'points') {
    const s = await findSub(productId);
    const pts = (await pricePoints(s.id)).sort((a, b) => eur(a) - eur(b));
    const exact = pts.find((p) => eur(p) === target);
    console.log(`${productId}: ${pts.length} puntos de precio en ${TERRITORY}`);
    console.log(exact ? `\n  ${target} € es un punto VÁLIDO ✓\n` : `\n  ${target} € NO es punto válido.\n`);
    const near = pts.filter((p) => Math.abs(eur(p) - target) <= Math.max(3, target * 0.06));
    for (const p of near) {
      console.log(`  ${eur(p) === target ? '→' : ' '} ${String(eur(p)).padStart(8)} €  ${p.id}`);
    }
    return;
  }

  if (cmd !== 'set') {
    console.log('Usa: list | points <productId> <eur> | set <productId> <eur> [--apply]');
    process.exit(1);
  }

  const s = await findSub(productId);
  const before = await currentPrice(s.id);
  const pts = await pricePoints(s.id);
  const point = pts.find((p) => eur(p) === target);
  if (!point) {
    throw new Error(
      `${target} € no es un punto de precio válido. Mira los cercanos con:\n` +
        `  node set-asc-prices.cjs points ${productId} ${target}`,
    );
  }

  // Una suscripción ya APROBADA no admite «precio inicial» otra vez: Apple
  // devuelve 409 STATE_ERROR. Lo que acepta es un cambio de precio PROGRAMADO,
  // y eso se pide mandando `startDate`.
  //
  // Mañana NO vale: Apple pide dos días de margen (cuenta en su huso, no en el
  // tuyo, y rechaza con «must be on or after ...»). Por eso el defecto son 3
  // días, que aguanta el cambio de día en cualquier huso.
  const startArg = process.argv.find((a) => a.startsWith('--start='));
  const startDate =
    startArg
      ? startArg.slice('--start='.length)
      : new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  console.log(APPLY ? '== APLICANDO ==' : '== DRY-RUN (no escribe) ==');
  console.log(`  ${productId}`);
  console.log(`  ${TERRITORY}: ${before ?? '—'} → ${target} €`);
  console.log(`  punto de precio: ${point.id}`);
  console.log(`  en vigor desde: ${startDate}`);
  console.log(`  suscriptores actuales: se quedan en su precio (preserveCurrentPrice)`);
  if (!APPLY) return;

  const r = await fetch(`${API}/v1/subscriptionPrices`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      data: {
        type: 'subscriptionPrices',
        attributes: { preserveCurrentPrice: true, startDate },
        relationships: {
          subscription: { data: { type: 'subscriptions', id: s.id } },
          subscriptionPricePoint: {
            data: { type: 'subscriptionPricePoints', id: point.id },
          },
        },
      },
    }),
  });
  const out = await r.json();
  if (out.errors) {
    console.log(`  ERROR → ${JSON.stringify(out.errors).slice(0, 600)}`);
    process.exit(1);
  }
  console.log('  OK ✓  (Apple deriva el resto de territorios de la tabla de España)');
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
