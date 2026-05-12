# TACTIUM — Design System para Generación con IA

> **Documento maestro para pasar a Claude Design / banana / DALL-E / Midjourney.**
> Self-contained. No requiere consultar otros docs.
> Última actualización: 2026-05-12.

---

## 0 · CÓMO USAR ESTE DOCUMENTO

Cuando trabajes con cualquier AI de imagen (Claude Design, DALL-E vía ChatGPT, Midjourney, banana, Higgsfield), **pégale las secciones relevantes al inicio de la conversación** como "system context":

1. Pega siempre **§1 + §2 + §3** (contexto, paleta, tipografía).
2. Añade **§5** si vas a generar un carrusel.
3. Añade **§6** si vas a generar un post cuadrado.
4. Añade **§7** si vas a generar un reel/TikTok cover.
5. Al final, usa los **prompts plantilla de §10** y rellena los huecos `[…]`.

**Instrucción de apertura recomendada para ChatGPT/DALL-E:**

```
Voy a generar varios assets visuales para TACTIUM, una marca tech.
Te paso un design system completo. Sigue las reglas estrictamente,
no inventes elementos, no añadas decoración fuera de lo descrito.
Cuando te pida una imagen, usa exactamente el prompt que te dé
sin reescribirlo.
```

---

## 1 · CONTEXTO DE MARCA

### Qué es TACTIUM

Una **app móvil (iOS + Android) de gestión de equipos de pádel federado** en España. Resuelve un problema concreto: armar la alineación oficial de cada jornada respetando el orden por puntos FEP y comunicarla al equipo. Multi-equipo bajo un mismo club, con roles separados (admin del club / capitán de cada equipo).

**Audiencias:**
- **Capitán federado** — gestiona 1 equipo, 8-30 jugadores. Necesita rapidez y certeza.
- **Admin de club** — gestiona 3-25 equipos. Necesita vista global y delegar capitanes.

### Posicionamiento de marca

> **TACTIUM debe sentirse como una herramienta de precisión — no como un SaaS genérico.**

Sus referencias son: Linear, Vercel, Raycast, Notion, Stripe Dashboard, Framer.
**No es** ni Strava ni una app de gaming. Es **mission control para deporte serio**.

### Arquetipo de marca

**The Strategist.** Las palabras clave que SIEMPRE deben sentirse:

> Precise · Tactical · Modern · Competitive · Minimal · High-performance · Intelligent · Structured · Premium-tech

**Prohibido:** corporativo aburrido · gamer · casual · jerga marketera · hype exagerado.

### Voz y tono

✅ Confiado, directo, moderno, conciso, performance-oriented
❌ Slang juvenil, exclamaciones múltiples, emojis, jerga corporativa

| Sí | No |
|---|---|
| "Lineups listos en 30 segundos." | "¡¡¡Lineups en RÉCORD de tiempo!!! 🚀🔥" |
| "Tu capitán pone la alineación. TACTIUM ordena por puntos." | "Olvídate del rollo de alineaciones, te hacemos la vida easy 😎" |

### Idioma

Español de España (`es-ES`). Persona: **tú**, nunca usted.

Glosario obligatorio:
- `pista` (no cancha)
- `pareja` (no dupla)
- `jornada` (no fecha de partido)
- `capitán` / `capitana`
- `federación`
- `alineación`
- `plantilla`
- `temporada`
- `puntos FEP` (no "ranking" a secas)

---

## 2 · SISTEMA DE COLOR

### Paleta principal

Monocromática verde sobre verdoso-negro. **Un solo accent dominante por viewport.** Nunca dos hues compitiendo.

| Token | Hex | RGB | Uso |
|---|---|---|---|
| **TACTIUM Black** | `#030F0F` | 3 15 15 | Fondos · app · web · todo dark |
| **TACTIUM Green** | `#00DF82` | 0 223 130 | CTAs · highlights · números clave · logo accent |
| **TACTIUM Deep Green** | `#03624C` | 3 98 76 | Surfaces secundarias · dividers |
| **TACTIUM Soft White** | `#E8F5EF` | 232 245 239 | Tipografía · iconos · labels |
| **Inverse text** | `#001810` | 0 24 16 | Texto sobre botón verde |

