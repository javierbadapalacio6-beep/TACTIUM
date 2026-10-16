// Gancho de IA «el móvil se ensambla» (lección «Efecto descomponer» de AI Mastery, 12-10).
// Tres pasos en fal.ai, ≈ 0,6 $ en total:
//   1) Nano Banana Pro  → móvil genérico «descompuesto» (piezas flotando), 9:16
//   2) Nano Banana Pro (edit) → el mismo móvil montado, de frente
//   3) Kling 2.5 Turbo Pro imagen→vídeo con fotograma inicial y final (5 s)
// Sin texto ni marcas en el móvil: la app real la pone Remotion encima (la IA deforma las interfaces).
//
//   node scripts/gen-gancho-ensamblaje.mjs
//
// Deja public/gen/ensamblaje-a.png, ensamblaje-b.png y public/broll/ia-ensamblaje.mp4.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const env = fs.readFileSync(path.join(ROOT, "panel/.env"), "utf8");
const KEY = (env.match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");
const h = { Authorization: `Key ${KEY}`, "content-type": "application/json" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function fal(modelo, entrada) {
  const r = await fetch(`https://queue.fal.run/${modelo}`, { method: "POST", headers: h, body: JSON.stringify(entrada) });
  const cola = await r.json();
  if (!cola.status_url) throw new Error(`${modelo}: ${JSON.stringify(cola).slice(0, 300)}`);
  for (let i = 0; i < 180; i++) {
    await espera(4000);
    const s = await (await fetch(cola.status_url, { headers: h })).json();
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(`${modelo}: ${JSON.stringify(s).slice(0, 300)}`);
  }
  return await (await fetch(cola.response_url, { headers: h })).json();
}
const bajar = async (url, sal) => fs.writeFileSync(sal, Buffer.from(await (await fetch(url)).arrayBuffer()));

const ESTILO = "dark black studio background with deep emerald green rim light, glossy, premium product render, 4k, no text, no logos, no brand marks";

fs.mkdirSync(path.join(ROOT, "public/gen"), { recursive: true });
const A = path.join(ROOT, "public/gen/ensamblaje-a.png");
const B = path.join(ROOT, "public/gen/ensamblaje-b.png");

console.log("1/3 móvil descompuesto…");
const a = await fal("fal-ai/nano-banana-pro", {
  prompt: `Exploded-view product render of a generic modern smartphone: the glass screen, the frame, the battery and the circuit board floating apart in the air, evenly spaced along a vertical axis, slightly rotated, vertical composition. ${ESTILO}`,
  aspect_ratio: "9:16", resolution: "1K", num_images: 1, output_format: "png",
});
const urlA = a.images?.[0]?.url;
if (!urlA) throw new Error("sin imagen A: " + JSON.stringify(a).slice(0, 300));
await bajar(urlA, A);

console.log("2/3 móvil montado…");
const b = await fal("fal-ai/nano-banana-pro/edit", {
  prompt: `The same smartphone, now fully assembled and seen straight from the front, centered, upright, the screen glowing soft emerald green with a faint abstract light, no text and no icons on the screen. ${ESTILO}`,
  image_urls: [urlA], aspect_ratio: "9:16", resolution: "1K", num_images: 1, output_format: "png",
});
const urlB = b.images?.[0]?.url;
if (!urlB) throw new Error("sin imagen B: " + JSON.stringify(b).slice(0, 300));
await bajar(urlB, B);

console.log("3/3 animando con Kling…");
const v = await fal("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
  prompt: "The floating parts of the smartphone fly together fast and snap precisely into place, assembling into the complete phone, smooth cinematic motion, a bright flash of green light at the moment it locks together, camera slowly pushes in",
  image_url: urlA, tail_image_url: urlB, duration: "5",
  negative_prompt: "text, watermark, logo, letters, blurry, distorted, low quality, extra parts",
  cfg_scale: 0.5,
});
const urlV = v.video?.url;
if (!urlV) throw new Error("sin vídeo: " + JSON.stringify(v).slice(0, 300));
fs.mkdirSync(path.join(ROOT, "public/broll"), { recursive: true });
await bajar(urlV, path.join(ROOT, "public/broll/ia-ensamblaje.mp4"));
console.log("ok public/broll/ia-ensamblaje.mp4");
