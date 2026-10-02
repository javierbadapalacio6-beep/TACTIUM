// Manda un vídeo al bot de Telegram para revisarlo en el móvil (copia ligera a 720p).
//   node panel/enviar-vista.mjs renders/T1-alineacion-9x16.mp4 "Texto opcional"
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const cfg = Object.fromEntries((await (await fetch(`${env.SUPABASE_URL}/rest/v1/redes_config?select=clave,valor&clave=in.(tg_token,tg_chat)`, { headers: h })).json()).map((r) => [r.clave, r.valor]));

const [origen, texto = ""] = process.argv.slice(2);
const vista = origen.replace(/\.mp4$/, "-vista-movil.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", origen, "-vf", "scale='if(gt(iw,ih),1280,720)':-2", "-c:v", "libx264", "-crf", "26", "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", vista]);
const fd = new FormData();
fd.append("chat_id", cfg.tg_chat);
fd.append("caption", texto || path.basename(origen));
fd.append("supports_streaming", "true");
fd.append("video", new Blob([fs.readFileSync(vista)], { type: "video/mp4" }), path.basename(vista));
const r = await (await fetch(`https://api.telegram.org/bot${cfg.tg_token}/sendVideo`, { method: "POST", body: fd })).json();
console.log(r.ok ? `${path.basename(vista)} enviado` : `Error: ${r.description}`);
