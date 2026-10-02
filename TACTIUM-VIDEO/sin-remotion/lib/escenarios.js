// Escenarios de los reels de humor, en el mismo estilo plano que los muñecos.
// Todos ocupan el lienzo vertical (1080x1920); el personaje va delante, de pecho para arriba,
// así que lo importante del decorado vive en el tercio de arriba y en los laterales.
import { TRAZO } from "./munecos.js";
import { rnd } from "./util.js";

const W = 1080, H = 1920;
function linea(g, w = 8) { g.lineWidth = w; g.strokeStyle = TRAZO; g.lineJoin = "round"; g.lineCap = "round"; }
function caja(g, x, y, w, h, color, r = 0, lw = 8) { g.beginPath(); r ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fillStyle = color; g.fill(); linea(g, lw); g.stroke(); }
function circulo(g, x, y, r, color, lw = 7) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill(); linea(g, lw); g.stroke(); }

/** Viñeta suave: centra la mirada en el personaje y da profundidad. */
export function vineta(g, fuerza = 0.28) {
  const v = g.createRadialGradient(540, 900, 380, 540, 960, 1250); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${fuerza})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

/** Pala de pádel (carbono, agujeros, garganta en triángulo, sin cuerdas). */
export function pala(g, x, y, s = 1, rot = 0, acento = "#00DF82") {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.beginPath(); g.roundRect(-22, 150, 44, 170, 14); g.fillStyle = "#e9e9e9"; g.fill(); linea(g, 7); g.stroke();
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-22, 175 + i * 24); g.lineTo(22, 165 + i * 24); linea(g, 3); g.stroke(); }
  g.beginPath(); g.moveTo(-60, 60); g.lineTo(-24, 152); g.lineTo(24, 152); g.lineTo(60, 60); g.closePath(); g.fillStyle = "#1d1d1f"; g.fill(); linea(g, 7); g.stroke();
  g.beginPath(); g.moveTo(-26, 85); g.lineTo(0, 132); g.lineTo(26, 85); g.closePath(); g.fillStyle = "#cfd9d6"; g.fill(); linea(g, 5); g.stroke();
  g.beginPath(); g.ellipse(0, -60, 130, 150, 0, 0, Math.PI * 2); g.fillStyle = "#1d1d1f"; g.fill(); linea(g, 8); g.stroke();
  g.beginPath(); g.ellipse(0, -60, 112, 132, 0, 0, Math.PI * 2); g.strokeStyle = acento; g.lineWidth = 6; g.stroke();
  g.fillStyle = "#cfd9d6"; for (let yy = -160; yy <= 40; yy += 34) for (let xx = -90; xx <= 90; xx += 34) { if ((xx * xx) / 9000 + ((yy + 60) * (yy + 60)) / 13500 > 1) continue; g.beginPath(); g.arc(xx, yy, 7, 0, 7); g.fill(); }
  g.restore();
}

/** Paletero (mochila de palas) apoyado. */
function paletero(g, x, y, s = 1, color = "#1F3B57") {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(-170, 0); g.quadraticCurveTo(-200, -260, 0, -300); g.quadraticCurveTo(200, -260, 170, 0); g.closePath(); g.fillStyle = color; g.fill(); linea(g); g.stroke();
  g.beginPath(); g.moveTo(-150, -150); g.quadraticCurveTo(0, -190, 150, -150); linea(g, 6); g.stroke();
  g.fillStyle = "#00DF82"; g.fillRect(-120, -110, 240, 22); linea(g, 5); g.strokeRect(-120, -110, 240, 22);
  g.beginPath(); g.moveTo(-60, -290); g.quadraticCurveTo(0, -380, 60, -290); linea(g, 14); g.stroke();
  g.restore();
}

/** Bote de pelotas. */
function botePelotas(g, x, y) {
  caja(g, x - 45, y - 170, 90, 170, "rgba(220,235,240,0.75)", 14, 6);
  for (let i = 0; i < 3; i++) circulo(g, x, y - 35 - i * 52, 26, "#D6E636", 5);
  caja(g, x - 50, y - 190, 100, 26, "#E94F37", 8, 6);
}

