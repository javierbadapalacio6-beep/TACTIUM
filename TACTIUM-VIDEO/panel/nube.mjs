// Publicación automática en la nube (Supabase). El panel local prepara cada pieza
// (convierte y sube sus archivos al bucket público «redes» y deja la fila en
// `redes_publicaciones`); la función `redes-publicar`, llamada por un cron, la publica
// en Instagram a su hora y avisa por Telegram. Aquí también se lee el estado y los avisos.
//
// Necesita en panel/.env: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import * as calendario from "./calendario.mjs";
import * as grabaciones from "./grabaciones.mjs";

const ENV_PATH = path.join(import.meta.dirname, ".env");
const ROOT = path.resolve(import.meta.dirname, "..");
const RENDERS = path.join(ROOT, "renders");
const SALIDA = path.join(RENDERS, "para-publicar");

function env() {
  const v = {};
  for (const l of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) v[m[1]] = m[2].trim(); }
  return v;
}
export const configurada = () => { const e = env(); return !!(e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY); };

async function rest(ruta, { metodo = "GET", cuerpo, prefer } = {}) {
  const e = env();
  const r = await fetch(`${e.SUPABASE_URL}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: e.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json", ...(prefer ? { prefer } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

async function subir(local, destino, tipo) {
  const e = env();
  const r = await fetch(`${e.SUPABASE_URL}/storage/v1/object/redes/${destino}`, {
    method: "POST",
    headers: { authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": tipo, "x-upsert": "true", "cache-control": "300" },
    body: fs.readFileSync(local),
  });
  if (!r.ok) throw new Error(`No se pudo subir ${path.basename(local)}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return destino;
}

const ffmpeg = (args) => new Promise((ok, mal) => {
  const p = spawn("ffmpeg", ["-v", "error", "-y", ...args]);
  let err = ""; p.stderr.on("data", (d) => (err += d));
  p.on("close", (c) => (c === 0 ? ok() : mal(new Error(`ffmpeg: ${err.slice(0, 200)}`))));
});
const masNuevo = (a, b) => fs.existsSync(a) && fs.statSync(a).mtimeMs >= fs.statSync(b).mtimeMs;

/**
 * Los archivos tal y como los quiere Instagram: los reels en su versión 16:9 (así lo
 * pidió Javier) con audio AAC a 128 kbps; las imágenes, en JPEG (no admite PNG).
 */
async function prepararArchivos(p) {
  fs.mkdirSync(SALIDA, { recursive: true });
  const g = p.generar;
  if (!g) throw new Error("Esta pieza todavía no tiene archivos generados");
  if (p.tipo === "reel") {
    // Por defecto se publica el 16:9; `generar.formato: "9x16"` publica la versión vertical
    // (reels hechos solo con clips verticales: ocupan la pantalla entera).
    const fmt = g.formato === "9x16" ? "9x16" : "16x9";
    const master = path.join(RENDERS, `${g.id}-${fmt}.mp4`);
    if (!fs.existsSync(master)) throw new Error(`Falta el vídeo ${fmt.replace("x", ":")} (${g.id}-${fmt}.mp4): genéralo desde la ficha`);
    const listo = path.join(SALIDA, `${g.id}-${fmt}-ig.mp4`);
    if (!masNuevo(listo, master)) {
      await ffmpeg(["-i", master, "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30",
        "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", listo]);
    }
    const archivos = [{ local: listo, destino: `${p.id}/${path.basename(listo)}`, tipo: "video/mp4" }];
    // Portada propia (renders/portadas/<pieza>.jpg, composición `portada-<pieza>`): va como
    // segundo archivo y la función la manda como `cover_url`. Sin ella, Instagram usa el segundo 1.
    const portada = path.join(RENDERS, "portadas", `${p.id}.jpg`);
    if (fs.existsSync(portada)) archivos.push({ local: portada, destino: `${p.id}/portada-${p.id}.jpg`, tipo: "image/jpeg" });
    return archivos;
  }
  const dir = path.join(RENDERS, "carruseles", g.id);
  const pngs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort() : [];
  if (!pngs.length) throw new Error("No hay imágenes generadas para esta pieza");
  const salida = [];
  for (const f of pngs) {
    const png = path.join(dir, f);
    const jpg = path.join(SALIDA, `${g.id}-${f.replace(".png", ".jpg")}`);
    if (!masNuevo(jpg, png)) await ffmpeg(["-i", png, "-q:v", "2", jpg]);
    salida.push({ local: jpg, destino: `${p.id}/${path.basename(jpg)}`, tipo: "image/jpeg" });
  }
  return p.tipo === "carrusel" ? salida.slice(0, 10) : salida.slice(0, 1);
}

/** Hora de Madrid → instante UTC, respetando el cambio de hora. */
export function madridAUtc(fecha, hora) {
  const [y, m, d] = fecha.split("-").map(Number);
  const [H, M] = hora.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, H, M);
  const g = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const comoMadrid = Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute);
  return new Date(guess - (comoMadrid - guess)).toISOString();
}

