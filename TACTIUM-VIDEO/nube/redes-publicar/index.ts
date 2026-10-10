// redes-publicar · publica en Instagram lo que el panel de contenido deja programado
// en `redes_publicaciones`, y avisa por Telegram de lo que ha salido y de lo que toca.
//
// La llama un cron cada minuto, solo cuando hay algo pendiente en la próxima hora,
// y el panel local para «Publicar ahora». Todas las llamadas llevan la cabecera
// `x-redes-secreto` (clave `cron_secreto` de `redes_config`): por eso verify_jwt va apagado.
//
// Cuerpo opcional: { pieza } procesa solo esa pieza ya; { accion: "resumen" } manda el
// resumen del día; { accion: "mantenimiento" } renueva el token si le queda poco;
// { accion: "informes" } manda el informe de 48 h de lo publicado; { accion: "semanal" }, el
// resumen de los lunes.
//
// Una pieza pasa por: programada → (se crea el contenedor hasta 60 min antes)
// procesando → (a su hora, con el contenedor listo) publicada | error.
// Las de tipo «aviso» (stories con sticker) no se publican: a su hora se manda la imagen
// por Telegram para subirla a mano. Las de tipo «grabacion» mandan el guion.
import { createClient } from "npm:@supabase/supabase-js@2";
import { informePieza, informeSemanal, resumirRef } from "./informes.ts";
import type { Formato, Metricas, NavHistoria, PiezaSemana, Ref } from "./informes.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const IG = "https://graph.instagram.com/v22.0";
const PUBLICO = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/redes/`;
const ANTELACION_MS = 60 * 60 * 1000;
const TZ = "Europe/Madrid";

type Cfg = Record<string, string>;
type Fila = {
  pieza: string; tipo: string; titulo: string; programada_para: string; caption: string;
  media: string[]; portada_ms: number | null; estado: string; contenedor: string | null;
  hijos: string[] | null; intentos: number;
};

const leerCfg = async (): Promise<Cfg> => {
  const { data, error } = await sb.from("redes_config").select("clave,valor");
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
};

async function ig(cfg: Cfg, ruta: string, params: Record<string, string> = {}, metodo = "GET") {
  const q = new URLSearchParams({ ...params, access_token: cfg.ig_token });
  const r = metodo === "GET"
    ? await fetch(`${IG}/${ruta}?${q}`)
    : await fetch(`${IG}/${ruta}`, { method: "POST", body: q });
  const j = await r.json();
  if (j.error) throw new Error(j.error.error_user_msg || j.error.message || JSON.stringify(j.error));
  return j;
}

const fechaMadrid = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const cuando = (iso: string) => {
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  const fecha = fechaMadrid(d);
  if (fecha === fechaMadrid(new Date())) return `hoy a las ${hora}`;
  if (fecha === fechaMadrid(new Date(Date.now() + 86400000))) return `mañana a las ${hora}`;
  return `el ${new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d)} a las ${hora}`;
};

const NOMBRE: Record<string, string> = { reel: "reel", carrusel: "carrusel", post: "post", story: "story", aviso: "story con sticker", grabacion: "grabación" };

async function siguiente(excluir?: string) {
  const { data } = await sb.from("redes_publicaciones").select("pieza,tipo,titulo,programada_para")
    .in("estado", ["programada", "procesando"]).neq("tipo", "grabacion").gt("programada_para", new Date().toISOString())
    .order("programada_para").limit(2);
  const s = (data || []).find((x) => x.pieza !== excluir);
  if (!s) return "no hay nada más programado";
  return `${s.pieza} · ${s.titulo} (${NOMBRE[s.tipo] || s.tipo}${s.tipo === "aviso" ? ", a mano" : ""}), ${cuando(s.programada_para)}`;
}

/** Guarda el aviso y lo manda por Telegram si está configurado (tg_token + tg_chat).
 *  Con `foto`, va como imagen con el texto al pie (para guardarla en el móvil y subirla). */
async function avisar(cfg: Cfg, pieza: string | null, texto: string, sig: string, foto?: string) {
  let enviado = false, error: string | null = null;
  if (cfg.tg_token && cfg.tg_chat) {
    try {
      const cuerpoTexto = sig ? `${texto}\n\nSiguiente: ${sig}` : texto;
      const r = await fetch(`https://api.telegram.org/bot${cfg.tg_token}/${foto ? "sendPhoto" : "sendMessage"}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(foto
          ? { chat_id: cfg.tg_chat, photo: foto, caption: cuerpoTexto.slice(0, 1024) }
          : { chat_id: cfg.tg_chat, text: cuerpoTexto.slice(0, 4096) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.description || "Telegram no aceptó el mensaje");
      enviado = true;
    } catch (e) { error = String((e as Error).message || e); }
  } else {
    error = "Telegram sin configurar";
  }
  await sb.from("redes_avisos").insert({ pieza, texto, siguiente: sig, enviado, error, canal: "telegram" });
}

