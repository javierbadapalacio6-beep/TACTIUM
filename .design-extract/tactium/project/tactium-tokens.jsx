// TACTIUM design tokens
// Brand palette from the kit:
//  - background ink: #030F0F
//  - primary green:  #03624C
//  - accent neon:    #00DF82
//  - typography:     Satoshi (loaded via Fontshare)

const TACTIUM = {
  bg:         '#030F0F',
  bgRaised:   '#081818',
  bgCard:     '#0C2222',
  bgCard2:    '#0F2A28',
  primary:    '#03624C',
  primaryDim: '#02463A',
  accent:     '#00DF82',
  accentDim:  '#00B86B',
  // text
  text:       '#E8F5EF',
  textMuted:  'rgba(232,245,239,0.55)',
  textFaint:  'rgba(232,245,239,0.32)',
  // signals
  ok:         '#00DF82',
  warn:       '#F2C94C',
  err:        '#FF6B6B',
  // strokes
  hair:       'rgba(232,245,239,0.06)',
  hairStrong: 'rgba(232,245,239,0.10)',
};

// Satoshi font face shorthand
const FONT = '"Satoshi", -apple-system, "SF Pro Display", system-ui, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// Sample roster — generic placeholders, FEP-style points
const ROSTER = [
  { id: 'p1', name: 'Player 01', pts: 482, avail: true,  pos: 'Drive' },
  { id: 'p2', name: 'Player 02', pts: 451, avail: true,  pos: 'Revés' },
  { id: 'p3', name: 'Player 03', pts: 437, avail: true,  pos: 'Drive' },
  { id: 'p4', name: 'Player 04', pts: 412, avail: true,  pos: 'Revés' },
  { id: 'p5', name: 'Player 05', pts: 388, avail: true,  pos: 'Drive' },
  { id: 'p6', name: 'Player 06', pts: 365, avail: true,  pos: 'Revés' },
  { id: 'p7', name: 'Player 07', pts: 341, avail: true,  pos: 'Drive' },
  { id: 'p8', name: 'Player 08', pts: 318, avail: false, pos: 'Revés' },
  { id: 'p9', name: 'Player 09', pts: 294, avail: true,  pos: 'Drive' },
  { id: 'p10', name: 'Player 10', pts: 271, avail: true,  pos: 'Revés' },
  { id: 'p11', name: 'Player 11', pts: 245, avail: false, pos: 'Drive' },
  { id: 'p12', name: 'Player 12', pts: 220, avail: true,  pos: 'Revés' },
];

// ─── Type scale ────────────────────────────────────────────────────────
// Three clear hierarchy levels per screen:
//   display  — the dominant focal element (1× per screen, max 2)
//   title    — section / card titles
//   body     — paragraph + list rows
//   meta     — eyebrows, captions, mono labels
const TYPE = {
  eyebrow:   { fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', fontWeight: 500, fontFamily: MONO, color: TACTIUM.accent },
  meta:      { fontSize: 11, letterSpacing: 1.2, color: TACTIUM.textFaint, fontFamily: MONO },
  caption:   { fontSize: 12, color: TACTIUM.textMuted, lineHeight: 1.45 },
  body:      { fontSize: 14, color: TACTIUM.text, lineHeight: 1.45 },
  bodyMuted: { fontSize: 14, color: TACTIUM.textMuted, lineHeight: 1.45 },
  title:     { fontSize: 17, fontWeight: 500, letterSpacing: -0.2, color: TACTIUM.text, lineHeight: 1.2 },
  h2:        { fontSize: 22, fontWeight: 500, letterSpacing: -0.4, color: TACTIUM.text, lineHeight: 1.15 },
  h1:        { fontSize: 30, fontWeight: 500, letterSpacing: -0.7, color: TACTIUM.text, lineHeight: 1.05 },
  display:   { fontSize: 38, fontWeight: 500, letterSpacing: -1.2, color: TACTIUM.text, lineHeight: 1 },
};

// ─── Radii / Spacing ───────────────────────────────────────────────────
const R = { sm: 10, md: 14, lg: 18, xl: 22, pill: 9999 };
const SP = { xs: 6, sm: 10, md: 16, lg: 22, xl: 32, xxl: 44 };

// ─── Shared button styles ──────────────────────────────────────────────
// Primary CTA — neon fill, dark text, glow. The big focal action.
const btnPrimary = {
  width: '100%', height: 56, borderRadius: R.lg, border: 'none', cursor: 'pointer',
  background: TACTIUM.accent, color: '#001810',
  fontFamily: FONT, fontWeight: 600, fontSize: 16, letterSpacing: -0.1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  boxShadow: `0 14px 32px ${TACTIUM.accent}33, 0 0 0 1px ${TACTIUM.accent}40 inset, 0 1px 0 rgba(255,255,255,0.18) inset`,
  transition: 'transform 120ms ease, box-shadow 200ms ease',
};
// Secondary — outline accent
const btnSecondary = {
  width: '100%', height: 50, borderRadius: R.md, cursor: 'pointer',
  background: `${TACTIUM.accent}10`,
  border: `1px solid ${TACTIUM.accent}40`,
  color: TACTIUM.accent,
  fontFamily: FONT, fontWeight: 500, fontSize: 14, letterSpacing: -0.1,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
// Ghost — neutral chrome, the third tier
const btnGhost = {
  width: '100%', height: 48, borderRadius: R.md, cursor: 'pointer',
  background: 'transparent',
  border: `1px solid ${TACTIUM.hairStrong}`,
  color: TACTIUM.textMuted,
  fontFamily: FONT, fontWeight: 500, fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

// ─── Card surface ──────────────────────────────────────────────────────
const cardStyle = {
  background: TACTIUM.bgCard,
  border: `1px solid ${TACTIUM.hair}`,
  borderRadius: R.lg,
  padding: SP.md,
};
const cardRaised = {
  background: TACTIUM.bgCard,
  border: `1px solid ${TACTIUM.hairStrong}`,
  borderRadius: R.lg,
  padding: SP.lg,
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)',
};

Object.assign(window, {
  TACTIUM, FONT, MONO, ROSTER,
  TYPE, R, SP,
  btnPrimary, btnSecondary, btnGhost,
  cardStyle, cardRaised,
});