/** Stories con sticker: Instagram no deja ponerlo por API, así que se avisan en vez de publicarse. */
const conSticker = (p) => p.tipo === "story" && p.sticker && p.sticker !== "Ninguno";

const pieza = (id) => {
  const p = calendario.leer().piezas.find((x) => x.id === id);
  if (!p) throw new Error(`No existe la pieza ${id}`);
  return p;
};
const filaDe = async (id) => (await rest(`redes_publicaciones?pieza=eq.${encodeURIComponent(id)}&select=*`))[0] || null;

/** Deja una pieza programada en la nube para su día y hora (o para `cuandoIso`). */
export async function programar(id, { cuandoIso } = {}) {
  const p = pieza(id);
  const actual = await filaDe(id);
  if (actual?.estado === "publicada") throw new Error(`${id} ya está publicada en Instagram`);
  if (p.estado === "grabar") throw new Error(`${id} está por grabar: todavía no hay nada que publicar`);
  if (!cuandoIso && !(p.fecha && p.hora)) throw new Error(`${id} no tiene día y hora`);
  const cuando = cuandoIso || madridAUtc(p.fecha, p.hora);

  let media = [];
  try {
    const archivos = await prepararArchivos(p);
    for (const a of archivos) media.push(await subir(a.local, a.destino, a.tipo));
  } catch (e) {
    if (!conSticker(p)) throw e; // el aviso de una story puede ir sin imagen
  }
  const caption = [p.caption, p.cta, p.hashtags].filter(Boolean).join("\n\n");
  const fila = {
    pieza: p.id, tipo: conSticker(p) ? "aviso" : p.tipo, titulo: p.titulo, programada_para: cuando,
    caption: conSticker(p) ? `Sticker: ${p.sticker}` : caption, media,
    portada_ms: p.tipo === "reel" ? 1000 : null,
    estado: "programada", contenedor: null, hijos: null, bloqueado_hasta: null,
    ig_media_id: null, ig_enlace: null, error: null, intentos: 0, publicada_at: null, actualizado: new Date().toISOString(),
  };
  const [f] = await rest("redes_publicaciones?on_conflict=pieza", { metodo: "POST", cuerpo: fila, prefer: "resolution=merge-duplicates,return=representation" });
  return f;
}

export async function cancelar(id) {
  const r = await rest(`redes_publicaciones?pieza=eq.${encodeURIComponent(id)}&estado=in.(programada,procesando,error)`, {
    metodo: "PATCH", cuerpo: { estado: "cancelada", contenedor: null, hijos: null, bloqueado_hasta: null, actualizado: new Date().toISOString() }, prefer: "return=representation",
  });
  if (!r.length) throw new Error("No había nada programado que cancelar");
  return r[0];
}