const actualizar = (pieza: string, cambios: Record<string, unknown>) =>
  sb.from("redes_publicaciones").update({ ...cambios, actualizado: new Date().toISOString() }).eq("pieza", pieza);

/** Recuerda qué piezas salieron como reel de prueba (para informarlas a las 24 h y decidir si se gradúan). */
async function marcarPrueba(cfg: Cfg, pieza: string) {
  const l = new Set((cfg.reels_prueba_publicados || "").split(",").filter(Boolean));
  l.add(pieza);
  await sb.from("redes_config").upsert([{ clave: "reels_prueba_publicados", valor: [...l].slice(-60).join(","), actualizado: new Date().toISOString() }]);
}

/** Crea el contenedor de Instagram (y los de cada imagen si es carrusel). */
async function preparar(cfg: Cfg, f: Fila) {
  const url = (i: number) => PUBLICO + f.media[i];
  // Ubicación (clave `ig_ubicacion` de redes_config): el ID de la PÁGINA de Facebook de un
  // lugar (no el número de la URL de instagram.com/explore/locations). Vacío = sin ubicación.
  // Las stories no la admiten por API.
  const loc: Record<string, string> = cfg.ig_ubicacion ? { location_id: cfg.ig_ubicacion } : {};
  // Colaboradores (clave `ig_colaboradores` de redes_config: usuarios separados por comas, máximo 3).
  // La publicación sale en sus perfiles y suma su alcance cuando aceptan la invitación. Reels,
  // posts y carruseles (en el contenedor padre); las stories no lo admiten.
  const lista = (cfg.ig_colaboradores || "").split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean).slice(0, 3);
  const colab: Record<string, string> = lista.length ? { collaborators: JSON.stringify(lista) } : {};
  // Reels de prueba (clave `ig_reels_prueba` = MANUAL | SS_PERFORMANCE; vacío u «off» = desactivado).
  // Solo los ven quienes NO te siguen y no salen en tu perfil: sirven para probar ganchos sin quemar
  // a los seguidores. MANUAL: los pasas a seguidores tú desde la app; SS_PERFORMANCE: Instagram los
  // gradúa solo si rinden. `ig_reels_prueba_piezas` (IDs separados por comas) limita cuáles; vacío = todos.
  const modoRaw = (cfg.ig_reels_prueba || "").trim().toUpperCase();
  const modoPrueba = modoRaw === "MANUAL" || modoRaw === "SS_PERFORMANCE" ? modoRaw : null;
  const soloPiezas = (cfg.ig_reels_prueba_piezas || "").split(",").map((s) => s.trim()).filter(Boolean);
  const esPrueba = f.tipo === "reel" && !!modoPrueba && (soloPiezas.length === 0 || soloPiezas.includes(f.pieza));
  const prueba: Record<string, string> = esPrueba ? { trial_params: JSON.stringify({ graduation_strategy: modoPrueba }) } : {};
  const normal: Record<string, string> = f.tipo === "reel" ? { share_to_feed: "true" } : {};
  const crear = async (p: Record<string, string>) => {
    // De más a menos ambicioso: un extra que Instagram rechace nunca hace perder la publicación.
    const intentos: { quita: string; extra: Record<string, string> }[] = esPrueba
      ? [
          { quita: "", extra: { ...prueba, ...colab } },
          ...(lista.length ? [{ quita: "los colaboradores", extra: { ...prueba } }] : []),
          { quita: "el modo prueba (saldrá como reel normal)", extra: { ...normal } },
        ]
      : [
          { quita: "", extra: { ...normal, ...colab } },
          ...(lista.length ? [{ quita: "los colaboradores", extra: { ...normal } }] : []),
        ];
    let ultimo: unknown;
    for (let i = 0; i < intentos.length; i++) {
      try {
        const id = (await ig(cfg, `${cfg.ig_cuenta}/media`, { ...p, ...intentos[i].extra }, "POST")).id as string;
        if ("trial_params" in intentos[i].extra) await marcarPrueba(cfg, f.pieza);
        return id;
      } catch (e) {
        ultimo = e;
        if (i < intentos.length - 1) {
          await avisar(cfg, f.pieza, `Instagram no aceptó ${intentos[i + 1].quita} en ${f.pieza}: ${String((e as Error).message || e)}. Reintento sin eso.`, "");
        }
      }
    }
    throw ultimo;
  };
  if (f.tipo === "reel") {
    const p: Record<string, string> = { media_type: "REELS", video_url: url(0), caption: f.caption, ...loc };
    // Portada propia (segundo archivo, JPEG): manda sobre el fotograma de `portada_ms`.
    if (f.media[1]) p.cover_url = url(1);
    else if (f.portada_ms != null) p.thumb_offset = String(f.portada_ms);
    return await crear(p);
  }
  if (f.tipo === "story") {
    const esVideo = f.media[0].endsWith(".mp4");
    return (await ig(cfg, `${cfg.ig_cuenta}/media`, { media_type: "STORIES", [esVideo ? "video_url" : "image_url"]: url(0) }, "POST")).id as string;
  }
  if (f.tipo === "post") {
    return await crear({ image_url: url(0), caption: f.caption, ...loc });
  }
  // Carrusel: una imagen cada vez, guardando lo hecho por si la ejecución se corta.
  const hijos = [...(f.hijos || [])];
  for (let i = hijos.length; i < f.media.length; i++) {
    hijos.push((await ig(cfg, `${cfg.ig_cuenta}/media`, { image_url: url(i), is_carousel_item: "true" }, "POST")).id);
    await actualizar(f.pieza, { hijos });
  }
  return await crear({ media_type: "CAROUSEL", children: hijos.join(","), caption: f.caption, ...loc });
}

