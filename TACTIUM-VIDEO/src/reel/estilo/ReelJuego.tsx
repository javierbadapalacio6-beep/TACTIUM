// Reels de juego (16:9): clips reales de Javier jugando + estilo cinético, sin voz.
//
// Cada reel es un bloque de datos (REELS_JUEGO): música con su tempo, el segundo en
// que entra y las escenas medidas en PULSOS. Así cada corte cae en un pulso y el
// golpe fuerte (cámara lenta) entra con la subida de la canción. El componente no se
// toca para montar uno nuevo: se añade otro bloque y su composición sale sola en Root.
//
// Clips: public/broll/juego-NN.mp4 (los convierte scripts/convertir-juego.mjs y los
// apunta en public/broll/juego.json). Los horizontales llenan el cuadro; los
// verticales van en una columna al lado contrario del texto.
import React from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { CIERRE_MS, Cierre } from "../Reel";
import type { Palabra } from "../Karaoke";
import { AnimacionTexto, Efecto, Fondo, Lista, RiserGancho, TINTE_MARCA, TextoCinetico, WhooshCortes, esWhoosh, type AnimTexto, type IconoDe } from "./Cinetico";

/** Texto con tiempos a mano (no hay voz). Los tiempos van en PULSOS desde el inicio de la escena. */
const txt = (...ps: [string, number][]): Palabra[] => ps.map(([t, p]) => ({ t, a: p, b: p + 0.6 }));
/** Igual, pero con los tiempos en ms reales (de la voz en off) → pulsos. */
const txtMs = (bpm: number, ...ps: [string, number][]): Palabra[] => txt(...ps.map(([t, m]) => [t, m / (60000 / bpm)] as [string, number]));

type Escena = {
  /** Lo que dura la escena, en pulsos de la música. `desde`/`hasta` se calculan solos. */
  pulsos: number;
  desde?: number;
  hasta?: number;
  /** Cómo entra la escena (varía de un reel a otro): `flash` (destello claro de 5
   *  fotogramas), `barrido` (entra deslizando y desenfocada) o `zoom` (golpe de zoom). */
  entrada?: "flash" | "barrido" | "zoom" | "subida";
  /** `vertical`: clip 9:16, en columna redondeada al lado contrario del texto. */
  /** `zoom`: acerca el clip hacia `origen` (CSS transform-origin), para que la acción no
   *  quede diminuta o para sacar del cuadro algo que no debe verse (marcas de agua). */
  clip?: {
    src: string; desdeS: number; velocidad?: number; vertical?: boolean; zoom?: number; origen?: string;
    /** Solo 9:16 · clip horizontal que sigue al jugador: [segundo del clip, posición x %] (object-position). */
    paneo?: [number, number][];
    /** Solo 9:16 · el clip empieza a esta altura (px) y deja arriba una franja limpia para el texto. */
    techo?: number;
    /** Solo 9:16 · punch-in: el zoom crece de `zoom` a `zoom × punch` a lo largo de la escena. */
    punch?: number;
  };
  /** Solo 9:16 · objeto héroe: el marcador de 5 parejas (3 ganan, 2 pierden: un 3-2).
   *  `llenar`: las filas entran una a una · `extremos`: laten la pareja 1 y la 5, el resto se apaga.
   *  Si la escena lleva `clip`, el clip va de fondo, desenfocado y oscuro. */
  grafico?: { tipo: "marcador"; modo: "llenar" | "extremos"; /** `extremos`: pulso en que se enciende la pareja 5 y la 1. */ focoP?: [number, number] };
  fondo?: "oscuro" | "claro";
  texto?: {
    ws: Palabra[];
    claves: string[];
    serif?: string[];
    /** Lista que se acumula, con su rótulo encima. */
    lista?: string;
    centro?: boolean;
    lado?: "izq" | "der";
    iconos?: Record<string, IconoDe>;
  };
  sfx?: string;
  /** Tramo [desdeMs, hastaMs] de la nota de voz del reel que suena al empezar esta escena. */
  voz?: [number, number];
  /** Efecto de los packs al entrar en la escena: `glitch` (entrada a tarjetas, en verde)
   *  o `quemado` (quemado de película, para la subida de la música). */
  efecto?: "glitch" | "quemado";
};

