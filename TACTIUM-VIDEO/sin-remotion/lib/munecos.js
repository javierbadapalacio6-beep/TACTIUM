// Muñecos 2D de los reels de humor: estilo plano con contorno negro grueso
// (referencia: Niña Repelente). Animación limitada a propósito: boca con el volumen
// de la voz, parpadeo, cejas, mirada, brazos con gesto y un leve balanceo al hablar.
//
// busto(g, P, st, x, y, s): dibuja al personaje P con la cabeza centrada en (x, y) y escala s.
//   P (caracterización) = {
//     piel, mejillas, pelo, peinado ("corto"|"tupe"|"despeinado"|"rapado"|"almohada"),
//     cabeza {rx, ry}, nariz ("boton"|"larga"|"gancho"), orejas (escala), ancho (escala del torso),
//     barba, barbaLarga, bigote, ojeras, parpados (0-1), cejasGruesas,
//     ropa: "polo"|"sudadera"|"tirantes"|"pijama", camiseta, detalle, rayas, manta,
//     brazalete (texto, p. ej. "C"), gorra, gorraVisera, gorraAlReves, gafasSol, cascos, cascosLuz
//   }
//   st = { t, boca 0-1, ojos 0-1, mirada {x,y}, cejas, cansado, sonrisa -1..1, inclina,
//          movil: "mano"|"boca"|null, pantalla, brazo: {lado, x, y, objeto: "cana"|"mando"|"palma"} }
import { rnd } from "./util.js";

export const TRAZO = "#141414";
const LW = 9;

function linea(g, w = LW) { g.lineWidth = w; g.strokeStyle = TRAZO; g.lineJoin = "round"; g.lineCap = "round"; }
function relleno(g, color, w = LW) { g.fillStyle = color; g.fill(); linea(g, w); g.stroke(); }
const elipse = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const oscuro = (hex, f = 0.82) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)); return `rgb(${c.join(",")})`; };

/** Parpadeo determinista: cada personaje con su ritmo (semilla), 0.13 s cerrado. */
export function parpadeo(t, semilla = 1) {
  const r = rnd(semilla * 97); const periodo = 2.6 + r() * 1.6, fase = r() * periodo;
  return ((t + fase) % periodo) < 0.13 ? 1 : 0;
}

/** Envolvente → apertura de la boca, con algo de suavizado y umbral para que cierre en las pausas. */
export function apertura(env, t, desde, fps = 30) {
  if (!env) return 0;
  const i = Math.floor((t - desde) * fps); if (i < 0 || i >= env.length) return 0;
  const v = (env[i] + (env[i - 1] ?? env[i]) * 0.5) / 1.5;
  return v < 0.12 ? 0 : Math.min(1, (v - 0.12) * 1.5);
}

// ── Cuerpo y ropa ───────────────────────────────────────────────────────────
function torso(g) {
  g.beginPath();
  g.moveTo(-70, 190); g.quadraticCurveTo(-250, 230, -290, 360); g.lineTo(-330, 1100); g.lineTo(330, 1100); g.lineTo(290, 360); g.quadraticCurveTo(250, 230, 70, 190); g.closePath();
}