async function estadoContenedor(cfg: Cfg, id: string) {
  return (await ig(cfg, id, { fields: "status_code,status" })) as { status_code: string; status?: string };
}

async function procesar(cfg: Cfg, f: Fila, forzar: boolean) {
  const aHora = forzar || new Date(f.programada_para).getTime() <= Date.now();

  if (f.tipo === "aviso") {
    if (!aHora) return "esperando";
    const foto = f.media[0] ? PUBLICO + f.media[0] : undefined;
    await avisar(cfg, f.pieza, `Sube ahora esta story a mano: ${f.pieza} · ${f.titulo}.\n${f.caption}. Guarda la imagen, súbela en Instagram y pon el sticker en el tercio de abajo.`, await siguiente(f.pieza), foto);
    await actualizar(f.pieza, { estado: "avisada", bloqueado_hasta: null });
    return "avisada";
  }

  if (f.tipo === "grabacion") {
    if (!aHora) return "esperando";
    await avisar(cfg, f.pieza, f.caption, "");
    await actualizar(f.pieza, { estado: "avisada", bloqueado_hasta: null });
    return "avisada";
  }

  let contenedor = f.contenedor;
  if (!contenedor) {
    contenedor = await preparar(cfg, f);
    await actualizar(f.pieza, { contenedor, estado: "procesando", intentos: f.intentos + 1 });
  }

  // Los vídeos tardan en procesarse: se espera un poco aquí y, si no, en la siguiente vuelta.
  let st = await estadoContenedor(cfg, contenedor);
  for (let i = 0; i < 6 && st.status_code === "IN_PROGRESS" && aHora; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    st = await estadoContenedor(cfg, contenedor);
  }
  if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
    throw new Error(`Instagram no pudo procesar el archivo (${st.status_code}${st.status ? `: ${st.status}` : ""})`);
  }
  if (st.status_code !== "FINISHED" || !aHora) return st.status_code === "FINISHED" ? "lista" : "procesando";

  const pub = await ig(cfg, `${cfg.ig_cuenta}/media_publish`, { creation_id: contenedor }, "POST");
  let enlace: string | null = null;
  try { enlace = (await ig(cfg, pub.id, { fields: "permalink" })).permalink; } catch { /* sin enlace no pasa nada */ }
  await actualizar(f.pieza, {
    estado: "publicada", ig_media_id: pub.id, ig_enlace: enlace, publicada_at: new Date().toISOString(),
    error: null, bloqueado_hasta: null,
  });
  await avisar(cfg, f.pieza, `Publicado en Instagram: ${f.pieza} · ${f.titulo} (${NOMBRE[f.tipo]}).${enlace ? ` ${enlace}` : ""}`, await siguiente(f.pieza));
  return "publicada";
}