### Escala neutral (UI completa)

| Token | Hex |
|---|---|
| Neutral 100 | `#E8F5EF` |
| Neutral 80 | `#A9BBB4` |
| Neutral 60 | `#6E827B` |
| Neutral 40 | `#35504A` |
| Neutral 20 | `#102322` |
| Neutral 0 | `#030F0F` |

### Tintes accent (overlays)

| Token | Color | Uso |
|---|---|---|
| `--accent-10` | `rgba(0,223,130,0.10)` | Fondos suaves accent |
| `--accent-25` | `rgba(0,223,130,0.25)` | Borders sutiles |
| `--accent-40` | `rgba(0,223,130,0.40)` | Hover, focus |
| `--accent-55` | `rgba(0,223,130,0.55)` | Active, selected |

### Reglas de uso del color

1. **Nunca pure black (`#000`)** — usa siempre `#030F0F`
2. **Nunca pure white (`#FFF`)** — usa siempre `#E8F5EF`
3. **Solo UN elemento accent verde dominante** por composición (botón CTA, número grande, badge)
4. **Cero gradientes arcoíris.** Si gradiente, sólo `accent → deep-green` muy sutil
5. **Status colors** (`warning`, `error`) sólo donde semánticamente sea obligatorio

---

## 3 · TIPOGRAFÍA

### Familias

| Fuente | Pesos | Uso |
|---|---|---|
| **Inter** | 400, 500, 600, 700, 800 | UI, body, headlines |
| **JetBrains Mono** | 400, 500, 600, 700 | Eyebrows, datos tabulares, números, identifiers |

### Escala

| Elemento | Tamaño | Peso | Tracking |
|---|---|---|---|
| Hero headline | 40-64px (responsivo) | 800 | -0.04em |
| H2 sección | 30-48px | 800 | -0.03em |
| H3 card | 18-20px | 700 | -0.02em |
| Body lg | 18-20px | 400 | 0 |
| Body | 14-16px | 400 | 0 |
| Eyebrow mono | 11px | 500 | +0.25em |
| Data mono | 10-12px | 500 | +0.10–0.16em |

### Reglas tipográficas

- **Eyebrows SIEMPRE en MAYÚSCULAS** con tracking `0.25–0.30em`, separadores con `·`
- **Headlines hug**: `line-height 1.05`, `letter-spacing -0.02em a -0.04em`
- **Mono para todo número** (precios, scores, métricas, IDs)
- **Decimales con coma**: `4,99 €` (no `4.99`)
- **Espacio antes de moneda**: `4,99 €` (no `4,99€`)

---

## 4 · LAYOUT, GRID Y GRÁFICA

### Espaciado base

Sistema de 8px. Valores comunes: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.

### Radii

| Token | Valor | Uso |
|---|---|---|
| sm | 8px | Chips, tiny badges |
| md | 12px | Pills, segmentos |
| lg | 16px | Cards, módulos |
| xl | 24px | Sheets, paneles |
| pill | ∞ | CTAs principales |
| squircle | 22% | Icon container (iOS-like) |

### Strokes y bordes

- **Hairline base**: `1px rgba(255,255,255,0.04)` — inset en cards
- **Hairline strong**: `1px rgba(255,255,255,0.10)` — bordes interactivos (inputs, ghost btns)
- **Hairline accent**: `1px rgba(0,223,130,0.40)` — estado activo/hover
- **Stroke en SVG**: 2-2.5px con `stroke-linecap: round`

### Tactical Grid (elemento de marca)

Patrón de fondo signature:

```css
background-image:
  linear-gradient(rgba(232,245,239,0.04) 1px, transparent 1px),
  linear-gradient(90deg, rgba(232,245,239,0.04) 1px, transparent 1px);
background-size: 56-72px;
mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
```

Se usa en: fondos de slides, hero web, login screens, marketing.

### Sombras

```css
/* Card flotante */
0 50px 100px -20px rgba(0,0,0,0.80),
inset 0 0 0 1px rgba(255,255,255,0.04);

/* Card sutil */
0 20px 50px -15px rgba(0,0,0,0.60),
inset 0 0 0 1px rgba(255,255,255,0.04);

/* CTA verde */
0 8px 24px -6px rgba(0,223,130,0.40);
```

Nunca hard 1-color drop shadows. Nunca neon glow excesivo.

### Aurora blobs (web/marketing)

Radial gradient `--accent 10-20%` con `blur(80-120px)`. Sólo en hero. **No usar en posts sociales.**

---

## 5 · LOGO SYSTEM

### Isotipo TACTIUM (SVG canónico)

T monogram con **velocity cuts** — barra horizontal arriba, cuerpo en wings curvadas a cada lado, detalles internos (mini-líneas + triangulitos).

```svg
<svg viewBox="0 0 1024 1024" fill="none">
  <rect x="280" y="220" width="464" height="20" rx="4" fill="#00DF82"/>
  <path d="M290 340H520C540 340 560 360 560 380V700L520 675V405C520 395 512 388 502 388H310L290 340Z" fill="#00DF82"/>
  <path d="M734 340H504C484 340 464 360 464 380V700L504 675V405C504 395 512 388 522 388H714L734 340Z" fill="#00DF82"/>
  <rect x="360" y="470" width="120" height="18" rx="4" fill="#00DF82"/>
  <path d="M390 585H450L435 620H405L390 585Z" fill="#00DF82"/>
  <rect x="544" y="470" width="120" height="18" rx="4" fill="#00DF82"/>
  <path d="M574 585H634L619 620H589L574 585Z" fill="#00DF82"/>
</svg>
```

### Reglas de uso del logo

| | |
|---|---|
| Color | `#00DF82` por defecto, recolorable si fondo no es `#030F0F` |
| Tamaño mínimo | 24px en pantalla |
| Safe area | 18% padding alrededor |
| Fondo permitido | `#030F0F`, `#0C2222`, `#0F2A28` (solo dark) |
| Fondo prohibido | Cualquier color claro, fotografías, texturas ruidosas |
| Distorsión | Nunca rotar > ±5°, nunca escalar no-uniformemente, nunca añadir glow/shadow |

### Wordmark TACTIUM

- **Caso**: UPPERCASE
- **Tipo**: Inter ExtraBold (800)
- **Tracking**: -0.04em (tight)
- **Color**: `#E8F5EF` sobre dark
- **Signature detail**: el punto de la **i** (si tuviera) se reemplaza por un **cuadrado verde `#00DF82`**. Este es el único accent dentro del wordmark.

### Lockup (isotipo + wordmark)

- **Horizontal**: isotipo a la izquierda, gap 12-16px, wordmark a la derecha
- **Stacked**: isotipo arriba, wordmark debajo, gap 8-12px
- **Solo isotipo**: para avatares, favicons, app icons
- **Solo wordmark**: para footer, signatures email

---

## 6 · SISTEMA DE SLIDES (CARRUSELES)

### Formato canónico

**1080×1350px** (vertical 4:5) para Instagram. Reutilizable como TikTok carousel slides.

### Anatomía de un slide

```
┌────────────────────────────────────┐  ← Padding 100px top, 80px sides
│                                    │
│  EYEBROW MONO · 28PX (accent)      │
│                                    │
│                                    │
│  CONTENIDO PRINCIPAL               │
│  (varía por tipo de slide)         │
│                                    │
│                                    │
│  ────────────────────────────────  │  ← Footer area
│  ●●○○○             [T] TACTIUM     │  ← Pagination dots + lockup
│                                    │
└────────────────────────────────────┘
```

