// redes-publicar · publica en Instagram lo que el panel de contenido deja programado
// en `redes_publicaciones`, y avisa por Telegram de lo que ha salido y de lo que toca.
//
// La llama un cron cada minuto, solo cuando hay algo pendiente en la próxima hora,
// y el panel local para «Publicar ahora». Todas las llamadas llevan la cabecera
// `x-redes-secreto` (clave `cron_secreto` de `redes_config`): por eso verify_jwt va apagado.
//
// Cuerpo opcional: { pieza } procesa solo esa pieza ya; { accion: "resumen" } manda el
// resumen del día; { accion: "mantenimiento" } renueva el token si le queda poco.
//
// Una pieza pasa por: programada → (se crea el contenedor hasta 60 min antes)
// procesando → (a su hora, con el contenedor listo) publicada | error.
// Las de tipo «aviso» (stories con sticker) no se publican: a su hora se manda la imagen
// por Telegram para subirla a mano. Las de tipo «grabacion» mandan el guion.
import { createClient } from "npm:@supabase/supabase-js@2";

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

/** Crea el contenedor de Instagram (y los de cada imagen si es carrusel). */
async function preparar(cfg: Cfg, f: Fila) {
  const url = (i: number) => PUBLICO + f.media[i];
  // Ubicación (clave `ig_ubicacion` de redes_config): el ID de la PÁGINA de Facebook de un
  // lugar (no el número de la URL de instagram.com/explore/locations). Vacío = sin ubicación.
  // Las stories no la admiten por API.
  const loc: Record<string, string> = cfg.ig_ubicacion ? { location_id: cfg.ig_ubicacion } : {};
  if (f.tipo === "reel") {
    const p: Record<string, string> = { media_type: "REELS", video_url: url(0), caption: f.caption, share_to_feed: "true", ...loc };
    // Portada propia (segundo archivo, JPEG): manda sobre el fotograma de `portada_ms`.
    if (f.media[1]) p.cover_url = url(1);
    else if (f.portada_ms != null) p.thumb_offset = String(f.portada_ms);
    return (await ig(cfg, `${cfg.ig_cuenta}/media`, p, "POST")).id as string;
  }
  if (f.tipo === "story") {
    const esVideo = f.media[0].endsWith(".mp4");
    return (await ig(cfg, `${cfg.ig_cuenta}/media`, { media_type: "STORIES", [esVideo ? "video_url" : "image_url"]: url(0) }, "POST")).id as string;
  }
  if (f.tipo === "post") {
    return (await ig(cfg, `${cfg.ig_cuenta}/media`, { image_url: url(0), caption: f.caption, ...loc }, "POST")).id as string;
  }
  // Carrusel: una imagen cada vez, guardando lo hecho por si la ejecución se corta.
  const hijos = [...(f.hijos || [])];
  for (let i = hijos.length; i < f.media.length; i++) {
    hijos.push((await ig(cfg, `${cfg.ig_cuenta}/media`, { image_url: url(i), is_carousel_item: "true" }, "POST")).id);
    await actualizar(f.pieza, { hijos });
  }
  return (await ig(cfg, `${cfg.ig_cuenta}/media`, { media_type: "CAROUSEL", children: hijos.join(","), caption: f.caption, ...loc }, "POST")).id as string;
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
