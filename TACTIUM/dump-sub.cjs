// Vuelca el recurso COMPLETO de una suscripción (solo lectura) para entender
// la estructura de basePlans/regionalConfigs antes de escribir precios.
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';
const PRODUCT = process.argv[2] || 'tactium_captain_yearly';

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;

  const r = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${PRODUCT}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await r.json();
  // Resumen legible + nº de regiones
  const bp = (data.basePlans || [])[0] || {};
  const regs = bp.regionalConfigs || [];
  console.log('productId:', data.productId);
  console.log('basePlanId:', bp.basePlanId, 'state:', bp.state);
  console.log('regionalConfigs count:', regs.length);
  const es = regs.find((x) => x.regionCode === 'ES');
  console.log('ES config:', JSON.stringify(es, null, 2));
  console.log('--- sample non-ES (first 2) ---');
  console.log(JSON.stringify(regs.slice(0, 2), null, 2));
  console.log('--- otherRegionsConfig ---');
  console.log(JSON.stringify(bp.otherRegionsConfig, null, 2));
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
