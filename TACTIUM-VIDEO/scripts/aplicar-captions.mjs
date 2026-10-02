// Aplica carruseles/captions.json al calendario (caption con formato, sin CTA aparte) y a lo
// que ya está programado en la nube y aún no ha salido.
//   node scripts/aplicar-captions.mjs
import fs from "node:fs";
import path from "node:path";

const textos = JSON.parse(fs.readFileSync("carruseles/captions.json", "utf8"));
const cal = JSON.parse(fs.readFileSync("calendario.json", "utf8"));
let n = 0;
for (const p of cal.piezas) if (textos[p.id]) { p.caption = textos[p.id]; p.cta = ""; n++; }
fs.writeFileSync("calendario.json", JSON.stringify(cal, null, 2) + "\n");
console.log(`calendario: ${n} textos actualizados`);

const env = Object.fromEntries(fs.readFileSync("panel/.env", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" };
const filas = await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_publicaciones?estado=eq.programada&tipo=in.(reel,carrusel,post)&select=pieza`, { headers: h })).json();
for (const { pieza } of filas) {
  const p = cal.piezas.find((x) => x.id === pieza);
  if (!p || !textos[pieza]) continue;
  const caption = [p.caption, p.hashtags].filter(Boolean).join("\n\n");
  // Sin contenedor: se vuelve a crear con el texto nuevo cuando toque.
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/redes_publicaciones?pieza=eq.${pieza}&estado=eq.programada`, { method: "PATCH", headers: h, body: JSON.stringify({ caption, contenedor: null, hijos: null }) });
  console.log(`nube: ${pieza} ${r.ok ? "actualizado" : r.status}`);
}
