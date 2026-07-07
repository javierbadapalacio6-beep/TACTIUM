/* Genera los assets de Google Play Store para TACTIUM:
   - Teléfono   1080x1920  (ratio 1.78:1, dentro del máx. 2:1 de Play)
   - Tablet 7"  1200x1920  (ratio 1.60:1)
   - Tablet 10" 1600x2560  (ratio 1.60:1)
   - Gráfico destacado (feature graphic) 1024x500  (sin alpha, 24-bit)
   - Icono hi-res 512x512
   Compone capturas REALES de la app sobre un lienzo de marca TACTIUM.
   Ejecutar desde tactium-landing para que resuelva `sharp`. */
const sharp = require('C:/Users/javie/Desktop/4PADEL LAB PRUEBA/tactium-landing/node_modules/sharp');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/javie/Desktop/4PADEL LAB PRUEBA';
const SRC = path.join(ROOT, 'tactium-landing', 'Screens APP');
const ICON = path.join(ROOT, 'tactium-landing', 'public', 'icons', 'icon-512.png');
const OUT = path.join(ROOT, 'app-store-assets', 'play');

const PHONE = path.join(OUT, 'phone');
const TAB7 = path.join(OUT, 'tablet-7');
const TAB10 = path.join(OUT, 'tablet-10');
[OUT, PHONE, TAB7, TAB10].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// orden = aparición en la ficha
const SCREENS = [
  { file: 'CLUB.png',                 h1: 'Tu club,',            h2: 'sin Excel ni WhatsApp' },
  { file: 'ALINEACION.jpeg',          h1: 'Tu alineación,',     h2: 'en 90 segundos' },
  { file: 'JORNADA + RESULTADOS.jpeg',h1: 'Toda la jornada',    h2: 'en un solo sitio' },
  { file: 'INVITACION JUGADOR.jpeg',  h1: 'Invita a tu equipo', h2: 'en 1 toque' },
  { file: 'PERFIL JUGADOR.jpeg',      h1: 'Tus jugadores,',     h2: 'siempre al día' },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FAM = "'Helvetica Neue', Arial, sans-serif";

function backgroundSvg(W, H) {
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

function textSvg(W, H, h1, h2) {
  const fs1 = Math.round(W * 0.064);          // tamaño titular escalado al ancho
  const wm = Math.round(W * 0.020);
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .h { font-family:${FAM}; font-weight:800; font-size:${fs1}px; fill:#E8F5EF; letter-spacing:-2px; }
      .a { fill:#00DF82; }
      .wm { font-family:'Courier New', monospace; font-weight:700; font-size:${wm}px; fill:#00DF82; letter-spacing:10px; }
    </style>
    <text x="${W / 2}" y="${Math.round(H * 0.107)}" text-anchor="middle" class="h">${esc(h1)}</text>
    <text x="${W / 2}" y="${Math.round(H * 0.107 + fs1 * 1.18)}" text-anchor="middle" class="h a">${esc(h2)}</text>
    <text x="${W / 2}" y="${Math.round(H * 0.958)}" text-anchor="middle" class="wm">T A C T I U M</text>
  </svg>`);
}

function roundedMask(w, h, r) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/>
  </svg>`);
}

function borderCard(w, h, r) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r}" ry="${r}"
      fill="none" stroke="rgba(232,245,239,0.18)" stroke-width="2"/>
  </svg>`);
}

// Compone una captura sobre el lienzo W x H, ajustada a una caja con márgenes.
async function compose(W, H, srcPath) {
  const RADIUS = Math.round(W * 0.04);
  const maxW = Math.round(W * 0.74);
  const maxH = Math.round(H * 0.66);
  const topY = Math.round(H * 0.225);

  const shot = await sharp(srcPath)
    .resize({ width: maxW, height: maxH, fit: 'inside' })
    .png().toBuffer();
  const meta = await sharp(shot).metadata();
  const sw = meta.width, sh = meta.height;
  const x = Math.round((W - sw) / 2);

  const rounded = await sharp(shot)
    .composite([{ input: roundedMask(sw, sh, RADIUS), blend: 'dest-in' }])
    .png().toBuffer();

  return sharp(backgroundSvg(W, H))
    .composite([
      { input: borderCard(sw + 6, sh + 6, RADIUS + 4), left: x - 3, top: topY - 3 },
      { input: rounded, left: x, top: topY },
    ])
    .png().toBuffer();
}

async function makeSet(dir, W, H) {
  for (let i = 0; i < SCREENS.length; i++) {
    const s = SCREENS[i];
    const srcPath = path.join(SRC, s.file);
    if (!fs.existsSync(srcPath)) { console.log('FALTA:', s.file); continue; }
    const base = await compose(W, H, srcPath);
    const out = await sharp(base)
      .composite([{ input: textSvg(W, H, s.h1, s.h2), left: 0, top: 0 }])
      .png().toBuffer();
    const n = String(i + 1).padStart(2, '0');
    await sharp(out).png().toFile(path.join(dir, `${n}.png`));
  }
  console.log(`OK set ${W}x${H} -> ${dir}`);
}

async function makeFeatureGraphic() {
  const W = 1024, H = 500;
  const iconSize = 300;
  const iconX = 90, iconY = Math.round((H - iconSize) / 2);
  const icon = await sharp(ICON)
    .resize(iconSize, iconSize, { fit: 'cover' })
    .composite([{ input: roundedMask(iconSize, iconSize, 66), blend: 'dest-in' }])
    .png().toBuffer();

  const textX = iconX + iconSize + 70;
  const txt = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .brand { font-family:'Courier New', monospace; font-weight:700; font-size:64px; fill:#E8F5EF; letter-spacing:14px; }
      .tag1 { font-family:${FAM}; font-weight:800; font-size:40px; fill:#00DF82; letter-spacing:-1px; }
      .tag2 { font-family:${FAM}; font-weight:600; font-size:30px; fill:#9FB8AE; letter-spacing:-0.5px; }
    </style>
    <text x="${textX}" y="195" class="brand">TACTIUM</text>
    <text x="${textX}" y="265" class="tag1">Tu club de pádel</text>
    <text x="${textX}" y="312" class="tag2">sin Excel ni WhatsApp</text>
  </svg>`);

  const out = await sharp(backgroundSvg(W, H))
    .composite([
      { input: icon, left: iconX, top: iconY },
      { input: txt, left: 0, top: 0 },
    ])
    .flatten({ background: '#030F0F' })   // sin alpha: feature graphic es 24-bit
    .removeAlpha()
    .png().toBuffer();
  await sharp(out).png().toFile(path.join(OUT, 'feature-graphic.png'));
  console.log('OK feature-graphic 1024x500');
}

async function makeIcon() {
  // 512x512, sin alpha (fondo de marca), por si el origen lo tuviera
  await sharp(ICON)
    .resize(512, 512, { fit: 'cover' })
    .flatten({ background: '#030F0F' })
    .png().toFile(path.join(OUT, 'icon-512.png'));
  console.log('OK icon-512');
}

(async () => {
  await makeSet(PHONE, 1080, 1920);
  await makeSet(TAB7, 1200, 1920);
  await makeSet(TAB10, 1600, 2560);
  await makeFeatureGraphic();
  await makeIcon();
  console.log('\nHecho. Assets en', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