export type ReelDeJuego = {
  id: string;
  /** Además del 16:9, sale una versión 9:16 (`<id>-vertical`): para reels de solo clips verticales. */
  vertical?: boolean;
  /** Solo existe en 9:16 (no se registra la composición 16:9). */
  soloVertical?: boolean;
  /** Texto en la zona segura estricta de la casa (x 80-910) en lugar de los márgenes del token. */
  zonaEstricta?: boolean;
  /** Tamaño del texto en 9:16 (1 = el de siempre). Sin voz, el texto tiene que leerse a la primera. */
  escalaTexto?: number;
  idea: string;
  /** Animación del texto de este reel (cada reel la suya, para no repetir la serie). */
  animTexto: AnimTexto;
  bpm: number;
  /** `subidaMs`: segundo de la canción en que entra la parte fuerte. Cae en la escena con
   *  `efecto: "quemado"` (el golpe); la música arranca lo que haga falta antes. */
  musica: { src: string; subidaMs: number; /** Volumen de la música (por defecto 0,85, pensado para ir bajo la voz). */ volumen?: number };
  /** Voz en off (nota de voz de Javier, public/voz/…): cada escena dice qué tramo suena. */
  voz?: string;
  escenas: Escena[];
};

/**
 * Cierre de la serie: dos golpes de texto, cada uno con TIEMPO para leerse (feedback del
 * 29-09-2026: «tu equipo, organizado» y «tú, a jugar» pasaban demasiado rápido).
 * La entrada y el efecto cambian con cada reel.
 */
const CIERRE_SERIE = (v: Partial<Pick<Escena, "efecto" | "entrada" | "voz" | "pulsos">>, ws?: Palabra[]): Escena => ({
  fondo: "oscuro", sfx: "sfx/whoosh-3.mp3", ...v, pulsos: v.pulsos ?? 9,
  texto: { ws: ws ?? txt(["tu", 0.2], ["equipo,", 0.45], ["organizado.", 0.8], ["tú, a", 4.6], ["jugar", 5.1]), claves: ["organizado", "jugar"], serif: ["jugar"], centro: true },
});

