// Conecta el bot de Telegram a los avisos de la nube.
//   node panel/conectar-telegram.mjs <token-de-BotFather>
// Antes, escribe «hola» a tu bot en Telegram: así se sabe a qué chat mandar los avisos.
import fs from "node:fs";
import path from "node:path";

const token = process.argv[2];
if (!/^\d+:[\w-]{30,}$/.test(token || "")) { console.error("Pásame el token de BotFather como argumento."); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const tg = async (m, cuerpo) => (await fetch(`https://api.telegram.org/bot${token}/${m}`, cuerpo ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) } : undefined)).json();

const yo = await tg("getMe");
if (!yo.ok) { console.error("Token no válido:", yo.description); process.exit(1); }
const upd = await tg("getUpdates");
const chat = [...(upd.result || [])].reverse().find((u) => u.message?.chat?.type === "private")?.message.chat;
if (!chat) { console.error(`Bot @${yo.result.username} correcto, pero no le has escrito todavía. Escríbele «hola» y vuelve a lanzarlo.`); process.exit(2); }

const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" };
const ahora = new Date().toISOString();
const r = await fetch(`${env.SUPABASE_URL}/rest/v1/redes_config?on_conflict=clave`, { method: "POST", headers: h, body: JSON.stringify([
  { clave: "tg_token", valor: token, actualizado: ahora },
  { clave: "tg_chat", valor: String(chat.id), actualizado: ahora },
]) });
if (!r.ok) { console.error("No se pudo guardar en Supabase:", r.status, await r.text()); process.exit(1); }
const prueba = await tg("sendMessage", { chat_id: chat.id, text: "Conectado. Aquí te llegará cada publicación de @tactium.io, lo que toca después y un resumen cada mañana." });
console.log(`Bot @${yo.result.username} conectado al chat de ${chat.first_name || chat.username} · mensaje de prueba: ${prueba.ok ? "enviado" : prueba.description}`);
