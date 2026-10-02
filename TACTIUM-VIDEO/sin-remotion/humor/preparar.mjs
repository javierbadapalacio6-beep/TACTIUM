// Prepara el montaje de un reel de muñecos a partir de sus voces:
// duración real de cada frase, envolvente de volumen (para la boca, a 30 fps),
// palabras con sus tiempos (src/reel/palabras/<pieza>-<id>.json, de transcribir.py)
// y las pistas de audio con su momento. Escribe sin-remotion/humor/<pieza>.json.
//   node sin-remotion/humor/preparar.mjs sin-remotion/humor/H1-montaje.json
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const montaje = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const voces = JSON.parse(fs.readFileSync(montaje.voces, "utf8"));
const FPS = 30;
const duracion = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();
function envolvente(f) {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  const n = pcm.length / 2, paso = 8000 / FPS, v = [];
  for (let i = 0; i + paso <= n; i += paso) { let s = 0; for (let j = 0; j < paso; j++) { const x = pcm.readInt16LE((Math.floor(i) + j) * 2) / 32768; s += x * x; } v.push(Math.sqrt(s / paso)); }
  const top = [...v].sort((a, b) => b - a)[Math.floor(v.length * 0.05)] || 1;
  return v.map((x) => +Math.min(1, x / top).toFixed(2));
}

let t = 0; const escenas = [], pistas = [];
for (const e of montaje.escenas) {
  const desde = t; let fin;
  const out = { id: e.id, desde };
  if (e.voz) {
    const src = `public/voz/ia/${montaje.pieza}/${e.voz}.mp3`, d = duracion(src), en = desde + e.antes;
    const frase = voces.frases.find((f) => f.id === e.voz);
    const pal = JSON.parse(fs.readFileSync(`src/reel/palabras/${montaje.pieza}-${e.voz}.json`, "utf8")).palabras;
    out.voz = { src, en, dur: d, env: envolvente(src), texto: frase.texto, palabras: pal.map((p) => ({ t: p.t, a: p.a / 1000, b: p.b / 1000 })) };
    pistas.push({ src, en, vol: 1 });
    fin = en + d + e.despues;
  } else fin = desde + e.dur;
  // Un efecto va a un segundo de la escena (`en`) o pegado a una palabra dicha (`palabra` + `tras`).
  for (const s of e.sfx || []) {
    let en = desde + (s.en ?? 0);
    if (s.palabra && out.voz) { const p = out.voz.palabras.find((w) => w.t.toLowerCase().replace(/[^a-záéíóúñü]/g, "").startsWith(s.palabra)); if (p) en = out.voz.en + p.a + (s.tras ?? 0); }
    pistas.push({ src: s.src, en: +Math.max(0, en).toFixed(3), vol: s.vol ?? 1 });
  }
  out.hasta = +fin.toFixed(3); escenas.push(out); t = fin;
}
// Música de fondo: desde el principio, baja, recortada desde `desde` y con fundido al final.
// Mientras alguien habla, la música baja (`agacha`, p. ej. 0.5 = a la mitad) y vuelve a subir en las pausas.
const hablan = escenas.filter((e) => e.voz).map((e) => [+(e.voz.en - 0.15).toFixed(2), +(e.voz.en + e.voz.dur + 0.15).toFixed(2)]);
if (montaje.musica) pistas.unshift({ src: montaje.musica.src, en: 0, desde: montaje.musica.desde ?? 0, vol: montaje.musica.vol ?? 0.06, fundido: true, agacha: montaje.musica.agacha ?? 0.5, hablan });
const salida = { pieza: montaje.pieza, dur: +t.toFixed(3), fps: FPS, escenas, pistas };
fs.writeFileSync(`sin-remotion/humor/${montaje.pieza}.json`, JSON.stringify(salida));
console.log(`${montaje.pieza}: ${salida.dur.toFixed(1)} s · ${escenas.map((e) => `${e.id} ${e.desde.toFixed(1)}-${e.hasta.toFixed(1)}`).join(" · ")}`);