// ── Salón del capitán ───────────────────────────────────────────────────────
export function salon(g) {
  g.fillStyle = "#EAD9B6"; g.fillRect(0, 0, W, H);
  // Papel pintado de rayas suaves
  g.fillStyle = "rgba(255,255,255,0.22)"; for (let x = 0; x < W; x += 70) g.fillRect(x, 0, 30, 1250);
  // Zócalo de madera
  g.fillStyle = "#C9A97A"; g.fillRect(0, 1250, W, H - 1250); linea(g); g.beginPath(); g.moveTo(0, 1250); g.lineTo(W, 1250); g.stroke();
  for (let x = 40; x < W; x += 90) { g.beginPath(); g.moveTo(x, 1250); g.lineTo(x, H); g.lineWidth = 3; g.strokeStyle = "rgba(20,20,20,0.15)"; g.stroke(); }
  // Ventana con ciudad
  caja(g, 60, 300, 330, 460, "#9ED3F0", 6);
  g.save(); g.beginPath(); g.rect(64, 304, 322, 452); g.clip();
  const r = rnd(4); for (let i = 0; i < 6; i++) { const bx = 60 + i * 58, bh = 120 + r() * 160; g.fillStyle = i % 2 ? "#B9C7D8" : "#A3B4C9"; g.fillRect(bx, 760 - bh, 54, bh); g.fillStyle = "#F7E7A1"; for (let wy = 760 - bh + 20; wy < 740; wy += 40) for (let wx = 0; wx < 2; wx++) if (r() > 0.4) g.fillRect(bx + 10 + wx * 22, wy, 12, 18); }
  g.fillStyle = "#fff"; for (const [cx, cy] of [[140, 400], [290, 470]]) { g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.arc(cx + 36, cy - 10, 36, 0, 7); g.arc(cx + 72, cy, 26, 0, 7); g.fill(); }
  g.restore();
  linea(g, 8); g.beginPath(); g.moveTo(225, 300); g.lineTo(225, 760); g.moveTo(60, 530); g.lineTo(390, 530); g.stroke();
  // Cortina
  g.beginPath(); g.moveTo(20, 270); g.lineTo(130, 270); g.quadraticCurveTo(90, 520, 120, 800); g.lineTo(10, 800); g.closePath(); g.fillStyle = "#C2603F"; g.fill(); linea(g); g.stroke();
  caja(g, 0, 255, 430, 22, "#6B4A2B", 10, 6);
  // Foto del equipo enmarcada
  caja(g, 470, 190, 200, 150, "#F6F1E6", 6, 7); g.fillStyle = "#7CC4F2"; g.fillRect(488, 208, 164, 114);
  for (let i = 0; i < 5; i++) { circulo(g, 510 + i * 30, 268, 14, "#F1C9A5", 4); g.fillStyle = "#03624C"; g.fillRect(498 + i * 30, 284, 24, 38); }
  // Estantería: trofeo, bote de pelotas y medalla
  caja(g, 690, 760, 360, 26, "#9C6B3E", 3);
  g.save(); g.translate(800, 760);
  g.beginPath(); g.moveTo(-60, -150); g.quadraticCurveTo(-60, -60, 0, -55); g.quadraticCurveTo(60, -60, 60, -150); g.closePath(); g.fillStyle = "#F2C230"; g.fill(); linea(g, 7); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 66, -120, 22, s > 0 ? -1.4 : Math.PI - 1.7, s > 0 ? 1.4 : Math.PI + 1.7, s < 0); linea(g, 7); g.stroke(); }
  caja(g, -16, -55, 32, 30, "#F2C230", 0, 6); caja(g, -45, -28, 90, 28, "#6B4A2B", 4, 6);
  g.restore();
  botePelotas(g, 960, 760);
  pala(g, 860, 430, 0.85, 0.35);
  // Lámpara de pie a la izquierda
  caja(g, 40, 900, 16, 400, "#3a3a3a", 4, 5);
  g.beginPath(); g.moveTo(-10, 900); g.lineTo(110, 900); g.lineTo(80, 820); g.lineTo(20, 820); g.closePath(); g.fillStyle = "#F7E7A1"; g.fill(); linea(g); g.stroke();
  // Paletero en el suelo y planta
  paletero(g, 930, 1560, 0.9);
  caja(g, 900, 1120, 120, 130, "#C2603F", 8);
  g.fillStyle = "#3E8E5A"; for (const [dx, dy, r2] of [[-30, -60, 50], [20, -90, 60], [60, -50, 45]]) { g.beginPath(); g.ellipse(960 + dx, 1120 + dy, r2 * 0.6, r2, dx * 0.01, 0, 7); g.fill(); linea(g, 6); g.stroke(); }
  vineta(g, 0.22);
}

