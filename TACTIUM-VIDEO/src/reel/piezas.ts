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
  | {
      /** Pantalla de la app dentro de un móvil, flotando sobre tu plano. */
      tipo: "mockup";
      src: string;
      lado?: "izq" | "der";
    }
);

/**
 * Cómo conviven tu plano y la pantalla de la app:
 *
 *  - `alterna`  — por defecto. La cobertura TAPA el plano por tramos. Para
 *                 piezas de mensaje, donde la pantalla es una prueba puntual.
 *  - `tutorial` — los dos a la vez: tu cara en la banda de arriba y la app
 *                 debajo. Para enseñar cómo se hace algo mientras lo cuentas.
 *  - `motion`   — tu cara arriba y un panel de marca debajo donde ocurren los
 *                 gráficos. El motion ES el contenido, no una ilustración.
 *  - `pip`      — la app a pantalla completa y tu cara en un recuadro. Cuando
 *                 el detalle de la pantalla manda sobre la cara.
 */
export type Layout = "alterna" | "tutorial" | "motion" | "pip";

export type Pieza = {
  id: string;
  titulo: string;
  layout?: Layout;
  /** Tú a cámara. `null` mientras no esté rodado: sale el marcador de encuadre. */
  plano: string | null;
  /**
   * Segundo del plano por el que entra la pieza. Permite sacar varias piezas
   * de una misma grabación sin volver a cortar el archivo con ffmpeg.
   * Los tiempos de `frases` y `graficos` siguen contando desde 0 de la PIEZA,
   * no del plano original.
   */
  planoDesdeMs?: number;
  /**
   * Punch-in: escala del plano de principio a fin. Un plano fijo de más de
   * tres segundos deja de retener; el empuje lento lo sostiene sin cortar.
   * `[1, 1]` lo desactiva. Por defecto `[1, 1.07]`.
   */
  zoom?: [number, number];
  /**
   * Rótulo de apertura, a pantalla completa sobre el plano. No sustituye al
   * subtítulo: es la promesa que hace que alguien deje de hacer scroll, y por
   * eso va más grande y dura menos.
   */
  gancho?: { texto: string; enfasis?: string; hastaMs: number };
  duracionMs: number;
  frases: Frase[];
  cobertura: Cobertura[];
  graficos?: Grafico[];
};

/**
 * Saca una pieza corta de otra ya rodada, recortando por tiempo.
 *
 * Una pieza de 35 segundos que enumera tres bloques no es un reel: es un vídeo
 * de producto. Quien entra por «alineaciones» se come veinte segundos de
 * torneos que no le interesan. Partirla multiplica el alcance sin volver a
 * rodar, porque cada trozo persigue a una persona distinta.
 *
 * No recorta el archivo: usa `planoDesdeMs`, así que el mp4 del plano sigue
 * siendo uno solo. Los tiempos de frases, coberturas y gráficos se desplazan
 * solos, y lo que se queda a caballo del corte se recorta al borde.
 */
const derivar = (
  base: Pieza,
  corte: {
    id: string;
    titulo: string;
    desdeMs: number;
    hastaMs: number;
    gancho?: Pieza["gancho"];
  },
): Pieza => {
  const { id, titulo, desdeMs, hastaMs, gancho } = corte;
  const largo = hastaMs - desdeMs;
  const pisa = (a: number, b: number) => b > desdeMs && a < hastaMs;
  const mueve = (a: number, b: number) => ({
    desdeMs: Math.max(0, a - desdeMs),
    hastaMs: Math.min(largo, b - desdeMs),
  });

  return {
    ...base,
    id,
    titulo,
    gancho,
    planoDesdeMs: (base.planoDesdeMs ?? 0) + desdeMs,
    duracionMs: largo,
    frases: base.frases
      .filter((f) => f.desdeMs !== undefined && f.hastaMs !== undefined && pisa(f.desdeMs, f.hastaMs))
      .map((f) => ({ ...f, ...mueve(f.desdeMs as number, f.hastaMs as number) })),
    cobertura: base.cobertura
      .filter((c) => pisa(c.desdeMs, c.hastaMs))
      .map((c) => ({ ...c, ...mueve(c.desdeMs, c.hastaMs) })),
    graficos: (base.graficos ?? [])
      .filter((g) => pisa(g.desdeMs, g.hastaMs))
      .map((g) => ({ ...g, ...mueve(g.desdeMs, g.hastaMs) })),
  };
};

