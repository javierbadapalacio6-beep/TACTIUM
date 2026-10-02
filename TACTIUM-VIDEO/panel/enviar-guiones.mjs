// Manda por el bot de Telegram los guiones de los reels por grabar, en orden de publicación:
// un mensaje de resumen y uno por reel (el mismo texto que el recordatorio de grabación).
//   node panel/enviar-guiones.mjs            → todos los pendientes
//   node panel/enviar-guiones.mjs A1 T1      → solo esos
import fs from "node:fs";
import path from "node:path";
import * as grabaciones from "./grabaciones.mjs";

const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const cfg = Object.fromEntries((await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_config?select=clave,valor&clave=in.(tg_token,tg_chat)`, { headers: h })).json()).map((r) => [r.clave, r.valor]));
const enviar = async (text) => {
  const r = await (await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: cfg.tg_chat, text }) })).json();
  if (!r.ok) throw new Error(r.description);
  await new Promise((res) => setTimeout(res, 700)); // sin atropellar a Telegram
};

const solo = process.argv.slice(2).map((x) => x.toUpperCase());
const piezas = grabaciones.porGrabar().filter((p) => !solo.length || solo.includes(p.id.toUpperCase())).sort((a, b) => a.fecha.localeCompare(b.fecha));
const dia = (f) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(f + "T12:00:00Z"));

const nota = process.env.NOTA ? `\n\n${process.env.NOTA}` : "";
await enviar(
  `GUIONES PARA GRABAR (${piezas.length}), en orden de publicación:\n\n` +
  piezas.map((p) => `${p.id} · ${p.titulo} · sale ${dia(p.fecha)}`).join("\n") +
  `\n\nTe llega un mensaje por guion. Graba cada uno con sus tomas y mándalas aquí con su código en el texto (A1, T1…). Las pantallas, con «A1 pantalla».${nota}`,
);
for (const p of piezas) await enviar(grabaciones.mensaje(p));
console.log(`Enviados ${piezas.length} guiones.`);
