# TACTIUM · Brief de Diseño para Landing 3D

> Prompt operativo para diseñar y construir la landing pública de TACTIUM. Pensado para entregar a un agente de diseño (Claude Design / Designer AI / equipo creativo) junto con los screenshots de la app.

---

## 1. Resumen ejecutivo

Diseñar y construir la **landing pre-lanzamiento** de TACTIUM: una web **dark, 3D, animada y scroll-driven** que capture a capitanes y clubs de pádel federado para una **waitlist**. La estética debe sentirse como un **laboratorio de élite** (precisión, datos, monoespaciado), no como un SaaS genérico.

Stack ya inicial: **Next.js 15 (App Router) + Tailwind v4 (CSS-first tokens) + TypeScript**. Animaciones esperadas: **react-three-fiber + drei** para 3D real, **GSAP + ScrollTrigger** para scrollytelling, **Lenis** para smooth scroll, **Motion** (ex Framer Motion) para micro-interacciones de UI.

---

## 2. Producto

**TACTIUM** es una app móvil (React Native / iOS+Android) para **gestionar equipos de pádel federado**. Resuelve un dolor real: armar la alineación oficial de cada jornada respetando el orden por puntos FEP y comunicarla al equipo.

### Audiencia (2 perfiles)

1. **Capitán de equipo federado** — gestiona 1 equipo, 8–30 jugadores. Necesita rapidez (alineación lista en 2 minutos antes del partido) y certeza (no equivocarse con el orden por puntos).
2. **Admin de club** — gestiona 3–25 equipos bajo el mismo club. Necesita vista global y delegar capitanes.

### Propuesta única

- **Auto-balance de alineaciones por puntos FEP** — orden por fuerza, respetando reglas de federación (FEP, FAP, FMP, FCantP, FMurP, FNP, LAPI, EPF Bizkaia).
- **Variantes ilimitadas por jornada** — prueba escenarios sin perder la oficial.
- **Notificaciones push a los jugadores** convocados (hora, sede, pareja).
- **Multi-equipo bajo un club** con roles separados (admin del club / capitán de cada equipo).

### Modelo de negocio

Suscripción mensual o anual (-20%), 14 días de prueba gratis. Planes:

| Plan | Equipos | Mensual |
|------|---------|---------|
| Capitán | 1 | 4,99 € |
| Club Starter | 3 | 11,99 € |
| Club Pro | 10 | 24,99 € |
| Club Elite | 25 | 39,99 € |

---

## 3. Objetivo de la landing

1. **Conversión primaria**: que el visitante deje su email en la waitlist (formulario presente en Hero y FinalCta).
2. **Comunicación clara** en 5 segundos: qué hace TACTIUM, para quién, qué le diferencia.
3. **Soporte SEO**: indexación de keywords `padel federado`, `alineaciones`, `app capitán pádel`, `gestión de equipos pádel`.

---

## 4. Tone & vibe

**Palabras clave**: laboratorio · precisión · oscuro · futuro · serio pero ágil.

**Referencias visuales** (NO copiar, inspirarse):

- **linear.app** — minimalismo dark, tipografía gigante, transiciones suaves, mucho mono.
- **vercel.com** — densidad informativa, grids precisos, gradientes radiales sutiles.
- **stripe.com** — illustration system con phones flotando.
- **rauno.me / hyperplexed.dev** — micro-interacciones de detalle (cursor follow, magnetic buttons).
- **bruno-simon.com / awwwards 3D winners** — 3D real integrado en scroll.

**Evitar**:

- ❌ Skeumorfismo o glass blur excesivo (Apple-style).
- ❌ Emojis como iconos (usar Lucide SVG).
- ❌ Light mode. La marca vive en oscuro.
- ❌ Stock photos de gente jugando al pádel (clichés).
- ❌ Hero "animado" con vídeo MP4 background pesado.
- ❌ Gradientes arcoíris. La paleta es **monocromo verde** sobre negro.

---

## 5. Sistema de diseño

