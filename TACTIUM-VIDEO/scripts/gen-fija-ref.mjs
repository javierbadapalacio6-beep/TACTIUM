// Imágenes fijas 16:9 para la imagen de apoyo, generadas A PARTIR DE FOTOS DE REFERENCIA
// (referencias/, fuera de git). Primer paso antes de animarlas: se revisan y, si están bien,
// se animan con gen-clip.mjs (imagen → vídeo).
//
//   node scripts/gen-fija-ref.mjs              → todas las de scripts/fijas-ref.json
//   node scripts/gen-fija-ref.mjs bola-linea   → solo esa
//
// Modelo: fal-ai/nano-banana/edit (≈ 0,04 $ por imagen). Sale en public/broll/fijas/<id>.png.
// Las referencias son de terceros y llevan marcas: se piden SIN logos ni texto.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const KEY = (fs.readFileSync(path.join(ROOT, "panel/.env"), "utf8").match(/^FAL_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error("Falta FAL_KEY en panel/.env");

const REGLAS =
  "Photorealistic, natural light, shot on a full-frame camera, 16:9 landscape. " +
  "The reference photos only show what real padel equipment looks like: keep those real proportions and materials, " +
  "but create a NEW original photograph with a different composition and camera angle. " +
  "Plain unbranded equipment: no logos, no text, no letters, no numbers, no watermarks. No people.";

const MIME = { ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const dataUri = (f) => `data:${MIME[path.extname(f)]};base64,${fs.readFileSync(path.join(ROOT, "referencias", f)).toString("base64")}`;

const fijas = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/fijas-ref.json"), "utf8"));
const DEST = path.join(ROOT, "public/broll/fijas");
fs.mkdirSync(DEST, { recursive: true });

async function generar(f) {
  const r = await fetch("https://fal.run/fal-ai/nano-banana/edit", {
    method: "POST",
    headers: { Authorization: `Key ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      // `manos: true` → se permiten manos (nunca caras): la IA falla menos con manos que con gente.
      prompt: `${f.prompt} ${f.manos ? REGLAS.replace("No people.", "Only hands visible, no faces, no full bodies.") : REGLAS}`,
      image_urls: f.refs.map(dataUri),
      aspect_ratio: "16:9",
      num_images: 1,
      output_format: "png",
    }),
  });
  const j = await r.json();
  const url = j.images?.[0]?.url;
  if (!url) throw new Error(`${f.id}: ${JSON.stringify(j).slice(0, 300)}`);
  const sal = path.join(DEST, `${f.id}.png`);
  fs.writeFileSync(sal, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return sal;
}

const solo = process.argv[2];
const lista = fijas.filter((f) => !solo || f.id === solo);
const res = await Promise.allSettled(lista.map(generar));
res.forEach((r, i) => console.log(r.status === "fulfilled" ? `ok ${lista[i].id}` : `FALLO ${r.reason.message}`));
