// Descarga a TACTIUM-VIDEO/bruto/ (cara/, pantalla/, broll/) los vídeos que Javier ha mandado al bot de Telegram,
// con el nombre de archivo de su guion (A1 → A1-federaciones.mp4, las siguientes -toma2…).
//   node panel/descargar-brutos.mjs           → todos los que no se han descargado
//   node panel/descargar-brutos.mjs A1 T1     → solo esos códigos
import fs from "node:fs";
import path from "node:path";
import * as grabaciones from "./grabaciones.mjs";

const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const DESTINO = path.resolve(import.meta.dirname, "..", "bruto", "cara");
const solo = process.argv.slice(2).map((x) => x.toUpperCase());

const filas = await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_brutos?descargado=eq.false&pieza=not.is.null&select=*&order=pieza,toma`, { headers: h })).json();
const sinCodigo = await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_brutos?pieza=is.null&select=id`, { headers: h })).json();
fs.mkdirSync(DESTINO, { recursive: true });

let n = 0;
for (const b of filas) {
  if (solo.length && !solo.includes(b.pieza.toUpperCase())) continue;
  // Tomas a cámara → bruto/cara/<archivo del guion>; pantallas → bruto/pantalla/; clips de juego → bruto/broll/.
  const ext = path.extname(b.ruta) || ".mp4";
  let carpeta = DESTINO, nombre;
  if (/\.(oga|ogg|opus|mp3|m4a|wav)$/i.test(b.ruta)) {
    // Notas de voz: frases que faltan, se montan como voz en off.
    carpeta = path.join(DESTINO, "..", "voz");
    nombre = `${b.pieza}-voz${b.toma > 1 ? `-${b.toma}` : ""}${ext}`;
  } else if (b.pieza === "BROLL") {
    carpeta = path.join(DESTINO, "..", "broll");
    nombre = `juego-${String(b.toma).padStart(2, "0")}${ext}`;
  } else if (b.pieza.endsWith("-pantalla")) {
    carpeta = path.join(DESTINO, "..", "pantalla");
    nombre = `${b.pieza}${b.toma > 1 ? `-toma${b.toma}` : ""}${ext}`;
  } else {
    const base = (grabaciones.guion(b.pieza)?.archivo || `${b.pieza}.mp4`).replace(/\.mp4$/, "");
    nombre = `${base}${b.toma > 1 ? `-toma${b.toma}` : ""}${ext}`;
  }
  fs.mkdirSync(carpeta, { recursive: true });
  // Nunca pisar un vídeo ya descargado (dos tomas con el mismo número, o clips de otro envío).
  // Los clips de juego se numeran seguidos: el siguiente número libre de la carpeta.
  for (let i = 2, k = b.toma + 1; fs.existsSync(path.join(carpeta, nombre)); i++, k++) {
    nombre = b.pieza === "BROLL"
      ? `juego-${String(k).padStart(2, "0")}${ext}`
      : nombre.replace(/(-v\d+)?(\.[^.]+)$/, `-v${i}$2`);
  }
  const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/redes-brutos/${b.ruta}`, { headers: h });
  if (!r.ok) { console.log("FALLO", b.pieza, b.toma, r.status); continue; }
  fs.writeFileSync(path.join(carpeta, nombre), Buffer.from(await r.arrayBuffer()));
  await fetch(`${env.SUPABASE_URL}/rest/v1/redes_brutos?id=eq.${b.id}`, { method: "PATCH", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ descargado: true }) });
  console.log(`${b.pieza} toma ${b.toma} → bruto/${path.basename(carpeta)}/${nombre} (${(b.tamano / 1048576).toFixed(1)} MB${b.duracion ? `, ${b.duracion} s` : ""})`);
  n++;
}
console.log(n ? `${n} vídeo${n > 1 ? "s" : ""} descargado${n > 1 ? "s" : ""}.` : "No hay vídeos nuevos.");
if (sinCodigo.length) console.log(`Hay ${sinCodigo.length} vídeo(s) sin código: responde en Telegram al vídeo con su código (A1, T1…).`);