function cuerpo(g, P) {
  const ropa = P.ropa || "polo";
  // Cuello (debajo de la ropa)
  g.beginPath(); g.rect(-58, 120, 116, 100); g.fillStyle = P.piel; g.fill(); linea(g, 7);
  g.beginPath(); g.moveTo(-58, 120); g.lineTo(-58, 205); g.moveTo(58, 120); g.lineTo(58, 205); g.stroke();
  if (ropa === "tirantes") {
    torso(g); g.fillStyle = P.piel; g.fill(); linea(g); g.stroke();
    g.beginPath(); g.moveTo(-190, 1100); g.lineTo(-170, 300); g.quadraticCurveTo(-120, 270, -100, 250); g.quadraticCurveTo(0, 420, 100, 250); g.quadraticCurveTo(120, 270, 170, 300); g.lineTo(190, 1100); g.closePath(); relleno(g, P.camiseta);
    linea(g, 4); g.strokeStyle = "rgba(20,20,20,0.35)"; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 60, 240); g.quadraticCurveTo(s * 120, 250, s * 160, 280); g.stroke(); }
    return;
  }
  torso(g); relleno(g, P.camiseta);
  if (ropa === "pijama" && P.rayas) {
    g.save(); torso(g); g.clip(); g.strokeStyle = P.rayas; g.lineWidth = 22; for (let x = -340; x < 340; x += 70) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 1100); g.stroke(); } g.restore();
    torso(g); linea(g); g.stroke();
    g.beginPath(); g.moveTo(-80, 195); g.lineTo(0, 330); g.lineTo(80, 195); linea(g, 7); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 380 + i * 110, 13, 0, 7); relleno(g, "#fff", 5); }
  } else if (ropa === "sudadera") {
    g.beginPath(); g.moveTo(-170, 230); g.quadraticCurveTo(0, 330, 170, 230); g.quadraticCurveTo(120, 190, 70, 190); g.quadraticCurveTo(0, 250, -70, 190); g.quadraticCurveTo(-120, 190, -170, 230); g.closePath(); relleno(g, oscuro(P.camiseta), 7);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 40, 270); g.quadraticCurveTo(s * 50, 400, s * 36, 470); g.lineWidth = 9; g.strokeStyle = TRAZO; g.stroke(); g.lineWidth = 5; g.strokeStyle = "#f5f5f5"; g.stroke(); g.beginPath(); g.arc(s * 36, 480, 11, 0, 7); relleno(g, "#d9d9d9", 5); }
    g.beginPath(); g.moveTo(-170, 760); g.lineTo(170, 760); g.lineTo(210, 980); g.lineTo(-210, 980); g.closePath(); relleno(g, oscuro(P.camiseta, 0.9), 7);
  } else { // polo
    if (P.detalle) { g.save(); torso(g); g.clip(); g.fillStyle = P.detalle; g.fillRect(-340, 520, 680, 50); g.restore(); torso(g); linea(g); g.stroke(); }
    g.beginPath(); g.moveTo(-75, 192); g.lineTo(0, 290); g.lineTo(75, 192); linea(g, 7); g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 85, 185); g.lineTo(s * 40, 250); g.lineTo(s * 110, 230); g.closePath(); relleno(g, P.detalle || P.camiseta, 6); }
    g.beginPath(); g.arc(0, 330, 10, 0, 7); relleno(g, "#fff", 4); g.beginPath(); g.arc(0, 375, 10, 0, 7); relleno(g, "#fff", 4);
  }
  // Pliegues de la tela
  linea(g, 5); g.strokeStyle = "rgba(20,20,20,0.3)";
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 200, 640); g.quadraticCurveTo(s * 160, 720, s * 190, 820); g.stroke(); }
  if (P.manta) {
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 340, 1100); g.lineTo(s * 305, 330); g.quadraticCurveTo(s * 260, 215, s * 150, 205); g.quadraticCurveTo(s * 110, 420, s * 195, 1100); g.closePath(); relleno(g, P.manta);
      g.save(); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 6; for (let y = 380; y < 1100; y += 90) { g.beginPath(); g.moveTo(s * 300, y); g.lineTo(s * 190, y + 40); g.stroke(); } g.restore();
    }
  }
}

/** Brazalete de capitán en el brazo derecho (se ve a la izquierda: el otro lleva el móvil). */
function brazalete(g, P) {
  if (!P.brazalete) return;
  g.save(); g.translate(-262, 470); g.rotate(0.12);
  g.beginPath(); g.roundRect(-55, -38, 110, 76, 10); relleno(g, "#FFD23F", 7);
  g.fillStyle = TRAZO; g.font = "900 56px Satoshi"; g.textAlign = "center"; g.fillText(P.brazalete, 0, 20);
  g.restore();
}

