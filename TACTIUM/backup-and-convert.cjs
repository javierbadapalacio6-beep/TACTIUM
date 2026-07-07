// 1) Backup (solo lectura) del recurso completo de los 8 productos a ./play-backup/
// 2) Prueba convertRegionPrices(price EUR) para ver la conversión sin recargo.
const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const PKG = 'io.tactium.app';

const PRODUCTS = [
  'tactium_captain_monthly',
  'tactium_captain_yearly',
  'tactium_club_starter_monthly',
  'tactium_club_starter_yearly',
  'tactium_club_pro_monthly',
  'tactium_club_pro_yearly',
  'tactium_club_elite_monthly',
  'tactium_club_elite_yearly',
];

function money(eur) {
  const units = Math.trunc(eur);
  const nanos = Math.round((eur - units) * 1e9);
  return { currencyCode: 'EUR', units: String(units), nanos };
}

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const H = { Authorization: `Bearer ${token}` };

  // ── 1) Backup ──────────────────────────────────────────────────────────
  fs.mkdirSync('./play-backup', { recursive: true });
  for (const p of PRODUCTS) {
    const r = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${p}`,
      { headers: H },
    );
    const data = await r.json();
    fs.writeFileSync(`./play-backup/${p}.json`, JSON.stringify(data, null, 2));
    const bp = (data.basePlans || [])[0] || {};
    const es = (bp.regionalConfigs || []).find((x) => x.regionCode === 'ES');
    const esPrice = es ? `${es.price.units}.${String(es.price.nanos).padStart(9, '0').slice(0, 2)} ${es.price.currencyCode}` : '—';
    console.log(`backup ${p}  ES=${esPrice}  regions=${(bp.regionalConfigs || []).length}`);
  }

  // ── 2) convertRegionPrices con 47,99 EUR (prueba) ───────────────────────
  console.log('\n--- convertRegionPrices(47.99 EUR) ---');
  const cr = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/pricing:convertRegionPrices`,
    {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: money(47.99) }),
    },
  );
  const conv = await cr.json();
  if (conv.error) {
    console.log('convert ERROR:', JSON.stringify(conv.error).slice(0, 400));
    return;
  }
  const all = conv.convertedRegionPrices || {};
  const keys = Object.keys(all);
  console.log('regiones convertidas:', keys.length);
  for (const code of ['ES', 'AT', 'US', 'GB', 'MX', 'AR', 'BR']) {
    const v = all[code];
    if (v) {
      const pr = v.price;
      console.log(`  ${code}: ${pr.units}.${String(pr.nanos).padStart(9, '0').slice(0, 2)} ${pr.currencyCode}`);
    }
  }
  console.log('  OTHER:', JSON.stringify(conv.convertedOtherRegionsPrice));
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
