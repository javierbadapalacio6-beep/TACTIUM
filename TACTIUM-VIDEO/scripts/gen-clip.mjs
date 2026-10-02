// Genera clips de ambiente con IA en fal.ai (Kling 2.5 Turbo Pro, 16:9, 5 s ≈ 0,35 $ cada uno).
//
//   node scripts/gen-clip.mjs                 → genera los de scripts/clips-ia.json que falten
//   node scripts/gen-clip.mjs pista-noche     → solo ese (lo rehace aunque exista)
//
// Deja cada clip en public/broll/ia-<id>.mp4. La clave va en panel/.env (FAL_KEY).
// Solo AMBIENTE: pista vacía, bola, palas, red. El pádel en acción lo pone Javier con sus
// propios clips: la IA todavía falla con la bola, la pala y la malla de la red.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = fs.readFileSync(path.join(ROOT, "panel/.env"), "utf8");
const KEY = (env.match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");

const MODELO = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";
const NEGATIVO = "text, watermark, logo, letters, people faces close-up, distorted racket, extra limbs, blurry, low quality, cartoon";
const clips = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/clips-ia.json"), "utf8"));
const DEST = path.join(ROOT, "public/broll");
fs.mkdirSync(DEST, { recursive: true });

const h = { Authorization: `Key ${KEY}`, "content-type": "application/json" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function generar(c) {
  const sal = path.join(DEST, `ia-${c.id}.mp4`);
  const r = await fetch(`https://queue.fal.run/${MODELO}`, {
    method: "POST", headers: h,
    body: JSON.stringify({ prompt: c.prompt, duration: "5", aspect_ratio: "16:9", negative_prompt: NEGATIVO, cfg_scale: 0.5 }),
  });
  const cola = await r.json();
  if (!cola.status_url) throw new Error(`${c.id}: ${JSON.stringify(cola).slice(0, 200)}`);
  for (let i = 0; i < 120; i++) {
    await espera(5000);
    const s = await (await fetch(cola.status_url, { headers: h })).json();
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(`${c.id}: ${JSON.stringify(s).slice(0, 200)}`);
  }
  const res = await (await fetch(cola.response_url, { headers: h })).json();
  const url = res.video?.url;
  if (!url) throw new Error(`${c.id}: sin vídeo ${JSON.stringify(res).slice(0, 200)}`);
  fs.writeFileSync(sal, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return sal;
}

const solo = process.argv[2];
const lista = clips.filter((c) => (solo ? c.id === solo : !fs.existsSync(path.join(DEST, `ia-${c.id}.mp4`))));
const res = await Promise.allSettled(lista.map(generar));
res.forEach((r, i) => console.log(r.status === "fulfilled" ? `ok ${lista[i].id}` : `FALLO ${r.reason.message}`));