**Reglas:**
- Padding: `100px top, 80px sides, 80px bottom`
- Eyebrow siempre en MAYÚSCULAS mono, color `#00DF82`, tracking `0.28em`, tamaño 26-30px
- Pagination dots: 10px de diámetro, accent verde el activo (32×10px tipo pill), neutral 20% los demás
- Lockup TACTIUM en footer derecho: isotipo 36-40px + wordmark 20px mono tracking `0.32em` color `rgba(232,245,239,0.5)`
- Fondo: `#030F0F` + tactical grid + opcional aurora blob radial sutil
- **NUNCA** añadir fotos stock, gradientes arcoíris, emojis, decoración fuera de la grid

### 5 tipos de slide

#### 5.1 · Cover (slide 1)

Sirve como "portada" del carrusel. Atrae al swipe.

**Elementos:**
- Eyebrow en top
- Isotipo TACTIUM 140-160px
- Headline grande (76-92px, weight 800, tracking -0.04em, hugged 1.04 line-height)

**Ejemplo:**
```
EYEBROW:  "PRE-LANZAMIENTO · 2026"
TÍTULO:   "El sistema operativo del pádel federado"
```

#### 5.2 · Content (slide 2-N)

Slides intermedios con un mensaje por slide.

**Elementos:**
- Eyebrow numerado: "FEATURE · 01", "PASO · 02", etc.
- Título 60-80px weight 800 tracking -0.03em
- Body 32-40px weight 400 color text-muted

**Ejemplo:**
```
EYEBROW:  "FEATURE · 01"
TÍTULO:   "Alineaciones por puntos FEP"
BODY:     "30 segundos. Sin Excel. Sin discusiones de orden."
```

#### 5.3 · Stat

Para datos golpe — comparativas, métricas, números impactantes.

**Elementos:**
- Eyebrow contextual: "ANTES", "AHORA", "DATO", "EN 2026"
- Stat enorme 180-240px mono weight 800 color accent verde
- Stat label 32-40px weight 500 color text-muted

**Ejemplo:**
```
EYEBROW: "ANTES"
STAT:    "20 MIN"
LABEL:   "armar alineación en Excel"
```

#### 5.4 · Quote

Para testimonios, citas de jugadores reales, frases destacadas.

**Elementos:**
- Eyebrow: "TESTIMONIO", "VOZ DE CAPITÁN", etc.
- Quote 48-60px weight 700 line-height 1.2 con comillas inglesas `" "`
- Atribución 22-26px mono UPPERCASE tracking 0.2em color text-faint

**Ejemplo:**
```
QUOTE: "Hacíamos la alineación en el coche camino del partido."
ATTR:  "JAVI · CAPITÁN CD PADEL"
```

#### 5.5 · CTA (slide final)

Slide de cierre con call-to-action explícito.

**Elementos:**
- Eyebrow: "ÚNETE A LA BETA", "REGÍSTRATE", etc.
- Title grande 72-88px
- Botón pill verde con texto inverse `#001810`
- URL mono uppercase debajo (`TACTIUM.APP`)

**Ejemplo:**
```
EYEBROW: "ÚNETE A LA BETA"
TÍTULO:  "Pre-lanzamiento abierto"
BOTÓN:   "Link en bio"
URL:     "TACTIUM.APP"
```

### Patrón canónico de carrusel

| Posición | Tipo | Contenido |
|---|---|---|
| 1 | Cover | Eyebrow + Headline + Logo |
| 2-N | Content / Stat / Quote | El mensaje (1 idea por slide) |
| Último | CTA | Acción concreta + URL |

**Reglas estructurales:**
- Mínimo 3 slides, máximo 10 (sweet spot: 5-7)
- 1 idea por slide. Si hay 2, divide el slide
- El último siempre cierra con CTA
- Cohesión visual entre slides (mismo fondo, mismo grid, misma pagination)

