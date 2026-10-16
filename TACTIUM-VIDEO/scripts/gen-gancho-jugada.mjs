// Gancho de IA sobre una jugada REAL (lección «Ganchos hiper-realistas» de AI Mastery, 12-10):
// se toma el fotograma del golpe de public/broll/juego-11.mp4 (5,4 s, remate) y Kling 2.5 Turbo Pro
// lo anima con un efecto. Dos variantes en paralelo (≈ 0,35 $ cada una, 5 s):
//   a = tiempo congelado + empuje de cámara   ·   b = onda de choque + bola disparada a cámara
//
//   node scripts/gen-gancho-jugada.mjs        → public/broll/ia-jugada-a.mp4 y ia-jugada-b.mp4
// La IA todavía falla con la bola y la pala: por eso solo se usa 1-2 s, a cámara rápida, y se juzga a ojo.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = fs.readFileSync(path.join(ROOT, "panel/.env"), "utf8");
const KEY = (env.match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");
const h = { Authorization: `Key ${KEY}`, "content-type": "application/json" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const imagen = "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "public/gen/jugada-11.jpg")).toString("base64");
const NEG = "text, watermark, logo, letters, blurry, distorted face, deformed racket, extra limbs, extra rackets, cartoon, low quality";

const VARIANTES = {
  a: "Time freezes at the exact moment of the smash: the player and the ball stay suspended in mid-air while the camera makes a fast cinematic push-in toward him, slight orbit, sand and dust particles floating in the air, light rays through the roof windows, hyper-realistic, sharp, no change to the player's pose",
  b: "A bright white shockwave ring bursts outward from the racket at the moment of impact, the padel ball shoots fast toward the camera leaving a motion streak, dust and sand explode off the court, the camera shakes slightly then pushes in, hyper-realistic cinematic, the player keeps his pose",
};

async function generar([id, prompt]) {
  const r = await fetch("https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
    method: "POST", headers: h,
    body: JSON.stringify({ prompt, image_url: imagen, duration: "5", negative_prompt: NEG, cfg_scale: 0.5 }),
  });
  const cola = await r.json();
  if (!cola.status_url) throw new Error(`${id}: ${JSON.stringify(cola).slice(0, 300)}`);
  for (let i = 0; i < 180; i++) {
    await espera(4000);
    const s = await (await fetch(cola.status_url, { headers: h })).json();
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(`${id}: ${JSON.stringify(s).slice(0, 300)}`);
  }
  const res = await (await fetch(cola.response_url, { headers: h })).json();
  const url = res.video?.url;
  if (!url) throw new Error(`${id}: sin vídeo ${JSON.stringify(res).slice(0, 300)}`);
  const sal = path.join(ROOT, `public/broll/ia-jugada-${id}.mp4`);
  fs.writeFileSync(sal, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return sal;
}

const res = await Promise.allSettled(Object.entries(VARIANTES).map(generar));
res.forEach((r, i) => console.log(r.status === "fulfilled" ? `ok ${r.value}` : `FALLO ${r.reason.message}`));