### 5.1 Paleta (dark exclusivo)

```css
/* Fondos */
--color-bg:          #030F0F   /* Negro verdoso base */
--color-bg-raised:   #081818   /* Surface elevado */
--color-bg-card:     #0C2222   /* Cards y módulos */
--color-bg-card-2:   #0F2A28   /* Cards en hover/elevación */

/* Marca */
--color-primary:     #03624C   /* Verde institucional, fondos accent */
--color-primary-dim: #02463A
--color-accent:      #00DF82   /* ⭐ Verde TACTIUM — el color de la marca */
--color-accent-dim:  #00B86B

/* Texto */
--color-text:         #E8F5EF              /* Body, 100% */
--color-text-muted:   rgba(232,245,239,0.70) /* Subtítulos, descripciones */
--color-text-faint:   rgba(232,245,239,0.50) /* Mono eyebrows, hints */
--color-text-inverse: #001810              /* Texto sobre botón accent */

/* Trazos */
--color-hair:         rgba(232,245,239,0.06) /* Borders sutiles */
--color-hair-strong:  rgba(232,245,239,0.10) /* Borders más visibles */

/* Estado */
--color-success: #00DF82  (= accent)
--color-warning: #F2C94C
--color-error:   #FF6B6B

/* Tintes accent (overlays / fills) */
--color-accent-10: rgba(0,223,130,0.10)
--color-accent-25: rgba(0,223,130,0.25)
--color-accent-40: rgba(0,223,130,0.40)
--color-accent-55: rgba(0,223,130,0.55)
```

**Reglas de uso del accent**:

- Sólo **un elemento accent dominante por viewport** (botón CTA, número grande, badge).
- Eyebrows mono en `accent` (text-[11px] tracking-[0.25em]).
- Glows / halos: blur(80px) opacity 0.10–0.20 detrás de mockups y CTAs.
- Hover de cards: borde `accent-40`, glow radial siguiendo cursor.

### 5.2 Tipografía

| Familia | Uso | Pesos |
|---------|-----|-------|
| **Inter** (sans) | Body, headlines, todo el copy. `next/font/google` con weights 400/500/600/700/800. | 400, 500, 600, 700, 800 |
| **JetBrains Mono** | Eyebrows, datos tabulares (precios, números, métricas), badges. | 400, 500, 600, 700 |

**Escala** (mobile-first, fluida):

```
H1 hero    → 40px / 56px sm / 64px lg, leading-[1.05], tracking-tight, font-extrabold
H2 section → 30px / 36px / 48px, font-extrabold, tracking-tight
H3 card    → 18px / 20px, font-bold
Body lg    → 18px / 20px, leading-relaxed, text-muted
Body       → 14px / 16px, text-muted
Eyebrow    → 11px mono, tracking-[0.25em–0.30em], font-medium, color accent
Mono data  → 10–12px mono, tracking-[1px–1.6px]
```

### 5.3 Espaciado, radios, shadows

```
Radius:  sm 8px · md 12px · lg 16px · xl 24px · phone 42px (frame de iPhone)
Section padding: py-20 sm:py-28 lg:py-32
Container: max-w-6xl (1152px) mx-auto px-6
Gaps en grids: gap-4 default · gap-12 lg:gap-16 en hero
```

**Sombras dominantes** (siempre suaves, nunca duras):

```css
/* Card flotante */
shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.04)]

/* Card sutil */
shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.04)]

/* CTA verde */
shadow: 0 8px 24px -6px rgba(0,223,130,0.4)
```

### 5.4 Iconografía

- **Lucide React** exclusivamente. Stroke 1.5–2px. Size 16–24.
- Iconos siempre en `accent` o `text-muted`, nunca en blanco puro.
- Decorativos = `aria-hidden`. Funcionales = `aria-label`.

---

## 6. Stack técnico esperado

