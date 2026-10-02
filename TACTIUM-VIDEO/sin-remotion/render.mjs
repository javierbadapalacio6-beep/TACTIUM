// Render de escenas sin Remotion: sirve la escena, la recorre fotograma a
// fotograma con Chrome sin ventana (el que ya trae Remotion) y la pasa a FFmpeg.
// Duración, fps, música y salida los declara la propia escena (window.__meta,
// ver lib/base.js). Sin música → MP4 sin audio, listo como plano para Remotion.
//
//   node sin-remotion/render.mjs escenas/showreel.html                → su `salida`
//   node sin-remotion/render.mjs escenas/showreel.html --stills 1,3,6 → storyboard/<escena>/*.jpg
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ESCENA = process.argv[2];
if (!ESCENA || ESCENA.startsWith("--")) { console.error("uso: node sin-remotion/render.mjs escenas/<escena>.html [--stills 1,3,6]"); process.exit(1); }
const CHROME = path.join(ROOT, "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe");

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2", ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/sin-remotion/${ESCENA}?render=1`;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
page.on("pageerror", (e) => console.error("[page]", e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const { dur: DUR, fps: FPS, musica, pistas, salida } = await page.evaluate(() => window.__meta);
const shot = async (t) => { await page.evaluate((x) => window.seek(x), t); return page.screenshot({ type: "jpeg", quality: 93 }); };

const stillsArg = process.argv.indexOf("--stills");
if (stillsArg > -1) {
  const dir = path.join(ROOT, "sin-remotion/storyboard", path.basename(ESCENA, ".html")); fs.mkdirSync(dir, { recursive: true });
  for (const t of process.argv[stillsArg + 1].split(",").map(Number)) {
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.jpg`), await shot(t));
  }
  console.log("storyboard →", dir);
} else {
  const out = path.join(ROOT, salida); fs.mkdirSync(path.dirname(out), { recursive: true });
  // `pistas`: varias fuentes (voces, efectos) cada una en su segundo, mezcladas sin normalizar.
  const mezcla = pistas?.length ? [
    ...pistas.flatMap((p) => ["-i", path.join(ROOT, p.src)]),
    "-filter_complex", pistas.map((p, i) => `[${i + 1}:a]${p.desde ? `atrim=start=${p.desde},asetpts=PTS-STARTPTS,` : ""}${p.fundido ? `afade=t=out:st=${Math.max(0, DUR - 1.2 - p.en)}:d=1.2,` : ""}adelay=${Math.round(p.en * 1000)}:all=1,volume=${p.agacha && p.hablan?.length ? `'${p.vol}*(1-${p.agacha}*min(1,${p.hablan.map(([a, b]) => `between(t,${a},${b})`).join("+")}))':eval=frame` : (p.vol ?? 1)}[p${i}]`).join(";") +
      `;${pistas.map((_, i) => `[p${i}]`).join("")}amix=inputs=${pistas.length}:normalize=0:duration=longest,atrim=0:${DUR},apad=whole_dur=${DUR}[a]`,
    "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k",
  ] : null;
  const audio = mezcla || (musica ? [
    "-ss", String(musica.desde ?? 0), "-i", path.join(ROOT, musica.src),
    "-filter_complex", `[1:a]atrim=0:${DUR},afade=t=in:d=0.3,afade=t=out:st=${DUR - 0.8}:d=0.8[a]`,
    "-map", "0:v", "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-shortest",
  ] : ["-an"]);
  const ff = spawn("ffmpeg", [
    "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    ...audio,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-maxrate", "12M", "-bufsize", "24M", "-preset", "medium", "-r", String(FPS), // listo para subir: el grano dispara el bitrate
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const total = FPS * DUR, t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const buf = await shot(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) process.stdout.write(`\r${f}/${total} fotogramas · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on("close", (c) => (c ? j(new Error("ffmpeg " + c)) : r())));
  console.log(`\nlisto → ${out} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
server.close();
