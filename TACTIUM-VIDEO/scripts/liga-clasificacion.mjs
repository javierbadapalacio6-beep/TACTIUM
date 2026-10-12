// Datos reales para la cascada de la clasificación (src/reel/estilo/ClasificacionCascada.tsx).
//
//   node scripts/liga-clasificacion.mjs                      → lista los grupos de la liga 28074 (2026)
//   node scripts/liga-clasificacion.mjs 31249                → src/reel/datos/clasificacion-demo.json con ese grupo
//   node scripts/liga-clasificacion.mjs 31249 28942 mi.json  → otra liga y otro fichero de salida
//
// Lee fcp_clasificacion y fcp_grupos con la clave publicable de tactium-web (lectura pública).
// OJO: la liga 2026/27 (28942) aún no tiene clasificación hasta que se juegue la jornada 1; la 2026 (28074)
// sí. La posición 1 de la fase regular NO es la campeona de la liga (el playoff no está en los datos).
import fs from "node:fs";
import path from "node:path";

const [, , idGrupo, liga = "28074", salida = "src/reel/datos/clasificacion-demo.json"] = process.argv;
const env = fs.readFileSync(path.resolve("../tactium-web/.env.local"), "utf8");
const v = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1].trim().replace(/^"|"$/g, "");
const U = v("NEXT_PUBLIC_SUPABASE_URL"), K = v("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const get = async (q) => {
  const r = await fetch(`${U}/rest/v1/${q}`, { headers: { apikey: K, authorization: `Bearer ${K}` } });
  if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`);
  return r.json();
};

const grupos = await get(`fcp_grupos?id_liga=eq.${liga}&select=id_grupo,nombre,temporada&order=nombre`);
if (!idGrupo) {
  console.log(grupos.map((g) => `${g.id_grupo}\t${g.nombre}`).join("\n"));
  process.exit(0);
}
const g = grupos.find((x) => x.id_grupo === idGrupo);
if (!g) throw new Error(`No existe el grupo ${idGrupo} en la liga ${liga}`);
const filas = await get(`fcp_clasificacion?id_liga=eq.${liga}&id_grupo=eq.${idGrupo}&select=posicion,equipo,enf,puntos,sets_favor,sets_contra&order=posicion`);
if (!filas.length) throw new Error(`El grupo ${idGrupo} no tiene clasificación todavía`);
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ liga: `Liga Cántabra ${g.temporada}`, grupo: g.nombre, fuente: `fcp_clasificacion (liga ${liga}), consultado el ${new Date().toISOString().slice(0, 10)}`, filas }, null, 1));
console.log(g.nombre, "·", filas.length, "equipos →", salida);
