// Los datos de cada reel. Es lo ÚNICO que se toca para montar una pieza nueva:
// el componente no se edita.
//
// Guiones: ../MOTION GRAPICHS TACTIUM/… no — están en `TACTIUM-VIDEO/GUIONES-REELS.md`.
//
// Rutas de archivo: todo lo que se reproduce vive en `public/`. Los brutos que
// deja Javier en `bruto/` NO se leen desde aquí: se recortan antes con ffmpeg y
// el recorte se deja en `public/plano/` (lo que dices a cámara) o
// `public/cobertura/` (pantallas de la app y pádel real).

export type Frase = {
  /** Un cue corto. Si pasa de `T.sub.maxChars`, se parte solo en dos líneas. */
  texto: string;
  /** La palabra que va en verde. UNA por frase, y solo si carga el significado. */
  enfasis?: string;
  /** Opcional. Sin esto, el tiempo se reparte proporcional a la longitud. */
  desdeMs?: number;
  hastaMs?: number;
};

export type Cobertura = {
  /** Ruta dentro de `public/`. Vídeo (.mp4/.mov) o imagen. `null` = aún sin grabar. */
  src: string | null;
  /** Qué archivo se espera aquí. Se pinta en el marcador mientras `src` sea null. */
  nota?: string;
  desdeMs: number;
  hastaMs: number;
  /** Segundo del clip de origen por el que entra. Por defecto, 0. */
  offsetMs?: number;
};

/** Gráficos de dato. Solo entran si construyen el mensaje; si decoran, sobran. */
export type Grafico = { desdeMs: number; hastaMs: number } & (
  | { tipo: "numero"; valor: number; eyebrow?: string; pie?: string }
  | {
      tipo: "resalte";
      /** En % del lienzo, para no depender del tamaño de la captura. */
      zona: { x: number; y: number; w: number; h: number };
      etiqueta?: string;
    }
  | { tipo: "contador"; de: number; a: number; unidad: string; eyebrow?: string }
  | {
      tipo: "ticks";
      /** `enMs` (relativo al inicio del gráfico) cuando el ítem debe caer sobre
       *  una palabra concreta; si no, se usa `pasoMs`. */
      items: { texto: string; enMs?: number }[];
      pasoMs?: number;
    }
  | { tipo: "cortinilla"; cifra: string; pie?: string }
);

/**
 * Cómo conviven tu plano y la pantalla de la app:
 *
 *  - `alterna`  — por defecto. La cobertura TAPA el plano por tramos. Para
 *                 piezas de mensaje, donde la pantalla es una prueba puntual.
 *  - `tutorial` — los dos a la vez: tu cara en la banda de arriba y la app
 *                 debajo. Para enseñar cómo se hace algo mientras lo cuentas.
 *  - `pip`      — la app a pantalla completa y tu cara en un recuadro. Cuando
 *                 el detalle de la pantalla manda sobre la cara.
 */
export type Layout = "alterna" | "tutorial" | "pip";

export type Pieza = {
  id: string;
  titulo: string;
  layout?: Layout;
  /** Tú a cámara. `null` mientras no esté rodado: sale el marcador de encuadre. */
  plano: string | null;
  duracionMs: number;
  frases: Frase[];
  cobertura: Cobertura[];
  graficos?: Grafico[];
};