export const REELS_JUEGO: ReelDeJuego[] = [
  {
    id: "juego-01",
    idea: "Lo que se ve (el partido) y lo que no (mensajes, bajas, la alineación): eso ya lo hace TACTIUM. Con voz en off de Javier.",
    // Receta: texto desenfocado + glitch al entrar en tarjetas + quemado en el golpe.
    animTexto: "desenfoque",
    bpm: 129.2,
    musica: { src: "musica/pixabay-charming-phonk.mp3", subidaMs: 16720 },
    // Nota de voz (30-09). Los textos van a los tiempos reales de cada frase (ms → pulsos).
    voz: "voz/J1.mp3",
    escenas: [
      { pulsos: 7, clip: { src: "broll/juego-06.mp4", desdeS: 0 }, voz: [560, 3500],
        texto: { ws: txtMs(129.2, ["esto", 100], ["es", 840], ["lo", 1380], ["que", 1560], ["se", 1680], ["ve", 1820], ["de", 2000], ["un partido", 2280]), claves: ["un partido"], lado: "der", iconos: { "un partido": "pelota" } } },
      { pulsos: 12, fondo: "oscuro", sfx: "sfx/whoosh-1.mp3", efecto: "glitch", voz: [3840, 8900],
        texto: { ws: txtMs(129.2, ["84 mensajes", 1500], ["3 bajas", 3120], ["la alineación", 4300]), claves: ["84 mensajes", "3 bajas", "la alineación"], serif: ["la alineación"], lista: "lo que no se ve:" } },
      { pulsos: 6, fondo: "claro", sfx: "sfx/swoosh.wav", voz: [9480, 11500],
        texto: { ws: txtMs(129.2, ["eso", 100], ["ya", 440], ["lo", 1160], ["hace", 1260], ["TACTIUM", 1400]), claves: ["tactium"], centro: true } },
      { pulsos: 6, clip: { src: "broll/juego-02.mp4", desdeS: 1.25, velocidad: 0.5 }, sfx: "sfx/basshit.wav", efecto: "quemado" },
      { pulsos: 4, clip: { src: "broll/juego-07.mp4", desdeS: 0.2 } },
      { pulsos: 3, clip: { src: "broll/juego-01.mp4", desdeS: 0.35 } },
      { pulsos: 2, clip: { src: "broll/juego-05.mp4", desdeS: 2.45 } },
      CIERRE_SERIE({ efecto: "glitch", pulsos: 10, voz: [12040, 16100] },
        txtMs(129.2, ["tu", 100], ["equipo,", 380], ["organizado.", 1200], ["tú, a", 2640], ["jugar", 3420])),
    ],
  },
  {
    id: "juego-02",
    vertical: true,
    idea: "Del grupo de WhatsApp a las once menos cuarto a la pista: la alineación en 2 minutos y el capitán también juega. Clips verticales, voz en off de Javier.",
    // Receta distinta: texto que sube por máscara + destellos al entrar en tarjetas +
    // barridos y golpes de zoom entre jugadas + quemado solo en el remate. Sin glitch.
    animTexto: "mascara",
    bpm: 117.5,
    musica: { src: "musica/pixabay-music-promotion.mp3", subidaMs: 16340 },
    voz: "voz/J2.mp3",
    escenas: [
      // El grupo echando humo, visto desde tus ojos. Zoom para sacar del cuadro la marca
      // de agua de la app de edición (arriba a la izquierda).
      { pulsos: 8, clip: { src: "broll/juego-27.mp4", desdeS: 0, vertical: true, zoom: 1.2, origen: "85% 100%" }, voz: [240, 3300],
        texto: { ws: txtMs(117.5, ["11", 100], ["menos", 680], ["cuarto", 920], ["de", 1240], ["la", 1440], ["noche.", 1540], ["el", 2060], ["grupo,", 2300], ["ardiendo", 2600]), claves: ["noche", "ardiendo"], serif: ["ardiendo"], lado: "der" } },
      { pulsos: 7, fondo: "claro", sfx: "sfx/swoosh.wav", entrada: "flash", voz: [4140, 7000],
        texto: { ws: txtMs(117.5, ["TACTIUM,", 100], ["la", 1240], ["alineación", 1320], ["en", 1780], ["2 minutos", 2180]), claves: ["2 minutos"], centro: true, iconos: { "2 minutos": "crono" } } },
      // Llegas a la pista (se acerca a cámara).
      { pulsos: 4, clip: { src: "broll/juego-16.mp4", desdeS: 0, vertical: true }, sfx: "sfx/whoosh-1.mp3", entrada: "barrido", voz: [7380, 9000],
        texto: { ws: txtMs(117.5, ["y", 100], ["el", 160], ["martes,", 240], ["a la pista", 780]), claves: ["a la pista"], lado: "der", iconos: { "a la pista": "pala" } } },
      // Las jugadas también llevan texto: sin él, el 16:9 se queda vacío (la columna sola).
      { pulsos: 5, clip: { src: "broll/juego-11.mp4", desdeS: 4.85, velocidad: 0.5, vertical: true, zoom: 1.6, origen: "55% 58%" }, sfx: "sfx/basshit.wav", efecto: "quemado", voz: [9840, 11200],
        texto: { ws: txtMs(117.5, ["cada", 100], ["punto", 440], ["cuenta", 720]), claves: ["cuenta"], serif: ["cuenta"], lado: "der" } },
      { pulsos: 4, clip: { src: "broll/juego-18.mp4", desdeS: 12.5, vertical: true }, entrada: "zoom", voz: [11420, 12900],
        texto: { ws: txtMs(117.5, ["el", 100], ["resultado,", 180], ["registrado", 620]), claves: ["registrado"], lado: "der", iconos: { registrado: "check" } } },
      // Sin texto: en los reels con voz en off, todo lo escrito se dice y lo que no se dice no
      // se escribe (Javier, 30-09). «Tu nivel, al día» no estaba grabado.
      { pulsos: 3, clip: { src: "broll/juego-25.mp4", desdeS: 10.5, vertical: true, zoom: 1.4, origen: "60% 62%" }, entrada: "barrido" },
      { pulsos: 4, clip: { src: "broll/juego-20.mp4", desdeS: 2.2, vertical: true }, entrada: "zoom", voz: [13720, 15400],
        texto: { ws: txtMs(117.5, ["el", 100], ["capitán", 240], ["también", 760], ["juega", 1100]), claves: ["juega"], serif: ["juega"], lado: "der" } },
      CIERRE_SERIE({ entrada: "flash", voz: [15800, 19100] },
        txtMs(117.5, ["tu", 100], ["equipo,", 200], ["organizado.", 540], ["tú, a", 1880], ["jugar", 2560])),
    ],
  },
  {
    // E1 «Tres a dos» (parrilla 12-18 oct, GUIONES-REELS.md). Sin voz: todo va escrito.
    // Datos reales (fcp_partidos, liga 28074, consultados el 11-10): 1.481 encuentros
    // masculinos jugados, 588 acabaron 3-2 o 2-3. No hay ningún otro dato en la pieza.
    id: "E1-tres-a-dos",
    vertical: true,
    soloVertical: true,
    zonaEstricta: true,
    escalaTexto: 1.35,
    idea: "4 de cada 10 encuentros de la Liga Cántabra masculina acabaron 3-2: el punto de la pareja 5 vale lo mismo que el de la 1. Clips nuevos, sin voz.",
    // Receta distinta a J1 y J2: texto tecleado (máquina) + entradas que suben + paneo que
    // sigue al jugador en un clip horizontal + objeto héroe (el marcador de 5 parejas) sobre
    // el clip desenfocado + un solo quemado en el remate + punch-in al final. Sin glitch ni flash.
    animTexto: "maquina",
    bpm: 93.5,
    // Vlog Hip-Hop (Pixabay, licencia verificada en LICENCIAS.md), ~93,5 BPM. A los 64,55 s
    // vuelve la base tras el puente: la música ARRANCA ahí (primer golpe en el fotograma 1, nunca
    // en silencio; el puente a 0,2 se quedaba en -45 dB bajo el dato). `subidaMs` = 64,55 s +
    // 10,5 pulsos, para que el remate (quemado) caiga en un tiempo de la base.
    musica: { src: "musica/pixabay-vlog-hip-hop.mp3", subidaMs: 64550 + Math.round(10.5 * (60000 / 93.5)), volumen: 0.2 },
    escenas: [
      // Gancho: ya en el fotograma 1 hay jugador en movimiento (cámara lenta, 60 fps) y el
      // texto entero (tiempos negativos = ya escrito). El clip baja a y=640 para dejar la
      // franja de arriba al texto y el paneo sigue al jugador hasta el golpe (~2,9 s del clip).
      { pulsos: 5, clip: { src: "broll/juego-04.mp4", desdeS: 2.0, velocidad: 0.5, techo: 640,
          paneo: [[2.0, 2], [2.1, 4], [2.35, 19], [2.6, 46], [2.85, 68], [3.1, 86], [3.6, 88]] },
        texto: { ws: txt(["4", -2], ["de", -2], ["cada", -2], ["10:", -2], ["3-2", -1.6]), claves: ["3-2"] } },
      // El dato, con el objeto héroe: las 5 parejas entran a corcheas (3 ganan, 2 pierden).
      { pulsos: 5.5, entrada: "subida", clip: { src: "broll/juego-14.mp4", desdeS: 3.2 }, grafico: { tipo: "marcador", modo: "llenar" },
        texto: { ws: txt(["4", 0], ["de", 0.04], ["cada", 0.08], ["10", 0.12], ["encuentros", 0.16], ["acabaron", 0.24], ["3-2:", 0.32], ["588 de 1.481", 0.45],
          ["Liga", 2.85], ["Cántabra", 2.9], ["masculina", 2.95], ["2026", 3.0]), claves: ["588 de 1.481"] } },
      // El remate, a cámara lenta, cuando vuelve la base de la música.
      { pulsos: 2.5, entrada: "zoom", efecto: "quemado", clip: { src: "broll/juego-19.mp4", desdeS: 8.55, velocidad: 0.5, zoom: 2, origen: "40% 54%" } },
      // Pareja 5 y pareja 1: se encienden cuando se nombran y laten igual.
      { pulsos: 6, entrada: "subida", clip: { src: "broll/juego-26.mp4", desdeS: 3.0 }, grafico: { tipo: "marcador", modo: "extremos", focoP: [0.5, 3.45] },
        texto: { ws: txt(["el", 0.1], ["punto", 0.15], ["de", 0.2], ["la", 0.25], ["pareja 5", 0.5],
          ["vale", 2.9], ["lo", 2.95], ["mismo", 3.0], ["que", 3.05], ["el", 3.1], ["de", 3.15], ["la", 3.2], ["pareja 1", 3.45]), claves: ["pareja 5", "pareja 1"] } },
      // Cierre con bucle: vuelve el 3-2 del gancho, con punch-in sobre la volea.
      { pulsos: 4, clip: { src: "broll/juego-23.mp4", desdeS: 5.0, velocidad: 0.5, zoom: 1.12, punch: 1.22, origen: "52% 56%" },
        texto: { ws: txt(["piensa", 0.1], ["quién", 0.2], ["te", 0.3], ["cierra", 0.35], ["el", 0.45], ["3-2", 0.8]), claves: ["3-2"] } },
    ],
  },
];