---

## 7 · POSTS CUADRADOS (1080×1080)

### Para qué usar

- Anuncios rápidos (lanzamiento de feature, evento)
- Stats individuales sin carrusel
- Quotes destacados
- Calendario único de jornada

### Anatomía

Misma estructura que slide pero **cuadrado**:
- Padding 80px todos los lados
- Mismo footer (pagination opcional si es post único)
- Headline más compacto (max 60px)

---

## 8 · STORIES Y REELS (1080×1920)

### Story estática

**Estructura:**
- Padding top **150px** (deja espacio para username del feed cuando se reshareea)
- Padding bottom **250px** (deja espacio para sticker de link)
- Contenido centrado vertical en la zona safe
- Mismo lockup en bottom-center (no derecha)

### Reel/TikTok cover

Cover del vídeo (no el vídeo, solo la thumbnail):
- 1080×1920
- Texto del título grande (72-88px) en los primeros 2/3 del frame
- Logo en bottom 1/3
- Color saturado (accent verde) para maximizar tap-through

---

## 9 · MOTION SYSTEM (para vídeos / reels)

### Personalidad de motion

Smooth · precise · fast · subtle. **Nunca bouncy, nunca elastic.**

### Timings

| Tipo | Duración | Easing |
|---|---|---|
| Hover / micro-interacción | 140-200ms | `cubic-bezier(0.25, 1, 0.5, 1)` (out-quart) |
| Reveal / entry | 220-460ms | `out(3)` o `out(4)` |
| Scrolltelling / scrubbed | 1-3s según viewport | Linear o `in-out` |

### Patterns

- **Cascade stagger** (entrada de elementos): 50-80ms entre elementos, easing `out(3)`
- **Idle float**: `translateY(-10px) rotateY(±6°)` loop 8s para mockups
- **Magnetic buttons** (web only): el botón se acerca 4-8px hacia el cursor
- **Aurora cursor follow** (hero web): radial gradient sigue el cursor con lerp 0.08

### Prohibido

- Bounce/spring overshoot
- Elastic
- Flashing
- Tipografía que zoom-in con scale > 1.2 (jarra el ojo)

---

## 10 · PROMPTS PLANTILLA PARA AI DE IMAGEN

### Prompt maestro (pégalo SIEMPRE al inicio)

```
You are generating a visual asset for TACTIUM, a Spanish padel
team management app brand. Strict rules:

PALETTE — monochromatic green on greenish-black, no other hues:
- Background: #030F0F (deep greenish-black, NEVER pure black)
- Primary accent: #00DF82 (vibrant neon green)
- Secondary green: #03624C
- Off-white: #E8F5EF (NEVER pure white)
- Inverse text on green: #001810

TYPOGRAPHY:
- Inter ExtraBold (800) for headlines, letterspacing -0.04em
- JetBrains Mono for eyebrows and data, letterspacing 0.25em uppercase

STYLE:
- Flat 2D vector construction
- Lab-grade minimalism (think Linear, Vercel, Raycast)
- Subtle dot grid pattern on background at 4% opacity
- Stroke 2-2.5px with rounded caps where applicable

FORBIDDEN:
- Emoji, photographic elements, stock images
- 3D bevel, drop shadows, neon glow halos
- Rainbow gradients, glassmorphism
- Light mode, pure black, pure white
- Decorative flourishes, mascot-style branding

LANGUAGE — text in Spanish (Spain), use "tú" not "usted".
Glossary: pista (not cancha), pareja (not dupla), jornada,
capitán/a, federación, alineación, plantilla, puntos FEP.
```

### Prompt · Slide Cover