// ── Terraza del club ────────────────────────────────────────────────────────
export function club(g) {
  const cielo = g.createLinearGradient(0, 0, 0, 900); cielo.addColorStop(0, "#6FB8EE"); cielo.addColorStop(1, "#CDEBFA");
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  circulo(g, 900, 120, 70, "#FFE27A", 0);
  // Focos
  for (const x of [120, 960]) { caja(g, x - 10, 40, 20, 300, "#5a5a5a", 4, 5); caja(g, x - 60, 20, 120, 50, "#DADADA", 10, 6); }
  // Pista: suelo azul, líneas, red y dos jugadores al fondo
  g.fillStyle = "#2D6FD0"; g.fillRect(0, 700, W, 700);
  g.strokeStyle = "#fff"; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 860); g.lineTo(W, 860); g.moveTo(540, 860); g.lineTo(540, 1400); g.stroke();
  g.fillStyle = "rgba(20,20,20,0.35)"; g.fillRect(0, 760, W, 36); linea(g, 5); g.beginPath(); g.moveTo(0, 760); g.lineTo(W, 760); g.stroke();
  g.save(); g.strokeStyle = "rgba(20,20,20,0.25)"; g.lineWidth = 2; for (let x = 0; x < W; x += 14) { g.beginPath(); g.moveTo(x, 760); g.lineTo(x, 796); g.stroke(); } g.restore();
  for (const [x, c] of [[260, "#E94F37"], [820, "#FFC93C"]]) { circulo(g, x, 650, 22, "#F1C9A5", 5); g.beginPath(); g.roundRect(x - 26, 672, 52, 70, 12); g.fillStyle = c; g.fill(); linea(g, 5); g.stroke(); g.beginPath(); g.moveTo(x + 26, 690); g.lineTo(x + 60, 650); linea(g, 6); g.stroke(); circulo(g, x + 70, 636, 16, "#1d1d1f", 4); }
  // Cristales con perfil metálico y malla arriba
  for (let x = 0; x <= W; x += 270) { g.fillStyle = "rgba(210,240,255,0.25)"; g.fillRect(x, 300, 270, 520); linea(g, 10); g.beginPath(); g.moveTo(x, 300); g.lineTo(x, 820); g.stroke(); }
  g.save(); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 10; for (let x = 60; x < W; x += 270) { g.beginPath(); g.moveTo(x, 360); g.lineTo(x + 90, 480); g.stroke(); } g.restore();
  linea(g, 10); g.beginPath(); g.moveTo(0, 300); g.lineTo(W, 300); g.moveTo(0, 820); g.lineTo(W, 820); g.stroke();
  g.strokeStyle = "rgba(20,20,20,0.25)"; g.lineWidth = 2; for (let x = -300; x < W; x += 36) { g.beginPath(); g.moveTo(x, 120); g.lineTo(x + 180, 300); g.moveTo(x + 180, 120); g.lineTo(x, 300); g.stroke(); }
  linea(g, 8); g.beginPath(); g.moveTo(0, 120); g.lineTo(W, 120); g.stroke();
  // Pizarra del bar
  caja(g, 30, 880, 220, 300, "#2E3B33", 10); caja(g, 30, 880, 220, 300, "rgba(0,0,0,0)", 10, 14);
  g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 6; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60, 940 + i * 48); g.lineTo(60 + 90 + (i % 3) * 25, 940 + i * 48); g.stroke(); g.beginPath(); g.moveTo(190, 940 + i * 48); g.lineTo(220, 940 + i * 48); g.stroke(); }
  // Barra con grifos
  caja(g, -20, 1380, W + 40, 120, "#A8743F", 0); caja(g, -20, 1500, W + 40, 420, "#8A5C30", 0);
  for (let x = 40; x < W; x += 160) { g.beginPath(); g.moveTo(x, 1500); g.lineTo(x, H); g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.25)"; g.stroke(); }
  caja(g, 820, 1250, 180, 30, "#C0C0C0", 8, 6);
  for (let i = 0; i < 3; i++) { caja(g, 840 + i * 55, 1170, 22, 80, "#B8B8B8", 6, 5); circulo(g, 851 + i * 55, 1160, 18, ["#E94F37", "#00DF82", "#FFC93C"][i], 5); }
  caja(g, 60, 1300, 120, 80, "#F5F5F5", 10, 6); // servilletero
  vineta(g, 0.2);
}