async function resumen(cfg: Cfg) {
  const fin = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data } = await sb.from("redes_publicaciones").select("pieza,tipo,titulo,programada_para")
    .in("estado", ["programada", "procesando"]).gte("programada_para", new Date().toISOString()).lte("programada_para", fin).order("programada_para");
  if (!data?.length) return "nada";
  const hora = (x: { programada_para: string }) => cuando(x.programada_para).replace(/^(hoy|mañana) a las /, "");
  const lista = data.map((x) => x.tipo === "grabacion"
    ? `${hora(x)} te llega el guion para grabar ${x.titulo}`
    : `${hora(x)} ${x.pieza} ${NOMBRE[x.tipo]}${x.tipo === "aviso" ? " (a mano)" : " (sale sola)"}`).join("\n");
  await avisar(cfg, null, `Hoy:\n${lista}`, "");
  return "enviado";
}

// ── Informes: cada formato con su propio análisis (lógica en informes.ts) ───────────────
// Reel, carrusel, post e historia se ganan de formas distintas, así que cada uno tiene su
// informe, su referencia (medianas del MISMO formato) y su siguiente paso. Los informes de
// piezas del feed salen a las 48 h; las historias, a las ~16-24 h (caducan a las 24 h).

const METRICAS_BASE: Record<Formato, string[]> = {
  reel: ["reach", "views", "saved", "shares", "likes", "comments", "total_interactions", "ig_reels_avg_watch_time"],
  carrusel: ["reach", "views", "saved", "shares", "likes", "comments", "total_interactions"],
  post: ["reach", "views", "saved", "shares", "likes", "comments", "total_interactions"],
  story: ["reach", "views", "replies", "shares", "total_interactions"],
};
// Para medir el CRECIMIENTO por pieza. No todos los formatos las admiten: se piden una a una.
const METRICAS_CRECIMIENTO = ["follows", "profile_visits"];

// deno-lint-ignore no-explicit-any
const aMetricas = (r: any): Metricas => Object.fromEntries((r.data || []).map((d: any) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));

/** Métricas de una pieza. Si Instagram rechaza alguna para ese formato, se piden de una en una y se quedan las válidas. */
async function metricasDe(cfg: Cfg, id: string, formato: Formato): Promise<Metricas> {
  const pedir = async (ms: string[]) => aMetricas(await ig(cfg, `${id}/insights`, { metric: ms.join(",") }));
  let out: Metricas = {};
  try {
    out = await pedir(METRICAS_BASE[formato]);
  } catch {
    for (const m of METRICAS_BASE[formato]) {
      try { Object.assign(out, await pedir([m])); } catch { /* no disponible en este formato */ }
    }
  }
  for (const m of METRICAS_CRECIMIENTO) {
    try { Object.assign(out, await pedir([m])); } catch { /* no disponible en este formato */ }
  }
  return out;
}

/** Toques de una historia: adelante, atrás, salidas y paso a la siguiente. */
async function navegacionHistoria(cfg: Cfg, id: string): Promise<NavHistoria | null> {
  try {
    const r = await ig(cfg, `${id}/insights`, { metric: "navigation", breakdown: "story_navigation_action_type" });
    // deno-lint-ignore no-explicit-any
    const res: any[] = r.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
    const v = (k: string) => res.filter((x) => String(x.dimension_values?.[0] || "").toLowerCase().includes(k)).reduce((a, x) => a + (x.value || 0), 0);
    return { adelante: v("tap_forward"), atras: v("tap_back"), salidas: v("exit"), siguiente: v("swipe_forward") };
  } catch {
    return null;
  }
}

