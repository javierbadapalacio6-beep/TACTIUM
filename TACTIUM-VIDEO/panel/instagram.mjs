// Lectura de métricas reales de Instagram (Graph API para cuentas Business/Creator).
// Todo pasa por el servidor: el navegador nunca ve el token.
//
// Variables en `panel/.env` (ver `.env.example`):
//   IG_ACCESS_TOKEN  · token de la app (corto o largo)
//   IG_ACCOUNT_ID    · id de la cuenta profesional (tactium.io)
//   IG_APP_SECRET    · clave secreta de la app, solo para canjear/renovar el token
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(import.meta.dirname, ".env");
const API = "https://graph.instagram.com/v22.0";

function leerEnv() {
  const vars = {};
  if (fs.existsSync(ENV_PATH)) {
    for (const linea of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

function escribirEnv(cambios) {
  const actuales = leerEnv();
  const nuevas = { ...actuales, ...cambios };
  const texto = Object.entries(nuevas).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(ENV_PATH, texto);
}

async function pedir(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j;
}

/** URL para que la cuenta de Instagram autorice la app por el flujo OAuth real
 *  (el único cuyo token luego admite el canje a larga duración). */
export function urlAutorizar() {
  const { IG_APP_ID, IG_REDIRECT_URI } = leerEnv();
  if (!IG_APP_ID || !IG_REDIRECT_URI) throw new Error("Falta IG_APP_ID o IG_REDIRECT_URI en panel/.env");
  const scope = ["instagram_business_basic", "instagram_business_manage_insights", "instagram_business_content_publish"].join(",");
  const q = new URLSearchParams({ client_id: IG_APP_ID, redirect_uri: IG_REDIRECT_URI, response_type: "code", scope });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** Cambia el `code` que devuelve Instagram tras autorizar por un token corto real,
 *  y de un tirón lo canjea por el de 60 días. Es lo que llama /oauth/callback. */
export async function terminarAutorizacion(code) {
  const { IG_APP_ID, IG_APP_SECRET, IG_REDIRECT_URI } = leerEnv();
  const body = new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: IG_REDIRECT_URI, code });
  const r = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body });
  const j = await r.json();
  if (j.error_message || !j.access_token) throw new Error(j.error_message || "Instagram no devolvió token");
  escribirEnv({ IG_ACCESS_TOKEN: j.access_token });
  return canjearTokenLargo();
}

/** Canjea un token corto (o largo a punto de caducar) por uno de 60 días. Requiere IG_APP_SECRET. */
export async function canjearTokenLargo() {
  const { IG_ACCESS_TOKEN, IG_APP_SECRET } = leerEnv();
  if (!IG_ACCESS_TOKEN) throw new Error("Falta IG_ACCESS_TOKEN en panel/.env");
  if (!IG_APP_SECRET) throw new Error("Falta IG_APP_SECRET en panel/.env");
  const url = `${API}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(IG_APP_SECRET)}&access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`;
  const j = await pedir(url);
  escribirEnv({ IG_ACCESS_TOKEN: j.access_token, IG_TOKEN_EXPIRES: String(Date.now() + j.expires_in * 1000) });
  return { dias: Math.round(j.expires_in / 86400) };
}

/** Renueva un token largo ya existente (solo funciona si tiene más de 24 h de vida). */
export async function renovarTokenLargo() {
  const { IG_ACCESS_TOKEN } = leerEnv();
  const url = `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`;
  const j = await pedir(url);
  escribirEnv({ IG_ACCESS_TOKEN: j.access_token, IG_TOKEN_EXPIRES: String(Date.now() + j.expires_in * 1000) });
  return { dias: Math.round(j.expires_in / 86400) };
}

// ── Token ─────────────────────────────────────────────────────────────────
// La nube lo renueva sola antes de que caduque: si está conectada, manda su token y se
// copia al .env local; si no, se usa el del .env.
let tokenCache = null;
async function tokenVigente() {
  if (tokenCache && Date.now() - tokenCache.t < 10 * 60 * 1000) return tokenCache.valor;
  const local = leerEnv();
  let valor = local.IG_ACCESS_TOKEN;
  try {
    const nube = await import("./nube.mjs");
    if (nube.configurada()) {
      const t = await nube.tokenNube();
      if (t.ig_token) {
        valor = t.ig_token;
        if (t.ig_token !== local.IG_ACCESS_TOKEN) escribirEnv({ IG_ACCESS_TOKEN: t.ig_token, IG_TOKEN_EXPIRES: t.ig_token_caduca });
      }
    }
  } catch { /* sin nube: token local */ }
  tokenCache = { t: Date.now(), valor };
  return valor;
}