async function llamarFuncion(cuerpo) {
  const e = env();
  const [cfg] = await rest("redes_config?clave=eq.cron_secreto&select=valor");
  const r = await fetch(`${e.SUPABASE_URL}/functions/v1/redes-publicar`, {
    method: "POST", headers: { "content-type": "application/json", "x-redes-secreto": cfg.valor }, body: JSON.stringify(cuerpo),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}

/** Prepara ya el contenedor en Instagram sin publicar: comprueba que el archivo vale. */
export async function probar(id) {
  const f = await filaDe(id);
  if (!f || !["programada", "procesando", "error"].includes(f.estado)) throw new Error("Primero hay que programarla");
  const r = await llamarFuncion({ pieza: id });
  return { resultado: r.resultado?.[id], fila: await filaDe(id) };
}

/** Programa para ahora y publica en el momento. */
export async function publicarAhora(id) {
  const f = await filaDe(id);
  if (!f || f.estado === "cancelada" || f.estado === "avisada") await programar(id, { cuandoIso: new Date().toISOString() });
  else await rest(`redes_publicaciones?pieza=eq.${encodeURIComponent(id)}`, { metodo: "PATCH", cuerpo: { programada_para: new Date().toISOString() } });
  const r = await llamarFuncion({ pieza: id, ahora: true });
  const fila = await filaDe(id);
  if (fila?.estado === "publicada") calendario.actualizar(id, { ig: fila.ig_media_id });
  return { resultado: r.resultado?.[id], fila };
}

/** Estado de todo lo programado y los últimos avisos; pasa al calendario lo ya publicado. */
export async function estado() {
  const [filas, avisos, cfg] = await Promise.all([
    rest("redes_publicaciones?select=pieza,tipo,titulo,programada_para,estado,contenedor,ig_media_id,ig_enlace,error,intentos,publicada_at,actualizado,media&order=programada_para"),
    rest("redes_avisos?select=id,creado,pieza,texto,siguiente,enviado,error&order=creado.desc&limit=40"),
    rest("redes_config?select=clave"),
  ]);
  const claves = new Set(cfg.map((c) => c.clave));
  const cal = calendario.leer();
  let sincronizadas = 0;
  for (const f of filas) {
    const p = cal.piezas.find((x) => x.id === f.pieza);
    if (p && f.estado === "publicada" && f.ig_media_id && p.ig !== f.ig_media_id) { calendario.actualizar(f.pieza, { ig: f.ig_media_id }); sincronizadas++; }
  }
  return {
    filas, avisos, sincronizadas,
    telegram: claves.has("tg_token") && claves.has("tg_chat"),
    instagram: claves.has("ig_token") && claves.has("ig_cuenta"),
  };
}

/** Sube a la nube la conexión con Instagram que tiene el panel local. */
export async function subirConfigInstagram({ IG_ACCESS_TOKEN, IG_ACCOUNT_ID, IG_TOKEN_EXPIRES }) {
  const ahora = new Date().toISOString();
  await rest("redes_config?on_conflict=clave", {
    metodo: "POST", prefer: "resolution=merge-duplicates",
    cuerpo: [
      { clave: "ig_token", valor: IG_ACCESS_TOKEN, actualizado: ahora },
      { clave: "ig_cuenta", valor: IG_ACCOUNT_ID, actualizado: ahora },
      { clave: "ig_token_caduca", valor: String(IG_TOKEN_EXPIRES || ""), actualizado: ahora },
    ],
  });
}

/** El token vigente en la nube (la nube lo renueva sola): el panel local lo usa también. */
export async function tokenNube() {
  const r = await rest("redes_config?clave=in.(ig_token,ig_token_caduca)&select=clave,valor");
  return Object.fromEntries(r.map((x) => [x.clave, x.valor]));
}

/** Recordatorio de grabación de una pieza por grabar: el guion por Telegram dos días antes. */
export async function programarGrabacion(id) {
  const p = pieza(id);
  if (p.estado !== "grabar") throw new Error(`${id} no está por grabar`);
  const fila = {
    pieza: `${p.id}-grabar`, tipo: "grabacion", titulo: `${p.id} · ${p.titulo}`,
    programada_para: grabaciones.cuando(p, madridAUtc), caption: grabaciones.mensaje(p), media: [],
    estado: "programada", contenedor: null, hijos: null, bloqueado_hasta: null, error: null, intentos: 0,
    actualizado: new Date().toISOString(),
  };
  const [f] = await rest("redes_publicaciones?on_conflict=pieza", { metodo: "POST", cuerpo: fila, prefer: "resolution=merge-duplicates,return=representation" });
  return f;
}