/** Brazo de hombro a mano; la manga es del color de la ropa (piel si va de tirantes). */
function brazo(g, P, lado, mano, objeto) {
  const hx = lado * 285, hy = 370, [mx, my] = mano;
  const cx = (hx + mx) / 2 + lado * 120, cy = (hy + my) / 2 + 90;
  const manga = P.ropa === "tirantes" ? P.piel : P.camiseta;
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(cx, cy, mx, my); g.lineWidth = 104; g.strokeStyle = TRAZO; g.stroke();
  g.lineWidth = 86; g.strokeStyle = manga; g.stroke();
  if (P.ropa === "pijama" && P.rayas) { g.lineWidth = 20; g.strokeStyle = P.rayas; g.setLineDash([22, 48]); g.stroke(); g.setLineDash([]); }
  g.restore();
  if (objeto === "cana") {
    g.beginPath(); g.moveTo(mx - 50, my - 170); g.lineTo(mx + 50, my - 170); g.lineTo(mx + 40, my + 30); g.lineTo(mx - 40, my + 30); g.closePath(); relleno(g, "rgba(240,190,60,0.95)", 7);
    g.beginPath(); g.ellipse(mx, my - 175, 52, 22, 0, 0, 7); relleno(g, "#FFFDF2", 6);
    g.fillStyle = "rgba(255,255,255,0.7)"; for (const [dx, dy] of [[-15, -100], [10, -60], [-5, -20]]) { g.beginPath(); g.arc(mx + dx, my + dy, 6, 0, 7); g.fill(); }
  }
  if (objeto === "mando") {
    g.save(); g.translate(mx, my - 60); g.rotate(-0.3); g.beginPath(); g.roundRect(-24, -90, 48, 180, 14); relleno(g, "#2b2b2b", 6);
    g.fillStyle = "#E94F37"; g.beginPath(); g.arc(0, -60, 10, 0, 7); g.fill(); g.fillStyle = "#aaa"; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.arc(-10 + j * 20, -20 + i * 26, 6, 0, 7); g.fill(); }
    g.restore();
  }
  elipse(g, mx, my, 56, 50); relleno(g, P.piel, 7);
  if (objeto === "palma") for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(mx - 42 + i * 28, my - 52, 14, 30, -0.1 + i * 0.07, 0, 7); relleno(g, P.piel, 6); }
  else for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(mx - 30 + i * 30, my - 30); g.lineTo(mx - 30 + i * 30, my + 5); linea(g, 5); g.stroke(); }
}

// ── Cabeza ──────────────────────────────────────────────────────────────────
function pelo(g, P, rx, ry) {
  const c = P.pelo;
  if (P.peinado === "rapado") { elipse(g, 0, -ry * 0.42, rx * 0.98, ry * 0.6); g.save(); g.clip(); g.fillStyle = c; g.globalAlpha = 0.5; g.fillRect(-rx, -ry - 20, rx * 2, ry * 0.52); g.restore(); return; }
  g.beginPath();
  if (P.peinado === "despeinado" || P.peinado === "almohada") {
    g.moveTo(-rx - 8, -40);
    const pts = P.peinado === "almohada"
      ? [[-rx - 10, -130], [-rx + 10, -180], [-90, -205], [-20, -215], [50, -230], [110, -300], [140, -235], [210, -280], [200, -200], [rx + 22, -150], [rx + 8, -40]]
      : [[-215, -120], [-170, -175], [-150, -250], [-90, -215], [-50, -285], [0, -230], [60, -290], [95, -220], [160, -255], [170, -175], [215, -120], [200, -40]];
    for (const [x, y] of pts) g.lineTo(x, y);
    g.quadraticCurveTo(120, -150, 0, -150); g.quadraticCurveTo(-120, -150, -rx - 8, -40);
  } else if (P.peinado === "tupe") {
    g.moveTo(-rx - 6, -30); g.quadraticCurveTo(-rx - 20, -200, -60, -245); g.quadraticCurveTo(80, -330, 175, -235); g.quadraticCurveTo(rx + 30, -160, rx + 6, -30);
    g.quadraticCurveTo(170, -120, 40, -140); g.quadraticCurveTo(-140, -150, -rx - 6, -30);
  } else { // corto con raya
    g.moveTo(-rx - 4, -25); g.quadraticCurveTo(-rx - 12, -ry - 2, 0, -ry - 12); g.quadraticCurveTo(rx + 12, -ry - 2, rx + 4, -25);
    g.quadraticCurveTo(rx - 20, -125, 60, -135); g.quadraticCurveTo(0, -110, -60, -135); g.quadraticCurveTo(-rx + 20, -125, -rx - 4, -25);
  }
  g.closePath(); relleno(g, c);
  g.save(); g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 10; g.beginPath(); g.arc(-40, -120, 90, Math.PI * 1.15, Math.PI * 1.45); g.stroke(); g.restore();
}

