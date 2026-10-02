// redes-telegram · recibe por el bot de Telegram los vídeos en bruto que graba Javier.
//
// Telegram llama aquí (webhook) con cada mensaje. Solo se atiende al chat configurado
// (`tg_chat`) y a peticiones con la cabecera secreta que se registró en setWebhook
// (por eso verify_jwt va apagado).
// Cada vídeo se guarda en el bucket privado «redes-brutos» y en `redes_brutos`, con su
// código de pieza si viene en el texto del envío (p. ej. «A1»), o después respondiendo
// al vídeo con el código. El bot contesta qué toma es.
//
// Límite de la API de bots: solo se pueden descargar archivos de hasta 20 MB. Enviados
// como vídeo normal, Telegram los comprime y caben; enviados como archivo, no.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LIMITE = 20 * 1024 * 1024;
const CODIGO = /^\s*([A-Za-z]\d{1,2}[a-z]?)\b/;

type Cfg = Record<string, string>;
const leerCfg = async (): Promise<Cfg> => {
  const { data } = await sb.from("redes_config").select("clave,valor");
  return Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
};

const tg = (cfg: Cfg, metodo: string, cuerpo: Record<string, unknown>) =>
  fetch(`https://api.telegram.org/bot${cfg.tg_token}/${metodo}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo),
  }).then((r) => r.json());

const responder = (cfg: Cfg, aMensaje: number, texto: string) =>
  tg(cfg, "sendMessage", { chat_id: cfg.tg_chat, text: texto, reply_to_message_id: aMensaje });

/**
 * Qué es el vídeo según el texto del envío:
 *  - «A1», «a1 toma buena»        → A1 (una toma a cámara del guion)
 *  - «A1 pantalla»                → A1-pantalla (grabación de pantalla para ese vídeo)
 *  - «BROLL», «b-roll», «juego»   → BROLL (clips tuyos jugando, imagen de apoyo)
 */
const codigo = (t?: string) => {
  const txt = t || "";
  if (/^\s*(b-?roll|juego)\b/i.test(txt)) return "BROLL";
  const m = txt.match(CODIGO);
  if (!m) return null;
  const c = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return /\bpantallas?\b/i.test(txt) ? `${c}-pantalla` : c;
};

async function siguienteToma(pieza: string) {
  const { count } = await sb.from("redes_brutos").select("id", { count: "exact", head: true }).eq("pieza", pieza);
  return (count || 0) + 1;
}

/** ¿Hay un vídeo por grabar con ese código? (solo para avisar si parece un error). */
async function conocida(pieza: string) {
  if (pieza === "BROLL") return true;
  const base = pieza.replace(/-pantalla$/, "");
  const { data } = await sb.from("redes_publicaciones").select("pieza").eq("pieza", `${base}-grabar`).limit(1);
  return !!data?.length;
}

/** Pone el código del álbum a los vídeos de ese álbum que llegaron sin texto (en orden de envío). */
async function heredarAlbum(grupo: string, pieza: string) {
  const { data } = await sb.from("redes_brutos").select("id").eq("media_grupo", grupo).is("pieza", null).order("tg_mensaje");
  for (const b of data || []) {
    const toma = await siguienteToma(pieza);
    await sb.from("redes_brutos").update({ pieza, toma }).eq("id", b.id).is("pieza", null);
  }
}

async function guardarVideo(cfg: Cfg, update: number, msg: any) {
  // Vídeos y también notas de voz / audios (para frases que faltan: se montan como voz en off).
  const v = msg.video || msg.video_note || msg.voice || msg.audio ||
    (/^(video|audio)\//.test(msg.document?.mime_type || "") ? msg.document : null);
  const esAudio = !!(msg.voice || msg.audio || msg.document?.mime_type?.startsWith("audio/"));
  if (!v) return;
  if ((v.file_size || 0) > LIMITE) {
    await responder(cfg, msg.message_id, `Este pesa ${(v.file_size / 1048576).toFixed(0)} MB y el bot solo puede coger hasta 20 MB. Mándalo como vídeo normal (no como archivo) y Telegram lo comprime.`);
    return;
  }
  const f = await tg(cfg, "getFile", { file_id: v.file_id });
  if (!f.ok) { await responder(cfg, msg.message_id, `No he podido descargarlo: ${f.description}`); return; }
  const r = await fetch(`https://api.telegram.org/file/bot${cfg.tg_token}/${f.result.file_path}`);
  const datos = new Uint8Array(await r.arrayBuffer());

  const pieza = codigo(msg.caption);
  const toma = pieza ? await siguienteToma(pieza) : null;
  const grupo: string | null = msg.media_group_id || null;
  const ext = (f.result.file_path.split(".").pop() || (esAudio ? "ogg" : "mp4")).toLowerCase();
  const ruta = `${pieza || "sin-codigo"}/${new Date().toISOString().replace(/[:.]/g, "-")}-${msg.message_id}.${ext}`;
  const { error } = await sb.storage.from("redes-brutos").upload(ruta, datos, { contentType: esAudio ? (ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : "audio/ogg") : ext === "mov" ? "video/quicktime" : "video/mp4", upsert: false });
  if (error) { await responder(cfg, msg.message_id, `No he podido guardarlo: ${error.message}`); return; }

  const { error: e2 } = await sb.from("redes_brutos").insert({
    pieza, toma, ruta, tamano: datos.length, duracion: v.duration || null, tg_update: update, tg_mensaje: msg.message_id, media_grupo: grupo,
  });
  if (e2 && !/duplicate/.test(e2.message)) { await responder(cfg, msg.message_id, `Guardado, pero no se pudo apuntar: ${e2.message}`); return; }

  // Álbum: Telegram solo pone el texto en el primer vídeo. Los demás heredan su código.
  // Llegan casi a la vez y en cualquier orden, así que se resuelve por los dos lados.
  if (grupo) {
    if (pieza) {
      await heredarAlbum(grupo, pieza);
    } else {
      await new Promise((r) => setTimeout(r, 3000));
      const { data: yo } = await sb.from("redes_brutos").select("pieza").eq("tg_mensaje", msg.message_id).limit(1);
      if (yo?.[0]?.pieza) return; // ya lo apuntó el vídeo con texto
      const { data: hermano } = await sb.from("redes_brutos").select("pieza").eq("media_grupo", grupo).not("pieza", "is", null).limit(1);
      if (hermano?.[0]?.pieza) { await heredarAlbum(grupo, hermano[0].pieza); return; }
    }
  }

  const seg = v.duration ? `${v.duration} s, ` : "";
  const mb = `${(datos.length / 1048576).toFixed(1).replace(".", ",")} MB`;
  if (!pieza) {
    await responder(cfg, msg.message_id, esAudio
      ? `Audio recibido (${seg}${mb}). ¿De qué vídeo es? Responde a este audio con su código, por ejemplo R2.`
      : `Recibido (${seg}${mb}). ¿De qué vídeo es? Responde a este vídeo con su código, por ejemplo A1.`);
  } else {
    const aviso = (await conocida(pieza)) ? "" : ` Ojo: no tengo ningún vídeo por grabar con el código ${pieza}.`;
    const que = esAudio ? `audio de ${pieza}, toma ${toma}` : pieza === "BROLL" ? `clip de juego nº ${toma}` : pieza.endsWith("-pantalla") ? `pantalla de ${pieza.replace(/-pantalla$/, "")}, toma ${toma}` : `${pieza}, toma ${toma}`;
    const album = grupo ? " Los demás vídeos de este álbum se apuntan con el mismo código." : "";
    await responder(cfg, msg.message_id, `Recibido: ${que} (${seg}${mb}).${album}${aviso} Cuando tengas todo, díselo a Claude para montarlo.`);
  }
}

