// Posts de Instagram (y reutilizable en TikTok como carrusel slides).
// Cada post se renderiza a N slides PNG 1080x1350 vía /api/carousel/[postId]/[slideIdx]
// y se previsualizan / descargan desde /dev/carousel.
//
// Edita este archivo para añadir un post nuevo: copia el shape de un
// existente, cambia el id, slides, caption y hashtags.
//
// Tipos de slide:
//   - "cover"    → título grande + isotipo + eyebrow
//   - "content"  → eyebrow + título + body + visual element opcional
//   - "stat"     → número grande mono + label
//   - "quote"    → texto destacado + atribución
//   - "cta"      → CTA grande + URL + isotipo

export type SlideKind = "cover" | "content" | "stat" | "quote" | "cta";

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
        cta: "tactium.io",
        url: "Link en bio",
      },
    ],
  },
];

export function getPost(id: string): CarouselPost | undefined {
  return POSTS.find((p) => p.id === id);
}