function ojo(g, x, st, P) {
  const y = -15, rx = 46, ry = 56;
  elipse(g, x, y, rx, ry); g.fillStyle = "#fff"; g.fill(); linea(g, 6); g.stroke();
  const mx = (st.mirada?.x || 0) * 16, my = (st.mirada?.y || 0) * 22;
  g.save(); elipse(g, x, y, rx, ry); g.clip();
  g.beginPath(); g.arc(x + mx, y + 8 + my, 21, 0, 7); g.fillStyle = TRAZO; g.fill();
  g.beginPath(); g.arc(x + mx + 7, y + my, 6, 0, 7); g.fillStyle = "#fff"; g.fill();
  const cierre = Math.max(st.ojos || 0, st.cansado ? 0.45 : 0, P.parpados || 0);
  if (cierre > 0) { g.fillStyle = P.piel; g.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, (ry * 2 + 4) * cierre); }
  g.restore();
  if (cierre > 0) { g.beginPath(); g.moveTo(x - rx + 4, y - ry + (ry * 2) * cierre); g.lineTo(x + rx - 4, y - ry + (ry * 2) * cierre); linea(g, 6); g.stroke(); }
  if (st.cansado || P.ojeras) {
    g.save(); g.fillStyle = "rgba(110,70,120,0.28)"; g.beginPath(); g.ellipse(x, y + 62, 40, 14, 0, 0, 7); g.fill(); g.restore();
    g.beginPath(); g.arc(x, y + 50, 36, 0.25 * Math.PI, 0.75 * Math.PI); linea(g, 4); g.strokeStyle = "rgba(20,20,20,0.5)"; g.stroke();
  }
}

function cejas(g, P, st) {
  const forma = { neutra: [0, 0], arriba: [-28, -28], cansadas: [6, 26], duda: [-34, 4], enfado: [16, -14] }[st.cejas || "neutra"];
  g.lineWidth = P.cejasGruesas ? 22 : 16; g.lineCap = "round"; g.strokeStyle = P.pelo;
  g.beginPath(); g.moveTo(-120, -92 + forma[0] * 0.3); g.lineTo(-35, -100 + forma[0]); g.stroke();
  g.beginPath(); g.moveTo(35, -100 + forma[1]); g.lineTo(120, -92 + forma[1] * 0.3); g.stroke();
}

function nariz(g, P) {
  const tipo = P.nariz || "boton";
  if (tipo === "larga") { g.beginPath(); g.moveTo(-4, 5); g.lineTo(-22, 80); g.quadraticCurveTo(0, 94, 22, 82); linea(g, 6); g.stroke(); return; }
  if (tipo === "gancho") { g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(-48, 60, -20, 82); g.quadraticCurveTo(0, 90, 18, 74); linea(g, 6); g.stroke(); return; }
  g.beginPath(); g.moveTo(-6, 20); g.quadraticCurveTo(-32, 66, 0, 72); g.quadraticCurveTo(14, 72, 18, 64); linea(g, 6); g.stroke();
}