```
[Pegar prompt maestro arriba]

Generate a 1080×1350px vertical Instagram carousel COVER slide.

Layout (top to bottom):
1. TOP-LEFT eyebrow text in JetBrains Mono uppercase, color #00DF82,
   letterspacing 0.28em, size 26px: "[EYEBROW]"
2. Below eyebrow, the TACTIUM logo (T monogram with velocity cuts)
   at 140px in #00DF82
3. Headline below logo, Inter ExtraBold 84px, letterspacing -0.04em,
   line-height 1.04, color #E8F5EF: "[HEADLINE]"
4. Footer at bottom with pagination dots (5 dots, first one active
   #00DF82 pill 32×10px, rest 10×10px circles at 20% opacity off-white)
5. Footer bottom-right: small TACTIUM logo (36px) + wordmark
   "TACTIUM" mono 20px letterspacing 0.32em color rgba(232,245,239,0.5)

Background: #030F0F with subtle dot grid pattern (1px dots at
rgba(232,245,239,0.04) spacing 72px) plus a soft radial aurora
gradient #00DF82 at 15% opacity in top-right corner blurred 120px.
```

### Prompt · Slide Content

```
[Pegar prompt maestro]

Generate a 1080×1350px vertical Instagram CONTENT slide.

Layout:
1. TOP eyebrow JetBrains Mono uppercase 26px #00DF82: "[EYEBROW
   like 'FEATURE · 01' or 'PASO · 02']"
2. CENTER-LEFT title Inter ExtraBold 72px tracking -0.03em
   color #E8F5EF line-height 1.05: "[TITLE]"
3. Below title, body text Inter Regular 36px color rgba(232,245,239,0.70)
   line-height 1.4: "[BODY]"
4. Footer same as cover slide.

Background same as cover slide.
```

### Prompt · Slide Stat

```
[Pegar prompt maestro]

Generate a 1080×1350px vertical Instagram STAT slide.

Layout:
1. TOP eyebrow JetBrains Mono uppercase 26px #00DF82: "[EYEBROW
   like 'ANTES', 'AHORA', 'DATO']"
2. CENTER stat number HUGE — JetBrains Mono ExtraBold 220px
   color #00DF82 line-height 1: "[STAT like '20 MIN' or '30 SEG']"
3. Below stat, label Inter Medium 36px color rgba(232,245,239,0.70):
   "[LABEL like 'armar alineación en Excel']"
4. Footer same as cover slide.

Background same as cover slide.
```

### Prompt · Slide CTA

```
[Pegar prompt maestro]

Generate a 1080×1350px vertical Instagram CTA slide (last in carousel).

Layout:
1. TOP eyebrow JetBrains Mono 26px #00DF82: "[EYEBROW like
   'ÚNETE A LA BETA']"
2. CENTER title Inter ExtraBold 84px tracking -0.04em #E8F5EF:
   "[TITLE]"
3. Below title, a pill-shaped button:
   - Background #00DF82, padding 22px×44px, border-radius 999px
   - Text Inter Bold 34px color #001810: "[CTA TEXT like 'Link en bio']"
4. Below button, URL JetBrains Mono 28px uppercase tracking 0.15em
   color rgba(232,245,239,0.50): "[URL like 'TACTIUM.APP']"
5. Footer with pagination dots (last one active) + logo lockup.

Background same as cover slide.
```

### Prompt · Story 1080×1920

```
[Pegar prompt maestro]

Generate a 1080×1920px vertical Instagram Story.

Safe zones:
- Top 150px reserved (no text/icons here — gets covered by username
  when reshared)
- Bottom 250px reserved (gets covered by link sticker)

Layout in safe zone (between y=150 and y=1670):
1. TACTIUM logo at top-center, 80px
2. Eyebrow below logo, JetBrains Mono 28px #00DF82 uppercase:
   "[EYEBROW]"
3. CENTER headline Inter ExtraBold 88px tracking -0.04em #E8F5EF:
   "[HEADLINE]"
4. Optional body text Inter Regular 36px text-muted: "[BODY]"
5. Bottom-center wordmark TACTIUM mono 22px tracking 0.32em
   color rgba(232,245,239,0.5)

Background same as carousel slides.
```

