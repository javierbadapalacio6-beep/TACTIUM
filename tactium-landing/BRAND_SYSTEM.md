# TACTIUM — Startup Brand System

> Brand bible canonical. Fuente de verdad para identidad, copy, UI, motion.
> Última actualización: 2026-08-10 — Satoshi sustituye a Inter · sistema de color ampliado a doble tema.

> **Dónde vive cada superficie**
> - **Producto** (app móvil + app web) → **doble tema**, claro y oscuro, elegible por el usuario. Tokens en `CLAUDE DESIGN/colors_and_type.css`, fuente de verdad en `TACTIUM/src/core/theme/colors.ts`.
> - **Marketing** (landing, carruseles, posts, stories, reels) → **sólo oscuro**, a propósito. Reglas en `DESIGN_SYSTEM.md`.
> - **Assets de marca que viajan fuera** (splash, tarjetas para compartir) → **siempre oscuros**, sea cual sea el tema del producto.

## Brand Core

### Brand Name
TACTIUM

### Positioning
Modern sports team management platform focused on tactical organization, lineups, seasons, schedules, federated competition management, and team coordination.

### Brand Personality
Precise · Tactical · Modern · Competitive · Minimal · High-performance · Intelligent · Structured · Premium-tech

### Brand Archetype
**The Strategist.** TACTIUM should feel like a precision sports operating system, a tactical dashboard, a high-performance digital tool used by serious teams. Not casual. Not playful. Not gaming-oriented. Not corporate legacy software.

---

## Visual Direction

### Design References
Linear · Vercel · Raycast · Notion · Stripe Dashboard · Framer · Awwwards minimal startup aesthetics

### Visual Keywords
geometric · modular · grid-based · technical · restrained · premium · crisp · intelligent

---

## Logo System

### Primary Symbol
Selected direction: **Minimal tactical "T" monogram with velocity-inspired horizontal cuts.**

Core concepts represented: tactics · movement · team coordination · match flow · sports systems · speed · execution.

### Logo Construction
- Rounded stroke terminals
- 2–2.5px visual stroke consistency
- Symmetrical geometry
- Balanced negative space
- Flat vector construction only

### Logo Behavior
Must work at 24px · remain identifiable as app icon · feel strong in monochrome · maintain visual clarity on **both dark and light backgrounds**.

Cuando va inline en la interfaz se dibuja como "T-tile": cuadrado redondeado con relleno `#03624C` y la `T` en accent. Ese relleno es idéntico en los dos temas, así que la tesela no necesita variante clara. El isotipo suelto sobre lienzo claro se recolorea a `#00995E`.

Avoid: gradients · shadows · skeuomorphism · neon glow excess · busy detail · mascot-style branding.

---

## Color System

Monocromático verde. **Un solo accent dominante por composición**, nunca dos hues compitiendo. El producto expone dos temas con **las mismas claves de token** y distintos valores, de forma que ningún componente ramifica por tema: lee el token y el tema decide.

### Dark — la firma, y el tema por defecto

| Token | Hex | Use |
|---|---|---|
| **TACTIUM Black** | `#030F0F` | App backgrounds, dashboards, website hero, dark UI |
| **TACTIUM Green** (primary accent) | `#00DF82` | Active states, CTAs, highlights, tactical indicators, selected items, charts, logo accents |
| **TACTIUM Deep Green** (secondary) | `#03624C` | Surfaces, dividers, subtle UI blocks, secondary indicators |
| **TACTIUM Soft White** | `#E8F5EF` | Typography, icons, interface labels, contrast elements |
| **Inverse text** | `#001810` | Texto sobre relleno verde |

### Light — sólo producto, y de pleno derecho

| Token | Hex | Use |
|---|---|---|
| **Light canvas** | `#F4F7F5` | Fondo base. Nunca blanco puro |
| **Light surfaces** | `#FFFFFF` / `#EEF3F0` | Tarjetas y segunda elevación |
| **TACTIUM Green · light** | `#00995E` | El mismo papel que `#00DF82` en oscuro |
| **TACTIUM Deep Green** | `#03624C` | Idéntico en ambos temas |
| **Light ink** | `#0E1A14` | Tipografía. 64% muted · 42% faint. Nunca negro puro |
| **Inverse text** | `#FFFFFF` | Texto sobre relleno verde |

**Las tres reglas que más se incumplen al pasar a claro:**

1. **El accent cambia.** `#00DF82` da 1,6:1 sobre blanco: falla como texto, como borde y como anillo de foco. `#00995E` da 4,6:1 sobre `#F4F7F5` y además funciona como relleno con texto blanco encima.
2. **Los glows desaparecen.** En oscuro el halo verde es la firma visual; en claro es suciedad. La profundidad la dan sombras neutras suaves y hairlines.
3. **Las sombras se aclaran y se acortan.** Las recetas oscuras (negro al 60–80%) manchan de gris un lienzo casi blanco. En claro: tinte del propio texto, opacidad baja, desenfoque corto.

Los estados semánticos también tienen valores propios en claro (`#B7791F` warning · `#D93B41` error): los del tema oscuro vibran sobre blanco.