const BASE: Pieza[] = [
  // ───────────────────────────────────────────────────────────────────────────
  // LA PRIMERA QUE SE PUBLICA. Vuelta de temporada + repaso de los tres
  // bloques por los que alguien paga: su equipo, sus torneos, su federación.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "V1-vuelta",
    titulo: "Se acabó el verano",
    // Plano completo: los rótulos y los mockups van ENCIMA de ti, no en una
    // mitad negra. Se ve más producto y se te ve a ti todo el rato.
    layout: "alterna",
    // Los 6 trozos ya cortados por el silencio, recortados a plano medio y
    // pegados: `bash /tmp/montar.sh` en el historial. 34,60s de habla real.
    plano: "plano/V1-vuelta.mp4",
    duracionMs: 34870,
    // Las mismas palabras que ya decía la primera frase, pero a tamaño de
    // gancho y sin panel debajo: durante 1,4s sólo estás tú y la promesa.
    gancho: { texto: "Se acabó el verano.", hastaMs: 1370 },
    frases: [
      // trozo 1
      { texto: "Se acabó el verano.", desdeMs: 0, hastaMs: 1370 },
      { texto: "Vuelve la liga.", desdeMs: 1370, hastaMs: 2353, enfasis: "Vuelve la liga." },
      { texto: "Y yo no he parado.", desdeMs: 2353, hastaMs: 3711 },

      // trozo 2
      { texto: "Tres meses.", desdeMs: 3711, hastaMs: 4533 },
      { texto: "Muchos cambios", desdeMs: 4533, hastaMs: 5672 },
      { texto: "en la app.", desdeMs: 5672, hastaMs: 6464 },

      // trozo 3
      { texto: "Tu equipo:", desdeMs: 6464, hastaMs: 7479 },
      { texto: "quién puede jugar,", desdeMs: 7479, hastaMs: 8847 },
      { texto: "la alineación según", desdeMs: 8847, hastaMs: 10094 },
      { texto: "la normativa de tu federación,", desdeMs: 10094, hastaMs: 12275 },
      { texto: "y la temporada", desdeMs: 12275, hastaMs: 13266 },
      { texto: "entera registrada.", desdeMs: 13266, hastaMs: 15067 },

      // trozo 4
      { texto: "Torneos: grupos,", desdeMs: 15067, hastaMs: 15932 },
      { texto: "eliminatoria", desdeMs: 15932, hastaMs: 16799 },
      { texto: "y consolación,", desdeMs: 16799, hastaMs: 17975 },
      { texto: "con horarios pista a pista.", desdeMs: 17975, hastaMs: 19876 },
      { texto: "Se inscriben con un código", desdeMs: 19876, hastaMs: 21967 },
      { texto: "y pagan por la web.", desdeMs: 21967, hastaMs: 23297 },

      // trozo 5
      { texto: "Y la Federación Cántabra", desdeMs: 23297, hastaMs: 25654 },
      { texto: "dentro de la app:", desdeMs: 25654, hastaMs: 26833 },
      { texto: "tus puntos,", desdeMs: 26833, hastaMs: 27715 },
      { texto: "las clasificaciones", desdeMs: 27715, hastaMs: 29099 },
      { texto: "y los cuadros.", desdeMs: 29099, hastaMs: 30156 },
      { texto: "Sin buscarte en un PDF.", desdeMs: 30156, hastaMs: 31633 },

      // trozo 6
      { texto: "La temporada 2026/2027", desdeMs: 31633, hastaMs: 33153 },
      { texto: "ya está cargada.", desdeMs: 33153, hastaMs: 34335 },
      { texto: "Empezamos.", desdeMs: 34335, hastaMs: 34876, enfasis: "Empezamos." },
    ],
    // Sin cobertura: en `motion` el panel de abajo lo llenan los gráficos, no
    // capturas. Así la pieza se publica sin esperar a grabar pantallas.
    cobertura: [],
    graficos: [
      // Bloque 2 · el dato
      { tipo: "numero", valor: 300, eyebrow: "cambios", desdeMs: 4300, hastaMs: 7000 },

      // Bloque 3 · tu equipo — aquí sí hay captura real, así que en vez de
      // enumerar se enseña: el móvil entra por la derecha con la alineación.
      { tipo: "mockup", src: "img/alineacion.jpg", lado: "der", desdeMs: 7400, hastaMs: 14900 },

      // Bloque 4 · torneos
      {
        tipo: "ticks",
        items: [
          { texto: "Grupos y cuadro", enMs: 200 },
          { texto: "Consolación", enMs: 1700 },
          { texto: "Horarios por pista", enMs: 3400 },
          { texto: "Inscripción y cobro", enMs: 5600 },
        ],
        desdeMs: 14200, hastaMs: 21600,
      },

      // Bloque 5 · federación
      {
        tipo: "ticks",
        items: [
          { texto: "Tus puntos", enMs: 200 },
          { texto: "Clasificaciones", enMs: 2100 },
          { texto: "Cuadros de playoff", enMs: 3900 },
        ],
        desdeMs: 22000, hastaMs: 29800,
      },

      // Bloque 6 · el curso nuevo
      { tipo: "cortinilla", cifra: "2026/2027", pie: "ya está cargada", desdeMs: 30200, hastaMs: 33000 },
    ],
  },

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

// ─────────────────────────────────────────────────────────────────────────────
// Los tres cortes de V1
//
// V1 dura 35 segundos y enumera tres bloques: equipo, torneos y federación.
// Eso es un vídeo de producto, no un reel — quien entra buscando alineaciones
// aguanta veinte segundos hablando de torneos que no le interesan.
//
// Cada corte persigue a una persona distinta: el capitán, el club que organiza,
// y el jugador federado. Salen del mismo mp4 sin volver a rodar ni a cortar.
//
// PENDIENTE: los tres arrancan en frío, a media frase, porque el gancho de la
// grabación original está en los primeros seis segundos y allí se queda. Para
// publicarlos, lo suyo es grabar dos segundos de gancho propio para cada uno
// y montarlos delante — el campo `gancho` ya está listo para eso.
// ─────────────────────────────────────────────────────────────────────────────

/** La pieza larga de la que salen los tres cortes. */
const V1 = BASE[0];

export const PIEZAS: Pieza[] = [
  ...BASE,

  // El capitán que pierde la tarde montando la alineación.
  derivar(V1, {
    id: "V1a-equipo",
    titulo: "Tu equipo",
    desdeMs: 6464,
    hastaMs: 15067,
  }),

  // El club que organiza y cobra.
  derivar(V1, {
    id: "V1b-torneos",
    titulo: "Torneos",
    desdeMs: 15067,
    hastaMs: 23297,
  }),

  // El jugador federado que se busca en un PDF. Llega hasta el final de la
  // grabación a propósito: así se lleva el cierre de temporada, que es el
  // único de los tres remates que funciona solo.
  derivar(V1, {
    id: "V1c-federacion",
    titulo: "La Federación dentro de la app",
    desdeMs: 23297,
    hastaMs: 34870,
  }),
];
