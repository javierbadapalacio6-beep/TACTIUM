// Registra el webhook del bot de Telegram en la función redes-telegram de Supabase.
// Hace falta una vez (o si se cambia el token del bot).
//   node panel/activar-bot.mjs
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const cfg = Object.fromEntries((await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_config?clave=in.(tg_token,tg_webhook_secreto)&select=clave,valor`, { headers: h })).json()).map((x) => [x.clave, x.valor]));
const r = await (await fetch(`https://api.telegram.org/bot${cfg.tg_token}/setWebhook`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: `${env.SUPABASE_URL}/functions/v1/redes-telegram`, secret_token: cfg.tg_webhook_secreto, allowed_updates: ["message"], drop_pending_updates: true }),
})).json();
const info = await (await fetch(`https://api.telegram.org/bot${cfg.tg_token}/getWebhookInfo`)).json();
console.log("webhook:", r.ok ? "registrado" : r.description, "·", info.result.url, "· pendientes:", info.result.pending_update_count, info.result.last_error_message ? `· último error: ${info.result.last_error_message}` : "");
