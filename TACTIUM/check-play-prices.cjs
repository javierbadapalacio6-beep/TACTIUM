// Lista el precio de cada base plan (region ES) de las 8 suscripciones en Play.
const { GoogleAuth } = require('google-auth-library');
const PKG = process.argv[2] || 'io.tactium.app';

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;

  const r = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await r.json();
  if (!data.subscriptions) {
    console.log('Respuesta inesperada:', JSON.stringify(data).slice(0, 800));
    return;
  }
  for (const sub of data.subscriptions) {
    console.log(`\n# ${sub.productId}`);
    for (const bp of sub.basePlans || []) {
      const regions = bp.regionalConfigs || [];
      const es = regions.find((x) => x.regionCode === 'ES');
      const any = es || regions[0];
      let priceStr = '(sin precio)';
      if (any && any.price) {
        const units = Number(any.price.units || 0);
        const nanos = Number(any.price.nanos || 0);
        const val = units + nanos / 1e9;
        priceStr = `${val.toFixed(2)} ${any.price.currencyCode} (${
          any.regionCode
        })`;
      }
      console.log(`   basePlan=${bp.basePlanId} state=${bp.state} → ${priceStr}`);
    }
  }
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
