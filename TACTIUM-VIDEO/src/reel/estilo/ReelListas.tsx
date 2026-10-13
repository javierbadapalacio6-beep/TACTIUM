// Reels de listas (9:16): un carrusel de LIGA convertido en reel de imágenes con música y
// SIN voz. Primera pieza: L6R (primeros de grupo 2026), prueba de formato del 12-10-2026
// (ESTRATEGIA-IG.md §16). Si pasa, L5R sale con este mismo componente: solo se añade un
// bloque a REELS_LISTAS.
//
// Receta (distinta a J1, J2 y E1): tarjeta gancho de 2 s con una pregunta (legible entera
// desde el fotograma 1; se mueve por empuje y un subrayado que se dibuja) que corta a las
// listas en el golpe de la música; cabecera fija que no se mueve entre pantallas (la
// «pizarra» que se actualiza); tarjetas que se revelan con una cortinilla de recorte en
// cascada de tresillos; rótulo de sección que sube letra a letra por máscara; barra de
// progreso de tres tramos (hay más listas: espera a la tuya); empuje lento de la pizarra y
// cortes en los bombos. Sin glitch, quemado, flash ni barrido.
//
// v2 (12-10-2026, Javier): las listas entraban demasiado rápido y el descifrado dejaba letras
// al azar en el fotograma que Instagram puede usar de portada. Ahora los nombres salen ya
// escritos, cada lista está ≥ 3,8 s en pantalla y delante va la tarjeta gancho.
//
// Todo el texto vive en la zona segura estricta (x 80-910 · y 260-1540).
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { CIERRE_MS, Cierre } from "../Reel";
import { Fondo, SERIF, WhooshCortes } from "./Cinetico";

const Z = { x0: 80, x1: 910, y0: 260, y1: 1540 } as const;
const ANCHO = Z.x1 - Z.x0;
/** La pizarra de listas va 8 px hacia dentro: con su empuje (×1,015 desde el centro) sigue en la zona segura. */
const LISTA = { x: Z.x0 + 8, w: ANCHO - 16 } as const;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const suave = Easing.bezier(0.25, 1, 0.5, 1);
const MUTED = "rgba(232,245,239,0.58)";

type Grupo = { etiqueta: string; equipo: string };
type Bloque = { titulo: string; grupos: Grupo[]; /** ms desde el inicio de la pantalla */ entraMs?: number };
/** Texto con UNA palabra en verde: [antes, verde, después]. */
type Frase = [string, string, string];
/** Estilo «cruces» (J1R): un grupo con sus partidos; el primero de cada cruce juega en casa. */
type BloqueCruces = {
  letra: string;
  /** Letra de la que «rueda» la ficha del grupo (la de la pantalla anterior). */
  previa?: string;
  cruces: [string, string][];
  /** ms desde el inicio de la pantalla */
  entraMs?: number;
};
type Pantalla = {
  hastaMs: number;
  /** Tarjeta gancho antes de las listas: líneas grandes, una palabra en verde y subrayada.
   *  `tira` (solo estilo «cruces»): fila de casillas de jornadas con la actual en verde. */
  gancho?: { eyebrow: string; lineas: string[]; verde: string; tira?: { total: number; actual: number; etiqueta: string } };
  /** Solo estilo «cruces»: título de la cabecera en esta pantalla (p. ej. «1ª Masculina»). */
  categoria?: string;
  /** Solo estilo «cruces»: grupos con sus cruces. */
  cruces?: BloqueCruces[];
  /** Solo estilo «cruces»: pantalla final (líneas grandes, una palabra en verde, nota pequeña). */
  final?: { lineas: string[]; verde: string; nota: string };
  bloques?: Bloque[];
  /** Tarjeta de dato bajo la lista (ms desde el inicio de la pantalla). */
  dato?: { aMs: number; linea1: Frase; linea2: string; top?: number };
  /** Pantalla final de llamada a la acción. */
  cta?: { pregunta: Frase; peticion: Frase; peticionMs: number; pie: string };
  /** Adelanto de la entrada (ms): la lista ya está entrando en el primer fotograma de la pantalla. */
  adelantoMs?: number;
  /** Alto de cada tarjeta (las pantallas con dos bloques van más justas). */
  altoTarjeta?: number;
};

export type ReelDeListas = {
  id: string;
  idea: string;
  /** Opcional. Sin valor: la receta de L6R (pizarra de tarjetas). «cruces»: receta de J1R (ver ReelCruces). */
  estilo?: "cruces";
  cabecera: { eyebrow: string; titulo: string; verde: string; nota: string };
  musica: { src: string; desdeMs: number; volumen: number };
  pantallas: Pantalla[];
};

