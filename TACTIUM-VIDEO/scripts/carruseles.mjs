// Carruseles y posts de Instagram a partir de una plantilla HTML.
// Renderiza cada slide (1080×1350, 4:5) con el Chromium local de Playwright.
//
//   node scripts/carruseles.mjs            → todo lo que hay en carruseles/*.json
//   node scripts/carruseles.mjs C1 P2      → solo esos
//
// La especificación vive en `carruseles/<id>.json`; el diseño está aquí
// (tokens de marca de src/reel/tokens.json). Las capturas en public/web e
// public/img, las imágenes generadas en public/gen.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const ROOT = path.resolve(".");
const PUB = path.join(ROOT, "public");
const OUT = path.join(ROOT, "renders", "carruseles");
const tok = JSON.parse(fs.readFileSync("src/reel/tokens.json", "utf8"));
const C = tok.color.dark;

let W = 1080, H = 1350; // se ajusta por spec (post 4:5 o story 9:16)
const file = (p) => "file:///" + encodeURI(path.join(PUB, p).split(path.sep).join("/"));

const css = () => `
@font-face{font-family:Satoshi;src:url("${file("fonts/satoshi-400.woff2")}");font-weight:400}
@font-face{font-family:Satoshi;src:url("${file("fonts/satoshi-500.woff2")}");font-weight:500}
@font-face{font-family:Satoshi;src:url("${file("fonts/satoshi-700.woff2")}");font-weight:700}
@font-face{font-family:Satoshi;src:url("${file("fonts/satoshi-900.woff2")}");font-weight:900}
@font-face{font-family:JBMono;src:url("${file("fonts/jbmono-500.woff2")}");font-weight:500}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:${C.bg.base};color:${C.fg.primary};font-family:Satoshi,sans-serif;overflow:hidden}
.slide{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${C.bg.base}}
.foto{position:absolute;inset:0;background-size:cover;background-position:center}
.foto{filter:brightness(1.25) contrast(1.05)}
.foto::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,15,15,0) 0%,rgba(3,15,15,.2) 40%,rgba(3,15,15,.9) 100%)}
.fotoTop::after{background:linear-gradient(0deg,rgba(3,15,15,0) 0%,rgba(3,15,15,.25) 40%,rgba(3,15,15,.9) 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(${C.border.hair} 1px,transparent 1px),linear-gradient(90deg,${C.border.hair} 1px,transparent 1px);background-size:72px 72px;-webkit-mask-image:radial-gradient(ellipse at 50% 40%,#000 20%,transparent 70%)}
.glow{position:absolute;left:50%;top:-20%;width:1400px;height:900px;transform:translateX(-50%);background:radial-gradient(ellipse at center,rgba(0,223,130,.16),transparent 60%)}
.pad{position:absolute;left:84px;right:84px}
.eyebrow{font-family:JBMono,monospace;font-size:26px;letter-spacing:.25em;text-transform:uppercase;color:${C.accent.base}}
.eyebrow.muted{color:${C.fg.faint}}
h1{font-weight:900;letter-spacing:-.04em;line-height:.98;font-size:112px;text-wrap:balance}
h1.md{font-size:92px}
h1.sm{font-size:76px}
h2{font-weight:900;letter-spacing:-.03em;line-height:1.04;font-size:64px;text-wrap:balance}
p.lead{font-weight:500;font-size:40px;line-height:1.28;color:${C.fg.muted};text-wrap:pretty}
p.lead b{color:${C.fg.primary};font-weight:700}
.acc{color:${C.accent.base}}
.num{font-weight:900;font-size:360px;letter-spacing:-.06em;line-height:.85;color:${C.accent.base}}
.marca{position:absolute;top:${H > 1400 ? 300 : 56}px;right:84px;display:flex;align-items:center;gap:12px;font-family:JBMono,monospace;font-size:24px;letter-spacing:.1em;color:${C.fg.muted};z-index:9}
.marca img{height:28px;opacity:.9}
.cont{position:absolute;right:48px;bottom:${H > 1400 ? 300 : 56}px;display:flex;align-items:center;gap:14px;font-family:JBMono,monospace;font-size:24px;letter-spacing:.12em;color:${C.fg.faint};z-index:9}
.cont .fl{color:${C.accent.base};font-size:28px}
.phone{position:absolute;left:50%;transform:translateX(-50%);width:570px;border-radius:96px;background:#0a0a0a;padding:14px;box-shadow:0 0 0 2px #2a2d2e,0 0 0 4px #121414,0 70px 140px -30px rgba(0,0,0,.9),0 -40px 120px -40px rgba(0,223,130,.22)}
.phone .btn{position:absolute;background:#1c1f20;border-radius:3px}
.phone .btn.l1{left:-6px;top:200px;width:6px;height:52px}
.phone .btn.l2{left:-6px;top:290px;width:6px;height:96px}
.phone .btn.l3{left:-6px;top:406px;width:6px;height:96px}
.phone .btn.r1{right:-6px;top:320px;width:6px;height:150px}
.phone .scr{position:relative;border-radius:82px;overflow:hidden;background:${C.bg.base};height:100%}
.phone .scr img{display:block;width:100%}
.phone .isla{position:absolute;left:50%;top:22px;transform:translateX(-50%);width:186px;height:56px;border-radius:30px;background:#000;z-index:3}
.phone .sb{position:absolute;left:0;right:0;top:0;height:100px;display:flex;justify-content:space-between;align-items:center;padding:0 58px 0 62px;z-index:2;font-family:Satoshi,sans-serif;font-weight:700;font-size:30px;color:#fff}
.phone .sb .ic{display:flex;align-items:center;gap:10px}
.phone .sb .bat{width:48px;height:22px;border:3px solid rgba(255,255,255,.9);border-radius:8px;position:relative}
.phone .sb .bat::after{content:"";position:absolute;left:3px;top:3px;bottom:3px;width:70%;background:#fff;border-radius:3px}
.phone .sb .bat::before{content:"";position:absolute;right:-8px;top:6px;width:4px;height:8px;background:rgba(255,255,255,.7);border-radius:0 2px 2px 0}
.phone .sb svg{display:block}
.chip{display:inline-flex;align-items:center;gap:14px;padding:16px 26px;border-radius:999px;background:rgba(3,15,15,.85);border:2px solid ${C.border.hairStrong};font-family:JBMono,monospace;font-size:26px;letter-spacing:.06em;color:${C.fg.primary}}
.chip.rojo{border-color:${C.state.error};color:${C.state.error}}
.chip .dot{width:14px;height:14px;border-radius:50%;background:currentColor}
.card{background:${C.bg.card};border:2px solid ${C.border.hair};border-radius:28px;padding:40px 44px}
.wa{background:#0b141a;border-radius:36px;overflow:hidden;box-shadow:0 0 0 2px rgba(255,255,255,.06),0 50px 120px -30px rgba(0,0,0,.9)}
.wa .hd{display:flex;align-items:center;gap:22px;padding:30px 34px;background:#1f2c34}
.wa .av{width:88px;height:88px;border-radius:50%;background:#2a3942;display:flex;align-items:center;justify-content:center;font-size:44px}
.wa .t1{font-size:38px;font-weight:700;color:#e9edef}
.wa .t2{font-size:28px;color:#8696a0;margin-top:4px}
.wa .row{display:flex;justify-content:space-between;align-items:center;padding:34px;border-top:1px solid rgba(255,255,255,.06)}
.wa .row .m{font-size:34px;color:#8696a0;max-width:700px;line-height:1.3}
.wa .row .b{min-width:90px;height:64px;border-radius:32px;background:#00a884;color:#0b141a;font-weight:900;font-size:34px;display:flex;align-items:center;justify-content:center;padding:0 22px}
.wa .row .h{font-size:26px;color:#00a884;font-weight:700}
.codigo{font-family:JBMono,monospace;font-weight:500;font-size:200px;letter-spacing:.12em;color:${C.accent.base};text-align:center;line-height:1}
.ticks{display:flex;flex-direction:column;gap:26px}
.ticks div{display:flex;align-items:center;gap:22px;font-size:46px;font-weight:700;letter-spacing:-.02em}
.ticks div::before{content:"✓";width:60px;height:60px;border-radius:50%;background:${C.accent.base};color:${C.fg.inverse};display:flex;align-items:center;justify-content:center;font-size:32px;flex:none}
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** *texto* → acento verde; **texto** → blanco fuerte */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, '<span class="acc">$1</span>');

const pad2 = (v) => String(v).padStart(2, "0");
const foot = (i, n) => `
<div class="marca"><img src="${file("img/logo-t.png")}"> tactium.io</div>
${n > 1 ? `<div class="cont">${pad2(i)} / ${pad2(n)}${i < n ? ' <span class="fl">→</span>' : ""}</div>` : ""}`;

function slideHtml(s, i, n) {
  const fondo = s.foto ? `<div class="foto ${s.fotoTop ? "fotoTop" : ""}" style="background-image:url('${file(s.foto)}')"></div>` : `<div class="glow"></div><div class="grid"></div>`;
  let cuerpo = "";
  switch (s.tipo) {
    case "portada":
      cuerpo = `<div class="pad" style="bottom:${s.sticker ? 640 : (H > 1400 ? 360 : 190)}px">
        ${s.eyebrow ? `<div class="eyebrow" style="margin-bottom:34px">${esc(s.eyebrow)}</div>` : ""}
        <h1 class="${s.tam ?? ""}">${rich(s.titulo)}</h1>
        ${s.sub ? `<p class="lead" style="margin-top:36px">${rich(s.sub)}</p>` : ""}
      </div>`;
      break;
    case "texto":
      cuerpo = `<div class="pad" style="top:${s.sticker ? "34%" : "50%"};transform:translateY(-50%)">
        ${s.eyebrow ? `<div class="eyebrow" style="margin-bottom:34px">${esc(s.eyebrow)}</div>` : ""}
        <h2 style="${s.tam === "lg" ? "font-size:84px" : ""}">${rich(s.titulo)}</h2>
        ${s.sub ? `<p class="lead" style="margin-top:36px">${rich(s.sub)}</p>` : ""}
        ${s.ticks ? `<div class="ticks" style="margin-top:48px">${s.ticks.map((t) => `<div>${esc(t)}</div>`).join("")}</div>` : ""}
      </div>`;
      break;
    case "numero":
      cuerpo = `<div class="pad" style="top:50%;transform:translateY(-50%);text-align:center">
        <div class="eyebrow" style="margin-bottom:28px">${esc(s.eyebrow ?? "")}</div>
        <div class="num">${esc(s.valor)}</div>
        ${s.sub ? `<p class="lead" style="margin-top:44px">${rich(s.sub)}</p>` : ""}
      </div>`;
      break;
    case "pantalla": {
      // titular arriba, móvil recortado abajo (asoma, no cabe entero)
      const alto = s.alto ?? 760;
      cuerpo = `<div class="pad" style="top:${H > 1400 ? 400 : 110}px">
        ${s.eyebrow ? `<div class="eyebrow" style="margin-bottom:26px">${esc(s.eyebrow)}</div>` : ""}
        <h2 style="font-size:${s.tam === "sm" ? 54 : 64}px">${rich(s.titulo)}</h2>
        ${s.sub ? `<p class="lead" style="margin-top:22px;font-size:34px">${rich(s.sub)}</p>` : ""}
      </div>
      <div class="phone" style="top:${H - alto}px;height:${alto + 60}px">
        <div class="btn l1"></div><div class="btn l2"></div><div class="btn l3"></div><div class="btn r1"></div>
        <div class="scr">
        <div class="isla"></div>
        ${s.src.startsWith("web/") ? `<div class="sb"><span>9:41</span><span class="ic"><svg width="30" height="22" viewBox="0 0 30 22" fill="#fff"><rect x="0" y="14" width="5" height="8" rx="1"/><rect x="8" y="10" width="5" height="12" rx="1"/><rect x="16" y="5" width="5" height="17" rx="1"/><rect x="24" y="0" width="5" height="22" rx="1"/></svg><svg width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M3 8a17 17 0 0 1 24 0"/><path d="M8 13a10 10 0 0 1 14 0"/><circle cx="15" cy="18" r="1.5" fill="#fff"/></svg><span class="bat"></span></span></div>` : ""}
        <img src="${file(s.src)}" style="margin-top:${-(s.offset ?? 0) + (s.src.startsWith("web/") ? 100 : 0)}px">
        </div>
        ${s.chip ? `<div class="chip ${s.chipRojo ? "rojo" : ""}" style="position:absolute;left:36px;top:${s.chipY ?? 40}px"><span class="dot"></span>${esc(s.chip)}</div>` : ""}
      </div>`;
      break;
    }
    case "whatsapp":
      cuerpo = `<div class="pad" style="top:50%;transform:translateY(-50%)">
        <div class="wa">
          <div class="hd"><div class="av">🎾</div><div><div class="t1">${esc(s.grupo)}</div><div class="t2">${esc(s.miembros)}</div></div></div>
          ${s.filas.map((f) => `<div class="row"><div><div class="h">${esc(f.h)}</div><div class="m">${esc(f.m)}</div></div>${f.b ? `<div class="b">${esc(f.b)}</div>` : ""}</div>`).join("")}
        </div>
        ${s.pie ? `<p class="lead" style="margin-top:44px;text-align:center">${rich(s.pie)}</p>` : ""}
      </div>`;
      break;
    case "codigo":
      cuerpo = `<div class="pad" style="top:50%;transform:translateY(-50%);text-align:center">
        <div class="eyebrow" style="margin-bottom:40px">${esc(s.eyebrow ?? "código del torneo")}</div>
        <div class="codigo">${esc(s.valor)}</div>
        ${s.sub ? `<p class="lead" style="margin-top:56px">${rich(s.sub)}</p>` : ""}
      </div>`;
      break;
    case "cierre":
      cuerpo = `<div class="pad" style="top:50%;transform:translateY(-50%)">
        <h1 class="${s.tam ?? "md"}">${rich(s.titulo)}</h1>
        ${s.sub ? `<p class="lead" style="margin-top:40px">${rich(s.sub)}</p>` : ""}
        ${s.cta ? `<div class="chip" style="margin-top:56px">${esc(s.cta)}</div>` : ""}
      </div>`;
      break;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css()}</style></head><body>
  <div class="slide">${fondo}${cuerpo}${foot(i, n)}</div></body></html>`;
}

const only = process.argv.slice(2);
const specs = fs.readdirSync("carruseles").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join("carruseles", f), "utf8")));
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const spec of specs) {
  if (only.length && !only.includes(spec.id)) continue;
  if (spec.formato === "story") { W = 1080; H = 1920; } else { W = 1080; H = 1350; }
  await page.setViewportSize({ width: W, height: H });
  const dir = path.join(OUT, spec.id);
  fs.mkdirSync(dir, { recursive: true });
  const n = spec.slides.length;
  for (let i = 0; i < n; i++) {
    // about:blank no puede cargar file://; se escribe el HTML dentro de public/ y se navega a él.
    const tmp = path.join(PUB, "_slide.html");
    fs.writeFileSync(tmp, slideHtml(spec.slides[i], i + 1, n));
    await page.goto("file:///" + tmp.split(path.sep).join("/"), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(dir, `${spec.id}-${String(i + 1).padStart(2, "0")}.png`) });
  }
  console.log("ok", spec.id, n, "slides →", dir);
}
await browser.close();
try { fs.unlinkSync(path.join(PUB, "_slide.html")); } catch {}