/** Medianas de las últimas 12 piezas publicadas del MISMO formato (guardadas en cada informe). */
async function referencia(formato: Formato, excluir: string): Promise<Ref | null> {
  if (formato === "story") return null;
  const { data } = await sb.from("redes_publicaciones").select("metricas")
    .eq("tipo", formato).eq("estado", "publicada").not("metricas", "is", null).neq("pieza", excluir)
    .order("publicada_at", { ascending: false }).limit(12);
  return resumirRef((data || []).map((x) => x.metricas as Metricas));
}

/**
 * Informe de cada publicación del feed sin informe todavía: a las 48 h, y a las 24 h si fue un reel de
 * prueba (hay que decidir pronto si se gradúa a seguidores; Instagram da unas 72 h).
 */
async function informes(cfg: Cfg) {
  const pruebas = new Set((cfg.reels_prueba_publicados || "").split(",").filter(Boolean));
  const { data } = await sb.from("redes_publicaciones").select("pieza,tipo,titulo,ig_media_id,ig_enlace,publicada_at")
    .eq("estado", "publicada").is("informe_at", null).not("ig_media_id", "is", null).in("tipo", ["reel", "carrusel", "post"])
    .gte("publicada_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .lte("publicada_at", new Date(Date.now() - 24 * 3600000).toISOString())
    .order("publicada_at").limit(6);
  const hechos: string[] = [];
  for (const f of data || []) {
    const prueba = f.tipo === "reel" && pruebas.has(f.pieza);
    const horas = prueba ? 24 : 48;
    if (Date.now() - new Date(f.publicada_at).getTime() < horas * 3600000) continue;
    if (hechos.length >= 3) break;
    const formato = f.tipo as Formato;
    const m = await metricasDe(cfg, f.ig_media_id, formato);
    if (prueba && m.views === undefined) {
      // Instagram no devuelve los datos del reel de prueba por la API: hay que mirarlos en la app.
      await avisar(cfg, f.pieza, `🧪 REEL DE PRUEBA · ${f.pieza} · ${f.titulo}\nHan pasado 24 h. Instagram no da por API los datos de los reels de prueba: míralos en la app (Perfil → Panel profesional → Reels de prueba) y decide si lo compartes con tus seguidores. Criterio: ≥ 5 s de visionado medio y que se envíe a amigos.`, "");
      await actualizar(f.pieza, { informe_at: new Date().toISOString() });
      hechos.push(f.pieza);
      continue;
    }
    const ref = await referencia(formato, f.pieza);
    const texto = informePieza({ formato, pieza: f.pieza, titulo: f.titulo, publicada: new Date(f.publicada_at), horas, m, ref, enlace: f.ig_enlace, prueba });
    await avisar(cfg, f.pieza, texto, "");
    await actualizar(f.pieza, { informe_at: new Date().toISOString(), metricas: m });
    hechos.push(f.pieza);
  }
  return hechos;
}

/**
 * Informe de las historias activas (tanto las que sube la función como las que se suben a mano
 * desde el aviso de Telegram). Caducan a las 24 h y sus datos casi se cierran a las ~16 h, así que
 * se informa entre las 16 y las 24 h. Las ya informadas se recuerdan en `stories_informadas`.
 */
async function historias(cfg: Cfg) {
  const hechas = new Set((cfg.stories_informadas || "").split(",").filter(Boolean));
  const lista = (await ig(cfg, `${cfg.ig_cuenta}/stories`, { fields: "id,timestamp,media_type" })).data || [];
  const nuevas: string[] = [];
  // deno-lint-ignore no-explicit-any
  for (const s of lista as any[]) {
    if (hechas.has(s.id)) continue;
    const t = new Date(s.timestamp).getTime();
    const horas = (Date.now() - t) / 3600000;
    if (horas < 16) continue;
    const m = await metricasDe(cfg, s.id, "story");
    const nav = await navegacionHistoria(cfg, s.id);
    // La pieza programada más cercana (aviso o story) da nombre a la historia.
    const { data: cerca } = await sb.from("redes_publicaciones").select("pieza,titulo")
      .in("tipo", ["aviso", "story"])
      .gte("programada_para", new Date(t - 3 * 3600000).toISOString())
      .lte("programada_para", new Date(t + 3 * 3600000).toISOString()).limit(1);
    const p = cerca?.[0];
    const texto = informePieza({
      formato: "story", pieza: p?.pieza ?? "historia", titulo: p?.titulo ?? (s.media_type === "VIDEO" ? "Historia en vídeo" : "Historia"),
      publicada: new Date(t), horas: Math.round(horas), m, ref: null, nav,
    });
    await avisar(cfg, p?.pieza ?? null, texto, "");
    hechas.add(s.id);
    nuevas.push(s.id);
  }
  if (nuevas.length) {
    await sb.from("redes_config").upsert([{ clave: "stories_informadas", valor: [...hechas].slice(-60).join(","), actualizado: new Date().toISOString() }]);
  }
  return nuevas;
}

/** Un dato de la cuenta de los últimos 7 días (null si Instagram no lo da). */
async function cuenta7(cfg: Cfg, metrica: string, extra: Record<string, string> = {}): Promise<{ total: number | null; desglose: Record<string, number> }> {
  try {
    const ahora = Math.floor(Date.now() / 1000);
    const r = await ig(cfg, `${cfg.ig_cuenta}/insights`, { metric: metrica, metric_type: "total_value", period: "day", since: String(ahora - 7 * 86400), until: String(ahora), ...extra });
    const tv = r.data?.[0]?.total_value;
    const desglose: Record<string, number> = {};
    // deno-lint-ignore no-explicit-any
    for (const x of (tv?.breakdowns?.[0]?.results || []) as any[]) desglose[String(x.dimension_values?.[0] || "")] = x.value || 0;
    return { total: tv?.value ?? null, desglose };
  } catch {
    return { total: null, desglose: {} };
  }
}

/** Resumen de los lunes: crecimiento, lectura por formato y la apuesta de la semana. */
async function semanal(cfg: Cfg) {
  const cuenta = await ig(cfg, cfg.ig_cuenta, { fields: "followers_count" });
  const alcance = await cuenta7(cfg, "reach");
  const porTipo = await cuenta7(cfg, "reach", { breakdown: "follow_type" });
  const visitas = await cuenta7(cfg, "profile_views");
  const clics = await cuenta7(cfg, "website_clicks");
  const noSeg = Object.entries(porTipo.desglose).find(([k]) => k.toUpperCase().includes("NON"))?.[1];
  const totalSeg = Object.values(porTipo.desglose).reduce((a, b) => a + b, 0);

  const { data } = await sb.from("redes_publicaciones").select("pieza,tipo,titulo,ig_media_id")
    .eq("estado", "publicada").not("ig_media_id", "is", null).in("tipo", ["reel", "carrusel", "post"])
    .gte("publicada_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("publicada_at");
  const piezas: PiezaSemana[] = [];
  for (const f of data || []) {
    try { piezas.push({ pieza: f.pieza, titulo: f.titulo, formato: f.tipo as Formato, m: await metricasDe(cfg, f.ig_media_id, f.tipo as Formato) }); } catch { /* sin métricas */ }
  }

  const { data: prog } = await sb.from("redes_publicaciones").select("pieza,tipo,titulo,programada_para")
    .in("estado", ["programada", "procesando"]).neq("tipo", "grabacion")
    .gte("programada_para", new Date().toISOString()).lte("programada_para", new Date(Date.now() + 7 * 86400000).toISOString())
    .order("programada_para");
  const programadas: Record<string, number> = {};
  for (const x of prog || []) programadas[NOMBRE[x.tipo] || x.tipo] = (programadas[NOMBRE[x.tipo] || x.tipo] || 0) + 1;
  const primera = prog?.[0];

  const partes = informeSemanal({
    seguidores: cuenta.followers_count,
    seguidoresAntes: Number(cfg.seguidores_ultimo || 0) || null,
    meta: Number(cfg.meta_seguidores || 0) || null,
    alcance7: alcance.total,
    alcanceNoSeguidores: noSeg !== undefined && totalSeg > 0 ? Math.round((noSeg / totalSeg) * 100) : null,
    visitasPerfil: visitas.total,
    clicsEnlace: clics.total,
    piezas,
    programadas,
    proxima: primera ? `${primera.pieza} ${NOMBRE[primera.tipo] || primera.tipo} (${cuando(primera.programada_para)})` : null,
  });
  for (const t of partes) await avisar(cfg, null, t, "");
  await sb.from("redes_config").upsert([{ clave: "seguidores_ultimo", valor: String(cuenta.followers_count), actualizado: new Date().toISOString() }]);
  return "enviado";
}

async function mantenimiento(cfg: Cfg) {
  const caduca = Number(cfg.ig_token_caduca || 0);
  if (caduca && caduca - Date.now() > 10 * 86400000) return "token al día";
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.ig_token)}`);
  const j = await r.json();
  if (j.error || !j.access_token) {
    await avisar(cfg, null, `No se pudo renovar el token de Instagram: ${j.error?.message || "sin respuesta"}. Vuelve a autorizar desde el panel.`, await siguiente());
    return "fallo";
  }
  const hasta = String(Date.now() + j.expires_in * 1000);
  await sb.from("redes_config").upsert([
    { clave: "ig_token", valor: j.access_token, actualizado: new Date().toISOString() },
    { clave: "ig_token_caduca", valor: hasta, actualizado: new Date().toISOString() },
  ]);
  return "renovado";
}

Deno.serve(async (req) => {
  const cfg = await leerCfg();
  if (!cfg.cron_secreto || req.headers.get("x-redes-secreto") !== cfg.cron_secreto) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }
  const cuerpo = await req.json().catch(() => ({}));
  const json = (x: unknown) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });

  if (cuerpo.accion === "resumen") return json({ resumen: await resumen(cfg) });
  if (cuerpo.accion === "mantenimiento") return json({ token: await mantenimiento(cfg) });
  if (cuerpo.accion === "informes") return json({ informes: await informes(cfg) });
  if (cuerpo.accion === "semanal") return json({ semanal: await semanal(cfg) });
  if (cuerpo.accion === "historias") return json({ historias: await historias(cfg) });
  if (cuerpo.accion === "avisar" && cuerpo.texto) { await avisar(cfg, null, String(cuerpo.texto), await siguiente()); return json({ ok: true }); }

  // Qué toca: una pieza concreta, o todo lo pendiente de la próxima hora.
  const ahora = new Date();
  let q = sb.from("redes_publicaciones").select("*");
  q = cuerpo.pieza
    ? q.eq("pieza", cuerpo.pieza).in("estado", ["programada", "procesando", "error"])
    : q.in("estado", ["programada", "procesando"]).lte("programada_para", new Date(ahora.getTime() + ANTELACION_MS).toISOString()).order("programada_para").limit(4);
  const { data: filas, error } = await q;
  if (error) return json({ error: error.message });

  const resultado: Record<string, string> = {};
  for (const f of (filas || []) as Fila[]) {
    // Se reserva la fila 90 s: si otra ejecución llega a la vez, la salta.
    const { data: mia } = await sb.from("redes_publicaciones")
      .update({ bloqueado_hasta: new Date(Date.now() + 90000).toISOString() })
      .eq("pieza", f.pieza).or(`bloqueado_hasta.is.null,bloqueado_hasta.lt.${new Date().toISOString()}`).select("pieza");
    if (!mia?.length) { resultado[f.pieza] = "ocupada"; continue; }
    try {
      const fila = cuerpo.pieza && f.estado === "error" ? { ...f, contenedor: null, hijos: null } : f;
      resultado[f.pieza] = await procesar(cfg, fila, !!cuerpo.pieza && cuerpo.ahora === true);
      if (resultado[f.pieza] !== "publicada" && resultado[f.pieza] !== "avisada") await actualizar(f.pieza, { bloqueado_hasta: null });
    } catch (e) {
      const msg = String((e as Error).message || e);
      const reintentar = f.intentos < 2 && !/no pudo procesar/.test(msg);
      await actualizar(f.pieza, reintentar
        ? { error: msg, intentos: f.intentos + 1, contenedor: null, hijos: null, estado: "programada", bloqueado_hasta: new Date(Date.now() + 120000).toISOString() }
        : { error: msg, estado: "error", bloqueado_hasta: null });
      if (!reintentar) await avisar(cfg, f.pieza, `No se ha podido publicar ${f.pieza} · ${f.titulo}: ${msg}`, await siguiente(f.pieza));
      resultado[f.pieza] = `error: ${msg}`;
    }
  }
  return json({ resultado });
});
