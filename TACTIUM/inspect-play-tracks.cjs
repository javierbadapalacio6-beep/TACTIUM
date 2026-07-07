// Inspecciona las pistas (tracks) de Play y qué versionCodes tienen.
// Crea un "edit" temporal SOLO para leer (no se hace commit → expira solo).
const { GoogleAuth } = require('google-auth-library');
const PKG = 'io.tactium.app';

(async () => {
  const auth = new GoogleAuth({
    keyFile: './google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const token = (await (await auth.getClient()).getAccessToken()).token;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;

  const er = await fetch(`${base}/edits`, { method: 'POST', headers: H, body: '{}' });
  const edit = await er.json();
  if (edit.error) { console.log('ERROR edit:', JSON.stringify(edit.error).slice(0, 300)); return; }
  const id = edit.id;

  const tr = await fetch(`${base}/edits/${id}/tracks`, { headers: H });
  const t = await tr.json();
  if (t.error) { console.log('ERROR tracks:', JSON.stringify(t.error).slice(0, 300)); return; }

  for (const tk of t.tracks || []) {
    console.log(`\n# track: ${tk.track}`);
    for (const rel of tk.releases || []) {
      console.log(`   release "${rel.name}" status=${rel.status} versionCodes=${(rel.versionCodes || []).join(',')}`);
    }
    if (!(tk.releases || []).length) console.log('   (sin releases)');
  }
  // No commit → el edit caduca solo, no cambia nada.
})().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
