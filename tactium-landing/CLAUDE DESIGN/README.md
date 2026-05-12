# TACTIUM Design System

> **Dark, monochromatic, lab-grade.** The visual system behind TACTIUM — a federated-padel team manager (mobile app + pre-launch landing).

TACTIUM helps **federated padel captains** lock in the official lineup of every match day, respecting FEP points order, and **club admins** manage many teams under one roof. The brand voice is that of a precision instrument: serious, fast, data-forward, never noisy.

The two surfaces live in this system:

1. **Mobile app** — React Native (iOS + Android). Captains and players. Dark, dense, fast.
2. **Landing (pre-launch)** — Next.js 15 + Tailwind v4. 3D scrollytelling, dark, monochromatic green.

---

## Sources

- **Brief**: provided in chat (full operational brief for the Landing 3D).
- **App screens**: `uploads/*.jpeg` → copied into `assets/screens/`.
- **Logo**: `uploads/LOGO.png` → `assets/logo.png` (raster, ~1240×1240). _Vector source not provided — flagged below._
- **Codebase**: not provided. Visual rules in this document come from the brief + screens, not source code. **Please link the repo (or Figma) if available** so we can cross-check tokens like exact radii of the iOS PhoneFrame, FAB shadows, and the splash glow.

---

## Index

| File / Folder | What it is |
|---|---|
| `README.md` | This document. Brand context, content, visual & icon foundations. |
| `colors_and_type.css` | All design tokens (CSS vars), reset, semantic element styles, component recipes. |
| `SKILL.md` | Cross-compatible skill manifest — point Claude at this folder. |
| `assets/logo.png` | Master logo (raster). |
| `assets/screens/*.jpeg` | All 18 app screenshots provided. |
| `preview/` | Design-system cards rendered for the Design System tab. |
| `ui_kits/app/` | Mobile-app UI kit (iPhone frame, recreated screens, components). |
| `ui_kits/landing/` | Landing UI kit (Hero, AppPreview, ForClubs, Features, Pricing, FAQ). |

---

## Content fundamentals

**Language**: Spanish (Spain) — `es-ES`. Microcopy is written for a Spanish-speaking captain who lives in the padel scene.

- **Tone**: serious, sporty, precise. Not chatty, not corporate. Like a coach's clipboard.
- **Person**: **tú**, never _usted_. Direct.
- **Voice**: short imperatives. "Crea la alineación", "Empezar", "Confirmar alineación", "Ver alineación".
- **Glossary** (use exactly these terms):
  - `pista` _(not cancha)_, `pareja` _(not dupla)_, `jornada` _(not fecha)_,
  - `capitán` / `capitana`, `federación`, `alineación`, `plantilla`, `temporada`.
- **Casing**:
  - **Eyebrows are ALWAYS uppercase, monospaced**, with 0.25–0.30em tracking, dot separators:
    `JORNADA · J·01 · ALINEACIÓN`, `CLUB · ADMIN`, `BIENVENIDO`, `PRÓXIMA JORNADA`.
  - Headlines use sentence case: `¿Cómo vas a empezar?`, `Aún no hay jornadas`, `vs. Fort Padel`.
  - Buttons are sentence case verbs: `Confirmar alineación`, `Crear temporada`, `Empezar`.
- **Numbers and tabular data are mono**: `4600 PTS`, `1/2`, `100%`, `100/100 EQUI.`, `4,99 €/mes`.
- **Dots as separators** instead of commas/pipes: `Sá · masculino · Grupo A`, `Drive · 2400`, `vs. CD Padel`.
- **Status microcopy is tiny and exact**: `LOCAL`, `VISITANTE`, `VALIDADA`, `PENDIENTE`, `Empate`, `Acta cerrada · empate`, `Sin alineación`, `Sin temporada activa`.
- **Long-form copy is muted**: descriptive paragraphs use `--color-text-muted` (70% opacity), never full white.
- **No emoji** anywhere — _ever_. Iconography is exclusively Lucide.
- **Numbers in copy follow ES conventions**: comma decimal (`4,99 €`), space before currency.

**Sample copy that captures the voice** (lifted from screens):