/** Respuesta con un código a un vídeo que llegó sin él. */
async function asignarCodigo(cfg: Cfg, msg: any) {
  const pieza = codigo(msg.text);
  const original = msg.reply_to_message?.message_id;
  if (!pieza || !original) return false;
  const { data } = await sb.from("redes_brutos").select("id,pieza,media_grupo").eq("tg_mensaje", original).limit(1);
  if (!data?.length) return false;
  const toma = await siguienteToma(pieza);
  await sb.from("redes_brutos").update({ pieza, toma }).eq("id", data[0].id);
  // Si era de un álbum, el código vale para todo el álbum.
  if (data[0].media_grupo) await heredarAlbum(data[0].media_grupo, pieza);
  await responder(cfg, msg.message_id, data[0].media_grupo ? `Apuntado: ${pieza}, con todo su álbum.` : `Apuntado: ${pieza}, toma ${toma}.`);
  return true;
}

async function estado(cfg: Cfg, aMensaje: number) {
  const { data } = await sb.from("redes_brutos").select("pieza,descargado").order("creado");
  const por: Record<string, { n: number; nuevas: number }> = {};
  for (const b of data || []) { const k = b.pieza || "sin código"; por[k] ??= { n: 0, nuevas: 0 }; por[k].n++; if (!b.descargado) por[k].nuevas++; }
  const lineas = Object.entries(por).map(([k, v]) => `${k}: ${v.n} toma${v.n > 1 ? "s" : ""}${v.nuevas ? ` (${v.nuevas} sin montar)` : ""}`);
  await responder(cfg, aMensaje, lineas.length ? `Vídeos recibidos:\n${lineas.join("\n")}` : "Todavía no me has mandado ningún vídeo.");
}

Deno.serve(async (req) => {
  const cfg = await leerCfg();
  if (!cfg.tg_webhook_secreto || req.headers.get("x-telegram-bot-api-secret-token") !== cfg.tg_webhook_secreto) {
    return new Response("no autorizado", { status: 401 });
  }
  const u = await req.json().catch(() => null);
  const msg = u?.message;
  // Solo el chat de Javier: cualquier otro que escriba al bot se ignora.
  if (!msg || String(msg.chat?.id) !== String(cfg.tg_chat)) return new Response("ok");

  // Se contesta enseguida a Telegram y el trabajo sigue en segundo plano
  // (si tardara, Telegram reenviaría el mismo mensaje).
  const trabajo = (async () => {
    try {
      if (msg.video || msg.video_note || msg.voice || msg.audio || msg.document) return await guardarVideo(cfg, u.update_id, msg);
      if (msg.text && msg.reply_to_message && (await asignarCodigo(cfg, msg))) return;
      if (/^\/?(estado|videos|vídeos)/i.test(msg.text || "")) return await estado(cfg, msg.message_id);
      if (msg.text) {
        await responder(cfg, msg.message_id, "Mándame los vídeos como vídeo normal, con su código en el texto: «A1» para las tomas a cámara, «A1 pantalla» para las grabaciones de pantalla y «BROLL» para tus clips jugando. Escribe «estado» para ver lo que me ha llegado.");
      }
    } catch (e) {
      await responder(cfg, msg.message_id, `Algo ha fallado: ${String((e as Error).message || e)}`).catch(() => {});
    }
  })();
  // @ts-ignore: EdgeRuntime existe en Supabase Edge Functions
  EdgeRuntime.waitUntil(trabajo);
  return new Response("ok");
});