function bocaDe(g, st, P) {
  const m = st.boca || 0, y = 112;
  if (m < 0.05) {
    const s = (st.sonrisa ?? 0.2) * 22;
    g.beginPath(); g.moveTo(-48, y); g.quadraticCurveTo(0, y + s, 48, y); linea(g, 7); g.stroke();
  } else {
    const w = 42 + 22 * m, h = 10 + 46 * m;
    elipse(g, 0, y + h * 0.35, w, h); g.fillStyle = "#5b1a1d"; g.fill();
    g.save(); g.clip();
    g.fillStyle = "#fff"; g.fillRect(-w, y + h * 0.35 - h, w * 2, h * 0.38);
    elipse(g, 0, y + h * 0.35 + h * 0.75, w * 0.7, h * 0.5); g.fillStyle = "#d9606a"; g.fill();
    g.restore();
    elipse(g, 0, y + h * 0.35, w, h); linea(g, 7); g.stroke();
  }
  if (P.bigote) { g.beginPath(); g.moveTo(-70, 98); g.quadraticCurveTo(-35, 70, 0, 90); g.quadraticCurveTo(35, 70, 70, 98); g.quadraticCurveTo(35, 105, 0, 98); g.quadraticCurveTo(-35, 105, -70, 98); relleno(g, P.pelo, 6); }
}