// ── Métricas ──────────────────────────────────────────────────────────────
// Pedir los insights de ~40 publicaciones tarda unos segundos: se guardan en
// memoria y en `panel/.cache-instagram.json` durante 15 minutos. `fresco` fuerza.
const CACHE_PATH = path.join(import.meta.dirname, ".cache-instagram.json");
const CACHE_MS = 15 * 60 * 1000;
let cache = null;

const TZ = "Europe/Madrid";
const fechaMadrid = (iso) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const horaMadrid = (iso) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(iso)));
const diaMadrid = (iso) => { const d = new Date(fechaMadrid(iso) + "T12:00:00Z").getUTCDay(); return (d + 6) % 7; }; // 0 = lunes
const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** Tipo de pieza del calendario al que corresponde una publicación de Instagram. */
export function tipoDePublicacion(m) {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_product_type === "STORY") return "story";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrusel";
  return "post";
}

const FRANJAS = [
  { id: "manana", nombre: "Mañana", desde: 7, hasta: 11 },
  { id: "mediodia", nombre: "Mediodía", desde: 12, hasta: 14 },
  { id: "tarde", nombre: "Tarde", desde: 15, hasta: 17 },
  { id: "noche", nombre: "Tarde-noche", desde: 18, hasta: 23 },
];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
// Hora de publicación que representa a cada franja.
const HORA_FRANJA = { manana: "11:00", mediodia: "13:00", tarde: "16:00", noche: "19:00" };
const fmt = (n) => (n ?? 0).toLocaleString("es-ES");

/** Por qué cada formato va a la hora que va: sale del alcance real de tus publicaciones. */
function analizar(media) {
  const conAlcance = media.filter((m) => typeof m.reach === "number");
  const grupo = (tipos) => conAlcance.filter((m) => tipos.includes(m.tipo));
  const porFranja = (xs) => FRANJAS.map((f) => {
    const v = xs.filter((m) => m.hora >= f.desde && m.hora <= f.hasta).map((m) => m.reach);
    return { ...f, n: v.length, mediana: mediana(v) };
  });
  const porDia = (xs) => DIAS.map((d, i) => { const v = xs.filter((m) => m.dia === i).map((m) => m.reach); return { dia: d, largo: DIAS_LARGO[i], n: v.length, mediana: mediana(v) }; });

  const reels = grupo(["reel"]);
  const feed = grupo(["carrusel", "post"]);
  const fr = porFranja(reels);
  const ff = porFranja(feed);
  // La mejor franja con al menos 2 publicaciones: con una sola no hay patrón.
  const mejor = (xs) => xs.filter((f) => f.n >= 2).sort((a, b) => b.mediana - a.mediana)[0] || null;
  const mr = mejor(fr), mf = mejor(ff);
  const segunda = fr.filter((f) => f.n >= 2 && f !== mr).sort((a, b) => b.mediana - a.mediana)[0];
  const dr = porDia(reels);
  const validos = dr.filter((d) => d.n >= 3);
  const peorDia = [...validos].sort((a, b) => a.mediana - b.mediana)[0];
  const mejorDia = [...validos].sort((a, b) => b.mediana - a.mediana)[0];

  return {
    muestras: { reels: reels.length, feed: feed.length },
    medianas: { reel: mediana(reels.map((m) => m.reach)), feed: mediana(feed.map((m) => m.reach)) },
    reels: { franjas: fr, dias: dr },
    feed: { franjas: ff },
    recomendaciones: {
      reel: {
        hora: mr ? HORA_FRANJA[mr.id] : "19:00", confianza: mr && mr.n >= 4 ? "media" : "baja",
        texto: mr
          ? `Tus reels de ${mr.nombre.toLowerCase()} (${mr.desde}–${mr.hasta} h) tienen una mediana de ${fmt(mr.mediana)} de alcance en ${mr.n} publicaciones${segunda ? `, frente a ${fmt(segunda.mediana)} por la ${segunda.nombre.toLowerCase()}` : ""}. Por eso van a las ${HORA_FRANJA[mr.id]}.`
          : "Todavía no hay reels suficientes para elegir franja.",
      },
      carrusel: {
        hora: mf ? HORA_FRANJA[mf.id] : "16:00", confianza: "baja",
        texto: mf
          ? `Solo hay ${feed.length} carruseles y posts, y rinden poco a cualquier hora (mediana ${fmt(mediana(feed.map((m) => m.reach)))}). El mejor dato es la ${mf.nombre.toLowerCase()} (${fmt(mf.mediana)}, ${mf.n} publicaciones)${ff.filter((f) => f !== mf && f.n >= 2).map((f) => `, casi igual que la ${f.nombre.toLowerCase()} (${fmt(f.mediana)})`)[0] || ""}: hora provisional, se revisa en noviembre.`
          : "Sin carruseles suficientes: hora provisional.",
      },
      post: { hora: mf ? HORA_FRANJA[mf.id] : "16:00", confianza: "baja", texto: "Igual que los carruseles: pocos datos, van a la misma hora provisional." },
      story: { hora: "20:30", confianza: "sin datos", texto: "Instagram no guarda métricas de stories pasadas. Las de encuesta van el jueves por la noche, cuando los equipos hablan de la jornada; las que apuntan a un carrusel, media hora después de publicarlo." },
    },
    dias: mejorDia && peorDia && mejorDia !== peorDia
      ? `Con pocas muestras por día: tus reels del ${mejorDia.largo} rinden más (mediana ${fmt(mejorDia.mediana)}, ${mejorDia.n} reels) y los del ${peorDia.largo}, menos (${fmt(peorDia.mediana)}, ${peorDia.n} reels).`
      : null,
  };
}