```
Framework:        Next.js 15 (App Router, RSC + client islands)
Estilos:          Tailwind v4 (CSS-first tokens, sin tailwind.config.js)
Type system:      TypeScript estricto
Smooth scroll:    Lenis (pinned a window + Mac trackpad fix)
Scrollytelling:   GSAP + ScrollTrigger (@gsap/react useGSAP)
3D:               react-three-fiber + drei (OrbitControls, Float, Center, Text3D)
                  GLB/GLTF para modelos (pala + bola + pista 3D)
Animaciones UI:   Motion (ex Framer Motion) para entry/exit y layout
                  anime.js para timelines complejos (hero entrance)
Iconos:           Lucide React
Forms:            React Hook Form + Zod
Backend mínimo:   Supabase (waitlist table con citext dedup)
Email:            Resend (welcome al unirse)
Analytics:        Plausible (privacy-first, sin cookies)
Fonts:            next/font/google (Inter + JetBrains Mono)
Image:            next/image (siempre con sizes responsivo)
```

**Restricciones técnicas**:

- ❌ NO usar `framer-motion` clásico (arrastra `react-dom` + segunda copia de React). Usar `motion` paquete moderno.
- ❌ NO usar `moti` en la app móvil (rompe el bundle por la misma razón).
- ✅ Reanimated puro en la app móvil, GSAP en web.
- ✅ Todo dark, sin `light` mode previsto.

---

## 7. Animaciones esperadas

### 7.1 3D real (react-three-fiber)

Un canvas 3D principal que se reutilice **anclado por scroll** (no múltiples canvas):

- **Pala de pádel 3D** que rota y flota en el hero, y a medida que el usuario scrollea **viaja por la página** acompañando las secciones (timeline GSAP-driven scrubbing la `<canvas>` position).
- **Pista de pádel low-poly** en una sección dedicada, con cámara que orbita lentamente.
- **Pelota** rebotando por una trayectoria curva durante un scroll-stage.
- Iluminación: 1 directional + 1 point en `accent` para tinte verde.

**Performance**:

- DPR clamp `[1, 1.5]`. Frameloop `demand`. Suspense + lazy load del canvas (no SSR).
- Fallback a SVG estático en `prefers-reduced-motion`.

### 7.2 Scrollytelling (GSAP ScrollTrigger)

- **Pin & scrub**: secciones que se "fijan" mientras el usuario scrollea y los phones se transforman/rotan dentro.
- **Stagger reveal**: cards de bento y phones de AppPreview entran con stagger 80–110ms.
- **Parallax sutil**: capas de fondo (aurora blobs) se desplazan a 0.3–0.5x del scroll.
- **Number counters** rolling para precios y métricas usando `motion`.
- **Progress indicator vertical** opcional a la derecha (estilo Awwwards).

### 7.3 Smooth scroll (Lenis)

```ts
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});
```

Sincronizar con GSAP ScrollTrigger (`lenis.on('scroll', ScrollTrigger.update)`).

### 7.4 Micro-interacciones

- **Magnetic buttons** en CTAs (el botón se acerca ligeramente al cursor con `transform: translate()`).
- **Cursor follow trail** en grids tipo bento (glow radial que sigue el ratón).
- **Float idle** en mockups (translateY -10px + rotateY ±6° en loop 8s).
- **Hover tilt** en phones (rotateX/Y según posición del cursor relativa, suavizado).
- **Selection custom** con accent verde (`::selection`).

### 7.5 Accesibilidad de motion

- `@media (prefers-reduced-motion: reduce)` desactiva TODO. Las animaciones decorativas caen a estado final.
- Animaciones funcionales (transición de page, focus) deben mantenerse < 200ms.

---

## 8. Estructura narrativa propuesta

