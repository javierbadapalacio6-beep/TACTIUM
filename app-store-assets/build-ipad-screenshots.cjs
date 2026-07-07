/* Capturas de App Store para iPad (2732x2048, horizontal) con el MISMO
   estilo de marca que las del iPhone: fondo con glow TACTIUM, titular
   arriba (blanco + acento), la captura real como tarjeta redondeada con
   borde, y el wordmark abajo. Fuente: capturas reales del iPad (WhatsApp).
   Ejecutar desde tactium-landing para resolver `sharp`. */
const sharp = require('C:/Users/javie/Desktop/4PADEL LAB PRUEBA/tactium-landing/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/javie/Desktop/4PADEL LAB PRUEBA';
const SRC = ROOT; // las capturas WhatsApp están en la raíz
const OUT = path.join(ROOT, 'app-store-assets', 'ios-ipad');
fs.mkdirSync(OUT, { recursive: true });

const W = 2732, H = 2048;
const SHOT_W = 2080;                       // ancho de la captura enmarcada
const SHOT_X = Math.round((W - SHOT_W) / 2);
const SHOT_Y = 372;
const RADIUS = 40;

const SHOTS = [
  { n: '01', file: 'WhatsApp Image 2026-06-11 at 17.19.13.jpeg',     h1: 'Tu club,',           h2: 'sin Excel ni WhatsApp' },
  { n: '02', file: 'WhatsApp Image 2026-06-11 at 17.19.14 (1).jpeg', h1: 'Tu alineación,',     h2: 'en 90 segundos' },
  { n: '03', file: 'WhatsApp Image 2026-06-11 at 17.19.14 (3).jpeg', h1: 'Toda la temporada,', h2: 'jornada a jornada' },
  { n: '04', file: 'WhatsApp Image 2026-06-11 at 17.19.14.jpeg',     h1: 'Tus jugadores,',     h2: 'siempre al día' },
  { n: '05', file: 'WhatsApp Image 2026-06-11 at 17.19.14 (2).jpeg', h1: 'Invita a tu equipo', h2: 'en 1 toque' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function backgroundSvg() {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="2%" r="60%">
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
  const fs1 = 100;
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .h { font-family:${fam}; font-weight:800; font-size:${fs1}px; fill:#E8F5EF; letter-spacing:-2px; }
      .a { fill:#00DF82; }
      .wm { font-family:'Courier New', monospace; font-weight:700; font-size:32px; fill:#00DF82; letter-spacing:14px; }
    </style>
    <text x="${W / 2}" y="180" text-anchor="middle" class="h">${esc(h1)}</text>
    <text x="${W / 2}" y="${180 + Math.round(fs1 * 1.12)}" text-anchor="middle" class="h a">${esc(h2)}</text>
    <text x="${W / 2}" y="1992" text-anchor="middle" class="wm">T A C T I U M</text>
  </svg>`);
}

function roundedMask(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/>
  </svg>`);
}

function borderCard(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${RADIUS + 4}" ry="${RADIUS + 4}"
      fill="none" stroke="rgba(232,245,239,0.18)" stroke-width="3"/>
  </svg>`);
}

(async () => {
  for (const s of SHOTS) {
    const srcPath = path.join(SRC, s.file);
    if (!fs.existsSync(srcPath)) { console.log('FALTA:', s.file); continue; }

    const shot = await sharp(srcPath).resize({ width: SHOT_W }).png().toBuffer();
    const meta = await sharp(shot).metadata();
    const sh = meta.height;

    const rounded = await sharp(shot)
      .composite([{ input: roundedMask(SHOT_W, sh), blend: 'dest-in' }])
      .png().toBuffer();

    const out = await sharp(backgroundSvg())
      .composite([
        { input: borderCard(SHOT_W + 6, sh + 6), left: SHOT_X - 3, top: SHOT_Y - 3 },
        { input: rounded, left: SHOT_X, top: SHOT_Y },
        { input: textSvg(s.h1, s.h2), left: 0, top: 0 },
      ])
      .flatten({ background: '#030F0F' })
      .removeAlpha()
      .png().toFile(path.join(OUT, `${s.n}.png`));
    console.log(`OK ${s.n}.png  <- ${s.file}  (card ${SHOT_W}x${sh} @ y${SHOT_Y})`);
  }
  console.log('\nHecho. iPad en', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
