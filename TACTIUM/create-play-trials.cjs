// Crea (y activa) una oferta de PRUEBA GRATUITA de 14 días en cada producto
// de suscripción de Android.
//   · Fase: 14 días (P2W) gratis (free:true) en todas las regiones del plan.
//   · Elegibilidad: anySubscriptionInApp → solo para quien NUNCA ha tenido
//     ninguna suscripción en la app => 1 prueba por usuario para cualquier plan
//     (mismo anti-abuso que el grupo de suscripción de iOS).
//
// Uso:
//   node create-play-trials.cjs <productId|all>           → DRY-RUN
//   node create-play-trials.cjs <productId|all> --apply   → crea + activa
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';
const REGIONS_VERSION = '2025/03';
const OFFER_ID = 'freetrial14';
const TRIAL_DURATION = 'P2W'; // 14 días

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

const arg = process.argv[2];
const APPLY = process.argv.includes('--apply');

(async () => {
  if (!arg) {
    console.log('Uso: node create-play-trials.cjs <productId|all> [--apply]');
    process.exit(1);
  }
  const products = arg === 'all' ? PRODUCTS : [arg];

  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  console.log(APPLY ? '== CREANDO + ACTIVANDO OFERTAS ==' : '== DRY-RUN (no escribe) ==');

  for (const productId of products) {
    const bp = productId.endsWith('monthly') ? 'monthly' : 'yearly';

    // 1) Region codes del plan base (la oferta debe cubrir un subconjunto)
    const subR = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${productId}`,
      { headers: H },
    );
    const sub = await subR.json();
    if (sub.error) {
      console.log(`\n${productId}: ERROR get sub → ${JSON.stringify(sub.error).slice(0, 160)}`);
      continue;
    }
    const basePlan = (sub.basePlans || []).find((b) => b.basePlanId === bp);
    const regionCodes = (basePlan?.regionalConfigs || []).map((r) => r.regionCode);

    const offerBody = {
      packageName: PKG,
      productId,
      basePlanId: bp,
      offerId: OFFER_ID,
      // Elegibilidad: solo quien no ha tenido NINGUNA sub en la app.
      targeting: {
        acquisitionRule: { scope: { anySubscriptionInApp: {} } },
      },
      // Fase única: 14 días gratis en todas las regiones del plan.
      phases: [
        {
          duration: TRIAL_DURATION,
          recurrenceCount: 1,
          regionalConfigs: regionCodes.map((rc) => ({
            regionCode: rc,
            free: {},
          })),
        },
      ],
      // Disponibilidad de la oferta por región.
      regionalConfigs: regionCodes.map((rc) => ({
        regionCode: rc,
        newSubscriberAvailability: true,
      })),
      offerTags: [{ tag: 'freetrial' }],
    };

    console.log(
      `\n${productId} (plan ${bp}) → oferta '${OFFER_ID}' · 14 días gratis · ${regionCodes.length} regiones · elegibilidad=anySubscriptionInApp`,
    );

    if (!APPLY) continue;

    // 2) Crear (queda en DRAFT)
    const createUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${productId}/basePlans/${bp}/offers` +
      `?offerId=${OFFER_ID}&regionsVersion.version=${encodeURIComponent(REGIONS_VERSION)}`;
    const cr = await fetch(createUrl, {
      method: 'POST',
      headers: H,
      body: JSON.stringify(offerBody),
    });
    const created = await cr.json();
    if (created.error) {
      console.log(`  CREATE ERROR → ${JSON.stringify(created.error).slice(0, 400)}`);
      continue;
    }
    console.log(`  creada (state=${created.state})`);

    // 3) Activar
    const actUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions/${productId}/basePlans/${bp}/offers/${OFFER_ID}:activate`;
    const ar = await fetch(actUrl, { method: 'POST', headers: H, body: '{}' });
    const activated = await ar.json();
    if (activated.error) {
      console.log(`  ACTIVATE ERROR → ${JSON.stringify(activated.error).slice(0, 400)}`);
    } else {
      console.log(`  ACTIVA ✓ (state=${activated.state})`);
    }
  }
})().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