// ── Cocina (se desplaza con `avance` para que parezca que anda) ─────────────
export function cocina(g, avance = 0) {
  g.fillStyle = "#F4EEE2"; g.fillRect(0, 0, W, H);
  const off = -(avance % 120);
  g.fillStyle = "#E6F0EE"; g.fillRect(0, 560, W, 760);
  g.strokeStyle = "rgba(20,20,20,0.18)"; g.lineWidth = 3;
  for (let x = off; x < W; x += 120) { g.beginPath(); g.moveTo(x, 560); g.lineTo(x, 1320); g.stroke(); }
  for (let y = 560; y <= 1320; y += 95) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const off2 = -(avance % 1000);
  for (let k = -1; k < 3; k++) {
    const x = off2 + k * 1000;
    // Muebles altos con tiradores
    caja(g, x + 30, 140, 300, 380, "#5FA8A0", 10); caja(g, x + 350, 140, 300, 380, "#5FA8A0", 10);
    g.fillStyle = TRAZO; g.fillRect(x + 300, 300, 12, 60); g.fillRect(x + 370, 300, 12, 60);
    // Utensilios colgados
    linea(g, 6); g.beginPath(); g.moveTo(x + 60, 620); g.lineTo(x + 330, 620); g.stroke();
    for (let i = 0; i < 4; i++) { const ux = x + 90 + i * 66; g.beginPath(); g.moveTo(ux, 620); g.lineTo(ux, 760); linea(g, 7); g.stroke(); circulo(g, ux, 780, i % 2 ? 22 : 16, "#B0B0B0", 5); }
    // Ventana con planta
    caja(g, x + 420, 600, 200, 220, "#9ED3F0", 6); linea(g, 6); g.beginPath(); g.moveTo(x + 520, 600); g.lineTo(x + 520, 820); g.stroke();
    caja(g, x + 470, 760, 60, 60, "#C2603F", 6, 5); g.fillStyle = "#3E8E5A"; g.beginPath(); g.ellipse(x + 500, 735, 30, 40, 0, 0, 7); g.fill(); linea(g, 5); g.stroke();
    // Encimera con fogón y sartén
    caja(g, x + 20, 1320, 960, 70, "#E2C79A", 4);
    caja(g, x + 80, 1240, 200, 80, "#3a3a3a", 10, 6); g.beginPath(); g.ellipse(x + 180, 1235, 90, 22, 0, 0, 7); g.fillStyle = "#222"; g.fill(); linea(g, 6); g.stroke(); g.beginPath(); g.moveTo(x + 270, 1230); g.lineTo(x + 380, 1210); linea(g, 14); g.stroke();
    // Nevera con imanes y dibujo
    caja(g, x + 690, 520, 240, 800, "#EDEDED", 16); linea(g, 7); g.beginPath(); g.moveTo(x + 690, 800); g.lineTo(x + 930, 800); g.stroke(); g.fillStyle = TRAZO; g.fillRect(x + 900, 600, 12, 140);
    caja(g, x + 720, 860, 120, 150, "#FFFDF2", 4, 5); g.strokeStyle = "#2D6FD0"; g.lineWidth = 5; g.beginPath(); g.arc(x + 760, 920, 18, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + 790, 980); g.lineTo(x + 820, 900); g.stroke();
    for (const [mx, my, c] of [[730, 600, "#E94F37"], [800, 650, "#FFC93C"], [760, 700, "#00DF82"]]) circulo(g, x + mx, my, 16, c, 5);
  }
  vineta(g, 0.18);
}

