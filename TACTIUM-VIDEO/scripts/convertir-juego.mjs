// Convierte los clips originales de juego (iPhone: HEVC 10 bits, HDR HLG, 4K 60p) a clips
// listos para Remotion en public/broll/juego-NN.mp4: H.264, color normal (SDR bt709), 60 fps.
//   · Horizontales → 1920×1080.   · Verticales (9:16) → 1080×1920.
// Lleva la cuenta en public/broll/juego.json (original → juego-NN, orientación, duración)
// para no convertir dos veces lo mismo. Uso:
//   node scripts/convertir-juego.mjs            → convierte los originales nuevos
//
// Receta de color: con zscale directo o tonemap (mobius) el techo se quema y con hable
// sale apagado; la conversión de matriz bt2020 → bt709 deja la pista y la piel naturales.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ORIG = path.join(ROOT, "bruto/broll/originales");
const DEST = path.join(ROOT, "public/broll");
const REG = path.join(DEST, "juego.json");

const reg = fs.existsSync(REG) ? JSON.parse(fs.readFileSync(REG, "utf8")) : {};
const hechos = new Set(Object.values(reg).map((r) => r.original));
const siguiente = () => {
  const usados = Object.keys(reg).map((k) => Number(k.replace("juego-", ""))).filter(Boolean);
  for (let n = 1; ; n++) if (!usados.includes(n) && !fs.existsSync(path.join(DEST, `juego-${String(n).padStart(2, "0")}.mp4`))) return n;
};

const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
  "stream=width,height,color_transfer:stream_side_data=rotation:format=duration", "-of", "json", f]).toString());

const nuevos = fs.readdirSync(ORIG).filter((f) => /\.(mov|mp4|m4v)$/i.test(f) && !hechos.has(f)).sort();
if (!nuevos.length) { console.log("No hay originales nuevos."); process.exit(0); }

for (const f of nuevos) {
  const src = path.join(ORIG, f);
  const p = probe(src);
  const s = p.streams[0];
  const rot = Math.abs(Number(s.side_data_list?.find((d) => d.rotation !== undefined)?.rotation || 0));
  // ffmpeg ya gira el vídeo según su metadato: la orientación real es la girada.
  const [w, h] = rot === 90 || rot === 270 ? [s.height, s.width] : [s.width, s.height];
  const vertical = h > w;
  const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
  const hdr = /arib-std-b67|smpte2084/.test(s.color_transfer || "");
  const matriz = hdr ? ":in_color_matrix=bt2020:out_color_matrix=bt709" : "";
  const id = `juego-${String(siguiente()).padStart(2, "0")}`;
  const sal = path.join(DEST, `${id}.mp4`);
  // «cover»: rellena el lienzo recortando lo que sobre (por si el original no es 16:9/9:16 exacto).
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos${matriz},crop=${W}:${H},format=yuv420p`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", vf, "-r", "60", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", "-movflags", "+faststart", sal]);
  const dur = Number(probe(sal).format.duration);
  reg[id] = { original: f, orientacion: vertical ? "vertical" : "horizontal", duracion: Math.round(dur * 100) / 100 };
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + "\n");
  console.log(`ok ${id} ← ${f} (${vertical ? "9:16" : "16:9"}, ${dur.toFixed(1)} s${hdr ? ", HDR → SDR" : ""})`);
}
