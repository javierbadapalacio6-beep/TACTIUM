// Posts de Instagram (y reutilizable en TikTok como carrusel slides).
// Cada post se renderiza a N slides PNG 1080x1350 vía /api/carousel/[postId]/[slideIdx]
// y se previsualizan / descargan desde /dev/carousel.
//
// Edita este archivo para añadir un post nuevo: copia el shape de un
// existente, cambia el id, slides, caption y hashtags.
//
// Tipos de slide:
//   - "cover"          → título grande + isotipo + eyebrow
//   - "content"        → eyebrow + título + body + visual element opcional
//   - "stat"           → número grande mono + label
//   - "quote"          → texto destacado + atribución
//   - "cta"            → CTA grande + URL + isotipo
//   - "image-overlay"  → foto fullbleed + gradiente inferior + eyebrow/title encima

export type SlideKind =
  | "cover"
  | "content"
  | "stat"
  | "quote"
  | "cta"
  | "image-overlay";

export interface Slide {
  kind: SlideKind;
  eyebrow?: string;
  title?: string;
  body?: string;
  stat?: string;
  statLabel?: string;
  quote?: string;
  attribution?: string;
  cta?: string;
  url?: string;
  // Sólo para kind:"image-overlay". Ruta pública relativa al dominio
  // (ej. "/social/avatar/hero.png"). Se resuelve a URL absoluta en el
  // route handler con request origin.
  imagePath?: string;
}

export interface CarouselPost {
  id: string;
  // Título interno (no se muestra), para listar en /dev/carousel
  internalTitle: string;
  // Caption del post de Instagram (con saltos de línea reales)
  caption: string;
  hashtags: string[];
  slides: Slide[];
}

