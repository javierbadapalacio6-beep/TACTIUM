// Voces con IA para los reels de muñecos (fal.ai → ElevenLabs Multilingual v2).
// Cuesta céntimos: se cobra por carácter, y una pieza de humor son ~300 caracteres.
//
//   node scripts/gen-voz.mjs <guion.json>         → genera las frases que falten
//   node scripts/gen-voz.mjs <guion.json> --todas → las vuelve a generar todas
//
// El guion: { "pieza": "H1", "modelo": "v3", "frases": [{ "id": "01-capitan", "voz": "Brian",
//   "texto": "…" (lo que se dice: subtítulos), "actuado": "[suspira] …" (lo que lee v3) }] }. Cada frase sale en public/voz/ia/<pieza>/<id>.mp3.
// La clave va en panel/.env (FAL_KEY).
import fs from "node:fs";
import path from "node:path";

const env = fs.readFileSync("panel/.env", "utf8");
const KEY = (env.match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");
// v3 interpreta etiquetas entre corchetes ([suspira], [susurrando], [desesperado]…) para dar
// dramatismo; multilingual-v2 es más estable pero más plano. Se elige por guion ("modelo": "v3").
const MODELOS = { v2: "fal-ai/elevenlabs/tts/multilingual-v2", v3: "fal-ai/elevenlabs/tts/eleven-v3" };
const h = { Authorization: `Key ${KEY}`, "content-type": "application/json" };

const [archivo, ...flags] = process.argv.slice(2);
if (!archivo) throw new Error("uso: node scripts/gen-voz.mjs <guion.json> [--todas]");
const guion = JSON.parse(fs.readFileSync(archivo, "utf8"));
const dir = path.join("public/voz/ia", guion.pieza);
fs.mkdirSync(dir, { recursive: true });

for (const f of guion.frases) {
  const out = path.join(dir, `${f.id}.mp3`);
  if (fs.existsSync(out) && !flags.includes("--todas")) { console.log(`· ${f.id} ya está`); continue; }
  const v3 = (f.modelo || guion.modelo) === "v3";
  const cuerpo = v3
    ? { text: f.actuado || f.texto, voice: f.voz, stability: f.estabilidad ?? 0.0, language_code: "es" }
    : { text: f.texto, voice: f.voz, stability: f.estabilidad ?? 0.4, similarity_boost: 0.75, style: f.estilo ?? 0.3, speed: f.velocidad ?? 1.0, language_code: "es" };
  const r = await fetch(`https://queue.fal.run/${MODELOS[v3 ? "v3" : "v2"]}`, { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
  if (!r.ok) throw new Error(`${f.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  const cola = await r.json();
  let s;
  do { await new Promise((ok) => setTimeout(ok, 1500)); s = await (await fetch(cola.status_url, { headers: h })).json(); } while (s.status !== "COMPLETED" && s.status !== "FAILED" && s.status !== "ERROR");
  const res = await (await fetch(cola.response_url, { headers: h })).json();
  const url = res.audio?.url;
  if (!url) throw new Error(`${f.id}: sin audio · ${JSON.stringify(res).slice(0, 300)}`);
  fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`✓ ${f.id} (${f.voz})`);
}