/** Cuenta, alcance de 7 días, todas las publicaciones con sus métricas y el análisis de horas. */
export async function metricas({ fresco = false } = {}) {
  // El análisis se recalcula siempre: la caché guarda solo los datos de Instagram.
  const conAnalisis = (d) => ({ ...d, analisis: analizar(d.media) });
  if (!fresco && cache && Date.now() - cache.t < CACHE_MS) return conAnalisis(cache.datos);
  if (!fresco && !cache && fs.existsSync(CACHE_PATH)) {
    try { const c = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); if (Date.now() - c.t < CACHE_MS) { cache = c; return conAnalisis(c.datos); } } catch {}
  }

  const { IG_ACCOUNT_ID } = leerEnv();
  const IG_ACCESS_TOKEN = await tokenVigente();
  if (!IG_ACCESS_TOKEN || !IG_ACCOUNT_ID) throw new Error("Falta IG_ACCESS_TOKEN o IG_ACCOUNT_ID en panel/.env");
  const tok = `access_token=${encodeURIComponent(IG_ACCESS_TOKEN)}`;

  const cuenta = await pedir(`${API}/${IG_ACCOUNT_ID}?fields=username,name,profile_picture_url,followers_count,media_count&${tok}`);

  let alcance7d = null;
  try {
    const ahora = Math.floor(Date.now() / 1000);
    const ins = await pedir(`${API}/${IG_ACCOUNT_ID}/insights?metric=reach&metric_type=total_value&period=day&since=${ahora - 7 * 86400}&until=${ahora}&${tok}`);
    alcance7d = ins.data?.[0]?.total_value?.value ?? null;
  } catch { /* sin datos suficientes */ }

  // Todas las publicaciones, página a página.
  const lista = [];
  let url = `${API}/${IG_ACCOUNT_ID}/media?fields=id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url&limit=50&${tok}`;
  while (url && lista.length < 200) { const r = await pedir(url); lista.push(...(r.data || [])); url = r.paging?.next; }

  // Insights de cada una, de 8 en 8 para no saturar la API.
  const media = [];
  for (let i = 0; i < lista.length; i += 8) {
    const lote = await Promise.all(lista.slice(i, i + 8).map(async (m) => {
      const tipo = tipoDePublicacion(m);
      const nombres = tipo === "reel" ? "reach,views,saved,shares,likes,comments" : "reach,saved,shares,likes,comments";
      let vals = {};
      try {
        const r = await pedir(`${API}/${m.id}/insights?metric=${nombres}&${tok}`);
        vals = Object.fromEntries((r.data || []).map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
      } catch { /* formatos sin insights */ }
      return {
        id: m.id, tipo, fecha: fechaMadrid(m.timestamp), hora: horaMadrid(m.timestamp), dia: diaMadrid(m.timestamp),
        timestamp: m.timestamp, titular: (m.caption || "").split("\n")[0].slice(0, 90), enlace: m.permalink,
        miniatura: m.thumbnail_url || (m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM" ? m.media_url : null),
        ...vals,
      };
    }));
    media.push(...lote);
  }

  const datos = { cuenta, alcance7d, media, actualizado: new Date().toISOString() };
  cache = { t: Date.now(), datos };
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache)); } catch {}
  return conAnalisis(datos);
}

/** URL de la miniatura de una publicación según la última lectura (caducan a los pocos días). */
export function urlMiniatura(id) {
  let c = cache;
  if (!c && fs.existsSync(CACHE_PATH)) { try { c = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch {} }
  return c?.datos?.media?.find((m) => m.id === id)?.miniatura || null;
}