// ── Dormitorio de madrugada (la luz se pone en la escena: multiplicar + brillo del móvil) ──
export function dormitorio(g) {
  g.fillStyle = "#3B4A78"; g.fillRect(0, 0, W, H);
  // Póster de pádel y estantería con libros
  caja(g, 80, 220, 230, 320, "#E94F37", 6); pala(g, 195, 360, 0.5, -0.4, "#FFC93C");
  caja(g, 380, 360, 220, 22, "#5A3E2B", 3, 6);
  const r = rnd(9); for (let i = 0; i < 6; i++) caja(g, 392 + i * 34, 360 - 80 - r() * 30, 28, 80 + r() * 30, ["#7CC4F2", "#FFC93C", "#E07A5F", "#9ED39A"][i % 4], 3, 4);
  // Ventana con luna y ciudad de noche
  caja(g, 640, 240, 380, 460, "#16204A", 6);
  g.save(); g.beginPath(); g.rect(644, 244, 372, 452); g.clip();
  for (let i = 0; i < 7; i++) { const bx = 640 + i * 56, bh = 90 + r() * 130; g.fillStyle = "#0E1533"; g.fillRect(bx, 700 - bh, 52, bh); g.fillStyle = "#F7E7A1"; for (let wy = 700 - bh + 16; wy < 690; wy += 34) if (r() > 0.6) g.fillRect(bx + 14, wy, 12, 16); }
  g.restore();
  g.fillStyle = "#F7F3D0"; g.beginPath(); g.arc(880, 360, 58, 0, 7); g.fill(); g.fillStyle = "#16204A"; g.beginPath(); g.arc(905, 340, 52, 0, 7); g.fill();
  g.fillStyle = "#fff"; for (const [x, y] of [[700, 300], [760, 420], [970, 300], [690, 480]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  linea(g, 8); g.beginPath(); g.moveTo(830, 240); g.lineTo(830, 700); g.moveTo(640, 470); g.lineTo(1020, 470); g.stroke();
  // Cabecero, almohada y edredón de cuadros
  caja(g, 60, 860, 960, 540, "#6B4A8A", 40);
  g.beginPath(); g.ellipse(540, 1240, 420, 150, 0, 0, 7); g.fillStyle = "#E8E6F5"; g.fill(); linea(g); g.stroke();
  // Mesilla: lámpara apagada, vaso de agua y despertador
  caja(g, 30, 1100, 240, 320, "#5A3E2B", 10); caja(g, 30, 1150, 240, 10, "#4a3222", 0, 4);
  caja(g, 60, 1010, 150, 80, "#111", 10, 6); g.fillStyle = "#FF4D4D"; g.font = "700 50px JBM"; g.textAlign = "center"; g.fillText("2:13", 135, 1068);
  caja(g, 220, 990, 44, 100, "rgba(200,225,255,0.55)", 6, 5);
  // Silla con ropa a la derecha
  caja(g, 900, 980, 30, 440, "#5A3E2B", 6, 6);
  g.beginPath(); g.moveTo(870, 1000); g.quadraticCurveTo(960, 960, 1080, 1010); g.lineTo(1080, 1180); g.quadraticCurveTo(980, 1120, 880, 1150); g.closePath(); g.fillStyle = "#5B7BD5"; g.fill(); linea(g); g.stroke();
}

// ── Salón con sofá y la tele encendida a la derecha ─────────────────────────
export function sofa(g, t = 0) {
  g.fillStyle = "#3E7C7A"; g.fillRect(0, 0, W, H);
  // Cuadros y estantería
  caja(g, 110, 220, 300, 220, "#F2E9D8", 6); g.fillStyle = "#E07A5F"; g.fillRect(130, 240, 260, 180); circulo(g, 300, 300, 40, "#FFC93C", 5);
  caja(g, 470, 260, 140, 180, "#F2E9D8", 6); g.fillStyle = "#7CC4F2"; g.fillRect(486, 276, 108, 148);
  caja(g, 700, 460, 300, 22, "#5A3E2B", 3, 6); botePelotas(g, 760, 460); pala(g, 900, 300, 0.55, 0.25);
  // Lámpara de pie
  caja(g, 60, 560, 16, 420, "#3a3a3a", 4, 5); g.beginPath(); g.moveTo(-20, 560); g.lineTo(150, 560); g.lineTo(110, 460); g.lineTo(20, 460); g.closePath(); g.fillStyle = "#F7E7A1"; g.fill(); linea(g); g.stroke();
  // Sofá con cojines
  caja(g, -40, 860, 1160, 300, "#B23A48", 50);
  caja(g, 640, 900, 200, 170, "#FFC93C", 40); caja(g, 820, 920, 180, 160, "#5FA8A0", 40);
  caja(g, -40, 1130, 1160, 380, "#9C2F3C", 40);
  caja(g, -60, 980, 160, 520, "#B23A48", 50); caja(g, 980, 980, 160, 520, "#B23A48", 50);
  // Alfombra y mesa baja con latas y patatas
  g.fillStyle = "#E9C46A"; g.fillRect(0, 1560, W, 360); g.fillStyle = "rgba(20,20,20,0.12)"; for (let x = 0; x < W; x += 60) g.fillRect(x, 1560, 30, 360);
  caja(g, 140, 1600, 800, 60, "#7A5232", 12); caja(g, 180, 1660, 30, 260, "#7A5232", 4, 6); caja(g, 870, 1660, 30, 260, "#7A5232", 4, 6);
  for (let i = 0; i < 2; i++) caja(g, 250 + i * 80, 1510, 56, 90, i ? "#E94F37" : "#2D6FD0", 10, 6);
  g.beginPath(); g.moveTo(560, 1600); g.lineTo(600, 1480); g.lineTo(760, 1480); g.lineTo(800, 1600); g.closePath(); g.fillStyle = "#FFC93C"; g.fill(); linea(g); g.stroke();
  // Luz de la tele, que parpadea con `t`
  const fl = 0.18 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 29);
  const luz = g.createRadialGradient(W + 100, 900, 50, W + 100, 900, 950); luz.addColorStop(0, `rgba(160,210,255,${fl + 0.22})`); luz.addColorStop(1, "rgba(160,210,255,0)");
  g.fillStyle = luz; g.fillRect(0, 0, W, H);
  vineta(g, 0.25);
}