export const PIEZAS: Pieza[] = [
  {
    id: "A1-federaciones",
    titulo: "Diecisiete federaciones",
    plano: null, // → "plano/A1-federaciones.mp4"
    duracionMs: 12000,
    frases: [
      { texto: "Me leí la normativa" },
      { texto: "de alineaciones de las" },
      { texto: "diecisiete federaciones", enfasis: "diecisiete" },
      { texto: "de pádel." },
      { texto: "Una por comunidad." },
      { texto: "Y no dicen lo mismo." },
      { texto: "Así que lo metí" },
      { texto: "todo aquí dentro." },
      { texto: "Tú eliges jugadores;" },
      { texto: "el orden te lo valida solo.", enfasis: "solo" },
    ],
    cobertura: [
      // El móvil entra cuando dice "aquí dentro" y se va antes del remate.
      { src: "img/alineacion.jpg", desdeMs: 7600, hastaMs: 9800 },
    ],
    graficos: [
      // El 17 aparece exactamente mientras lo dice, y se va con "de pádel".
      { tipo: "numero", valor: 17, eyebrow: "federaciones", desdeMs: 2600, hastaMs: 4600 },
    ],
  },

  {
    id: "A2-orden",
    titulo: "El orden de parejas",
    plano: null, // → "plano/A2-orden.mp4" · trípode fijo, mesa del bar
    duracionMs: 12000,
    frases: [
      { texto: "El orden de parejas" },
      { texto: "de tu equipo" },
      { texto: "probablemente está mal.", enfasis: "mal" },
      { texto: "No por mala fe:" },
      { texto: "cada federación" },
      { texto: "lo define distinto." },
      { texto: "Y si la pareja dos" },
      { texto: "es más fuerte que la uno," },
      { texto: "te la pueden impugnar.", enfasis: "impugnar" },
      { texto: "Aquí lo tienes comprobado" },
      { texto: "antes de mandarlo." },
    ],
    cobertura: [
      // La captura del error en rojo ES el reel: entra con "impugnar" y se queda.
      { src: "img/alineacion.jpg", desdeMs: 6800, hastaMs: 11200 },
    ],
    graficos: [
      // Señala la pareja 2 y apaga el resto, justo cuando dice "más fuerte que la uno".
      //
      // OJO: `img/alineacion.jpg` es una alineación CORRECTA. Cuando exista la
      // captura del error en rojo, se cambia la cobertura y esta etiqueta pasa a
      // ser la del propio aviso de la app: "Pareja 2 más fuerte que la 1".
      {
        tipo: "resalte",
        zona: { x: 12, y: 44, w: 76, h: 14 },
        etiqueta: "PAREJA 2",
        desdeMs: 6900,
        hastaMs: 9500,
      },
    ],
  },

  {
    id: "A3-dos-minutos",
    titulo: "De una hora a dos minutos",
    plano: null, // → "plano/A3-dos-minutos.mp4" · habitación, palas de fondo
    duracionMs: 12000,
    frases: [
      { texto: "Cada jornada perdía" },
      { texto: "una hora montando" },
      { texto: "la alineación." },
      { texto: "Grupo de WhatsApp," },
      { texto: "quién puede, quién no," },
      { texto: "y el lío del orden." },
      { texto: "Ahora la dejo hecha" },
      { texto: "antes de coger la pala." },
      { texto: "Dos minutos.", enfasis: "Dos minutos." },
    ],
    cobertura: [
      { src: "img/jornada-pendiente.jpg", desdeMs: 3000, hastaMs: 5600 },
    ],
    graficos: [
      // Arranca en "antes de arrancar" y llega al 2 justo cuando dice
      // "Dos minutos": el remate se ve y se oye a la vez.
      { tipo: "contador", de: 60, a: 2, unidad: "minutos", eyebrow: "antes / ahora", desdeMs: 10200, hastaMs: 12000 },
    ],
  },
  {
    id: "R4-torneo",
    titulo: "Un torneo de 32 parejas",
    plano: null, // → "plano/R4-torneo.mp4" · en el club, con la pista detrás
    // 386 caracteres a ~13,8 por segundo. Los 40s del guion eran de más: el
    // texto se dice en 28 y estirarlo solo habría metido silencios.
    duracionMs: 28000,
    frases: [
      { texto: "Así se monta" },
      { texto: "un torneo de pádel" },
      { texto: "de treinta y dos" },
      { texto: "parejas.", enfasis: "parejas." },

      { texto: "Eliges el formato:" },
      { texto: "fase de grupos" },
      { texto: "y eliminatoria," },
      { texto: "con cuadro" },
      { texto: "de consolación" },
      { texto: "para que nadie" },
      { texto: "se vuelva a casa" },
      { texto: "después de perder" },
      { texto: "un partido." },

      { texto: "Generas los cuadros," },
      { texto: "y la app reparte" },
      { texto: "los partidos" },
      { texto: "pista por pista," },
      { texto: "con su horario." },

      { texto: "Los jugadores se inscriben" },
      { texto: "con un código" },
      { texto: "desde el móvil" },
      { texto: "y pagan por la web." },

      { texto: "Si tu club sigue" },
      { texto: "haciendo esto con un Excel," , enfasis: "Excel," },
      { texto: "hablamos." },
    ],
    cobertura: [
      { src: null, nota: "cobertura/A3-torneo.mp4", desdeMs: 3900, hastaMs: 13300 },
      { src: null, nota: "cobertura/A3-torneo.mp4", desdeMs: 14700, hastaMs: 19000, offsetMs: 12000 },
      { src: null, nota: "cobertura/A4-inscripcion.mp4", desdeMs: 19000, hastaMs: 23200 },
    ],
    graficos: [
      // Los tres ticks NO van a paso fijo: cada uno cae sobre la palabra que le
      // toca, y entre el primero y el tercero hay once segundos y medio.
      {
        tipo: "ticks",
        items: [
          { texto: "Fase de grupos", enMs: 250 },
          { texto: "Cuadro de consolación", enMs: 3100 },
          { texto: "Horarios pista a pista", enMs: 11800 },
        ],
        desdeMs: 5000,
        hastaMs: 19000,
      },
      // Bisagra entre lo que hace la app y el remate a cámara. Tapa el plano a
      // propósito: es un corte de marca, no una transición de efecto.
      { tipo: "cortinilla", cifra: "32 parejas", pie: "inscritas y cobradas", desdeMs: 23200, hastaMs: 24300 },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TUTORIALES · gancho a cámara + la app enseñándose a la vez.
  // `layout: "tutorial"` reparte el lienzo: tu cara arriba, la pantalla debajo.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "T1-alineacion",
    titulo: "Montar una alineación",
    layout: "tutorial",
    plano: null, // → "plano/T1-alineacion.mp4" · encuadra la cara CENTRADA: se recorta a una banda
    duracionMs: 22000,
    frases: [
      // 0-3s · el gancho, antes de que empiece el tutorial
      { texto: "Montar la alineación" },
      { texto: "de una jornada," },
      { texto: "en veinte segundos.", enfasis: "veinte segundos." },

      // el tutorial, paso a paso
      { texto: "Abres la jornada." },
      { texto: "Aquí ves quién puede" },
      { texto: "jugar el sábado" },
      { texto: "y quién no." },
      { texto: "Le das a auto-orden" },
      { texto: "y te coloca las parejas" },
      { texto: "por puntos." },
      { texto: "Si una queda mal," },
      { texto: "te lo dice en rojo." },
      { texto: "Compruebas, y publicas." },
      { texto: "Se enteran todos a la vez." },
    ],
    cobertura: [
      // En tutorial la pantalla está SIEMPRE: no tapa tu cara, convive con ella.
      { src: null, nota: "cobertura/A1-alineacion.mp4", desdeMs: 0, hastaMs: 22000 },
    ],
    graficos: [
      // El resalte va en coordenadas del LIENZO, así que en tutorial hay que
      // contar con que la pantalla ocupa de 34% para abajo.
      {
        tipo: "resalte",
        zona: { x: 12, y: 58, w: 76, h: 10 },
        etiqueta: "AVISO EN ROJO",
        desdeMs: 15500,
        hastaMs: 18000,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// `ticks` y `cortinilla` no se usan en las tres piezas A: ahí no hay nada que
// enumerar ni dos ideas que separar, y la regla del sistema dice que un gráfico
// que se puede quitar sin perder información sobra. Su sitio es el R4, donde el
// guion sí enumera tres cosas y sí tiene una bisagra antes del remate.
// ─────────────────────────────────────────────────────────────────────────────
