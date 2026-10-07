// Exploración: descarga (o lee de caché) una página y la vuelca a un fichero.
//   node peek.mjs "/Torneo-Inscritos?id=30155" out.html
//   node peek.mjs /Torneos out.html ano=2026 tipo=Parejas categoria=Absoluto     (POST)
import fs from 'node:fs';
import { fetchPage, stats } from './lib/http.mjs';

const [pth, out, ...kv] = process.argv.slice(2);
const form = kv.length ? Object.fromEntries(kv.map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; })) : null;
const r = await fetchPage(pth, form);
if (out) fs.writeFileSync(out, r.html, 'latin1');
console.log(JSON.stringify({ status: r.status, finalPath: r.finalPath, len: r.html.length, fromCache: r.fromCache, net: stats.net }));
