// Diagnóstico: ¿puede la service account de RevenueCat leer la Play Developer API?
// Pregunta directa a Google -> error real (401/403/404/API-disabled) sin el envoltorio de RC.
const { GoogleAuth } = require('google-auth-library');
const PKG = process.argv[2] || 'io.tactium.app';

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  console.log('Token OK (la SA autentica). Package probado:', PKG);

  async function hit(label, url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await r.text();
    console.log(`\n=== ${label} ===`);
    console.log('HTTP', r.status, r.statusText);
    console.log(body.slice(0, 1200));
  }

  // 1) listar suscripciones (nuevo modelo) — necesita permiso a la app
  await hit('subscriptions.list (v3)', `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions`);
  // 2) crear un edit — el ping clásico de RevenueCat; falla si faltan permisos de la app
  const r2 = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/edits`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
  });
  console.log('\n=== edits.insert (POST) — el check que usa RevenueCat ===');
  console.log('HTTP', r2.status, r2.statusText);
  console.log((await r2.text()).slice(0, 1200));
})().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