> _CREATE · ANALYZE · ELEVATE_
> _El laboratorio de alineaciones inteligentes para pádel._
> _14 días de prueba gratis al crear tu primer equipo · Sin compromiso._
> _Las parejas se ordenan por puntos automáticamente._
> _Vista global del club. Las jornadas y los resultados los gestiona el capitán de cada equipo — desde aquí solo administras la estructura._

---

## Visual foundations

### Palette

Monochromatic green on greenish-black. **One accent dominates per viewport.** Tints carry depth (`accent-10` → `accent-55`); we never reach for a second hue. Status colors (`warning`, `error`) appear only where semantically required — a yellow `Empate` chip, a red `D` derrota badge.

- **Base** `#030F0F` (greenish black, never pure `#000`)
- **Card surfaces** `#0C2222` / `#0F2A28` (slightly elevated)
- **Brand accent** `#00DF82` — TACTIUM green. Used for: CTAs, eyebrows, key numbers (4600 PTS), avatar fills, progress bars, focus rings, glows.
- **Institutional fill** `#03624C` — quieter green for surfaces that want a brand tint (avatar tile bg, validated chip).
- **Text** `#E8F5EF` body / 70% muted / 50% faint. Never pure `#FFF`.

Contrast: `#E8F5EF` on `#030F0F` is WCAG AAA. The accent on dark surfaces is AAA for large text.

### Typography

- **Inter** (400–800) — UI, headlines, body. Default to weight 700–800 for headlines (very heavy), 500–600 for chrome, 400 for body.
- **JetBrains Mono** (400–700) — eyebrows, data (PTS, scores, prices), badges, identifiers like `J·01`, `2ª`.
- **Tracking is dramatic on mono**: 0.25em on eyebrows, 0.10–0.16em on inline data.
- **Headlines hug**: `letter-spacing: -0.02em`, `line-height: 1.05`.
- **No serifs anywhere.** No decorative display fonts.

### Backgrounds

- **No imagery, no photography, no stock.** The background is space — pure dark — with subtle atmospheric tint near accent elements only.
- **Aurora blobs** behind hero/CTA blocks: a radial gradient of `--color-accent` at ~10–20% opacity, blurred 80–120px. Stationary except on hero where they drift slowly.
- **Subtle grid** on landing-only sections: `rgba(232,245,239,0.04)` lines, 64px cadence, with a radial mask fading toward the section edges.
- **Vignette** on full-bleed hero: top-of-page radial darker than the base, simulating a stage lit from below.

### Borders & dividers

- **Hairlines** are how surfaces are defined. `inset 0 0 0 1px rgba(255,255,255,0.04)` on every card.
- A **strong hairline** (`rgba(255,255,255,0.10)`) marks interactive borders (input fields, ghost buttons).
- The **accent hairline** (`accent-40`) marks the _active_ or _hovered_ state (selected pareja card, focused input, "Variante 1" pill).
- Yellow / red hairlines only on status surfaces (Empate, error).

### Shadows & elevation

Two main recipes — _never_ hard 1-color drop shadows:

```css
/* Soft float, default card */
0 20px 50px -15px rgba(0,0,0,0.60),
inset 0 0 0 1px rgba(255,255,255,0.04);

/* Strong float, hero phones */
0 50px 100px -20px rgba(0,0,0,0.80),
inset 0 0 0 1px rgba(255,255,255,0.04);

/* CTA glow */
0 8px 24px -6px rgba(0,223,130,0.40);
```

Phones in stack get an additional **accent ambient glow** behind them: `box-shadow: 0 0 80px rgba(0,223,130,0.18)`.

### Corner radii

- `sm 8px` — chips, tiny badges (`TOP`, `V`, `D`).
- `md 12px` — inline pills, segmented controls.
- `lg 16px` — cards, modules (pareja card, jornada card).
- `xl 24px` — outer panels, sheets, large CTAs.
- `pill ∞` — primary CTAs, "Inicio" back buttons, tab bar.
- `phone 42px` — iPhone frame.

### Animation

- **Motion is decorative, never required.** All decorative anim must respect `prefers-reduced-motion: reduce`.
- **Easing**: `cubic-bezier(0.25, 1, 0.5, 1)` (out-quart) for UI; longer scrubbed timelines for landing scrollytelling.
- **Durations**: `140ms` fast (hovers), `220ms` base (cards/menus), `460ms` slow (reveals).
- **Idle float** on mockups in landing hero: `translateY(-10px) rotateY(±6°)` loop 8s.
- **CTA**: subtle upward translate on hover (`-1px`), glow intensifies.
- **Magnetic buttons** + cursor-follow glow on landing only (not in the app).
- **No bounce, no jank, no spring overshoot.** Lab-grade motion = clean and confident.

