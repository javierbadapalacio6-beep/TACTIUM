// Anima una imagen fija YA APROBADA (public/broll/fijas/<id>.png) → public/broll/<id>.mp4.
// Kling 2.5 Turbo Pro imagen→vídeo, 5 s = 0,35 $. Solo movimiento de cámara y de luz:
// la pista, la pala y la pelota no se tocan (por eso se parte de la imagen aprobada).
//
//   node scripts/animar-fija.mjs bola-linea pista-noche …
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const KEY = (fs.readFileSync(path.join(ROOT, "panel/.env"), "utf8").match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");

const MODELO = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const NEGATIVO = "morphing, objects changing shape, extra balls, extra rackets, people appearing, text, logos, warping net, fast motion, shaky camera";
// Movimiento por imagen. Siempre lento: es imagen de apoyo detrás de texto grande.
const MOVIMIENTO = {
  "bola-linea": "Very slow push-in towards the ball at ground level, the ball stays still, slight shimmer of light on the glass behind. Everything else remains exactly as in the image.",
  "pista-atardecer": "Slow smooth dolly forward from the corner towards the net, the sun flare gently shifts, long shadows stay on the turf. The court keeps exactly its layout.",
  "pista-exterior-atardecer": "Slow lateral tracking shot to the right along the outside of the court, clouds drifting slowly in the pink sky. The structure keeps exactly its shape.",
  "pista-cristal-dia": "Slow lateral tracking shot along the glass wall, palm leaves moving gently in the breeze, sunlight reflections sliding on the glass. The court keeps exactly its layout.",
  "pista-noche": "Very slow push-in through the centre of the court, floodlights glowing with a soft flicker, light haze. The court keeps exactly its layout.",
  "puntos-libreta": "Very slow push-in. The hand writes a short number with the pen in the notebook, small natural movement; the other hand, the racket and the ball stay still. No new objects.",
  "movil-notificaciones": "Very slow push-in towards the phone. On the phone screen new chat bubbles appear one after another and the screen glows softly; the ball, the bench and the court stay still.",
  "libreta-parejas": "Very slow push-in. The hand slowly crosses out one line in the notebook with the pen; the lamp light flickers very softly. Everything else stays still.",
  "palas-red": "Very slow push-in towards the rackets and balls, soft daylight, subtle reflections moving on the glass wall. The rackets and balls stay completely still and keep exactly their shape, holes and colours.",
};

const h = { Authorization: `Key ${KEY}`, "content-type": "application/json" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function animar(id) {
  const png = path.join(ROOT, "public/broll/fijas", `${id}.png`);
  if (!fs.existsSync(png)) throw new Error(`${id}: no existe la imagen fija`);
  if (!MOVIMIENTO[id]) throw new Error(`${id}: falta su movimiento en MOVIMIENTO`);
  // JPEG para que la petición no pese megas.
  const jpg = png.replace(/\.png$/, ".jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-q:v", "3", jpg]);
  const image_url = `data:image/jpeg;base64,${fs.readFileSync(jpg).toString("base64")}`;
  const r = await fetch(`https://queue.fal.run/${MODELO}`, {
    method: "POST", headers: h,
    body: JSON.stringify({ prompt: MOVIMIENTO[id], image_url, duration: "5", negative_prompt: NEGATIVO, cfg_scale: 0.5 }),
  });
  const cola = await r.json();
  if (!cola.status_url) throw new Error(`${id}: ${JSON.stringify(cola).slice(0, 300)}`);
  for (let i = 0; i < 120; i++) {
    await espera(5000);
    const s = await (await fetch(cola.status_url, { headers: h })).json();
    if (s.status === "COMPLETED") break;
    if (s.status === "FAILED" || s.error) throw new Error(`${id}: ${JSON.stringify(s).slice(0, 300)}`);
  }
  const res = await (await fetch(cola.response_url, { headers: h })).json();
  if (!res.video?.url) throw new Error(`${id}: ${JSON.stringify(res).slice(0, 300)}`);
  const sal = path.join(ROOT, "public/broll", `${id}.mp4`);
  fs.writeFileSync(sal, Buffer.from(await (await fetch(res.video.url)).arrayBuffer()));
  return sal;
}

const ids = process.argv.slice(2);
if (!ids.length) throw new Error("Di qué imágenes animar: node scripts/animar-fija.mjs <id> …");
const res = await Promise.allSettled(ids.map(animar));
res.forEach((r, i) => console.log(r.status === "fulfilled" ? `ok ${ids[i]}` : `FALLO ${r.reason.message}`));
