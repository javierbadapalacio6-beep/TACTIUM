// ── Paleta OSCURA (la original de la marca) ─────────────────────────────────
export const darkColors = {
  // ── Background tones ──────────────────────────────────────────────
  background: '#030F0F',
  bgRaised: '#081818',
  bgCard: '#0C2222',
  bgCard2: '#0F2A28',

  // ── Brand ────────────────────────────────────────────────────────
  primary: '#03624C',
  primaryDim: '#02463A',
  accent: '#00DF82',
  accentDim: '#00B86B',

  // ── Text ────────────────────────────────────────────────────────
  // Alphas calibradas contra `background` (#030F0F) para cumplir
  // WCAG AA 4.5:1 en texto body:
  //   - textMuted 0.70 → ~8:1  (AAA)
  //   - textFaint 0.50 → ~4.7:1 (AA, mínimo para body)
  text: '#E8F5EF',
  textMuted: 'rgba(232,245,239,0.70)',
  textFaint: 'rgba(232,245,239,0.50)',
  textInverse: '#001810',

  // ── Strokes ─────────────────────────────────────────────────────
  hair: 'rgba(232,245,239,0.06)',
  hairStrong: 'rgba(232,245,239,0.10)',
  border: 'rgba(232,245,239,0.10)',
  separator: 'rgba(232,245,239,0.06)',

  // ── Surfaces (legacy aliases) ───────────────────────────────────
  surface: '#0C2222',
  surfaceSecondary: '#081818',

  // ── Status ──────────────────────────────────────────────────────
  success: '#00DF82',
  warning: '#F2C94C',
  error: '#FF6B6B',
  info: '#00DF82',
  err: '#FF6B6B',

  // ── Tab bar ─────────────────────────────────────────────────────
  tabBarActive: '#FFFFFF',
  tabBarInactive: 'rgba(255,255,255,0.5)',

  // ── Misc ────────────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.55)',

  // Auxiliary tint helpers
  accent10: 'rgba(0,223,130,0.10)',
  accent15: 'rgba(0,223,130,0.15)',
  accent25: 'rgba(0,223,130,0.25)',
  accent40: 'rgba(0,223,130,0.40)',
  accent50: 'rgba(0,223,130,0.50)',
  black35: 'rgba(0,0,0,0.35)',
} as const;

export type Palette = Record<keyof typeof darkColors, string>;

// ── Paleta CLARA ────────────────────────────────────────────────────────────
// Mismas claves. El acento se oscurece (#00995E) para tener contraste tanto
// como relleno (texto blanco encima) como texto sobre fondo claro. El texto
// es casi negro con tinte verde. Neutros con leve sesgo hacia el verde marca.
export const lightColors: Palette = {
  background: '#F4F7F5',
  bgRaised: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCard2: '#EEF3F0',

  primary: '#03624C',
  primaryDim: '#024A39',
  accent: '#00995E',
  accentDim: '#007D4D',

  text: '#0E1A14',
  textMuted: 'rgba(14,26,20,0.64)',
  textFaint: 'rgba(14,26,20,0.42)',
  textInverse: '#FFFFFF',

  hair: 'rgba(14,26,20,0.08)',
  hairStrong: 'rgba(14,26,20,0.14)',
  border: 'rgba(14,26,20,0.14)',
  separator: 'rgba(14,26,20,0.08)',

  surface: '#FFFFFF',
  surfaceSecondary: '#EEF3F0',

  success: '#00995E',
  warning: '#B7791F',
  error: '#D93B41',
  info: '#00995E',
  err: '#D93B41',

  tabBarActive: '#0E1A14',
  tabBarInactive: 'rgba(14,26,20,0.45)',

  overlay: 'rgba(0,0,0,0.35)',

  accent10: 'rgba(0,153,94,0.10)',
  accent15: 'rgba(0,153,94,0.15)',
  accent25: 'rgba(0,153,94,0.22)',
  accent40: 'rgba(0,153,94,0.38)',
  accent50: 'rgba(0,153,94,0.50)',
  black35: 'rgba(0,0,0,0.30)',
};

// ── Utilidad de alpha ─────────────────────────────────────────────────────────
// Aplica una opacidad (0–1) a un color hex (#RGB / #RRGGBB) o rgb()/rgba().
// Imprescindible porque el patrón `color + 'AA'` (sufijo alfa hex) SÓLO funciona
// con hex de 6 dígitos: los tokens `textMuted`/`textFaint` son `rgba(...)`, así
// que concatenarles el sufijo produce un color inválido que RN descarta.
export const withAlpha = (color: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const s = color.trim();
  const m6 = /^#([0-9a-f]{6})$/i.exec(s);
  if (m6) {
    const int = parseInt(m6[1], 16);
    return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${a})`;
  }
  const m3 = /^#([0-9a-f]{3})$/i.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split('');
    return `rgba(${parseInt(r + r, 16)},${parseInt(g + g, 16)},${parseInt(b + b, 16)},${a})`;
  }
  const mrgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (mrgb) {
    const [r, g, b] = mrgb[1].split(',').map((p) => p.trim());
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
};

// ── Retrocompatibilidad ──────────────────────────────────────────────────────
// Las pantallas AÚN NO migradas al tema dinámico siguen importando `Colors`
// (paleta oscura fija). Se migran por fases a `useColors()`.
export const Colors = darkColors;

export type ColorKey = keyof typeof darkColors;