### Hover / press

- **Hover**: lighten background by ~6% (`--color-bg-card` → `--color-bg-card-2`), promote hairline to `accent-40`, raise card 1–2px, halo strengthens.
- **Press**: collapse to flat — `transform: translateY(0)`, hairline brightens to `accent-55`, no scale-down (no "tap shrink").
- **Disabled**: 40% opacity, no cursor change to `pointer`, glow removed.
- **Focus ring**: 2px solid `--color-accent`, offset 2px from element.

### Transparency & blur

- **Sticky header**: 72% bg-overlay + `backdrop-filter: blur(12px) saturate(180%)`, hairline bottom border.
- **Modal scrims**: solid `rgba(3,15,15,0.72)`, no blur (we keep the canvas crisp).
- **No glassmorphism** elsewhere. Apple-style frosted glass is explicitly banned.

### Layout

- **Container**: `max-w-6xl` (1152px), padded `px-6` (24px) min.
- **Section padding**: `py-20 sm:py-28 lg:py-32`.
- **Grids**: `gap-4` default, `gap-12 lg:gap-16` for hero / split sections.
- **Mobile-first**, breakpoints at `sm: 640px`, `lg: 1024px`.

### Cards

A TACTIUM card is:

- bg `#0C2222`, radius `16px`,
- inset hairline `rgba(255,255,255,0.04)`,
- soft drop `0 20px 50px -15px rgba(0,0,0,0.60)`,
- internal padding `16–24px`,
- vertical rhythm via `12–16px` gap.

The **selected** state turns the inset hairline into an _outset_ accent border at `1.5px` (`box-shadow: inset 0 0 0 1.5px var(--color-accent-55)`), and the top progress bar fills with `--color-accent`.

### Imagery

- **No photography on the marketing site.** Phones are the only imagery — UI screenshots framed in an iPhone bezel with `radius 42px`, Dynamic Island, ambient accent glow behind.
- App screenshots inside the app kit are real renders, never mocked.
- 3D assets (pala, pista, pelota) on the landing only; low-poly, single point + directional light tinted accent.

---

## Iconography

- **Lucide** is the **only** icon set. Stroke 1.5–2px, size 16–24, rounded line caps.
  - In the app screens we can identify: `chevron-left` (Inicio), `pencil` (edit), `trash-2`, `zap` (auto-orden), `more-horizontal`, `square-pen`, `check`, `calendar`, `map-pin`, `users`, `user`, `bar-chart`, `arrow-right`, `arrow-up-right`, `chevron-right`, `bell-off`, `share`, `grid` (Ver alineación).
- **Color rule**: icons are either `--color-accent` (active/CTA) or `--color-text-muted` (chrome). **Never pure white.** Never multi-color.
- **Loaded from CDN** by default: `https://unpkg.com/lucide-static@latest/icons/<name>.svg` or `lucide-react` in JSX. No icon font, no sprite sheet.
- **No emoji.** No unicode glyph icons. Decorative dots/separators are `·` (middle dot) — used liberally.
- **Logo**: provided as raster (`assets/logo.png`). When inline in UI we draw a 28×28 "T-tile" — a `bg-primary` rounded square with an Inter `T` glyph in accent. ⚠️ **Vector source missing** — please send SVG/AI so we can use the real mark at small sizes.

---

## Substitutions / flags

| Item | Status | Action |
|---|---|---|
| Inter, JetBrains Mono | ✅ Loaded from Google Fonts CDN at top of `colors_and_type.css`. | No substitution. |
| Logo (vector) | ⚠️ Only raster provided. | Please send SVG. |
| Codebase / Figma | ❌ Not provided. | Send link if available — we'll cross-check exact radii, animation specs, and any custom icons. |
| 3D models (pala, pelota, pista) | ❌ Not provided. | Not needed for static UI kits; needed for landing R3F scene. |

---

**Last updated**: 2026-05-12 · **Version**: 1.0
