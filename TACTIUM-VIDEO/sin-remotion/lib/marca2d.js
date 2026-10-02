// Piezas comunes de los vídeos de marca dibujados en canvas 2D:
// paleta, HUD con contraste automático, grano, barridos de corte y cierre con logo + wordmark.
import { clamp, eBack, eInOut, eOut, lerp, prog, rnd } from "./util.js";

export const C = { BG: "#030F0F", HUESO: "#F3F9F6", VERDE: "#00DF82", PROF: "#03624C", GRIS: "#6F8580", AVISO: "#FF5A5F" };
export const W = 1080, H = 1920;
export const CX = 495; // centro de la zona segura de Reels (x 80-910)

export const font = (ctx, w, px, fam = "Satoshi", style = "") => { ctx.font = `${style} ${w} ${px}px ${fam}`.trim(); };
export const eIn = (p) => p * p * p;

const grainTile = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); const im = x.createImageData(256, 256); const r = rnd(5);
  for (let i = 0; i < 256 * 256; i++) { const v = r() * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); return c;
})();

/** Grano suave (0.04): más, e Instagram lo machaca y el archivo se dispara. */
export function grano(fx, frame, alpha = 0.04) {
  fx.save(); fx.globalAlpha = alpha; fx.globalCompositeOperation = "overlay";
  fx.translate(-((frame * 73) % 256), -((frame * 151) % 256)); fx.fillStyle = fx.createPattern(grainTile, "repeat"); fx.fillRect(0, 0, W + 256, H + 256);
  fx.restore();
}

/** Barrido de bandas en cada corte de `cortes` (segundos). */
export function barridos(fx, t, cortes) {
  for (const b of cortes) {
    const q = (t - b + 0.07) / 0.2; if (q <= 0 || q >= 1) continue;
    for (let j = 0; j < 5; j++) { const x = lerp(-W, W, eInOut(clamp(q * 1.3 - j * 0.07))); fx.fillStyle = j % 2 ? C.VERDE : C.HUESO; fx.fillRect(x, j * (H / 5), W, H / 5 + 1); }
  }
}

/** HUD técnico: arriba marca y contador, abajo etiqueta, timecode y barra de progreso. */
export function hud(fx, t, frame, { fps, dur, arribaDer, abajoIzq, alpha = 1 }) {
  fx.save(); fx.globalAlpha = alpha; fx.globalCompositeOperation = "difference"; fx.fillStyle = "#fff"; font(fx, 500, 22, "JBM"); fx.letterSpacing = "4px";
  fx.textAlign = "left"; fx.fillText("TACTIUM — LIGA POR EQUIPOS", 80, 280); if (abajoIzq) fx.fillText(abajoIzq, 80, 1530);
  fx.textAlign = "right"; if (arribaDer) fx.fillText(arribaDer, 910, 280);
  const ff = frame % fps, ss = Math.floor(frame / fps); fx.fillText(`00:00:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`, 910, 1530);
  fx.fillRect(80, 1500, 830 * (t / dur), 2);
  fx.restore();
}

export function cargarLogo() { const img = new Image(); img.src = "/public/img/logo-t.png"; return img.decode().then(() => img).catch(() => null); }

/** Cierre: logo T (negro → transparente con «lighten»), wordmark TACTiUM con el punto verde y la url. */
export function cierre(g, lt, logo, { y = 560, linea = null } = {}) {
  g.fillStyle = C.BG; g.fillRect(0, 0, W, H);
  if (logo) {
    const p = eOut(prog(lt, 0, 0.45)), s = 340;
    g.save(); g.globalCompositeOperation = "lighten"; g.beginPath(); g.rect(CX - s / 2, y, s, s * p); g.clip();
    g.drawImage(logo, CX - s / 2, y - (1 - p) * 60, s, s); g.restore();
  }
  font(g, 900, 140); g.letterSpacing = "4px"; g.textAlign = "left";
  const parts = ["T", "A", "C", "T", "i", "U", "M"]; const ws = parts.map((c) => (c === "i" ? 42 : g.measureText(c).width));
  let x = CX - ws.reduce((a, b) => a + b, 0) / 2; const base = y + 520;
  parts.forEach((ch, i) => {
    const p = eOut(prog(lt, 0.2 + i * 0.05, 0.4)), dy = (1 - p) * 70; g.globalAlpha = p;
    if (ch === "i") { g.fillStyle = C.HUESO; g.fillRect(x + 6, base - 71 + dy, 30, 71); const d = eBack(prog(lt, 0.9, 0.3)); g.fillStyle = C.VERDE; g.globalAlpha = d > 0.01 ? 1 : 0; g.fillRect(x + 6, base - 101 - (1 - d) * 120, 30, 30); }
    else { g.fillStyle = C.HUESO; g.fillText(ch, x, base + dy); }
    x += ws[i];
  });
  g.letterSpacing = "8px"; font(g, 500, 32, "JBM"); g.fillStyle = C.GRIS; g.textAlign = "center";
  g.globalAlpha = eOut(prog(lt, 1.0, 0.35)); g.fillText("tactium.io", CX, base + 90);
  if (linea) { g.letterSpacing = "0px"; font(g, 700, 46); g.fillStyle = C.HUESO; g.globalAlpha = eOut(prog(lt, 1.2, 0.35)); g.fillText(linea, CX, base + 190); }
  g.globalAlpha = 1; g.letterSpacing = "0px";
}

/** Texto en varias líneas, alineado a la izquierda en la zona segura. */
export function lineas(g, textos, x, y, alto) { textos.forEach((tx, i) => g.fillText(tx, x, y + i * alto)); }