export const POSTS: CarouselPost[] = [
  // ────────────────────────────────────────────────────────────────
  // Post 1 · Welcome (lanzamiento de cuenta)
  // ────────────────────────────────────────────────────────────────
  {
    id: "welcome",
    internalTitle: "Bienvenida · Pre-lanzamiento TACTIUM",
    caption: `Bienvenido a TACTIUM.

El sistema operativo del pádel federado, hecho por y para capitanes y clubs.

Alineaciones por puntos FEP en 30 segundos.
Hasta 5 variantes por jornada.
Notificaciones push a tus jugadores.

Pre-lanzamiento abierto. Únete a la lista desde el link en bio.`,
    hashtags: [
      "padel", "padelfederado", "fep", "padelclub", "capitanpadel",
      "equipopadel", "padelespaña", "padellife", "startup", "sportsapp",
    ],
    slides: [
      {
        kind: "cover",
        eyebrow: "PRE-LANZAMIENTO · 2026",
        title: "El sistema operativo del pádel federado",
      },
      {
        kind: "content",
        eyebrow: "FEATURE · 01",
        title: "Alineaciones por puntos FEP",
        body: "30 segundos. Sin Excel. Sin discusiones de orden.",
      },
      {
        kind: "content",
        eyebrow: "FEATURE · 02",
        title: "Hasta 5 variantes por jornada",
        body: "Prueba escenarios sin perder la oficial.",
      },
      {
        kind: "content",
        eyebrow: "FEATURE · 03",
        title: "Notificaciones push al equipo",
        body: "Hora, pista, pareja. Todo al instante.",
      },
      {
        kind: "cta",
        eyebrow: "ÚNETE A LA BETA",
        title: "Pre-lanzamiento abierto",
        cta: "Link en bio",
        url: "tactium.io",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // Post 2 · Antes vs Después (Excel vs TACTIUM)
  // ────────────────────────────────────────────────────────────────
  {
    id: "vs-excel",
    internalTitle: "Excel vs TACTIUM",
    caption: `20 minutos en Excel → 30 segundos en TACTIUM.

Y los jugadores reciben la convocatoria al móvil sin que el capitán mueva un dedo.

Pre-lanzamiento abierto en tactium.io`,
    hashtags: [
      "padelfederado", "fep", "capitanpadel", "padelclub", "productivity",
      "padellife", "sportsmanagement", "sportsapp", "startup",
    ],
    slides: [
      {
        kind: "cover",
        eyebrow: "COMPARATIVA",
        title: "Excel vs TACTIUM",
      },
      {
        kind: "stat",
        eyebrow: "ANTES",
        stat: "20 MIN",
        statLabel: "armar alineación en Excel",
      },
      {
        kind: "stat",
        eyebrow: "AHORA",
        stat: "30 SEG",
        statLabel: "alineación TACTIUM lista",
      },
      {
        kind: "content",
        eyebrow: "BONUS",
        title: "Sin pegar puntos a mano",
        body: "Importa el ranking FEP haciendo una foto. OCR multimodal.",
      },
      {
        kind: "cta",
        eyebrow: "DEMO PRIVADA",
        title: "Únete a la beta",
        cta: "Link en bio",
        url: "tactium.io",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // Post 3 · BTS · Por qué nació TACTIUM (1 slide stat, caption largo)
  // ────────────────────────────────────────────────────────────────
  {
    id: "bts-30-seg",
    internalTitle: "BTS · 30 segundos vs 20 minutos (build in public)",
    caption: `30 segundos.

Eso es lo que le toma a TACTIUM armar la alineación de tu equipo federado.

Antes te llevaba 20 minutos. Excel abierto. Página de FEP para mirar puntos. WhatsApp para confirmar quién juega. Y un papel para anotar el orden por puntos respetando las reglas de tu federación.

Una jornada perdí 25 minutos y me equivoqué del orden por fuerza. Ese viernes pensé: esto es 2026, esto no puede llevar tanto tiempo.

TACTIUM nace de ahí.

Pre-lanzamiento abierto en tactium.io.`,
    hashtags: [
      "buildinpublic", "padelfederado", "startup", "sportsapp",
      "capitanpadel", "fep", "padelclub", "founder",
    ],
    slides: [
      {
        kind: "stat",
        eyebrow: "BUILD IN PUBLIC",
        stat: "30 SEG",
        statLabel: "vs 20 min en Excel",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // Post 4 · Un día con TACTIUM (carrusel narrativo con avatar IA)
  // Producido con HIGGSFIELD nano_banana_2 + cast 03 como reference.
  // Las imágenes viven en public/social/avatar/
  // ────────────────────────────────────────────────────────────────
  {
    id: "un-dia-tactium",
    internalTitle: "Un día con TACTIUM · narrativo con avatar IA",
    caption: `Tu jornada empieza antes de pisar la pista.

Llegas al club. La pala lista. Pero la alineación sin armar.

Antes te tocaba sacar el Excel, pegar los puntos a mano y discutir el orden por WhatsApp.

Ahora son 30 segundos. Auto-balance por puntos FEP, respetando el orden de tu federación. Y al confirmar, los jugadores reciben push con hora, pista y pareja.

Vas a jugar — no a discutir el orden.

Pre-lanzamiento abierto en tactium.io.`,
    hashtags: [
      "padelfederado", "fep", "capitanpadel", "padelclub",
      "padelespaña", "padellife", "padel", "sportsapp", "startup",
    ],
    slides: [
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/walk.png",
        eyebrow: "01 · LLEGADA",
        title: "Tu jornada empieza aquí.",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/hero.png",
        eyebrow: "02 · ANTES DEL PARTIDO",
        title: "Pala lista. ¿Y la alineación?",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/lineup-bench.png",
        eyebrow: "03 · 30 SEGUNDOS",
        title: "Por puntos FEP. Sin discusiones.",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/drive.png",
        eyebrow: "04 · JUEGAS",
        title: "Vas a jugar — no a discutir el orden.",
      },
      {
        kind: "cta",
        eyebrow: "ÚNETE A LA BETA",
        title: "Pre-lanzamiento abierto",
        cta: "Link en bio",
        url: "tactium.io",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // Post 5 · Stories Day 1 · 4 imágenes 9:16 con TACTIUM-Pro Soul
  // Sin text overlay — el sticker / sonido lo añade el user en IG/TikTok.
  // ────────────────────────────────────────────────────────────────
  {
    id: "stories-day-1",
    internalTitle: "Stories Day 1 · 4 momentos con TACTIUM-Pro",
    caption: `Stories sueltas para usar a lo largo del día.

01 · Llegada al club — momento de "ya estoy aquí"
02 · Lineup ready en el banquillo — ENSEÑA TACTIUM, mejor que un screenshot
03 · Pre-match focus — concentración, AirPods, toalla
04 · Victoria — fist celebración tras ganar punto

Sticker IG recomendado: timer/cuenta atrás en la story 01, swipe-up con link en la 02, encuesta tonta en la 03, GIF de fuego en la 04.`,
    hashtags: [
      "padelfederado", "fep", "capitanpadel", "padelclub",
      "padelespaña", "padellife",
    ],
    slides: [
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/story-walk.png",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/story-lineup.png",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/story-prematch.png",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/story-win.png",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // Post 6 · Built for federated padel (carrusel educacional)
  // Mezcla mockups Soul + slides de texto. Para Semana 2 del calendar.
  // ────────────────────────────────────────────────────────────────
  {
    id: "built-for-federated",
    internalTitle: "Built for federated padel · educacional",
    caption: `No somos una app de pádel.
Somos la app del pádel federado.

Otras apps reservan pista.
Otras suben rankings.
Otras consultan resultados.

Pero ninguna entiende que tu federación tiene reglas distintas, que el orden por fuerza es un dolor cada semana, y que un capitán necesita gestionar plantilla, jornadas y comunicación desde un mismo sitio.

TACTIUM se construyó desde dentro. Por un capitán federado, para capitanes federados.

Pre-lanzamiento abierto en tactium.io.`,
    hashtags: [
      "padelfederado", "fep", "capitanpadel", "padelclub", "clubpadel",
      "padelespaña", "padellife", "gestiondeportiva", "sportsapp",
    ],
    slides: [
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/hero-club.png",
        eyebrow: "EL SISTEMA OPERATIVO",
        title: "Built for federated padel.",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/lineup-bench.png",
        eyebrow: "FEATURE · 01",
        title: "Alineaciones por puntos FEP.",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/capitan-lineup.png",
        eyebrow: "FEATURE · 02",
        title: "Para capitanes que arman cada semana.",
      },
      {
        kind: "image-overlay",
        imagePath: "/social/avatar/admin-club.png",
        eyebrow: "FEATURE · 03",
        title: "Para clubs con varios equipos.",
      },
      {
        kind: "cta",
        eyebrow: "ÚNETE A LA BETA",
        title: "Pre-lanzamiento abierto",
        cta: "Link en bio",
        url: "tactium.io",
      },
    ],
  },
];

export function getPost(id: string): CarouselPost | undefined {
  return POSTS.find((p) => p.id === id);
}
