// Reintenta la validación de compra hasta que el permiso financiero propague
// de forma ESTABLE (3 aciertos seguidos), porque Google propaga por réplicas
// y a mitad de camino unas llamadas dan 400 (OK) y otras 401 (aún no).
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';
const URL = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/purchases/subscriptionsv2/tokens/TOKEN_FALSO_123`;
const MAX = 40;          // hasta 40 intentos
const EVERY_MS = 20000;  // cada 20s -> ~13 min
const NEED_STREAK = 3;   // 3 OK consecutivos = estable

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = new GoogleAuth({ keyFile: './google-service-account.json', scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  let streak = 0;
  for (let i = 1; i <= MAX; i++) {
    const client = await auth.getClient();
    const token = (await client.getAccessToken()).token;
    let status;
    try {
      const r = await fetch(URL, { headers: { Authorization: `Bearer ${token}` } });
      status = r.status;
    } catch (e) { status = 'ERR ' + e.message; }
    const ok = status !== 401 && status !== 403 && typeof status === 'number';
    if (ok) {
      streak++;
      console.log(`[intento ${i}] HTTP ${status} OK (${streak}/${NEED_STREAK} seguidos)`);
      if (streak >= NEED_STREAK) {
        console.log(`\nPROPAGADO_ESTABLE`);
        return;
      }
    } else {
      if (streak > 0) console.log(`[intento ${i}] HTTP ${status} — racha rota, reinicio contador`);
      else console.log(`[intento ${i}] HTTP ${status} — aún sin permiso`);
      streak = 0;
    }
    if (i < MAX) await sleep(EVERY_MS);
  }
  console.log('\nAGOTADO_SIN_PROPAGAR');
})().catch((e) => { console.error('FALLO:', e.message); });
