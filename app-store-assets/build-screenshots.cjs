/* Genera screenshots de App Store (6.9" = 1290x2796 y 6.5" = 1242x2688)
   componiendo capturas REALES de la app sobre un lienzo de marca TACTIUM.
   No altera la UI (cumple Guideline 2.3.3). Ejecutar desde tactium-landing
   para que resuelva `sharp`. */
const sharp = require('C:/Users/javie/Desktop/4PADEL LAB PRUEBA/tactium-landing/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/javie/Desktop/4PADEL LAB PRUEBA';
const SRC = path.join(ROOT, 'tactium-landing', 'Screens APP');
const OUT69 = path.join(ROOT, 'app-store-assets', 'ios-6.9');
const OUT65 = path.join(ROOT, 'app-store-assets', 'ios-6.5');
fs.mkdirSync(OUT69, { recursive: true });
fs.mkdirSync(OUT65, { recursive: true });

const W = 1290, H = 2796;
const SHOT_W = 900;            // ancho del screenshot enmarcado
const SHOT_X = Math.round((W - SHOT_W) / 2);
const SHOT_Y = 590;
const RADIUS = 52;

// orden = aparición en la ficha
const SCREENS = [
  { file: 'CLUB.png',                 h1: 'Tu club,',            h2: 'sin Excel ni WhatsApp' },
  { file: 'ALINEACION.jpeg',          h1: 'Tu alineación,',     h2: 'en 90 segundos' },
  { file: 'JORNADA + RESULTADOS.jpeg',h1: 'Toda la jornada',    h2: 'en un solo sitio' },
  { file: 'INVITACION JUGADOR.jpeg',  h1: 'Invita a tu equipo', h2: 'en 1 toque' },
  { file: 'PERFIL JUGADOR.jpeg',      h1: 'Tus jugadores,',     h2: 'siempre al día' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function backgroundSvg() {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="9%" r="62%">
        <stop offset="0%" stop-color="#03624C" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="#030F0F" stop-opacity="1"/>
        <stop offset="100%" stop-color="#030F0F" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#030F0F"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
  </svg>`);
}

function textSvg(h1, h2) {
  const fam = "'Helvetica Neue', Arial, sans-serif";
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .h { font-family:${fam}; font-weight:800; font-size:82px; fill:#E8F5EF; letter-spacing:-2px; }
      .a { fill:#00DF82; }
      .wm { font-family:'Courier New', monospace; font-weight:700; font-size:26px; fill:#00DF82; letter-spacing:10px; }
    </style>
    <text x="${W/2}" y="300" text-anchor="middle" class="h">${esc(h1)}</text>
    <text x="${W/2}" y="396" text-anchor="middle" class="h a">${esc(h2)}</text>
    <text x="${W/2}" y="2680" text-anchor="middle" class="wm">T A C T I U M</text>
  </svg>`);
}

function roundedMask(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/>
  </svg>`);
}

function borderCard(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="${RADIUS+4}" ry="${RADIUS+4}"
      fill="none" stroke="rgba(232,245,239,0.18)" stroke-width="2"/>
  </svg>`);
}

(async () => {
  for (let i = 0; i < SCREENS.length; i++) {
    const s = SCREENS[i];
    const srcPath = path.join(SRC, s.file);
    if (!fs.existsSync(srcPath)) { console.log('FALTA:', s.file); continue; }

    // 1) screenshot a ancho fijo
    const shot = await sharp(srcPath).resize({ width: SHOT_W }).png().toBuffer();
    const meta = await sharp(shot).metadata();
    const sh = meta.height;

    // 2) esquinas redondeadas
    const rounded = await sharp(shot)
      .composite([{ input: roundedMask(SHOT_W, sh), blend: 'dest-in' }])
      .png().toBuffer();

    // 3) lienzo final
    const out = await sharp(backgroundSvg())
      .composite([
        { input: borderCard(SHOT_W + 6, sh + 6), left: SHOT_X - 3, top: SHOT_Y - 3 },
        { input: rounded, left: SHOT_X, top: SHOT_Y },
        { input: textSvg(s.h1, s.h2), left: 0, top: 0 },
      ])
      .png().toBuffer();

    const n = String(i + 1).padStart(2, '0');
    await sharp(out).png().toFile(path.join(OUT69, `${n}.png`));
    await sharp(out).resize(1242, 2688).png().toFile(path.join(OUT65, `${n}.png`));
    console.log(`OK ${n}.png  <- ${s.file}  (shot ${SHOT_W}x${sh})`);
  }
  console.log('\nHecho. 6.9" en', OUT69, '\n6.5" en', OUT65);
})();