function cabeza(g, P, st) {
  const rx = P.cabeza?.rx || 192, ry = P.cabeza?.ry || 215, oe = P.orejas || 1;
  for (const s of [-1, 1]) { elipse(g, s * (rx + 2), 0, 34 * oe, 50 * oe); relleno(g, P.piel, 7); elipse(g, s * (rx + 2), 0, 14 * oe, 26 * oe); g.strokeStyle = "rgba(20,20,20,0.4)"; g.lineWidth = 4; g.stroke(); }
  elipse(g, 0, 0, rx, ry); relleno(g, P.piel);
  // Sombra bajo el pelo, barba y mejillas
  g.save(); elipse(g, 0, 0, rx, ry); g.clip();
  g.fillStyle = "rgba(120,60,30,0.10)"; g.beginPath(); g.ellipse(0, -ry * 0.55, rx, ry * 0.35, 0, 0, 7); g.fill();
  if (P.barba) { g.fillStyle = P.barba; g.globalAlpha = P.barbaLarga ? 0.92 : 0.14; g.beginPath(); g.ellipse(0, P.barbaLarga ? 200 : 185, rx * 0.86, P.barbaLarga ? 120 : 85, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
  g.fillStyle = P.mejillas || "rgba(230,110,110,0.22)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 115, 70, 38, 24, 0, 0, 7); g.fill(); }
  g.restore();
  if (P.barbaLarga) { g.save(); elipse(g, 0, 0, rx, ry); g.clip(); linea(g, 7); g.beginPath(); g.ellipse(0, 200, rx * 0.86, 120, 0, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); g.restore(); }
  if (!P.gorra || P.gorraAlReves) pelo(g, P, rx, ry);
  ojo(g, -78, st, P); ojo(g, 78, st, P);
  cejas(g, P, st);
  nariz(g, P);
  bocaDe(g, st, P);
  if (P.gorra) {
    g.beginPath(); g.moveTo(-rx - 13, -40); g.quadraticCurveTo(-rx - 18, -ry - 35, 0, -ry - 40); g.quadraticCurveTo(rx + 18, -ry - 35, rx + 13, -40); g.quadraticCurveTo(0, -95, -rx - 13, -40); g.closePath(); relleno(g, P.gorra);
    if (P.gorraAlReves) { g.beginPath(); g.roundRect(-60, -110, 120, 46, 18); relleno(g, P.gorraVisera || P.gorra, 6); }
    else { elipse(g, 0, -62, rx + 23, 46); relleno(g, P.gorraVisera || P.gorra); }
    elipse(g, 0, -ry - 37, 18, 10); relleno(g, P.gorra, 6);
    if (P.gafasSol) {
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 62, -ry + 10, 58, 34, 0, 0, 7); relleno(g, "#1b1b1b", 7); g.save(); g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(s * 62 - 18, -ry, 12, 8, -0.5, 0, 7); g.fill(); g.restore(); }
      g.beginPath(); g.moveTo(-8, -ry + 4); g.lineTo(8, -ry + 4); linea(g, 7); g.stroke();
    }
  }
  if (P.cascos) {
    g.beginPath(); g.arc(0, -10, rx + 44, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 30; g.strokeStyle = TRAZO; g.stroke();
    g.beginPath(); g.arc(0, -10, rx + 44, Math.PI * 1.08, Math.PI * 1.92); g.lineWidth = 16; g.strokeStyle = P.cascos; g.stroke();
    for (const s of [-1, 1]) { g.beginPath(); g.roundRect(s * (rx + 23) - 38, -60, 76, 130, 30); relleno(g, P.cascos); g.beginPath(); g.arc(s * (rx + 23), 5, 18, 0, 7); relleno(g, P.cascosLuz || "#00DF82", 5); }
  }
}

/** Móvil en la mano; `pantalla` da el color de la luz. */
export function movil(g, x, y, rot, { pantalla = "#cfe8ff", piel = "#f1c9a5", bocaAbajo = false, grabando = false } = {}) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.roundRect(-62, -115, 124, 230, 22); relleno(g, "#1e1e22");
  if (!bocaAbajo) {
    g.beginPath(); g.roundRect(-50, -100, 100, 200, 12); g.fillStyle = pantalla; g.fill();
    if (grabando) { g.beginPath(); g.arc(0, 40, 26, 0, 7); g.fillStyle = "#E94F37"; g.fill(); g.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 7; i++) g.fillRect(-36 + i * 11, -40 - (i % 3) * 10, 6, 20 + (i % 3) * 20); }
    else { g.fillStyle = "rgba(0,0,0,0.18)"; for (let i = 0; i < 5; i++) { g.beginPath(); g.roundRect(i % 2 ? -36 : -6, -82 + i * 34, 44, 18, 8); g.fill(); } }
  } else { g.fillStyle = "#3a3a40"; g.beginPath(); g.roundRect(-30, -95, 46, 70, 14); g.fill(); g.beginPath(); g.arc(-12, -78, 10, 0, 7); g.fillStyle = "#111"; g.fill(); }
  g.beginPath(); g.ellipse(0, 95, 70, 52, 0, 0, 7); relleno(g, piel);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-40 + i * 32, 60); g.lineTo(-40 + i * 32, 95); linea(g, 5); g.stroke(); }
  g.restore();
}

export function busto(g, P, st, x, y, s = 1) {
  const habla = st.boca || 0, t = st.t || 0;
  const bob = Math.sin(t * 11) * 7 * habla, tilt = Math.sin(t * 5.3) * 0.025 * habla + (st.inclina || 0);
  g.save(); g.translate(x, y); g.scale(s, s);
  g.save(); g.scale(P.ancho || 1, 1); cuerpo(g, P); g.restore();
  brazalete(g, P);
  if (st.brazo) brazo(g, P, st.brazo.lado || -1, [st.brazo.x, st.brazo.y], st.brazo.objeto);
  g.save(); g.translate(0, bob); g.rotate(tilt); cabeza(g, P, st); g.restore();
  // "mano": a la altura del pecho; "boca": pegado a la boca, grabando un audio.
  if (st.movil === "boca") { brazo(g, P, -1, [-205, 330], null); movil(g, -205, 215, 0.55, { pantalla: st.pantalla, piel: P.piel, grabando: true }); }
  else if (st.movil) { brazo(g, P, 1, [190, 565], null); movil(g, 190, 470, -0.12, { pantalla: st.pantalla, piel: P.piel }); }
  g.restore();
}