### Neutral UI Scale (dark)
| Token | Hex |
|---|---|
| Neutral 100 | `#E8F5EF` |
| Neutral 80 | `#A9BBB4` |
| Neutral 60 | `#6E827B` |
| Neutral 40 | `#35504A` |
| Neutral 20 | `#102322` |
| Neutral 0 | `#030F0F` |

Los neutros del tema claro conservan un leve sesgo verde para que la interfaz siga leyéndose como TACTIUM y no como un panel blanco genérico.

---

## Typography System

### Primary Typeface
**Satoshi** — Black (900), Bold (700), Medium (500), Regular (400).

Es la sans oficial de TACTIUM, declarada como tal en `TACTIUM/src/core/theme/fonts.ts`. Se carga desde Fontshare (`api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900`).

> ⚠️ **Satoshi no tiene 600 ni 800.** Al migrar desde la escala antigua: `800 → 900`, `600 → 500`. Pedirle un peso que no existe hace que el navegador lo sintetice y el titular sale sucio.

> **Histórico:** hasta 2026-08-10 la tipográfica primaria era **Inter**. Satoshi la sustituye; Inter sobrevive sólo como fallback dentro del stack CSS. JetBrains Mono se mantiene sin cambios como fuente de datos, eyebrows e identificadores.

### Secondary Typeface
**JetBrains Mono** — 400 a 700. Eyebrows, datos tabulares, marcadores, puntos FEP, códigos, precios. Siempre `tabular-nums`.

### Style
Tight tracking · geometric rhythm · large headings · high spacing consistency · minimal decoration.

### Tracking
- Headlines: `-0.04em`
- UI Labels: `-0.02em`
- Body: `0em`

---

## Wordmark Rules

### Official Wordmark
**TACTIUM** — uppercase · geometric sans-serif · wide stable stance · strong horizontal rhythm.

### Signature Detail
The dot above the "I" becomes a square in accent color `#00DF82`. This should remain the only accent inside the wordmark.

---

## App Icon System

### Structure
Centered symbol · dark background · subtle tactical grid · no text · large breathing space · high contrast.

### Safe Area
Minimum padding: **18%**.

### App Store Presence
TACTIUM should visually stand beside Linear, Notion, Arc, Raycast, Vercel. Premium · modern · sharp · tactical · scalable.

---

## UI Style System

### Interface Philosophy
Mission control · sports operations software · tactical management platform · modern analytics dashboard.

### Rules
- **Dark-first, not dark-only.** El oscuro es el tema por defecto y la firma de la marca; el claro es un tema de pleno derecho que hay que diseñar, no derivar apagando luces.
- Large spacing
- Minimal borders — los hairlines cargan aún más peso en claro, donde no hay glows que separen superficies
- Restrained color use
- El verde sólo para acciones con significado — y siempre a través del token, para que siga al tema
- Avoid clutter
- Modular card layouts
- Anillo de foco visible en ambos temas: buena parte de la app web se maneja con teclado

---

## Component Language

### Cards
Soft radius · low visual noise · subtle borders. Superficie `bg-card` del tema activo: `#0C2222` en oscuro, `#FFFFFF` en claro.

### Buttons
- **Primary**: relleno verde con texto `text-inverse` — texto oscuro sobre el verde en tema oscuro, texto blanco sobre `#00995E` en claro
- **Secondary**: sólo contorno, hover sutil

### Data Visualizations
Tactical-grid inspired · clean lines · no unnecessary decoration · minimal axis styling.

---

## Motion System

### Personality
Smooth · precise · fast · subtle.

### Timing
150ms–250ms.

### References
Linear · Framer · Raycast.

Avoid: bouncy animations · elastic motion · flashy transitions.

---

## Graphic Language

### Tactical Grid
TACTIUM's signature background element:
- Subtle dot matrix
- 4% opacity — `rgba(232,245,239,0.04)` en oscuro, invertido a `rgba(14,26,20,0.05)` en claro
- Soft fade toward edges
- Geometric spacing

Used in: presentations · website backgrounds · login screens · marketing assets.

El **ambient backdrop** del producto (dos gradientes radiales: `primary` al 55% arriba, `accent` al 18% abajo a la izquierda) es su equivalente en pantalla. En tema claro baja a un cuarto de intensidad o desaparece: el lienzo claro es liso.

---

## Brand Voice

### Tone
Confident · direct · modern · concise · performance-oriented.

Avoid: corporate jargon · playful slang · exaggerated hype · gamer language.

### Hero Headline Candidates
- "Run your team with precision."
- "Built for modern sports organizations."
- "Lineups, seasons, tactics — unified."
- "The operating system for competitive teams."

### Tagline Candidates
1. Organize. Compete. Win.
2. Modern team management.
3. Built for tactical sports.
4. Your club. One system.
5. Precision for modern teams.

---

## Brand Applications

Core product areas: team management · schedules · player availability · lineups · seasons · standings · tactical boards · federation competition · club administration.

---

## Identity Positioning

TACTIUM should feel like:
- The **Linear** of sports management
- The **Notion** for competitive teams
- The modern replacement for outdated federation software

Identity communicates: speed · trust · structure · tactical intelligence · premium execution.

---

## Final Brand Summary

TACTIUM is a precision-first sports management platform. Its identity combines startup minimalism, tactical sports systems, premium dark UI aesthetics, modern product design, and geometric precision.

The brand should always feel: **clean, strategic, high-performance, and unmistakably modern.**
