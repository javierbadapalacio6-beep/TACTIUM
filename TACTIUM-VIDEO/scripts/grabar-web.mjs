// Graba en vídeo un recorrido por la web (tactium.io) en móvil, con los toques anotados,
// para montarlo después en Remotion (cursor de dedo, toques y zooms en `WebGrabada`).
//
//   node scripts/grabar-web.mjs torneos-publico
//
// Sale `public/web/grabaciones/<recorrido>.mp4` + `<recorrido>.json`, con el instante en
// que la página queda lista (`inicioMs`), los toques ({ms, x, y} en px CSS de 390×844) y
// las pausas marcadas. Solo páginas públicas: aquí no se inicia sesión ni se paga.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const OUT = "public/web/grabaciones";
const BASE = "https://tactium.io";
const VW = 390, VH = 844, DPR = 3;

/** Recorridos: pasos { ir } | { toca: texto | {css} | {boton} } | { escribe } | { baja: px } | { espera: ms }. */
const RECORRIDOS = {
  "torneos-publico": [
    { ir: "/torneos" }, { listo: true }, { espera: 1400 },
    { toca: { css: "a[href='/torneos/dd508541-9587-49e5-a09b-e2aa4efe632a']" } }, { espera: 2200 },
    { toca: { boton: "Cuadro" } }, { espera: 1200 }, { baja: 330 }, { espera: 900 }, { toca: { boton: "Cuartos" } }, { espera: 1800 }, { baja: -330 }, { espera: 400 },
    { toca: { boton: "Partidos" } }, { espera: 900 }, { toca: { boton: "Mar 1" } }, { espera: 1600 },
    { ir: "/torneos" }, { espera: 900 }, { bajaHasta: "Continuar" }, { espera: 700 },
    { toca: { css: "input[placeholder='K7P2QX']" } }, { escribe: "DEMO16" }, { espera: 500 },
    { toca: "Continuar" }, { espera: 2400 }, { baja: 240 }, { espera: 2200 },
  ],
  // Reel W1: buscas tu equipo, ves su grupo de 2026/27 y la plantilla de un rival con sus puntos.
  "busca-tu-equipo": [
    { ir: "/federacion/cantabra" }, { listo: true }, { espera: 1000 },
    { toca: { boton: "Equipos" } }, { espera: 500 },
    { toca: { css: "input[type=search]" } }, { escribe: "medio cudeyo" }, { espera: 1300 },
    { bajaHasta: { css: "a[href='/federacion/cantabra/equipo/162748']" } }, { espera: 500 },
    { toca: { css: "a[href='/federacion/cantabra/equipo/162748']" } }, { espera: 1800 },
    { bajaHasta: { css: "a[href='/federacion/cantabra/equipo/162743']" } }, { espera: 1400 },
    { toca: { css: "a[href='/federacion/cantabra/equipo/162743']" } }, { espera: 1500 },
    { bajaHasta: "Por puntos" }, { espera: 600 }, { baja: 260 }, { espera: 2400 },
  ],
};