### Prompt · TikTok / Reel cover

```
[Pegar prompt maestro]

Generate a 1080×1920px TikTok/Instagram Reel COVER image (thumbnail
that shows in feed before video plays).

Goal: maximize tap-through. The headline must be readable in a
small grid preview (Instagram displays Reels at 270×480 in feed).

Layout:
1. Top 2/3 of frame: HEADLINE Inter ExtraBold 96px tracking -0.04em
   color #E8F5EF, line-height 1.02, centered or left-aligned:
   "[HEADLINE — max 6 words for legibility]"
2. Bottom 1/3 of frame:
   - TACTIUM logo 100px centered horizontally
   - Wordmark TACTIUM below it, mono 28px tracking 0.32em
     color #00DF82

Background: #030F0F with the dot grid pattern more PROMINENT than
in carousel slides (8% opacity vs 4%) — Reels covers need more
contrast to stand out in feed.
```

---

## 11 · EJEMPLOS DE COPY POR TIPO DE POST

### Educational (4-1-1: el 50%)

- "El problema del capitán federado"
- "Cómo TACTIUM ordena tu alineación"
- "5 alineaciones, 1 oficial"
- "Para capitanes de 1 equipo"
- "Para clubs con varios equipos"
- "Todas las federaciones autonómicas"

### Promo / CTA (25%)

- "Pre-lanzamiento abierto"
- "X capitanes ya en la lista"
- "Cierre de beta el [fecha]"
- "20 minutos en Excel → 30 segundos en TACTIUM"

### Founder / BTS / Build-in-public (25%)

- "Detrás del producto"
- "Por qué dark mode obligatorio"
- "Métrica de la semana: X waitlist"
- "Decisión: cómo decidimos el orden por puntos FEP"

---

## 12 · CHECKLIST ANTES DE PUBLICAR

Cuando recibas un slide/post de una AI, **verifica:**

- [ ] Fondo es `#030F0F` (no `#000`)
- [ ] Texto principal es `#E8F5EF` (no `#FFF`)
- [ ] Solo UN elemento dominante en accent verde
- [ ] Eyebrow está en MAYÚSCULAS mono con tracking ancho
- [ ] Headline tiene tracking negativo (no se ve sueltito)
- [ ] Hay dot grid sutil en el fondo (4-8% opacity)
- [ ] Pagination dots presentes (si es carrusel)
- [ ] Logo TACTIUM en footer derecho/centro
- [ ] Cero emojis
- [ ] Cero fotos stock
- [ ] Decimales con coma, espacio antes de €
- [ ] Glosario respetado (pista, pareja, jornada)

Si algo falla → reenviar al AI con instrucción específica:
> "El fondo está demasiado claro. Usa #030F0F exactamente, no #1A1A1A."

---

## 13 · ASSETS DISPONIBLES EN EL REPO

| Ruta | Contenido |
|---|---|
| `public/brand/logo.png` | Logo PNG oficial (1254×1254) |
| `public/brand/logo.svg` | Logo SVG vectorial limpio |
| `public/brand/social/avatars/` | Avatars listos para IG (320), TikTok (200), master (400) |
| `public/brand/logo-variants/` | Variantes de logo generadas con IA |
| `BRAND_SYSTEM.md` | Bible de marca completo |
| `BRAND_SOCIAL.md` | Bios, hashtags, setup de cuentas |
| `CONTENT_CALENDAR.md` | 12 posts planificados para 4 semanas |
| `lib/carousel/posts.ts` | Posts como código (genera PNGs en `/dev/carousel`) |

---

## 14 · CIERRE

Cuando tengas duda sobre un detalle visual, vuelve a este documento.
Cuando un asset salga mal, identifica qué regla no se cumplió y dale al AI esa regla específica como corrección.

Marca consistente > marca creativa cada vez. **La fuerza de TACTIUM está en la repetición precisa.**