// ─────────────────────────────────────────────────────────────────────────────
// L6R · datos REALES del carrusel L6 (carruseles/L6.json). No se añade nada.
// Música: «No Sleep» · kontraa (Pixabay, sin Content ID en su ficha el 12-10-2026).
// Arranca a los 46,700 s: la tarjeta gancho suena sobre la subida (con su parón de 0,2 s a
// 47,7 s) y el corte a la primera lista cae en el golpe de la entrada fuerte (48,70 s =
// 2,000 s del reel). Medido: compás de 3,477 s (138 BPM en medio tiempo). Tiempos del reel
// (abs − 46,70): caja 3,32 · caja 6,15 (corte) · caja 7,45 · compás 10,51 (corte) · bombo
// 11,17 · bombo 15,30 (corte) · la música baja al puente a 15,96 · compás 17,47 (monograma).
// La llamada a la acción va sobre el puente, más tranquilo.
// ─────────────────────────────────────────────────────────────────────────────
export const REELS_LISTAS: ReelDeListas[] = [
  {
    id: "L6R-primeros-de-grupo",
    idea: "Carrusel L6 en reel de imágenes: quién acabó primero de su grupo en la fase regular de la Liga Cántabra 2026. Sin voz.",
    cabecera: { eyebrow: "LIGA CÁNTABRA · FASE REGULAR", titulo: "Primeros de grupo", verde: "2026", nota: "no son campeones: fase regular" },
    musica: { src: "musica/pixabay-no-sleep.mp3", desdeMs: 46700, volumen: 0.2 },
    pantallas: [
      {
        // Gancho: «¿Quién ganó tu grupo en 2026?» (90 en guion.mjs gancho, 6 palabras).
        hastaMs: 2000,
        gancho: { eyebrow: "LIGA CÁNTABRA · FASE REGULAR", lineas: ["¿Quién ganó", "tu grupo", "en 2026?"], verde: "grupo" },
      },
      {
        hastaMs: 6150,
        bloques: [
          {
            titulo: "Masculina · 1ª y 2ª",
            grupos: [
              { etiqueta: "1ª · GRUPO A", equipo: "CENTRAL PADEL A" },
              { etiqueta: "1ª · GRUPO B", equipo: "LA MARINA A" },
              { etiqueta: "2ª · GRUPO A", equipo: "A.D.R.M. A" },
              { etiqueta: "2ª · GRUPO B", equipo: "ALDAY BOUCO A" },
              { etiqueta: "2ª · GRUPO C", equipo: "MIOÑO PADEL GYM A" },
            ],
          },
        ],
        dato: { aMs: 3320 - 2000, linea1: ["Los tres de 2ª juegan en ", "1ª", ""], linea2: "esta temporada" },
      },
      {
        hastaMs: 10510,
        bloques: [
          {
            titulo: "Femenina · 1ª y 2ª",
            grupos: [
              { etiqueta: "1ª · GRUPO A", equipo: "CENTRAL PADEL A" },
              { etiqueta: "1ª · GRUPO B", equipo: "MONTEVERDE A" },
              { etiqueta: "2ª · GRUPO A", equipo: "SMASH SANTANDER B" },
              { etiqueta: "2ª · GRUPO B", equipo: "ZINK PADEL A" },
              { etiqueta: "2ª · GRUPO C", equipo: "MOVE & GO A" },
            ],
          },
        ],
        // Mismo dato que la diapositiva 3 de L6.
        dato: { aMs: 7450 - 6150, linea1: ["Dos de 2ª juegan en ", "1ª", ""], linea2: "esta temporada" },
      },
      {
        hastaMs: 15300,
        altoTarjeta: 104,
        bloques: [
          {
            titulo: "3ª masculina",
            grupos: [
              { etiqueta: "GRUPO A", equipo: "LA MARINA F" },
              { etiqueta: "GRUPO B", equipo: "S.T.C. CASTRO URDIALES B" },
              { etiqueta: "GRUPO C", equipo: "SMASH PADEL C" },
              { etiqueta: "GRUPO D", equipo: "LOS TROYANOS" },
            ],
          },
          {
            titulo: "3ª femenina",
            entraMs: 11170 - 10510,
            grupos: [
              { etiqueta: "GRUPO A", equipo: "MONTEVERDE F" },
              { etiqueta: "GRUPO B", equipo: "CENTRAL PADEL E" },
              { etiqueta: "GRUPO C", equipo: "ZINK PADEL C" },
            ],
          },
        ],
      },
      {
        hastaMs: 17470,
        cta: {
          pregunta: ["¿Tu equipo estaba en la ", "lista", "?"],
          peticion: ["Etiqueta a tu ", "capitán", ""],
          peticionMs: 15960 - 15300,
          pie: "tactium.io",
        },
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  // J1R · cruces de la jornada 1 (Liga Cántabra 2026/27), 1ª masculina y 1ª femenina.
  // Datos REALES de fcp_partidos (liga 28942, leídos el 13-10-2026): el primero de cada cruce
  // es el local. Jornada 1 = fin de semana del 23 al 25 de octubre; 14 jornadas. Días, horas y
  // sedes NO están (los fija cada club): no se escriben.
  // Música: «Creative Technology Showreel» · Pumpupthemind (Pixabay; ficha leída el 13-10-2026:
  // «Free for use under the Pixabay Content License», sin «Content ID Registered»). Medido:
  // 150 BPM, compás de 1,6 s; arranca a 62,0 s: la tarjeta gancho va sobre la subida del puente
  // y el corte a la primera lista cae en la vuelta fuerte (64,0 s = 2,0 s del reel). Cortes en
  // medios compases (0,8 s): 6,0 · 10,0 · 14,0 · 19,6 (compás) · cierre a 22,0.
  // ───────────────────────────────────────────────────────────────────────────
  {
    id: "J1R-calendario",
    idea: "Calendario 2026/27 publicado: los cruces de la jornada 1 de 1ª masculina y 1ª femenina de la Liga Cántabra. Sin voz.",
    estilo: "cruces",
    cabecera: { eyebrow: "JORNADA 1 · 23-25 OCT", titulo: "1ª Masculina", verde: "", nota: "EL PRIMERO JUEGA EN CASA" },
    musica: { src: "musica/pixabay-creative-technology-showreel.mp3", desdeMs: 62000, volumen: 0.2 },
    pantallas: [
      {
        // Gancho: «¿Contra quién juegas la jornada 1?» (90 en guion.mjs gancho, 6 palabras).
        hastaMs: 2000,
        gancho: {
          eyebrow: "LIGA CÁNTABRA 2026/27",
          lineas: ["¿Contra quién", "juegas la", "jornada 1?"],
          verde: "quién",
          tira: { total: 14, actual: 1, etiqueta: "JORNADA 1 DE 14 · 23-25 OCTUBRE" },
        },
      },
      {
        hastaMs: 6000,
        categoria: "1ª Masculina",
        cruces: [
          {
            letra: "A",
            cruces: [
              ["CENTRAL PADEL A", "SMASH PADEL A"],
              ["LA MARINA B", "ZINK PADEL A"],
              ["MEDIO CUDEYO A", "S.T.C. CASTRO URDIALES A"],
              ["RACKET SPORT B", "PONTEJOS A"],
            ],
          },
        ],
      },
      {
        hastaMs: 10000,
        categoria: "1ª Masculina",
        cruces: [
          {
            letra: "B",
            previa: "A",
            cruces: [
              ["A.D.R.M. A", "ZINK PADEL B"],
              ["G6 A", "LA MARINA A"],
              ["MONTEVERDE B", "VILLAESCUSA A"],
              ["REINOSA PADEL CLUB A", "ALDAY BOUCO A"],
            ],
          },
        ],
      },
      {
        hastaMs: 14000,
        categoria: "1ª Masculina",
        cruces: [
          {
            letra: "C",
            previa: "B",
            cruces: [
              ["CAMARGO A", "RACKET SPORT A"],
              ["G6 B", "LA PLAYUCA ASTILLERO A"],
              ["MONTEVERDE A", "MIOÑO PADEL GYM A"],
              ["PADEL X5 A", "+PADEL SANTANDER A"],
            ],
          },
        ],
      },
      {
        hastaMs: 19600,
        categoria: "1ª Femenina",
        cruces: [
          {
            letra: "A",
            cruces: [
              ["CIRCULO DE RECREO A", "MONTEVERDE A"],
              ["G6 C", "EL TEMPLO A"],
              ["LA MARINA B", "G6 B"],
              ["SMASH SANTANDER A", "PADEL X5 A"],
            ],
          },
          {
            letra: "B",
            entraMs: 800,
            cruces: [
              ["BATHCO PADEL TEAM ATP A", "LA MARINA A"],
              ["G6 A", "RACKET SPORT A"],
              ["MONTEVERDE B", "CENTRAL PADEL A"],
              ["SMASH SANTANDER B", "MOVE & GO A"],
            ],
          },
        ],
      },
      {
        hastaMs: 22000,
        final: { lineas: ["Los cruces", "de tu grupo,", "en tactium.io"], verde: "grupo", nota: "TACTIUM.IO → FEDERACIÓN" },
      },
    ],
  },
];

const cuerpoMs = (r: ReelDeListas) => r.pantallas[r.pantallas.length - 1].hastaMs;
export const durListas = (r: ReelDeListas) => ms(cuerpoMs(r)) + ms(CIERRE_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────────────────────

const ahora = (frame: number) => (frame / T.canvas.fps) * 1000;

/** Letras que suben por una máscara, una tras otra (rótulo de sección). */
const SubeLetras: React.FC<{ texto: string; aMs: number; style: React.CSSProperties; pasoMs?: number }> = ({ texto, aMs, style, pasoMs = 16 }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  return (
    <div style={style}>
      {texto.split("").map((l, i) => {
        const e = interpolate(t, [aMs + i * pasoMs, aMs + i * pasoMs + 260], [0, 1], { ...clamp, easing: suave });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", padding: "0.1em 0 0.22em", margin: "-0.1em 0 -0.22em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - e) * 120}%)`, whiteSpace: "pre" }}>{l}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Palabras que suben por máscara, una tras otra; la verde va en verde (CTA). */
const SubeFrase: React.FC<{ f: Frase; aMs: number; size: number; serifVerde?: boolean }> = ({ f, aMs, size, serifVerde }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const partes: { w: string; verde: boolean }[] = [];
  f[0].split(" ").filter(Boolean).forEach((w) => partes.push({ w, verde: false }));
  partes.push({ w: f[1] + f[2], verde: true });
  return (
    <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.035em", color: T.color.ink }}>
      {partes.map((p, i) => {
        const e = interpolate(t, [aMs + i * 70, aMs + i * 70 + 320], [0, 1], { ...clamp, easing: suave });
        const verde = p.verde;
        const palabra = verde ? f[1] : p.w;
        return (
          <React.Fragment key={i}>
            {i > 0 ? " " : null}
            <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", padding: "0.1em 0.04em 0.24em", margin: "-0.1em -0.04em -0.24em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - e) * 115}%)` }}>
                <span
                  style={
                    verde
                      ? { color: T.color.accent, fontFamily: serifVerde ? SERIF : T.font.sans, fontStyle: serifVerde ? "italic" : "normal", fontWeight: serifVerde ? 400 : 900, fontSize: serifVerde ? size * 1.16 : size, letterSpacing: serifVerde ? "-0.01em" : undefined }
                      : undefined
                  }
                >
                  {palabra}
                </span>
                {verde ? f[2] : null}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Bandera de Cantabria (blanca sobre roja), dibujada. */
const Bandera: React.FC = () => (
  <div style={{ width: 52, height: 34, borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 2px rgba(232,245,239,0.18)", flex: "none" }}>
    <div style={{ height: "50%", background: "#F4F6F5" }} />
    <div style={{ height: "50%", background: "#D52B1E" }} />
  </div>
);

/** Rejilla tenue que deriva despacio (como el fondo del carrusel, pero viva). */
const Cuadricula: React.FC = () => {
  const frame = useCurrentFrame();
  const d = (frame / T.canvas.fps) * 9;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: "linear-gradient(rgba(232,245,239,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(232,245,239,0.035) 1px, transparent 1px)",
        backgroundSize: "96px 96px",
        backgroundPosition: `0px ${d}px`,
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 85%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 85%)",
      }}
    />
  );
};

/** Cabecera fija de las listas: entera desde el primer fotograma de la primera lista. */
const Cabecera: React.FC<{ c: ReelDeListas["cabecera"] }> = ({ c }) => {
  const frame = useCurrentFrame();
  // Un pelín de vida sin que deje de leerse: el titular se asienta (escala) en 0,4 s.
  const s = interpolate(frame, [0, 12], [1.035, 1], { ...clamp, easing: suave });
  return (
    <div style={{ position: "absolute", left: Z.x0, top: 282, width: ANCHO, transformOrigin: "0% 0%", transform: `scale(${s})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Bandera />
        <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 27, letterSpacing: "0.2em", color: T.color.accent }}>{c.eyebrow}</div>
      </div>
      <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 92, lineHeight: 1.0, letterSpacing: "-0.045em", color: T.color.ink, marginTop: 20 }}>
        {c.titulo}
        <br />
        <span style={{ color: T.color.accent }}>{c.verde}</span>
      </div>
    </div>
  );
};

/** Barra de progreso de las listas (tres tramos): dice que hay más y cuánto falta. */
const Progreso: React.FC<{ tramos: [number, number][] }> = ({ tramos }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  return (
    <div style={{ position: "absolute", left: Z.x0, top: 262, width: ANCHO, display: "flex", gap: 10 }}>
      {tramos.map(([a, b], i) => {
        const p = interpolate(t, [a, b], [0, 1], clamp);
        return (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(232,245,239,0.16)", overflow: "hidden" }}>
            <div style={{ width: `${p * 100}%`, height: "100%", background: T.color.accent }} />
          </div>
        );
      })}
    </div>
  );
};

/** Una tarjeta: cortinilla de recorte de izquierda a derecha; el nombre ya va escrito. */
const Tarjeta: React.FC<{ g: Grupo; aMs: number; alto: number }> = ({ g, aMs, alto }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const r = interpolate(t, [aMs, aMs + 340], [0, 1], { ...clamp, easing: suave });
  const borde = interpolate(t, [aMs + 160, aMs + 380, aMs + 900], [0, 1, 0.35], clamp);
  // El nombre cabe siempre en el ancho de la tarjeta (≈0,66 em por letra en la negra mayúscula).
  const interior = LISTA.w - 64;
  const tamNombre = Math.min(alto >= 120 ? 56 : 50, interior / (g.equipo.length * 0.66));
  return (
    <div
      style={{
        height: alto,
        borderRadius: 24,
        padding: "0 32px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: alto >= 120 ? 8 : 4,
        background: "rgba(16,32,32,0.86)",
        boxShadow: `inset 0 0 0 2px rgba(232,245,239,0.08), inset 6px 0 0 0 rgba(0,223,130,${borde})`,
        clipPath: `inset(0 ${(1 - r) * 100}% 0 0 round 24px)`,
        transform: `translateX(${(1 - r) * 28}px)`,
      }}
    >
      <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 25, letterSpacing: "0.2em", color: MUTED, fontVariantNumeric: "tabular-nums" }}>{g.etiqueta}</div>
      <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: tamNombre, lineHeight: 1.05, letterSpacing: "-0.015em", color: T.color.ink, whiteSpace: "nowrap" }}>
        {g.equipo}
      </div>
    </div>
  );
};

const PantallaLista: React.FC<{ p: Pantalla; durMs: number }> = ({ p, durMs }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const adelanto = p.adelantoMs ?? 60;
  const alto = p.altoTarjeta ?? 122;
  const hueco = alto >= 120 ? 14 : 10;
  // Empuje lento de la pizarra entera (un plano quieto deja de retener a los 3 s).
  const empuje = interpolate(frame, [0, ms(durMs)], [1, 1.015], clamp);
  // Tresillos (145 ms): cascada tranquila; la lista entera está escrita en algo más de un segundo.
  const paso = 60000 / 138 / 3;
  let y = 0;
  return (
    <AbsoluteFill style={{ transform: `scale(${empuje})`, transformOrigin: "50% 50%" }}>
      <div style={{ position: "absolute", left: LISTA.x, top: 556, width: LISTA.w }}>
        {(p.bloques ?? []).map((b, bi) => {
          const base = (b.entraMs ?? 0) - adelanto;
          const top = y;
          y += 62 + b.grupos.length * (alto + hueco) + 14;
          return (
            <div key={bi} style={{ position: "absolute", left: 0, top, width: LISTA.w }}>
              <SubeLetras
                texto={b.titulo}
                aMs={base}
                style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 42, letterSpacing: "-0.01em", color: T.color.ink, height: 52 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: hueco, marginTop: 12 }}>
                {b.grupos.map((g, i) => (
                  <Tarjeta key={i} g={g} aMs={base + 90 + i * paso} alto={alto} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {p.dato ? (() => {
        const a = p.dato.aMs;
        const e = interpolate(t, [a, a + 260], [0, 1], { ...clamp, easing: suave });
        return (
          <div
            style={{
              position: "absolute", left: LISTA.x, width: LISTA.w, top: p.dato.top ?? 1316, padding: "22px 32px", borderRadius: 24,
              border: "2px dashed rgba(0,223,130,0.45)", background: "rgba(3,15,15,0.72)",
              opacity: e, transform: `translateY(${(1 - e) * 26}px) scale(${0.97 + 0.03 * e})`,
            }}
          >
            <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 25, letterSpacing: "0.24em", color: T.color.accent }}>DATO</div>
            <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 48, lineHeight: 1.08, letterSpacing: "-0.03em", color: T.color.ink, marginTop: 8 }}>
              {p.dato.linea1[0]}
              <span style={{ color: T.color.accent }}>{p.dato.linea1[1]}</span>
              {p.dato.linea1[2]}
              <br />
              {p.dato.linea2}
            </div>
          </div>
        );
      })() : null}
    </AbsoluteFill>
  );
};

/**
 * Tarjeta gancho: la pregunta entera y legible desde el fotograma 1 (también si Instagram lo
 * usa de portada). El movimiento lo ponen el empuje y el subrayado verde que se dibuja.
 */
const PantallaGancho: React.FC<{ g: NonNullable<Pantalla["gancho"]>; durMs: number }> = ({ g, durMs }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const empuje = interpolate(frame, [0, ms(durMs)], [1, 1.05], { ...clamp, easing: Easing.out(Easing.quad) });
  const raya = interpolate(t, [0, 700], [0.08, 1], { ...clamp, easing: suave });
  return (
    <AbsoluteFill style={{ transform: `scale(${empuje})`, transformOrigin: `${Z.x0}px 50%` }}>
      <div style={{ position: "absolute", left: Z.x0, top: 600, width: 790 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Bandera />
          <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 27, letterSpacing: "0.2em", color: T.color.accent }}>{g.eyebrow}</div>
        </div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 124, lineHeight: 1.02, letterSpacing: "-0.045em", color: T.color.ink, marginTop: 34 }}>
          {g.lineas.map((l, i) => (
            <div key={i}>
              {l.split(" ").map((w, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? " " : null}
                  {w === g.verde ? (
                    <span style={{ color: T.color.accent, position: "relative", display: "inline-block" }}>
                      {w}
                      <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.07em", width: `${raya * 100}%`, background: T.color.accent, borderRadius: 6 }} />
                    </span>
                  ) : (
                    w
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PantallaCta: React.FC<{ c: NonNullable<Pantalla["cta"]> }> = ({ c }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const pie = interpolate(t, [c.peticionMs + 200, c.peticionMs + 500], [0, 1], clamp);
  const empuje = interpolate(frame, [0, 70], [1.04, 1], { ...clamp, easing: suave });
  return (
    <AbsoluteFill style={{ transform: `scale(${empuje})`, transformOrigin: `${Z.x0}px 50%` }}>
      <div style={{ position: "absolute", left: Z.x0, top: 600, width: ANCHO }}>
        <SubeFrase f={c.pregunta} aMs={-120} size={108} />
        <div style={{ marginTop: 70 }}>
          <SubeFrase f={c.peticion} aMs={c.peticionMs} size={84} serifVerde />
        </div>
        <div style={{ marginTop: 64, fontFamily: T.font.mono, fontWeight: 500, fontSize: 30, letterSpacing: "0.16em", color: MUTED, opacity: pie }}>{c.pie}</div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Estilo «cruces» (J1R, 13-10-2026). Combinación distinta a L6R, E1, J1 y J2:
//  - gancho con las líneas a la deriva en sentidos alternos y una tira de casillas de
//    jornadas (la 1 en verde, una onda que la recorre); legible entero en el fotograma 1;
//  - tarjetas de cruce que caen como las paletas de un marcador de estación (giro en X con
//    perspectiva, nombres ya escritos) con un clic de tecla en cada una, y que se pliegan al
//    salir; costura horizontal entre local y visitante;
//  - ficha verde del grupo cuya letra rueda de la anterior (A → B → C);
//  - título de categoría que rueda en vertical cuando cambia (Masculina → Femenina);
//  - progreso con fichas de letra abajo (te dice cuándo llega tu grupo);
//  - deriva vertical lenta de la lista (no empuje de escala); swoosh corto en los cortes;
//  - final con palabras que se enfocan (desenfoque → nítido).
// Sin cortinilla de recorte, letras por máscara, barra de tramos, glitch, quemado ni flash.
// ─────────────────────────────────────────────────────────────────────────────

const OSCURO = "#030F0F";
const SALIDA_MS = 200;

/** Horizontales tenues fijas, como las de una agenda (fondo del estilo «cruces»). */
const Renglones: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage: "linear-gradient(rgba(232,245,239,0.03) 1px, transparent 1px)",
      backgroundSize: "100% 120px",
      maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, black 25%, transparent 85%)",
      WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, black 25%, transparent 85%)",
    }}
  />
);

/** Palabra verde sin su puntuación final (la coma o la interrogación van en blanco). */
const PalabraVerde: React.FC<{ w: string; verde: string }> = ({ w, verde }) => {
  const m = w.match(/^([¿¡]?)(.*?)([.,:;?!]*)$/)!;
  if (m[2] !== verde) return <>{w}</>;
  return (
    <>
      {m[1]}
      <span style={{ color: T.color.accent }}>{m[2]}</span>
      {m[3]}
    </>
  );
};

const GanchoTira: React.FC<{ g: NonNullable<Pantalla["gancho"]>; durMs: number }> = ({ g, durMs }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const deriva = interpolate(t, [0, durMs], [0, 12], clamp);
  const empuje = interpolate(frame, [0, ms(durMs)], [1, 1.03], { ...clamp, easing: Easing.out(Easing.quad) });
  const tira = g.tira;
  return (
    <AbsoluteFill style={{ transform: `scale(${empuje})`, transformOrigin: `${Z.x0}px 50%` }}>
      <div style={{ position: "absolute", left: Z.x0 + 24, top: 640, width: 790 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Bandera />
          <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 27, letterSpacing: "0.2em", color: T.color.accent }}>{g.eyebrow}</div>
        </div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 112, lineHeight: 1.04, letterSpacing: "-0.045em", color: T.color.ink, marginTop: 30 }}>
          {g.lineas.map((l, i) => (
            <div key={i} style={{ transform: `translateX(${(i % 2 ? 1 : -1) * deriva}px)`, whiteSpace: "nowrap" }}>
              {l.split(" ").map((w, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? " " : null}
                  <PalabraVerde w={w} verde={g.verde} />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        {tira ? (
          <div style={{ marginTop: 64 }}>
            <div style={{ display: "flex", gap: 12 }}>
              {Array.from({ length: tira.total }, (_, k) => {
                const actual = k + 1 === tira.actual;
                // Una onda recorre las casillas de la última a la primera y se queda en la actual.
                const pico = 120 + (tira.total - 1 - k) * 70;
                const brillo = interpolate(t, [pico - 120, pico, pico + 220], [0, 1, 0], clamp);
                const pulso = actual ? 0.5 + 0.5 * Math.sin((t / 1000) * Math.PI * 2.5) : 0;
                return (
                  <div
                    key={k}
                    style={{
                      width: 38, height: 38, borderRadius: 9, flex: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: actual ? T.color.accent : `rgba(232,245,239,${0.04 + 0.16 * brillo})`,
                      boxShadow: actual
                        ? `0 0 0 ${3 + 5 * pulso}px rgba(0,223,130,${0.28 - 0.18 * pulso})`
                        : `inset 0 0 0 2px rgba(232,245,239,${0.18 + 0.5 * brillo})`,
                      fontFamily: T.font.mono, fontWeight: 700, fontSize: 21, color: OSCURO,
                    }}
                  >
                    {actual ? tira.actual : null}
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 25, letterSpacing: "0.14em", color: MUTED, marginTop: 20 }}>{tira.etiqueta}</div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Ficha verde del grupo: la letra rueda en vertical desde la anterior (o sube desde abajo). */
const FichaGrupo: React.FC<{ letra: string; previa?: string; aMs: number; lado: number }> = ({ letra, previa, aMs, lado }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const e = interpolate(t, [aMs, aMs + 420], [0, 1], { ...clamp, easing: suave });
  const letraStyle: React.CSSProperties = {
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: T.font.sans, fontWeight: 900, fontSize: lado * 0.7, color: OSCURO, lineHeight: 1,
  };
  return (
    <div
      style={{
        position: "relative", width: lado, height: lado, borderRadius: lado * 0.24, background: T.color.accent, overflow: "hidden", flex: "none",
        // Sin letra previa, la ficha entra con su letra (no se ve antes de su momento).
        opacity: previa ? 1 : interpolate(t, [aMs, aMs + 120], [0, 1], clamp),
        transform: previa ? undefined : `scale(${0.7 + 0.3 * e})`,
      }}
    >
      {previa ? <div style={{ ...letraStyle, transform: `translateY(${-e * 100}%)` }}>{previa}</div> : null}
      <div style={{ ...letraStyle, transform: `translateY(${(1 - e) * 100}%)` }}>{letra}</div>
    </div>
  );
};

/** Una tarjeta de cruce: cae como una paleta de marcador; costura entre local y visitante. */
const TarjetaCruce: React.FC<{ c: [string, string]; aMs: number; salidaMs: number; alto: number; maxLetra: number }> = ({ c, aMs, salidaMs, alto, maxLetra }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const e = interpolate(t, [aMs, aMs + 380], [0, 1], { ...clamp, easing: suave });
  const s = interpolate(t, [salidaMs, salidaMs + 160], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const giro = s > 0 ? s * 90 : (1 - e) * -92;
  const origen = s > 0 ? "50% 100%" : "50% 0%";
  const pad = 30;
  const vs = Math.round(maxLetra * 0.46);
  const interior = LISTA.w - pad * 2;
  // Mismo tamaño para las dos líneas: el del nombre que menos cabe (≈0,64 em por letra).
  const tam = Math.min(maxLetra, interior / (c[0].length * 0.64), (interior - vs * 2.2) / (c[1].length * 0.64));
  return (
    <div
      style={{
        position: "relative", height: alto, borderRadius: 20, padding: `0 ${pad}px`,
        display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(alto * 0.06),
        background: "rgba(16,32,32,0.9)", boxShadow: "inset 0 0 0 2px rgba(232,245,239,0.08)",
        transform: `perspective(1400px) rotateX(${giro}deg)`, transformOrigin: origen,
        opacity: e < 0.02 || s > 0.98 ? 0 : 1,
      }}
    >
      {/* Costura de la paleta */}
      <div style={{ position: "absolute", left: 12, right: 12, top: "50%", height: 2, background: "rgba(3,15,15,0.9)" }} />
      <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: tam, lineHeight: 1.04, letterSpacing: "-0.015em", color: T.color.ink, whiteSpace: "nowrap" }}>{c[0]}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: vs * 0.5, whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: vs, letterSpacing: "0.08em", color: MUTED }}>vs</span>
        <span style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: tam, lineHeight: 1.04, letterSpacing: "-0.015em", color: T.color.ink }}>{c[1]}</span>
      </div>
    </div>
  );
};

const PASO_CRUCE = 200; // ms entre tarjeta y tarjeta (medio pulso a 150 BPM)

const PantallaCruces: React.FC<{ p: Pantalla; durMs: number }> = ({ p, durMs }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const bloques = p.cruces ?? [];
  const dos = bloques.length > 1;
  const alto = dos ? 94 : 184;
  const hueco = dos ? 8 : 20;
  const lado = dos ? 50 : 66;
  const maxLetra = dos ? 40 : 56;
  const top = dos ? 490 : 512;
  const salida = durMs - SALIDA_MS;
  const deriva = interpolate(t, [0, durMs], [0, -10], clamp);
  const sal = interpolate(t, [salida, salida + 180], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: LISTA.x, top, width: LISTA.w, transform: `translateY(${deriva}px)` }}>
        {bloques.map((b, bi) => {
          const base = b.entraMs ?? 0;
          const tit = interpolate(t, [base, base + 300], [0, 1], { ...clamp, easing: suave });
          return (
            <div key={bi} style={{ marginTop: bi > 0 ? 22 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, height: lado, opacity: 1 - sal, transform: `translateY(${-sal * 16}px)` }}>
                <FichaGrupo letra={b.letra} previa={b.previa} aMs={base} lado={lado} />
                <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: dos ? 36 : 44, letterSpacing: "-0.01em", color: T.color.ink, opacity: tit, transform: `translateX(${(1 - tit) * -18}px)` }}>
                  Grupo {b.letra}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: hueco, marginTop: dos ? 10 : 18 }}>
                {b.cruces.map((c, i) => (
                  <TarjetaCruce key={i} c={c} aMs={base + 120 + i * PASO_CRUCE} salidaMs={salida + (bi * 4 + i) * 12} alto={alto} maxLetra={maxLetra} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Cabecera fija del estilo «cruces»: el título rueda cuando cambia la categoría. */
const CabeceraCruces: React.FC<{ eyebrow: string; nota: string; tramos: { aMs: number; categoria: string }[] }> = ({ eyebrow, nota, tramos }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const cambios = tramos.filter((x, i) => i === 0 || x.categoria !== tramos[i - 1].categoria);
  const entra = interpolate(t, [0, 320], [0, 1], { ...clamp, easing: suave });
  const tamTitulo = 84;
  return (
    <div style={{ position: "absolute", left: Z.x0, top: 282, width: ANCHO }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: entra }}>
        <Bandera />
        <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 27, letterSpacing: "0.2em", color: T.color.accent }}>{eyebrow}</div>
      </div>
      <div style={{ position: "relative", height: tamTitulo * 1.08, marginTop: 18, overflow: "hidden" }}>
        {cambios.map((c, i) => {
          const sig = cambios[i + 1];
          const dentro = interpolate(t, [c.aMs, c.aMs + 380], [1, 0], { ...clamp, easing: suave });
          const fuera = sig ? interpolate(t, [sig.aMs, sig.aMs + 380], [0, -1], { ...clamp, easing: suave }) : 0;
          return (
            <div key={i} style={{ position: "absolute", left: 0, top: 0, fontFamily: T.font.sans, fontWeight: 900, fontSize: tamTitulo, lineHeight: 1.04, letterSpacing: "-0.045em", color: T.color.ink, whiteSpace: "nowrap", transform: `translateY(${(dentro + fuera) * 105}%)` }}>
              {c.categoria}
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 24, letterSpacing: "0.16em", color: MUTED, marginTop: 12, opacity: entra }}>{nota}</div>
    </div>
  );
};

/** Progreso con fichas de letra: dónde estamos y cuándo llega tu grupo. */
const ProgresoGrupos: React.FC<{ tramos: { aMs: number; bMs: number; categoria: string; letras: string[] }[] }> = ({ tramos }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const cats: { categoria: string; fichas: { letra: string; aMs: number; bMs: number }[] }[] = [];
  tramos.forEach((x) => {
    let c = cats.find((k) => k.categoria === x.categoria);
    if (!c) cats.push((c = { categoria: x.categoria, fichas: [] }));
    x.letras.forEach((l) => c!.fichas.push({ letra: l, aMs: x.aMs, bMs: x.bMs }));
  });
  return (
    <div style={{ position: "absolute", left: Z.x0, top: 1480, width: ANCHO, display: "flex", alignItems: "center", gap: 34 }}>
      {cats.map((c, ci) => (
        <div key={ci} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 22, letterSpacing: "0.12em", color: MUTED, marginRight: 6 }}>{c.categoria.toUpperCase()}</div>
          {c.fichas.map((f, fi) => {
            const on = interpolate(t, [f.aMs, f.aMs + 240], [0, 1], clamp) * interpolate(t, [f.bMs - 1, f.bMs], [1, 0], clamp);
            const hecha = t >= f.bMs;
            return (
              <div
                key={fi}
                style={{
                  width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: T.font.mono, fontWeight: 700, fontSize: 22,
                  background: `rgba(0,223,130,${on})`,
                  boxShadow: `inset 0 0 0 2px rgba(232,245,239,${hecha ? 0.32 : 0.16})`,
                  color: on > 0.5 ? OSCURO : `rgba(232,245,239,${hecha ? 0.7 : 0.4})`,
                  transform: `scale(${1 + 0.08 * on})`,
                }}
              >
                {f.letra}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Final: las palabras se enfocan una tras otra; nota pequeña con la ruta. */
const PantallaFinal: React.FC<{ f: NonNullable<Pantalla["final"]> }> = ({ f }) => {
  const frame = useCurrentFrame();
  const t = ahora(frame);
  const zoom = interpolate(frame, [0, 60], [1.04, 1], { ...clamp, easing: suave });
  let n = 0;
  const nota = interpolate(t, [700, 1000], [0, 1], { ...clamp, easing: suave });
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${Z.x0}px 50%` }}>
      <div style={{ position: "absolute", left: Z.x0 + 8, top: 600, width: ANCHO - 16 }}>
        <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 104, lineHeight: 1.04, letterSpacing: "-0.045em", color: T.color.ink }}>
          {f.lineas.map((l, i) => (
            <div key={i} style={{ whiteSpace: "nowrap" }}>
              {l.split(" ").map((w, j) => {
                const a = -40 + n++ * 75;
                const e = interpolate(t, [a, a + 300], [0, 1], { ...clamp, easing: suave });
                return (
                  <React.Fragment key={j}>
                    {j > 0 ? " " : null}
                    <span style={{ display: "inline-block", opacity: e, filter: `blur(${(1 - e) * 14}px)`, transform: `translateY(${(1 - e) * 16}px)` }}>
                      <PalabraVerde w={w} verde={f.verde} />
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 58, fontFamily: T.font.mono, fontWeight: 500, fontSize: 30, letterSpacing: "0.14em", color: MUTED, opacity: nota, transform: `translateX(${(1 - nota) * -20}px)` }}>{f.nota}</div>
      </div>
    </AbsoluteFill>
  );
};

const ReelCruces: React.FC<{ r: ReelDeListas }> = ({ r }) => {
  const fin = ms(cuerpoMs(r));
  const desde = r.pantallas.map((_, i) => (i === 0 ? 0 : r.pantallas[i - 1].hastaMs));
  const listas = r.pantallas
    .map((p, i) => ({ p, aMs: desde[i], bMs: p.hastaMs }))
    .filter((x) => !!x.p.cruces);
  const a0 = listas[0].aMs;
  const b1 = listas[listas.length - 1].bMs;
  const tramos = listas.map((x) => ({ aMs: x.aMs - a0, bMs: x.bMs - a0, categoria: x.p.categoria ?? r.cabecera.titulo, letras: (x.p.cruces ?? []).map((b) => b.letra) }));
  // Clic de tecla en cada paleta que cae (cuando asienta, ~140 ms tras empezar).
  const clics: number[] = [];
  listas.forEach((x) => (x.p.cruces ?? []).forEach((b) => b.cruces.forEach((_, i) => clics.push(x.aMs + (b.entraMs ?? 0) + 120 + i * PASO_CRUCE + 140))));
  // Swoosh corto en los cortes, salvo el del gancho (ahí pega la música).
  const cortes = desde.slice(2);
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Fondo tono="oscuro" />
      <Renglones />
      <Sequence from={ms(a0)} durationInFrames={ms(b1) - ms(a0)} name="cabecera">
        <CabeceraCruces eyebrow={r.cabecera.eyebrow} nota={r.cabecera.nota} tramos={tramos} />
        <ProgresoGrupos tramos={tramos} />
      </Sequence>
      {r.pantallas.map((p, i) => {
        const a = desde[i];
        const dur = p.hastaMs - a;
        return (
          <Sequence key={i} from={ms(a)} durationInFrames={ms(p.hastaMs) - ms(a)} name={p.final ? "final" : p.gancho ? "gancho" : `cruces-${i}`}>
            {p.final ? <PantallaFinal f={p.final} /> : p.gancho ? <GanchoTira g={p.gancho} durMs={dur} /> : <PantallaCruces p={p} durMs={dur} />}
          </Sequence>
        );
      })}
      {clics.map((c, i) => (
        <Sequence key={`clic${i}`} from={ms(c)} layout="none" name="clic">
          <Audio src={staticFile("sfx/tecla.mp3")} volume={0.16} />
        </Sequence>
      ))}
      {cortes.map((c, i) => (
        <Sequence key={`sw${i}`} from={Math.max(0, ms(c - 90))} layout="none" name="swoosh">
          <Audio src={staticFile("sfx/swoosh-2.wav")} volume={0.22} />
        </Sequence>
      ))}
      <Audio
        src={staticFile(r.musica.src)}
        trimBefore={Math.round((r.musica.desdeMs / 1000) * T.canvas.fps)}
        volume={(f) => interpolate(f, [0, fin, fin + ms(CIERRE_MS)], [r.musica.volumen, r.musica.volumen, 0], clamp)}
      />
      <Sequence from={fin} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};

export const ReelListas: React.FC<{ id: string }> = ({ id }) => {
  const r = REELS_LISTAS.find((x) => x.id === id)!;
  if (r.estilo === "cruces") return <ReelCruces r={r} />;
  const fin = ms(cuerpoMs(r));
  const desde = r.pantallas.map((_, i) => (i === 0 ? 0 : r.pantallas[i - 1].hastaMs));
  const listas = r.pantallas.map((p, i) => [desde[i], p.hastaMs] as [number, number]).filter((_, i) => !!r.pantallas[i].bloques);
  const primeraLista = listas[0][0];
  const ultimaLista = listas[listas.length - 1][1];
  const conGancho = !!r.pantallas[0].gancho;
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Fondo tono="oscuro" />
      <Cuadricula />
      {/* Cabecera y progreso: fijos mientras hay listas (la pizarra que se actualiza). */}
      <Sequence from={ms(primeraLista)} durationInFrames={ms(ultimaLista) - ms(primeraLista)} name="cabecera">
        <Progreso tramos={listas.map(([a, b]) => [a - primeraLista, b - primeraLista] as [number, number])} />
        <Cabecera c={r.cabecera} />
      </Sequence>
      {r.pantallas.map((p, i) => {
        const a = desde[i];
        const dur = p.hastaMs - a;
        return (
          <Sequence key={i} from={ms(a)} durationInFrames={ms(p.hastaMs) - ms(a)} name={p.cta ? "cta" : p.gancho ? "gancho" : `lista-${i}`}>
            {p.cta ? <PantallaCta c={p.cta} /> : p.gancho ? <PantallaGancho g={p.gancho} durMs={dur} /> : <PantallaLista p={p} durMs={dur} />}
          </Sequence>
        );
      })}
      {/* Whoosh en los cortes (pico en el corte); tras el gancho no: ahí ya pega la música. */}
      <WhooshCortes cortesMs={desde.slice(conGancho ? 2 : 1)} volumen={0.22} />
      <Audio
        src={staticFile(r.musica.src)}
        trimBefore={Math.round((r.musica.desdeMs / 1000) * T.canvas.fps)}
        volume={(f) => interpolate(f, [0, fin, fin + ms(CIERRE_MS)], [r.musica.volumen, r.musica.volumen, 0], clamp)}
      />
      <Sequence from={fin} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