const nombre = process.argv[2] || "torneos-publico";
const pasos = RECORRIDOS[nombre];
if (!pasos) { console.error(`No existe el recorrido ${nombre}`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grabar-web-"));

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, colorScheme: "dark", isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
// Se graba con el screencast de Chrome y no con recordVideo de Playwright: este último
// captura a 390 px de ancho (sin el devicePixelRatio) y rellena el resto de gris.
const cdp = await ctx.newCDPSession(page);
const cuadros = [];
cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
  const f = path.join(tmp, `${String(cuadros.length).padStart(5, "0")}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, "base64"));
  // La hora del cuadro se toma al llegar: la de Chrome no comparte reloj con Date.now().
  cuadros.push({ f, t: Date.now() });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 });
const t0 = Date.now();
const ms = () => Date.now() - t0;
const toques = [];
let inicioMs = 0;

const localizar = (q) =>
  typeof q === "string" ? page.getByText(q, { exact: false }).first()
  // El nombre del botón empieza por el texto («Mar 1» aunque lleve «· 5 partidos» detrás).
  // Las palabras pueden ir en spans sin espacio entre ellas («Mar» + «1»): se casan con \s*.
  : q.boton ? page.locator("button").filter({ hasText: new RegExp(q.boton.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*")) }).first()
  : page.locator(q.css).first();
/** Baja con la rueda en pasitos: así el vídeo enseña el desplazamiento, no un salto. */
async function bajar(px) {
  const pasos = Math.max(6, Math.round(px / 30));
  await page.mouse.move(VW / 2, VH * 0.6);
  for (let i = 0; i < pasos; i++) { await page.mouse.wheel(0, px / pasos); await page.waitForTimeout(16); }
}

for (const p of pasos) {
  if (p.ir) { await page.goto(BASE + p.ir, { waitUntil: "networkidle" }); await page.waitForTimeout(400); }
  if (p.listo) inicioMs = ms();
  if (p.espera) await page.waitForTimeout(p.espera);
  if (p.baja) await bajar(p.baja);
  if (p.bajaHasta) {
    const el = localizar(p.bajaHasta);
    for (let i = 0; i < 40; i++) {
      const bb = await el.boundingBox();
      if (bb && bb.y > VH * 0.3 && bb.y < VH * 0.7) break;
      await bajar(bb && bb.y < VH * 0.3 ? -90 : 90);
    }
  }
  if (p.toca) {
    const el = localizar(p.toca);
    await el.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(async (e) => {
      const hay = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));
      throw new Error(`No encuentro ${JSON.stringify(p.toca)} en ${page.url()}. Botones: ${JSON.stringify(hay)}\n${e.message}`);
    });
    // Tras la rueda la página sigue deslizándose un poco: se mide cuando ya está quieta.
    let bb = await el.boundingBox();
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(80);
      const otra = await el.boundingBox();
      if (bb && otra && Math.abs(otra.y - bb.y) < 1) break;
      bb = otra;
    }
    if (!bb) throw new Error(`No veo «${JSON.stringify(p.toca)}»`);
    const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
    toques.push({ ms: ms(), x: Math.round(x), y: Math.round(y) });
    await page.waitForTimeout(260); // el dedo llega antes de que reaccione la página
    await el.tap();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  if (p.escribe) for (const c of p.escribe) { await page.keyboard.type(c); await page.waitForTimeout(110); }
}
const finMs = ms();
await cdp.send("Page.stopScreencast").catch(() => {});
await ctx.close();
await browser.close();

// Chrome solo manda cuadro cuando cambia algo: cada imagen dura hasta la siguiente.
// El vídeo empieza en t0, así que se rellena el hueco inicial con el primer cuadro.
const lista = ["ffconcat version 1.0"];
cuadros.forEach((c, i) => {
  const dur = ((i + 1 < cuadros.length ? cuadros[i + 1].t : t0 + finMs) - (i === 0 ? t0 : c.t)) / 1000;
  lista.push(`file '${c.f.split(path.sep).join("/")}'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
});
lista.push(`file '${cuadros[cuadros.length - 1].f.split(path.sep).join("/")}'`);
fs.writeFileSync(path.join(tmp, "lista.txt"), lista.join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "lista.txt"),
  "-vf", `scale=${VW * DPR}:${VH * DPR}:flags=lanczos,fps=30`, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", path.join(OUT, `${nombre}.mp4`)]);
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(OUT, `${nombre}.json`), JSON.stringify({ nombre, ancho: VW, alto: VH, inicioMs, finMs, toques }, null, 2) + "\n");
console.log(`ok ${nombre}: ${((finMs - inicioMs) / 1000).toFixed(1)} s útiles, ${toques.length} toques, ${cuadros.length} cuadros → ${OUT}/${nombre}.mp4`);
