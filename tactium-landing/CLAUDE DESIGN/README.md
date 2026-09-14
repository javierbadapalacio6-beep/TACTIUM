# TACTIUM Design System

> **Monochromatic, lab-grade, dark-first — with a real light mode.** The visual system behind TACTIUM — a federated-padel team manager (mobile app + landing + web app).

TACTIUM helps **federated padel captains** lock in the official lineup of every match day, respecting FEP points order, and **club admins** manage many teams under one roof. The brand voice is that of a precision instrument: serious, fast, data-forward, never noisy.

The two surfaces live in this system:

1. **Mobile app** — React Native (iOS + Android). Captains, club admins and players. Dense, fast, dual-theme (Ajustes → APARIENCIA → Claro / Oscuro / Sistema).
2. **Landing** — Next.js + Tailwind v4. 3D scrollytelling, dark only — a marketing surface commits to one look on purpose.
3. **Web app** — the product in the browser. Same tokens, same dual theme as the mobile app, plus wide tool canvases (lineup drag & drop, tournament schedule grid, KO bracket) that don't fit on a phone.

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

Monochromatic green. **One accent dominates per viewport.** Tints carry depth (`accent-10` → `accent-55`); we never reach for a second hue. Status colors (`warning`, `error`) appear only where semantically required — a yellow `Empate` chip, a red `D` derrota badge.

The product ships **two themes** with identical token keys. Component code never branches on theme; it reads `var(--color-*)` and the theme decides.

#### Dark — the signature, and the default

- **Base** `#030F0F` (greenish black, never pure `#000`)
- **Card surfaces** `#0C2222` / `#0F2A28` (slightly elevated)
- **Brand accent** `#00DF82` — TACTIUM green. Used for: CTAs, eyebrows, key numbers (4600 PTS), avatar fills, progress bars, focus rings, glows.
- **Institutional fill** `#03624C` — quieter green for surfaces that want a brand tint (avatar tile bg, validated chip).
- **Text** `#E8F5EF` body / 70% muted / 50% faint. Never pure `#FFF`.
- **Status** `#F2C94C` warning · `#FF6B6B` error.

Contrast: `#E8F5EF` on `#030F0F` is WCAG AAA. The accent on dark surfaces is AAA for large text.

#### Light — a peer, not an afterthought

- **Base** `#F4F7F5` · **card surfaces** `#FFFFFF` / `#EEF3F0`
- **Brand accent** `#00995E` — **not** `#00DF82`
- **Institutional fill** `#03624C` (unchanged — it works in both)
- **Text** `#0E1A14` body / 64% muted / 42% faint. Never pure `#000`.
- **Status** `#B7791F` warning · `#D93B41` error

Neutrals carry a slight green bias so the light theme still reads as TACTIUM and not as a generic white dashboard.

#### The three rules that get broken constantly

1. **The accent changes.** `#00DF82` scores 1.6:1 on white — it fails as text, as a border and as a focus ring. `#00995E` clears 4.6:1 on `#F4F7F5` and still works as a fill with white text on top. Muted text at 64% and faint at 42% are calibrated the same way; don't lower them further.
2. **Glows disappear in light.** In dark, the green halo is the visual signature. In light it reads as dirt. `--glow-accent-*` resolve to `none` and depth comes from soft neutral shadows plus hairlines. A light mode with green halos is wrong, no exceptions.
3. **Shadows lighten and shorten.** The dark recipes (black at 60–80%) smear grey across a light background. Light tints the shadow with the text color at low opacity and short blur. Already wired into `--shadow-card-*`.

Two things stay dark in **every** theme, on purpose: the **splash screen** and the **share cards** (lineup card, result card, stats card). They're brand assets that travel outside the product, not UI.

### Typography

- **Satoshi** (400 / 500 / 700 / 900) — UI, headlines, body. Default to 700–900 for headlines (very heavy), 500–600 for chrome, 400 for body. This is the official TACTIUM sans, as declared in `TACTIUM/src/core/theme/fonts.ts`; it loads from Fontshare in `colors_and_type.css`. Inter survives only as a fallback in the stack — never specify it deliberately.
- **JetBrains Mono** (400–700) — eyebrows, data (PTS, scores, prices), badges, identifiers like `J·01`, `2ª`. Always `tabular-nums`.
- **Tracking is dramatic on mono**: 0.25em on eyebrows, 0.10–0.16em on inline data.
- **Headlines hug**: `letter-spacing: -0.02em`, `line-height: 1.05`.
- **No serifs anywhere.** No decorative display fonts.

Satoshi replaced Inter as the primary typeface on 2026-08-10. `../BRAND_SYSTEM.md` and `../DESIGN_SYSTEM.md` were updated in the same pass, so all four documents agree — if you find a spec naming Inter as primary, it predates that date and is stale.

⚠️ **Satoshi has no 600 or 800.** Its weights are 300 / 400 / 500 / 700 / 900. Migrating from the old Inter scale: `800 → 900 (Black)`, `600 → 500 (Medium)`. Asking for a weight that doesn't exist makes the browser synthesise it and the headline comes out muddy.

### Backgrounds

