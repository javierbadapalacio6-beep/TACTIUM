// Promueve el versionCode 11 (1.0.2, ya subido en interna) a la pista ALPHA
// (= prueba cerrada) de Google Play. No recompila ni resube el AAB:
// crea un edit, asigna vc11 a alpha con notas y commitea.
//
// OJO: commitear a una pista cerrada dispara la REVISIÓN de Google.
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';
const VERSION_CODE = '11';
const TRACK = 'alpha';
const NOTES =
  'Notificaciones push: avisos de nueva jornada y de alineación publicada, ' +
  'más recordatorios para confirmar tu disponibilidad y para que el capitán ' +
  'prepare la alineación. Mejoras de interfaz y correcciones.';

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;

  // 1) edit
  const er = await fetch(`${base}/edits`, { method: 'POST', headers: H, body: '{}' });
  const edit = await er.json();
  if (edit.error) { console.log('ERROR edit:', JSON.stringify(edit.error)); return; }
  const id = edit.id;

  // 2) asignar vc11 a la pista cerrada
  const trackBody = {
    track: TRACK,
    releases: [
      {
        name: '1.0.2 (11)',
        status: 'completed',
        versionCodes: [VERSION_CODE],
        releaseNotes: [{ language: 'es-ES', text: NOTES }],
      },
    ],
  };
  const ur = await fetch(`${base}/edits/${id}/tracks/${TRACK}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify(trackBody),
  });
  const upd = await ur.json();
  if (upd.error) { console.log('ERROR track update:', JSON.stringify(upd.error)); return; }
  console.log('track alpha actualizado:', JSON.stringify(upd.releases?.[0]));

  // 3) commit (envía a revisión de Google)
  const cr = await fetch(`${base}/edits/${id}:commit`, { method: 'POST', headers: H, body: '{}' });
  const com = await cr.json();
  if (com.error) { console.log('ERROR commit:', JSON.stringify(com.error)); return; }
  console.log('COMMIT OK · edit', com.id);
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
