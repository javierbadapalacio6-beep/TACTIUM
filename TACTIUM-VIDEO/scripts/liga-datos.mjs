// Datos de la Liga Cántabra 2026/27 para el contenido (grupos, plantillas y puntos FCP).
// Lee con la clave publicable de tactium-web (las tablas fcp_* tienen lectura pública).
//
//   node scripts/liga-datos.mjs   → carruseles/datos/liga-2627.json
import fs from "node:fs";
import path from "node:path";

const LIGA = 28942;
const envWeb = fs.readFileSync(path.resolve("../tactium-web/.env.local"), "utf8");
const v = (k) => envWeb.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1].trim().replace(/^"|"$/g, "");
const URL_ = v("NEXT_PUBLIC_SUPABASE_URL"), KEY = v("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

async function todo(tabla, query) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${tabla}?${query}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, range: `${desde}-${desde + 999}` } });
    if (!r.ok) throw new Error(`${tabla}: ${r.status} ${await r.text()}`);
    const t = await r.json(); filas.push(...t);
    if (t.length < 1000) return filas;
  }
}

const equipos = await todo("fcp_inscripciones", `id_liga=eq.${LIGA}&select=id_equipo,equipo,genero,grupo_nombre,subgrupo,sede_corta,sede&order=grupo_nombre,subgrupo,equipo`);
const jugadores = await todo("fcp_jugadores", `id_liga=eq.${LIGA}&select=id_jugador,id_equipo,puntos`);
const porEquipo = new Map();
for (const j of jugadores) { if (!porEquipo.has(j.id_equipo)) porEquipo.set(j.id_equipo, []); porEquipo.get(j.id_equipo).push(j.puntos || 0); }
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const e of equipos) {
  const pts = (porEquipo.get(e.id_equipo) || []).sort((a, b) => b - a);
  e.jugadores = pts.length;
  e.fuerza = Math.round(media(pts.slice(0, 10))); // media de los 10 mejores: lo que juega de verdad (5 parejas)
}
const salida = { liga: LIGA, temporada: "2026/27", generado: new Date().toISOString(), equipos,
  jugadoresDistintos: new Set(jugadores.map((j) => j.id_jugador)).size };
fs.mkdirSync("carruseles/datos", { recursive: true });
fs.writeFileSync("carruseles/datos/liga-2627.json", JSON.stringify(salida, null, 1));
console.log(equipos.length, "equipos ·", salida.jugadoresDistintos, "jugadores");