- **No imagery, no photography, no stock.** The background is space — with subtle atmospheric tint near accent elements only.
- **Aurora blobs** behind hero/CTA blocks: a radial gradient of `--color-accent` at ~10–20% opacity, blurred 80–120px. Stationary except on hero where they drift slowly. **In light mode drop them to a quarter intensity or remove them entirely** — the light canvas is flat, and a green wash on near-white looks like a rendering bug.
- **Ambient backdrop** (the app's `AmbientBackdrop`): two radial gradients over the base — `--color-primary` at 55% centered at `50% 22%` (radius 60%), and `--color-accent` at 18% at `22% 86%` (radius 55%), both fading to transparent. Same treatment in light: quarter intensity or nothing.
- **Subtle grid** on landing-only sections: `rgba(232,245,239,0.04)` lines, 64px cadence, with a radial mask fading toward the section edges. In light, invert to `rgba(14,26,20,0.05)`.
- **Vignette** on full-bleed hero: top-of-page radial darker than the base, simulating a stage lit from below. Dark only — don't try to translate it.

### Borders & dividers

- **Hairlines** are how surfaces are defined. Use the tokens (`--color-hair` / `--color-hair-strong`), not raw rgba — they flip from light-on-dark to dark-on-light with the theme. Dark resolves to `rgba(232,245,239,0.06)`, light to `rgba(14,26,20,0.08)`.
- A **strong hairline** (`--color-hair-strong`) marks interactive borders (input fields, ghost buttons). Hairlines carry *more* of the load in light mode, where there are no glows to separate surfaces.
- The **accent hairline** (`accent-40`) marks the _active_ or _hovered_ state (selected pareja card, focused input, "Variante 1" pill).
- Yellow / red hairlines only on status surfaces (Empate, error).

### Shadows & elevation

Two main recipes — _never_ hard 1-color drop shadows. Both are tokenised (`--shadow-card-soft`, `--shadow-card-strong`), so use the token and the theme picks the right one.

**Dark:**

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

**Light** — tinted with the text color, low opacity, short blur. Black-based shadows smear grey on a near-white canvas:

```css
/* Soft float, default card */
0 10px 30px -12px rgba(14,26,20,0.14),
inset 0 0 0 1px rgba(14,26,20,0.05);

/* Strong float */
0 24px 56px -18px rgba(14,26,20,0.20),
inset 0 0 0 1px rgba(14,26,20,0.06);

/* CTA lift — tighter, and built on #00995E */
0 6px 18px -6px rgba(0,153,94,0.35);
```

Phones in stack get an additional **accent ambient glow** behind them in dark: `box-shadow: 0 0 80px rgba(0,223,130,0.18)`. **In light there is no glow at all** — `--glow-accent-soft` and `--glow-accent-hard` resolve to `none`. Separation comes from the shadow and the hairline.

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

- **Hover**: shift background one step (`--color-bg-card` → `--color-bg-card-2`), promote hairline to `accent-40`, raise card 1–2px, halo strengthens. Note the direction flips by theme: in dark the surface gets *lighter*, in light it gets *darker* (`#FFFFFF` → `#EEF3F0`). The tokens already encode this — just swap the token, don't hand-roll a `lighten()`.
- **Press**: collapse to flat — `transform: translateY(0)`, hairline brightens to `accent-55`, no scale-down (no "tap shrink").
- **Disabled**: 40% opacity, no cursor change to `pointer`, glow removed.
- **Focus ring**: 2px solid `--color-accent`, offset 2px from element. Mandatory and visible in both themes — much of the web app is driven from the keyboard.

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
- **Logo**: provided as raster (`assets/logo.png`). When inline in UI we draw a 28×28 "T-tile" — a `bg-primary` rounded square with a Satoshi `T` glyph in accent. The `bg-primary` fill (`#03624C`) is identical in both themes, so the tile needs no light variant. ⚠️ **Vector source missing** — please send SVG/AI so we can use the real mark at small sizes.

---

## Substitutions / flags

| Item | Status | Action |
|---|---|---|
| Satoshi | ✅ Loaded from Fontshare CDN at top of `colors_and_type.css`. | No substitution. Inter stays in the stack as fallback only. |
| JetBrains Mono | ✅ Loaded from Google Fonts CDN at top of `colors_and_type.css`. | No substitution. |
| Light-mode palette | ✅ Taken verbatim from `TACTIUM/src/core/theme/colors.ts` (`lightColors`). | Keep in sync with that file — it is the source of truth, not this doc. |
| App screenshots | ⚠️ All 18 captures in `assets/screens/` are **dark mode**, taken before light mode shipped. | Use for layout and copy reference only. Don't infer light-mode appearance from them; re-capture when convenient. |
| Logo (vector) | ⚠️ Only raster provided. | Please send SVG. |
| Codebase / Figma | ✅ Codebase available at `TACTIUM/` in this repo. | Cross-check tokens against `src/core/theme/` (`colors.ts`, `typography.ts`, `spacing.ts`, `fonts.ts`) rather than trusting this doc when they disagree. |
| 3D models (pala, pelota, pista) | ❌ Not provided. | Not needed for static UI kits; needed for landing R3F scene. |

---

**Last updated**: 2026-08-10 · **Version**: 2.0 — dual theme (light mode added) + Satoshi replaces Inter as the primary sans.