/** Coloca las escenas una tras otra y arranca la música para que la subida caiga en el golpe. */
const colocar = (r: ReelDeJuego) => {
  let t = 0;
  const escenas = r.escenas.map((e) => {
    const x = { ...e, desde: t, hasta: t + e.pulsos };
    t += e.pulsos;
    return x as Escena & { desde: number; hasta: number };
  });
  const pulso = 60000 / r.bpm;
  const golpe = escenas.find((e) => e.efecto === "quemado");
  const desdeMs = Math.max(0, Math.round(r.musica.subidaMs - (golpe ? golpe.desde * pulso : 0)));
  return { escenas, pulso, desdeMs };
};

export const durJuego = (r: ReelDeJuego) => Math.round(r.escenas.reduce((a, e) => a + e.pulsos, 0) * (60000 / r.bpm));

/** Clip vertical en columna: alto completo, 9:16 sin recorte, al lado contrario del texto. */
const ColumnaVertical: React.FC<{ e: Escena }> = ({ e }) => {
  const M = 72;
  const h = 1080 - M * 2;
  const w = Math.round((h * 9) / 16);
  // Sin texto: centrada. Con texto a la derecha: columna a la izquierda, y al revés.
  const left = !e.texto ? (1920 - w) / 2 : e.texto.lado === "der" ? 260 : 1920 - 260 - w;
  return (
    <div style={{ position: "absolute", left, top: M, width: w, height: h, borderRadius: 28, overflow: "hidden", boxShadow: `0 0 0 2px ${T.color.hair}, 0 40px 90px -30px rgba(0,0,0,0.7)` }}>
      <OffthreadVideo
        src={staticFile(e.clip!.src)}
        trimBefore={Math.round(e.clip!.desdeS * T.canvas.fps)}
        playbackRate={e.clip!.velocidad ?? 1}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip!.zoom ?? 1})`, transformOrigin: e.clip!.origen ?? "center" }}
      />
    </div>
  );
};

/**
 * La escena en 9:16: el clip llena el lienzo, el texto arriba (debajo de la zona segura
 * superior) con una sombra que baja desde el borde, y las tarjetas igual que en el 16:9.
 */
/** Zona segura estricta de la casa para el texto en 9:16 (x 80-910). */
const ESTRICTA = { izq: 80, ancho: 830 };

/** El clip en 9:16: con zoom, punch-in, paneo (clips horizontales) y techo (franja libre arriba). */
const ClipVertical: React.FC<{ c: NonNullable<Escena["clip"]>; durMs: number; fondo?: boolean }> = ({ c, durMs, fondo }) => {
  const frame = useCurrentFrame();
  const fuenteS = c.desdeS + (frame / T.canvas.fps) * (c.velocidad ?? 1);
  const x = c.paneo
    ? interpolate(fuenteS, c.paneo.map((p) => p[0]), c.paneo.map((p) => p[1]), { easing: Easing.inOut(Easing.sin), extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 50;
  const z = (c.zoom ?? 1) * (c.punch ? interpolate(frame, [0, ms(durMs)], [1, c.punch], { easing: Easing.out(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1);
  const techo = c.techo ?? 0;
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, top: techo, bottom: 0, overflow: "hidden",
        // El borde de arriba se funde con el lienzo (sin línea dura bajo el texto).
        WebkitMaskImage: techo ? "linear-gradient(180deg, transparent 0px, black 90px)" : undefined,
        maskImage: techo ? "linear-gradient(180deg, transparent 0px, black 90px)" : undefined,
      }}
    >
      <OffthreadVideo
        src={staticFile(c.src)}
        trimBefore={Math.round(c.desdeS * T.canvas.fps)}
        playbackRate={c.velocidad ?? 1}
        muted
        style={{
          width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% 50%`,
          transform: `scale(${fondo ? 1.12 : z})`, transformOrigin: c.origen ?? "center",
          filter: fondo ? "blur(22px) brightness(0.42) saturate(0.8)" : undefined,
        }}
      />
    </div>
  );
};