```
Header (sticky, glass)
  ↓
Hero
  · Headline 2 líneas con accent
  · Subtítulo con propuesta
  · Waitlist form
  · Stack 3D (pala flotando + 2 phones mockup en stack)
  ↓
AppPreview · scrollytelling
  · 3 phones en stagger diagonal
  · Storytelling 01 PROGRAMA → 02 ALINEA → 03 CIERRA
  ↓
FederationsMarquee
  · Marquee infinito horizontal con logos de federaciones soportadas
  ↓
ForWho
  · 2 columnas: "Eres capitán" / "Eres club"
  ↓
ForClubs · deep-dive
  · Split: copy + bullets + 2 phones cruzados (panel club + listado equipos)
  ↓
Features · bento
  · 6 tiles asimétricas con icono Lucide + título + desc
  · Hover trail glow con cursor follow
  ↓
Pricing
  · Toggle mensual/anual con descuento -20%
  · 4 cards (Capitán, Starter, Pro, Elite)
  · Card recomendada highlight con border accent
  ↓
Faq
  · Acordeón con preguntas reales (5–7 items)
  ↓
FinalCta
  · Headline grande + waitlist form duplicado
  ↓
Footer
  · Logo + links legales + redes
```

---

## 9. Assets: screenshots

Las 17 capturas de la app viven en `/Screens APP/`. Categorizadas por prioridad de uso en landing:

### ⭐ TIER A · Imprescindibles (usar todas)

| Archivo | Pantalla | Uso recomendado |
|---------|----------|-----------------|
| `ALINEACION.jpeg` | Alineación con 3 parejas, auto-orden, barras de puntos, banquillo | **Hero principal**. Es la feature más diferencial. |
| `WhatsApp Image 2026-05-12 at 12.30.42.jpeg` | Splash "TACTIUM · CREATE · ANALYZE · ELEVATE" | **Hero secundario** (stack detrás de Alineación) o transición 3D. |
| `JORNADA + RESULTADOS.jpeg` | Jornada con cards V/D/empate y marcador por sets | **AppPreview paso 3** (cierre del flujo). |
| `JORNADA SIN ALINEACION NI RESULTADOS.jpeg` | Jornada con CTA "Crear alineación" | **AppPreview paso 1** (inicio del flujo). |
| `CLUB.jpeg` | Panel admin TACTIUM Test Club con 7 equipos y jornadas | **ForClubs phone 1**. Demuestra escalabilidad. |
| `EQUIPOS CLUB.jpeg` | Listado 7 equipos con badges 2ª/masc/fem | **ForClubs phone 2**. Multi-equipo. |
| `ONBOARDING WELCOME.jpeg` | "¿Cómo vas a empezar?" con planes Equipo / Club | **Pricing teaser** o sección onboarding storytelling. |

### 🔹 TIER B · Útiles si hay sección secundaria

| Archivo | Pantalla | Posible uso |
|---------|----------|-------------|
| `HOME VACIA.jpeg` | Home con empty state, atajos Disponibilidad/Plantilla, tab bar | Sección "Primer día con TACTIUM". |
| `INVITACION JUGADOR ELEGIR JUGADOR.jpeg` | "¿Cuál eres tú?" con lista de jugadores | Feature card "Invitar jugadores". |
| `ALINEACION VACIA.jpeg` | Estado inicial de alineación | Antes/después con `ALINEACION.jpeg`. |

### ⚪ TIER C · Skip (no aportan)

- `ONBOARDING 1.jpeg`, `ONBOARDING AÑADIR JUGADORES.jpeg` — pasos de setup, poco atractivos visualmente.
- `INICIO DE SESION.jpeg`, `RESGISTRO.jpeg` — pantallas estándar (Apple/Google sign-in), no diferenciales.
- `RESULTADOS VACIA.jpeg`, `TEMPORADAS VACIA.jpeg` — empty states genéricos.

### Tratamiento de las capturas

- **Frame**: iPhone con bordes `42px radius`, Dynamic Island, glow ambient accent detrás.
- **Tamaños**: hero 300px width / card 220px / tile 140px (aspect 9:19.5).
- **Composición**: phones rotados ±5–9° en stacks, con `hover:rotate-0` que los endereza.
- **Optimización**: `next/image` con `sizes` responsivo, quality 85.

---

## 10. Wireframe de Hero (ASCII)

