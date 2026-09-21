// Fija el precio EUR (final, IVA incluido) de cada producto en TODAS las
// regiones de moneda EUR (33 países UE), dejándolo PLANO e idéntico a España.
// Las regiones no-EUR no se tocan (conservan su precio local de Google).
//
// Dependencias: `google-auth-library`, fuera de package.json (ver la nota en
// set-asc-prices.cjs).
//
// Uso:
//   node set-play-prices.cjs <productId|all>           → DRY-RUN (no escribe)
//   node set-play-prices.cjs <productId|all> --apply   → aplica el PATCH
//
// Requiere que la service account tenga permiso de EDICIÓN en Play Console.
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';
const REGIONS_VERSION = '2025/03';

// Precio EUR final (con IVA incluido) por producto.
const TARGET_EUR = {
  tactium_captain_monthly: 4.99,
  tactium_captain_yearly: 47.99,
  tactium_club_starter_monthly: 11.99,
  tactium_club_starter_yearly: 115.99,
  tactium_club_pro_monthly: 24.99,
  tactium_club_pro_yearly: 239.99,
  tactium_club_elite_monthly: 49.99,
  tactium_club_elite_yearly: 479.99,
};

const arg = process.argv[2];
const APPLY = process.argv.includes('--apply');

function money(eur) {
  const units = Math.trunc(eur);
  const nanos = Math.round((eur - units) * 1e9);
  return { currencyCode: 'EUR', units: String(units), nanos };
}
function fmt(p) {
  return p ? `${p.units}.${String(p.nanos).padStart(9, '0').slice(0, 2)} ${p.currencyCode}` : '—';
}

(async () => {
  if (!arg) {
    console.log('Falta producto. Usa: node set-play-prices.cjs <productId|all> [--apply]');
    process.exit(1);
  }
  const products =
    arg === 'all' ? Object.keys(TARGET_EUR) : [arg];

  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log(APPLY ? '== APLICANDO CAMBIOS ==' : '== DRY-RUN (no escribe) ==');

  for (const productId of products) {
    const target = TARGET_EUR[productId];
    if (target == null) {
      console.log(`\n${productId}: SIN target definido, salto.`);
      continue;
    }
    const getR = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${productId}`,
      { headers: H },
    );
    const sub = await getR.json();
    if (sub.error) {
      console.log(`\n${productId}: ERROR get → ${JSON.stringify(sub.error).slice(0, 200)}`);
      continue;
    }

    let changed = 0;
    for (const bp of sub.basePlans || []) {
      for (const rc of bp.regionalConfigs || []) {
        if (rc.price && rc.price.currencyCode === 'EUR') {
          const before = fmt(rc.price);
          rc.price = money(target);
          if (before !== fmt(rc.price)) changed++;
        }
      }
      if (bp.otherRegionsConfig && bp.otherRegionsConfig.eurPrice) {
        bp.otherRegionsConfig.eurPrice = money(target);
      }
    }

    const esAfter = fmt(
      (sub.basePlans[0].regionalConfigs.find((r) => r.regionCode === 'ES') || {}).price,
    );
    console.log(
      `\n${productId} → target ${target} EUR | regiones EUR ajustadas: ${changed} | ES queda: ${esAfter}`,
    );

    if (!APPLY) continue;

    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${productId}` +
      `?updateMask=basePlans&regionsVersion.version=${encodeURIComponent(REGIONS_VERSION)}` +
      `&latencyTolerance=PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_SENSITIVE`;
    const patchR = await fetch(url, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(sub),
    });
    const out = await patchR.json();
    if (out.error) {
      console.log(`  PATCH ERROR → ${JSON.stringify(out.error).slice(0, 400)}`);
    } else {
      console.log(`  PATCH OK ✓`);
    }
  }
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
