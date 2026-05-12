export const Colors = {
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

export type ColorKey = keyof typeof Colors;
