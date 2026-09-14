// Lee `tokens.json`, que es una COPIA de la fuente de verdad del taller:
//   DESIGN SYSTEMS/TACTIUM_2026-09-14/03_TOKENS/tokens.json
// Si allí cambia un valor, se recopia:
//   cp "…/03_TOKENS/tokens.json" TACTIUM-VIDEO/src/reel/tokens.json
// Aquí no se inventa ningún valor: lo que no esté en el JSON, no existe.

import raw from "./tokens.json";

const px = (v: string) => Number.parseFloat(v);

const video = raw.video;
const dark = raw.color.dark;

export const T = {
  canvas: {
    w: video.canvas.w,
    h: video.canvas.h,
    fps: video.canvas.fps,
  },

  // Zona segura: nada legible fuera de estos márgenes. Cubre a la vez la UI de
  // Reels y la de TikTok, que come más por abajo.
  safe: {
    top: px(video.zonaSegura.top),
    bottom: px(video.zonaSegura.bottom),
    sides: px(video.zonaSegura.sides),
    // Por debajo de `escalonY`, la columna de iconos ocupa desde `escalonX`.
    escalonX: px(video.zonaSegura.escalonDerechaX),
    escalonY: px(video.zonaSegura.escalonDerechaDesdeY),
  },

  sub: {
    size: px(video.subtitulo.size),
    weight: video.subtitulo.weight,
    tracking: video.subtitulo.tracking,
    lineHeight: video.subtitulo.lineHeight,
    maxChars: video.subtitulo.maxChars,
    maxWidth: px(video.subtitulo.maxWidth),
    color: video.subtitulo.color,
    enfasis: video.subtitulo.colorEnfasis,
    fondo: video.subtitulo.fondo,
    baseline: px(video.subtitulo.baseline) / 100, // "62%" → 0.62
  },

  cartelito: {
    texto: video.cartelito.texto,
    size: px(video.cartelito.size),
    tracking: video.cartelito.tracking,
    durMs: video.cartelito.duracionMs,
  },

  color: {
    bg: dark.bg.base,
    card: dark.bg.card,
    ink: dark.fg.primary,
    muted: dark.fg.muted,
    accent: dark.accent.base,
    deep: raw.color.brand.deepGreen,
    inverse: dark.fg.inverse,
    hair: dark.border.hairStrong,
  },

  font: {
    sans: raw.font.family.sans,
    mono: raw.font.family.mono,
  },

  motion: {
    outQuart: raw.motion.ease.outQuart,
    fast: px(raw.motion.duration.fast),
    base: px(raw.motion.duration.base),
  },

  radius: {
    lg: px(raw.radius.lg),
    pill: px(raw.radius.pill),
    phone: px(raw.radius.phone),
  },

  space: {
    3: px(raw.space["3"]),
    4: px(raw.space["4"]),
    6: px(raw.space["6"]),
    8: px(raw.space["8"]),
  },
} as const;

/** Milisegundos → frames, al fps del lienzo de vídeo. */
export const ms = (v: number) => Math.round((v / 1000) * T.canvas.fps);