/** Una palomita (gana) o una raya (pierde), dibujadas: nada de emojis. */
const Resultado: React.FC<{ gana: boolean; t: number; lado: number }> = ({ gana, t, lado }) => (
  <div
    style={{
      width: lado, height: lado, borderRadius: "50%", flex: "none",
      background: gana ? T.color.accent : "transparent",
      boxShadow: gana ? "none" : "inset 0 0 0 4px rgba(232,245,239,0.35)",
      transform: `scale(${0.4 + 0.6 * t})`, opacity: t,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
  >
    <svg width={lado * 0.5} height={lado * 0.5} viewBox="0 0 24 24" fill="none" stroke={gana ? T.color.bg : "rgba(232,245,239,0.55)"} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
      {gana ? <path d="M4.5 12.5l5 5L19.5 7" /> : <path d="M6 12h12" />}
    </svg>
  </div>
);

/**
 * Objeto héroe de E1: el marcador de un encuentro de liga, 5 parejas, un 3-2 (ganan la 1, la 3
 * y la 5; es una ilustración, no un encuentro real). Vive en la mitad de abajo de la zona segura.
 */
const GANAN = [true, false, true, false, true];
const Marcador: React.FC<{ g: NonNullable<Escena["grafico"]>; pulso: number; izq: number; ancho: number }> = ({ g, pulso, izq, ancho }) => {
  const frame = useCurrentFrame();
  const now = (frame / T.canvas.fps) * 1000;
  const alto = 112;
  const hueco = 20;
  const suave = Easing.bezier(0.25, 1, 0.5, 1);
  return (
    <div style={{ position: "absolute", left: izq, width: ancho, top: 830, display: "flex", flexDirection: "column", gap: hueco }}>
      {GANAN.map((gana, i) => {
        const n = i + 1;
        let entra = 1;
        let chip = 1;
        let apagada = 0;
        let foco = 0;
        let late = 0;
        if (g.modo === "llenar") {
          const a = (0.5 + i * 0.5) * pulso;
          entra = interpolate(now, [a - 40, a + 220], [0, 1], { easing: suave, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          chip = interpolate(now, [a + 120, a + 320], [0, 1], { easing: Easing.out(Easing.back(2)), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        } else {
          const [p5, p1] = g.focoP ?? [0.5, 3.5];
          const encendida = n === 5 ? p5 * pulso : n === 1 ? p1 * pulso : null;
          apagada = interpolate(now, [0, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (encendida !== null) {
            foco = interpolate(now, [encendida - 60, encendida + 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            // Late en cada pulso desde que se nombra (las dos al mismo compás, mismo tamaño).
            const fase = ((now - encendida) % pulso + pulso) % pulso;
            late = now >= encendida ? Math.exp(-fase / 140) : 0;
          }
        }
        const enFoco = g.modo === "extremos" && (n === 1 || n === 5);
        const opacidad = g.modo === "llenar" ? entra : enFoco ? 0.55 + 0.45 * foco : 1 - 0.7 * apagada;
        return (
          <div
            key={n}
            style={{
              height: alto, borderRadius: 26, padding: "0 30px 0 36px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: `rgba(${enFoco && foco > 0 ? "0,223,130" : "232,245,239"},${enFoco ? 0.06 + 0.1 * foco : 0.07})`,
              boxShadow: `inset 0 0 0 ${enFoco ? 2 + 2 * foco : 2}px ${enFoco && foco > 0 ? `rgba(0,223,130,${0.35 + 0.65 * foco})` : "rgba(232,245,239,0.14)"}`,
              backdropFilter: "blur(6px)",
              opacity: opacidad,
              transform: `translateX(${(1 - entra) * -60}px) scale(${1 + 0.035 * late})`,
            }}
          >
            <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 50, letterSpacing: "-0.02em", color: T.color.ink, textTransform: "uppercase" }}>
              <span style={{ fontWeight: 500, fontSize: 34, letterSpacing: "0.06em", color: "rgba(232,245,239,0.7)", marginRight: 18 }}>PAREJA</span>
              {n}
            </div>
            <Resultado gana={gana} t={chip} lado={72} />
          </div>
        );
      })}
    </div>
  );
};

const EscenaVertical: React.FC<{ e: Escena; ws: Palabra[]; dur: number; pulso: number; estricta?: boolean; escala?: number }> = ({ e, ws, dur, pulso, estricta, escala = 1 }) => {
  const tono = e.fondo === "claro" ? "claro" : "oscuro";
  const izq = estricta ? ESTRICTA.izq : T.safe.sides;
  const ancho = estricta ? ESTRICTA.ancho : T.canvas.w - T.safe.sides * 2;
  const arriba = !!e.clip || !!e.grafico;
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {e.clip ? (
        <>
          {e.grafico || e.clip.paneo || e.clip.techo || e.clip.punch ? (
            <ClipVertical c={e.clip} durMs={dur} fondo={!!e.grafico} />
          ) : (
            <OffthreadVideo
              src={staticFile(e.clip.src)}
              trimBefore={Math.round(e.clip.desdeS * T.canvas.fps)}
              playbackRate={e.clip.velocidad ?? 1}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip.zoom ?? 1})`, transformOrigin: e.clip.origen ?? "center" }}
            />
          )}
          {e.texto && !e.grafico ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,15,15,0.92) 0%, rgba(3,15,15,0.7) 30%, rgba(3,15,15,0) 52%)" }} /> : null}
        </>
      ) : (
        <Fondo tono={tono} />
      )}
      {e.grafico ? <Marcador g={e.grafico} pulso={pulso} izq={izq} ancho={ancho} /> : null}
      {e.texto?.lista ? (
        <div style={{ position: "absolute", left: T.safe.sides, right: T.safe.sides, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 46, color: "rgba(232,245,239,0.78)", marginBottom: 18 }}>{e.texto.lista}</div>
          <Lista ws={ws} claves={e.texto.claves} serif={e.texto.serif} tono={tono} />
        </div>
      ) : e.texto ? (
        <AbsoluteFill
          style={{
            justifyContent: arriba ? "flex-start" : "center",
            alignItems: e.texto.centro ? "center" : "flex-start",
            paddingTop: arriba ? T.safe.top + 60 : 0,
            paddingLeft: e.texto.centro ? 0 : izq,
          }}
        >
          {/* Sobre el clip el techo de la pista es claro: sombra al texto (se hereda). */}
          <div style={{ textShadow: e.clip ? "0 4px 28px rgba(3,15,15,0.85), 0 1px 3px rgba(3,15,15,0.9)" : undefined }}>
            <TextoCinetico ws={ws} claves={e.texto.claves} serif={e.texto.serif} tono={tono} alinear={e.texto.centro ? "centro" : "izq"} ancho={ancho} finMs={dur} escala={escala} iconos={e.texto.iconos} />
          </div>
        </AbsoluteFill>
      ) : null}
      {e.sfx && !esWhoosh(e.sfx) ? <Audio src={staticFile(e.sfx)} volume={0.5} /> : null}
    </AbsoluteFill>
  );
};

/** La entrada de la escena: poca cosa y rápida (5-8 fotogramas). */
const Entrada: React.FC<{ tipo?: Escena["entrada"]; children: React.ReactNode }> = ({ tipo, children }) => {
  const frame = useCurrentFrame();
  if (!tipo) return <>{children}</>;
  if (tipo === "subida") {
    // Sube desde abajo con desenfoque de movimiento vertical (E1): 7 fotogramas.
    const s = interpolate(frame, [0, 7], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ transform: `translateY(${(1 - s) * 12}%)`, filter: `blur(${(1 - s) * 16}px)` }}>{children}</AbsoluteFill>;
  }
  const t = interpolate(frame, [0, tipo === "zoom" ? 8 : 6], [0, 1], { easing: Easing.bezier(0.25, 1, 0.5, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (tipo === "flash") {
    return (
      <AbsoluteFill>
        {children}
        <AbsoluteFill style={{ background: T.color.ink, opacity: interpolate(frame, [0, 5], [0.85, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />
      </AbsoluteFill>
    );
  }
  const estilo: React.CSSProperties =
    tipo === "barrido"
      ? { transform: `translateX(${(1 - t) * 14}%)`, filter: `blur(${(1 - t) * 18}px)` }
      : { transform: `scale(${1 + (1 - t) * 0.16})` };
  return <AbsoluteFill style={estilo}>{children}</AbsoluteFill>;
};

const EscenaJuego: React.FC<{ e: Escena & { desde: number; hasta: number }; pulso: number; vertical?: boolean; estricta?: boolean; escala?: number }> = ({ e, pulso, vertical, estricta, escala }) => {
  const dur = Math.round((e.hasta - e.desde) * pulso);
  const tono = e.fondo === "claro" ? "claro" : "oscuro";
  // Los tiempos del texto van en pulsos: aquí pasan a ms.
  const ws = (e.texto?.ws ?? []).map((p) => ({ ...p, a: Math.round(p.a * pulso), b: Math.round(p.b * pulso) }));
  if (vertical) return <Entrada tipo={e.entrada}><EscenaVertical e={e} ws={ws} dur={dur} pulso={pulso} estricta={estricta} escala={escala} /></Entrada>;
  return (
    <Entrada tipo={e.entrada}>
    <AbsoluteFill style={{ background: T.color.bg }}>
      {e.clip?.vertical ? (
        <>
          <Fondo tono="oscuro" />
          <ColumnaVertical e={e} />
        </>
      ) : e.clip ? (
        <>
          <OffthreadVideo
            src={staticFile(e.clip.src)}
            trimBefore={Math.round(e.clip.desdeS * T.canvas.fps)}
            playbackRate={e.clip.velocidad ?? 1}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip.zoom ?? 1})`, transformOrigin: e.clip.origen ?? "center" }}
          />
          {e.texto ? (
            // El texto va al lado libre del plano; la sombra, solo en ese lado.
            <AbsoluteFill style={{ background: `linear-gradient(${e.texto.lado === "der" ? 270 : 90}deg, rgba(3,15,15,0.72) 0%, rgba(3,15,15,0.25) 50%, rgba(3,15,15,0) 75%)` }} />
          ) : null}
        </>
      ) : (
        <Fondo tono={tono} />
      )}
      {e.texto?.lista ? (
        <div style={{ position: "absolute", left: 160, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 46, color: "rgba(232,245,239,0.78)", marginBottom: 18 }}>{e.texto.lista}</div>
          <Lista ws={ws} claves={e.texto.claves} serif={e.texto.serif} tono={tono} />
        </div>
      ) : e.texto ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: e.texto.centro ? "center" : "flex-start",
            paddingLeft: e.texto.centro ? 0 : e.clip?.vertical ? (e.texto.lado === "der" ? 1000 : 180) : e.texto.lado === "der" ? 1180 : 150,
          }}
        >
          <TextoCinetico
            ws={ws}
            claves={e.texto.claves}
            serif={e.texto.serif}
            tono={tono}
            alinear={e.texto.centro ? "centro" : "izq"}
            ancho={e.clip?.vertical ? 760 : e.texto.lado === "der" ? 640 : 1200}
            finMs={dur}
            escala={1.25}
            iconos={e.texto.iconos}
          />
        </AbsoluteFill>
      ) : null}
      {e.sfx && !esWhoosh(e.sfx) ? <Audio src={staticFile(e.sfx)} volume={0.5} /> : null}
    </AbsoluteFill>
    </Entrada>
  );
};

export const ReelJuego: React.FC<{ id: string; vertical?: boolean }> = ({ id, vertical }) => {
  const r = REELS_JUEGO.find((x) => x.id === id)!;
  const { escenas, pulso, desdeMs } = colocar(r);
  const fin = ms(durJuego(r));
  return (
    <AnimacionTexto.Provider value={r.animTexto}>
    <AbsoluteFill style={{ background: T.color.bg }}>
      {escenas.map((e, i) => (
        <Sequence key={i} from={ms(Math.round(e.desde * pulso))} durationInFrames={ms(Math.round((e.hasta - e.desde) * pulso))} name={`escena-${i + 1}`}>
          <EscenaJuego e={e} pulso={pulso} vertical={vertical} estricta={r.zonaEstricta} escala={r.escalaTexto} />
        </Sequence>
      ))}
      {/* Efectos de los packs, por encima del corte: empiezan un pelín antes para taparlo. */}
      {escenas.filter((e) => e.efecto).map((e, i) => {
        const glitch = e.efecto === "glitch";
        const inicio = Math.max(0, ms(Math.round(e.desde * pulso)) - (glitch ? 4 : 3));
        return (
          <Sequence key={`fx${i}`} from={inicio} durationInFrames={ms(glitch ? 900 : 800)} layout="none" name={`efecto-${e.efecto}`}>
            {glitch ? (
              <Efecto src="efectos/glitch.mp4" tinte={TINTE_MARCA} opacidad={0.95} />
            ) : (
              <>
                {/* El quemado viene en naranja: +115° lo lleva al verde de marca. */}
                <Efecto src={vertical ? "efectos/quemado-vertical.mp4" : "efectos/quemado.mp4"} tinte={115} opacidad={0.5} />
                <Audio src={staticFile("sfx/flash.wav")} volume={0.35} />
              </>
            )}
          </Sequence>
        );
      })}
      {/* Riser en el gancho (la primera escena), con el pico en el primer corte. */}
      <RiserGancho finMs={Math.round(escenas[0].hasta * pulso)} volumen={0.4} />
      {/* Whoosh en los cortes, salvo en el golpe (lleva su quemado y bajo) y el primero. */}
      <WhooshCortes cortesMs={escenas.slice(2).filter((e) => e.efecto !== "quemado").map((e) => Math.round(e.desde * pulso))} volumen={0.3} />
      {/* La voz en off: cada escena con `voz` suena su tramo de la nota. */}
      {r.voz
        ? escenas.filter((e) => e.voz).map((e, i) => (
            <Sequence key={`voz${i}`} from={ms(Math.round(e.desde * pulso))} layout="none" name={`voz-${i + 1}`}>
              <Audio src={staticFile(r.voz!)} trimBefore={ms(e.voz![0])} trimAfter={ms(e.voz![1])} volume={1} />
            </Sequence>
          ))
        : null}
      {/* La música manda cuando no hablas; mientras hablas baja para dejarte sitio. */}
      <Audio
        src={staticFile(r.musica.src)}
        trimBefore={Math.round((desdeMs / 1000) * T.canvas.fps)}
        volume={(f) => {
          const v = r.musica.volumen ?? 0.85;
          const base = interpolate(f, [0, ms(150), fin, fin + ms(CIERRE_MS)], [0, v, v, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const tramos = escenas.filter((e) => e.voz).map((e) => {
            const a = ms(Math.round(e.desde * pulso));
            return [a, a + ms(e.voz![1] - e.voz![0])];
          });
          const hablando = Math.max(0, ...tramos.map(([a, b]) => interpolate(f, [a - 6, a, b, b + 9], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
          return base * (1 - 0.7 * hablando);
        }}
      />
      <Sequence from={fin} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
    </AnimacionTexto.Provider>
  );
};