```
┌──────────────────────────────────────────────────────────┐
│  [LOGO TACTIUM]    Features  Precios  FAQ   [ Email→ ]   │  Header glass
├──────────────────────────────────────────────────────────┤
│                                                          │
│  PRE-LANZAMIENTO · 2026          ╱╲                      │
│                                  PHONE                   │
│  El sistema operativo            (splash)                │
│  del pádel federado              tilted -9°              │
│  ━━━━━━━━━━━━━━ accent                                   │
│                                       ╱╲                 │
│  Alineaciones con auto-balance        PHONE              │
│  por puntos FEP, variantes...         (alineación)       │
│                                       float idle         │
│  ┌──────────────────┐                 + glow             │
│  │ email@dominio    │ → Entrar        accent             │
│  └──────────────────┘                                    │
│  14 DÍAS GRATIS · CANCELA CUANDO QUIERAS                 │
│                                                          │
│  [ aurora blobs + grid sutil + perspective 1200px ]      │
└──────────────────────────────────────────────────────────┘
```

---

## 11. Microcopy en español (España)

- **Persona**: "tú", no "usted".
- **Glosario**: pista (no cancha), pareja (no dupla), jornada (no fecha), capitán/a, federación.
- **CTAs**: "Entrar en la lista", "Empezar gratis", "Quiero probarlo", "Ver planes".
- **Eyebrows mono SIEMPRE en mayúsculas** con tracking generoso (0.25em).

---

## 12. Performance & accesibilidad

- **Lighthouse target**: ≥ 90 en Performance, Accessibility, Best Practices, SEO.
- **Core Web Vitals**: LCP < 2s, CLS < 0.1, INP < 200ms.
- **Imágenes**: AVIF/WebP automático con `next/image`, lazy load por defecto, hero con `priority`.
- **Fonts**: `next/font` con `display: swap`, preload del subset latin.
- **3D canvas**: Suspense + dynamic import, no SSR, fallback estático.
- **a11y**: contraste mínimo WCAG AA 4.5:1 — la combinación `#E8F5EF` sobre `#030F0F` cumple AAA.
- **Reduced motion**: respetar y desactivar todas las animaciones decorativas.
- **Keyboard nav**: focus rings visibles en accent, tab order lógico, skip links.

---

## 13. Entregables esperados

1. Diseño en Figma (o equivalente) con:
   - Frames de Hero, AppPreview, ForClubs, Features, Pricing, Faq, FinalCta en mobile (375px) + desktop (1440px).
   - Componentes: Button, Input, Card, PhoneFrame, Eyebrow, Badge.
   - Variantes de estado (default, hover, active, disabled, error).
2. Storyboard de las animaciones 3D + scrollytelling (frames clave del recorrido de la pala 3D por la página).
3. Specs de animación (duración, easing, trigger) por componente.
4. Exportables: SVGs de logos, iconos custom si los hay.

---

## 14. Prompt directo para el agente de diseño

> Diseña la landing pre-lanzamiento de **TACTIUM**, una app móvil de gestión de equipos de pádel federado. La estética es **dark, monocromática verde (#00DF82 sobre #030F0F), tipografía Inter + JetBrains Mono, sensación de laboratorio de élite**. La web debe sentirse **animada, 3D y scroll-driven**: una pala de pádel 3D que viaja con el scroll, phones de la app flotando en stacks rotados, scrollytelling con GSAP ScrollTrigger pin & scrub, smooth scroll con Lenis. El objetivo es **convertir a waitlist** (email en Hero y FinalCta). Sigue el sistema de diseño y la estructura narrativa de este documento. Inspírate en linear.app, vercel.com, rauno.me y ganadores 3D de Awwwards — pero sin copiar. Stack: Next.js 15 + Tailwind v4 + react-three-fiber + GSAP + Motion. Microcopy en español de España. Las capturas TIER A son las que debes integrar; cuídalas con frame iPhone (radius 42px, Dynamic Island, glow ambient verde) y composición en stack rotado.

---

**Última actualización**: 2026-05-12 · **Versión**: 1.0
