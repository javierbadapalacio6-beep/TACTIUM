import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { T, ms } from "./tokens";
import type { Cobertura, Frase, Grafico, Pieza } from "./piezas";
import { Contador, Cortinilla, EnPanel, ListaTicks, Mockup, NumeroGrande, Resalte } from "./graficos";
import { Karaoke, palabrasDe, trocear, type Bloque } from "./Karaoke";
import { Efecto, TINTE_MARCA } from "./estilo/Cinetico";

/** El cierre de marca. Idéntico en todas las piezas: es la firma. */
// 1,8 s (antes 1 s): Javier pidió alargar el cierre en los vídeos siguientes (30-09).
export const CIERRE_MS = 1800;

export const durDePieza = (p: Pieza) => ms(p.duracionMs + CIERRE_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Tiempos de los subtítulos
//
// Si una frase no trae `desdeMs`/`hastaMs`, el tramo se reparte proporcional al
// número de caracteres — que es una aproximación decente al tiempo que se tarda
// en decir algo. En cuanto exista la locución real, se ajustan a mano las que
// bailen: por eso los campos son opcionales y no calculados siempre.
// ─────────────────────────────────────────────────────────────────────────────
export type Cue = { frase: Frase; desdeMs: number; hastaMs: number };

export const repartir = (frases: Frase[], totalMs: number): Cue[] => {
  const pesos = frases.map((f) => Math.max(f.texto.length, 1));
  const suma = pesos.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return frases.map((frase, i) => {
    const propio = (pesos[i] / suma) * totalMs;
    const desdeMs = frase.desdeMs ?? cursor;
    const hastaMs = frase.hastaMs ?? desdeMs + propio;
    cursor = hastaMs;
    return { frase, desdeMs, hastaMs };
  });
};

/** Parte en dos líneas por el hueco más cercano al centro, sin cortar palabras. */
const enDosLineas = (texto: string): string[] => {
  if (texto.length <= T.sub.maxChars) return [texto];
  const palabras = texto.split(" ");
  let mejor = { corte: 1, coste: Infinity };
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ").length;
    const b = palabras.slice(i).join(" ").length;
    const coste = Math.abs(a - b) + Math.max(0, Math.max(a, b) - T.sub.maxChars) * 10;
    if (coste < mejor.coste) mejor = { corte: i, coste };
  }
  return [palabras.slice(0, mejor.corte).join(" "), palabras.slice(mejor.corte).join(" ")];
};

/** Pinta la línea con UNA palabra en accent, si esa palabra está en esta línea. */
const Linea: React.FC<{ texto: string; enfasis?: string }> = ({ texto, enfasis }) => {
  if (!enfasis || !texto.toLowerCase().includes(enfasis.toLowerCase())) return <>{texto}</>;
  const i = texto.toLowerCase().indexOf(enfasis.toLowerCase());
  return (
    <>
      {texto.slice(0, i)}
      <span style={{ color: T.sub.enfasis }}>{texto.slice(i, i + enfasis.length)}</span>
      {texto.slice(i + enfasis.length)}
    </>
  );
};

export const Subtitulos: React.FC<{ cues: Cue[]; sinEnfasis?: boolean; baseline?: number }> = ({
  cues,
  sinEnfasis,
  baseline = T.sub.baseline,
}) => {
  const frame = useCurrentFrame();
  const actual = cues.find((c) => frame >= ms(c.desdeMs) && frame < ms(c.hastaMs));
  if (!actual) return null;

  // Entrada seca y corta: el subtítulo aparece, no "anima". 140ms.
  const desde = ms(actual.desdeMs);
  const t = interpolate(frame - desde, [0, ms(T.motion.fast)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: T.canvas.h * baseline,
        paddingLeft: T.safe.sides,
        paddingRight: T.safe.sides,
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - t) * 10}px)`,
          opacity: t,
          // El bloque va centrado, así que su mitad no puede pasar del escalón
          // de la columna de iconos. De ahí sale este ancho, no de un gusto.
          maxWidth: T.sub.maxWidth,
          background: T.sub.fondo,
          borderRadius: T.radius.lg,
          padding: `${T.space[3]}px ${T.space[6]}px`,
          textAlign: "center",
          fontFamily: T.font.sans,
          fontWeight: T.sub.weight,
          fontSize: T.sub.size,
          lineHeight: T.sub.lineHeight,
          letterSpacing: T.sub.tracking,
          color: T.sub.color,
          textWrap: "balance",
        }}
      >
        {enDosLineas(actual.frase.texto).map((linea, i) => (
          <div key={i}>
            <Linea texto={linea} enfasis={sinEnfasis ? undefined : actual.frase.enfasis} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Mientras hay un gráfico en pantalla, el subtítulo renuncia a su palabra en
 * verde. El sistema (§2) pide un solo accent dominante por composición, y un
 * gráfico de dato ya es verde y grande: dos bloques verdes compiten y ninguno
 * señala. Es automático a propósito — no depende de acordarse al escribir los datos.
 */
const SubtitulosDePieza: React.FC<{ cues: Cue[]; bloques: Bloque[] | null; pieza: Pieza; baseline: number }> = ({
  cues,
  bloques,
  pieza,
  baseline,
}) => {
  const frame = useCurrentFrame();
  // El rótulo de apertura y el subtítulo nunca se solapan: dos textos en el
  // mismo segundo no se leen, compiten.
  if (pieza.gancho && frame < ms(pieza.gancho.hastaMs)) return null;
  const activos = (pieza.graficos ?? []).filter(
    (g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs),
  );
  // La cortinilla ya dice su cifra a pantalla completa: un subtítulo encima
  // repetiría el mismo texto dos veces en el mismo segundo.
  if (activos.some((g) => g.tipo === "cortinilla")) return null;
  const hayGrafico = activos.length > 0;
  // El baseline lo decide `Reel`, porque en `motion` se mueve con el panel.
  if (bloques) {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: T.canvas.h * baseline,
          paddingLeft: T.safe.sides,
          paddingRight: T.safe.sides,
        }}
      >
        <Karaoke bloques={bloques} size={78} maxWidth={T.sub.maxWidth} apagado={hayGrafico} />
      </AbsoluteFill>
    );
  }
  return <Subtitulos cues={cues} sinEnfasis={hayGrafico} baseline={baseline} />;
};

/** Quién habla. Solo los dos primeros segundos, en una cuenta de marca hace falta. */
export const Cartelito: React.FC<{ suelo: number; arriba?: boolean }> = ({ suelo, arriba }) => {
  const frame = useCurrentFrame();
  const fin = ms(T.cartelito.durMs);
  const t = interpolate(frame, [0, ms(200), fin - ms(200), fin], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (t <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        // Con el panel abierto el subtítulo vive en la juntura, así que el
        // cartelito sube a la esquina superior para no pisarlo.
        justifyContent: arriba ? "flex-start" : "flex-end",
        alignItems: "flex-start",
        // Se queda dentro de la banda de la cara: por debajo taparía la app
        // o el panel de gráficos. Con el panel cerrado cae en la zona segura.
        paddingTop: arriba ? T.safe.top : 0,
        paddingBottom: arriba ? 0 : suelo,
        paddingLeft: T.safe.sides,
      }}
    >
      <div
        style={{
          opacity: t,
          fontFamily: T.font.mono,
          fontSize: T.cartelito.size,
          letterSpacing: T.cartelito.tracking,
          color: T.color.ink,
          background: T.sub.fondo,
          borderRadius: T.radius.pill,
          padding: `${T.space[3]}px ${T.space[6]}px`,
          borderLeft: `3px solid ${T.color.accent}`,
          whiteSpace: "nowrap",
        }}
      >
        {T.cartelito.texto}
      </div>
    </AbsoluteFill>
  );
};

/**
 * El panel entre un dato y el siguiente.
 *
 * Antes aquí vivía el wordmark, y eso convertía el 55% del lienzo en un logo
 * durante buena parte de la pieza. Nadie hace scroll para ver una marca: el
 * reposo tiene que leerse como escenario, no como anuncio. La firma se reserva
 * al cierre, que para eso está.
 *
 * Ahora el panel sólo se abre cuando hay algo que enseñar (ver `useApertura`),
 * así que esta retícula se ve poco: son los huecos entre dos gráficos seguidos.
 */
const PanelTextura: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        `linear-gradient(${T.color.hair} 1px, transparent 1px),` +
        `linear-gradient(90deg, ${T.color.hair} 1px, transparent 1px)`,
      backgroundSize: "60px 60px",
      // Se desvanece hacia los bordes: una retícula a sangre compite con el
      // subtítulo, que cae justo encima de la juntura.
      WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 72%)",
      maskImage: "radial-gradient(ellipse at center, black 25%, transparent 72%)",
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Apertura del panel
//
// El panel no está siempre: se abre cuando hay un dato que enseñar y se cierra
// cuando no. Mientras está cerrado, el plano ocupa el lienzo entero — que es lo
// que tiene que pasar en el gancho y en los tramos en los que sólo hablas.
//
// Dos gráficos separados por menos de dos transiciones se fusionan en un único
// tramo abierto. Si no, el panel rebotaría entre uno y el siguiente, y un salto
// de medio lienzo cada pocos segundos se lee como un fallo.
// ─────────────────────────────────────────────────────────────────────────────
export const tramosAbiertos = (pieza: Pieza): { a: number; b: number }[] => {
  const holgura = T.motion.slow * 2;
  // Abre el panel un gráfico o una captura. La cortinilla no: va a pantalla
  // completa por encima de todo, y el panel se cierra debajo de ella.
  const gs = [
    ...(pieza.graficos ?? []).filter((g) => g.tipo !== "cortinilla"),
    ...pieza.cobertura,
  ].sort((x, y) => x.desdeMs - y.desdeMs);
  const out: { a: number; b: number }[] = [];
  for (const g of gs) {
    const ultimo = out[out.length - 1];
    if (ultimo && g.desdeMs - ultimo.b < holgura) ultimo.b = Math.max(ultimo.b, g.hastaMs);
    else out.push({ a: g.desdeMs, b: g.hastaMs });
  }
  return out;
};

/** 0 = panel cerrado, el plano ocupa todo · 1 = panel abierto del todo. */
const useApertura = (pieza: Pieza): number => {
  const frame = useCurrentFrame();
  const tramos = useMemo(() => tramosAbiertos(pieza), [pieza]);
  const t = ms(T.motion.slow);
  let abierto = 0;
  for (const { a, b } of tramos) {
    const v = interpolate(frame, [ms(a) - t, ms(a), ms(b), ms(b) + t], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (v > abierto) abierto = v;
  }
  return abierto;
};

/** Marcador de encuadre: lo que se ve mientras no hay plano rodado. */
export const Marcador: React.FC<{ titulo: string; ruta: string; anclaY: number }> = ({
  titulo,
  ruta,
  anclaY,
}) => (
  <AbsoluteFill style={{ background: T.color.card }}>
    <AbsoluteFill
      style={{
        border: `2px dashed ${T.color.hair}`,
        margin: `${T.safe.top}px ${T.safe.sides}px ${T.safe.bottom}px`,
        borderRadius: T.radius.lg,
        alignItems: "center",
        justifyContent: "flex-start",
        textAlign: "center",
        padding: T.space[8],
        // A distintas alturas según qué falte, para que un plano y una cobertura
        // pendientes no se pisen entre sí ni tapen el subtítulo.
        paddingTop: T.canvas.h * anclaY,
      }}
    >
      <div style={{ fontFamily: T.font.mono, fontSize: 26, letterSpacing: "0.1em", color: T.color.accent }}>
        {titulo}
      </div>
      <div style={{ fontFamily: T.font.sans, fontSize: 34, color: T.color.muted, marginTop: T.space[4] }}>
        public/{ruta}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

const esVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src);

/** Despacha cada gráfico a su componente. El `never` del default obliga a que,
 *  si mañana se añade un tipo a `Grafico`, TypeScript avise aquí. */
export const PintaGrafico: React.FC<{ g: Grafico }> = ({ g }) => {
  switch (g.tipo) {
    case "numero":
      return <NumeroGrande valor={g.valor} eyebrow={g.eyebrow} pie={g.pie} />;
    case "resalte":
      return <Resalte zona={g.zona} etiqueta={g.etiqueta} />;
    case "contador":
      return <Contador de={g.de} a={g.a} unidad={g.unidad} eyebrow={g.eyebrow} />;
    case "ticks":
      return <ListaTicks items={g.items} pasoMs={g.pasoMs} />;
    case "cortinilla":
      return <Cortinilla cifra={g.cifra} pie={g.pie} />;
    case "mockup":
      return <Mockup src={g.src} lado={g.lado} />;
    default: {
      const _exhaustivo: never = g;
      return _exhaustivo;
    }
  }
};

/**
 * Tú a cámara.
 *
 * Lleva un punch-in lento de serie: un plano fijo deja de retener a los tres
 * segundos, y en una pieza de treinta el trípode quieto mata la mitad de arriba
 * del lienzo. El empuje sostiene la atención sin obligar a cortar.
 */
const Plano: React.FC<{ pieza: Pieza; apertura: number }> = ({ pieza, apertura }) => {
  const frame = useCurrentFrame();
  const [zIni, zFin] = pieza.zoom ?? [1, 1.07];
  let escala = interpolate(frame, [0, ms(pieza.duracionMs)], [zIni, zFin], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Con cortes declarados, cada tramo alterna el tamaño de partida y empuja
  // despacio dentro del tramo. Un corte entre dos tomas del mismo encuadre sin
  // cambio de escala se lee como un salto de cámara; con el cambio, como montaje.
  if (pieza.cortes && pieza.cortes.length) {
    const cortes = pieza.cortes.map(ms);
    const idx = cortes.filter((c) => frame >= c).length;
    const ini = idx === 0 ? 0 : cortes[idx - 1];
    const fin = idx < cortes.length ? cortes[idx] : ms(pieza.duracionMs);
    const p = Math.min(1, Math.max(0, (frame - ini) / Math.max(1, fin - ini)));
    escala = (idx % 2 ? 1.1 : 1) + p * 0.05;
  }

  // Al recortar 1920px a una banda, el centro geométrico cae por el pecho y la
  // cabeza se queda fuera: con el panel abierto el ancla sube (10% por defecto).
  // Con el panel cerrado no hay recorte y el encuadre es el que se rodó.
  const anclaY = interpolate(apertura, [0, 1], [50, pieza.anclaY ?? 10]);

  if (!pieza.plano) {
    return (
      <Marcador
        titulo="FALTA EL PLANO"
        ruta={`plano/${pieza.id}.mp4`}
        anclaY={apertura > 0.5 ? 0.04 : 0.22}
      />
    );
  }
  return (
    <OffthreadVideo
      src={staticFile(pieza.plano)}
      // Varias piezas pueden salir de una misma grabación sin volver a recortar
      // el archivo: aquí sólo se elige por dónde entra.
      trimBefore={pieza.planoDesdeMs ? ms(pieza.planoDesdeMs) : undefined}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `center ${anclaY}%`,
        transform: `scale(${escala})`,
      }}
    />
  );
};

/**
 * El rótulo de apertura, sobre el plano a pantalla completa.
 *
 * No sustituye al subtítulo: es la promesa que hace que alguien se pare, y por
 * eso va más grande y dura menos. Mientras está en pantalla el subtítulo calla,
 * o se leerían dos textos compitiendo en el mismo segundo.
 */
export const GanchoRotulo: React.FC<{ g: NonNullable<Pieza["gancho"]> }> = ({ g }) => {
  const frame = useCurrentFrame();
  const fin = ms(g.hastaMs);
  const t = interpolate(
    frame,
    [0, ms(T.motion.fast), fin - ms(T.motion.base), fin],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (t <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: T.safe.sides,
        paddingRight: T.safe.sides,
      }}
    >
      <div
        style={{
          opacity: t,
          transform: `scale(${0.96 + t * 0.04})`,
          maxWidth: T.sub.maxWidth,
          textAlign: "center",
          fontFamily: T.font.sans,
          fontWeight: T.sub.weight,
          // Por encima del subtítulo en jerarquía: es lo primero que se lee.
          fontSize: Math.round(T.sub.size * 1.5),
          lineHeight: 1.02,
          letterSpacing: T.sub.tracking,
          color: T.sub.color,
          background: T.sub.fondo,
          borderRadius: T.radius.lg,
          padding: `${T.space[4]}px ${T.space[6]}px`,
          textWrap: "balance",
        }}
      >
        <Linea texto={g.texto} enfasis={g.enfasis} />
      </div>
    </AbsoluteFill>
  );
};

const EASE_OUT = Easing.bezier(0.25, 1, 0.5, 1);

export const Pantalla: React.FC<{ c: Cobertura; enPanel?: boolean }> = ({ c, enPanel }) => {
  const frame = useCurrentFrame();
  if (c.src === null) {
    // Aún sin grabar: se puede montar la pieza entera igualmente.
    return <Marcador titulo="FALTA COBERTURA" ruta={c.nota ?? "cobertura/…"} anclaY={0.1} />;
  }
  // `contain`, no `cover`, a pantalla completa: una captura de la app recortada
  // pierde justo lo que se quería enseñar. En el panel es al revés: entera
  // cabría a 490px de ancho y no se leería, así que se recorta y se panea.
  const ajuste = c.ajuste ?? (enPanel ? "cover" : "contain");
  const dur = ms(c.hastaMs - c.desdeMs);
  const [p0, p1] = c.pan ?? [0, 0];
  const posY = interpolate(frame, [0, dur], [p0, p1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const estilo: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: ajuste,
    objectPosition: `center ${posY}%`,
  };
  const media = esVideo(c.src) ? (
    <OffthreadVideo src={staticFile(c.src)} startFrom={ms(c.offsetMs ?? 0)} style={estilo} />
  ) : (
    <Img src={staticFile(c.src)} style={estilo} />
  );
  if (!enPanel) return media;

  // Marco de iPhone, el mismo que en los carruseles: bisel, Dynamic Island y
  // barra de estado. La barra se pinta SIEMPRE y queda fija arriba mientras la
  // captura panea debajo; por eso las capturas van sin su barra propia
  // (`app/reel/`, `img/*-sinbarra`). Entra subiendo y sangra por abajo.
  const t = interpolate(frame, [0, ms(T.motion.base)], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const esWeb = true;
  const R = 96;
  const bisel = 14;
  return (
    <div
      style={{
        position: "absolute",
        top: T.space[6],
        left: T.space[8] + T.space[4],
        right: T.space[8] + T.space[4],
        bottom: 0,
        borderRadius: `${R}px ${R}px 0 0`,
        background: "#0a0a0a",
        padding: bisel,
        boxShadow: `0 0 0 2px #2a2d2e, 0 0 0 4px #121414, 0 -30px 80px -30px rgba(0,223,130,0.25)`,
        transform: `translateY(${(1 - t) * 48}px)`,
        opacity: t,
      }}
    >
      <div
        style={{
          position: "relative",
          height: "100%",
          borderRadius: `${R - bisel}px ${R - bisel}px 0 0`,
          overflow: "hidden",
          background: T.color.card,
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 22,
            transform: "translateX(-50%)",
            width: 186,
            height: 56,
            borderRadius: 30,
            background: "#000",
            zIndex: 3,
          }}
        />
        {esWeb ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 100,
              zIndex: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 58px 0 62px",
              fontFamily: T.font.sans,
              fontWeight: 700,
              fontSize: 30,
              color: "#fff",
            }}
          >
            <span>9:41</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="30" height="22" viewBox="0 0 30 22" fill="#fff">
                <rect x="0" y="14" width="5" height="8" rx="1" />
                <rect x="8" y="10" width="5" height="12" rx="1" />
                <rect x="16" y="5" width="5" height="17" rx="1" />
                <rect x="24" y="0" width="5" height="22" rx="1" />
              </svg>
              <svg width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <path d="M3 8a17 17 0 0 1 24 0" />
                <path d="M8 13a10 10 0 0 1 14 0" />
                <circle cx="15" cy="18" r="1.5" fill="#fff" />
              </svg>
              <span style={{ position: "relative", width: 48, height: 22, border: "3px solid rgba(255,255,255,0.9)", borderRadius: 8, display: "inline-block" }}>
                <span style={{ position: "absolute", left: 3, top: 3, bottom: 3, width: "70%", background: "#fff", borderRadius: 3 }} />
              </span>
            </span>
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 0, right: 0, top: esWeb ? 100 : 0, bottom: 0 }}>{media}</div>
      </div>
    </div>
  );
};

/** Pinta el reposo solo en los frames en que ningún gráfico ocupa el panel. */
const PanelEnReposoSiToca: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const frame = useCurrentFrame();
  const ocupado = [...(pieza.graficos ?? []), ...pieza.cobertura].some(
    (g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs),
  );
  return ocupado ? null : <PanelTextura />;
};

export const Reel: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const cues = useMemo(() => repartir(pieza.frases, pieza.duracionMs), [pieza]);
  const bloques = useMemo(() => {
    const ps = palabrasDe(pieza);
    return ps ? trocear(ps) : null;
  }, [pieza]);
  const finCuerpo = ms(pieza.duracionMs);
  const layout = pieza.layout ?? "alterna";
  const esMotion = layout === "motion";
  const apertura = useApertura(pieza);

  // En `motion` la banda de la cara respira: ocupa el lienzo entero mientras no
  // hay dato que enseñar, y se retira al 45% cuando el panel se abre. Así el
  // gancho se ve a pantalla completa y el panel sólo existe cuando aporta.
  const bandaCara = Math.round(
    esMotion
      ? interpolate(apertura, [0, 1], [T.canvas.h, T.canvas.h * (pieza.caraAlto ?? T.panel.caraAlto)])
      : T.canvas.h * T.tutorial.caraAlto,
  );
  const panelVisible = esMotion && apertura > 0.001;

  // El subtítulo acompaña a la juntura: al 62% sobre el plano entero, al 46%
  // —justo debajo del borde— cuando el panel está abierto.
  // En `motion` el subtítulo se pone a caballo de la juntura: pisa la barbilla
  // lo mínimo y sólo tapa la cabecera de la captura, que es lo que menos importa.
  const baseSub = esMotion
    ? interpolate(apertura, [0, 1], [T.sub.baseline, (pieza.caraAlto ?? T.panel.caraAlto) - 0.045])
    : layout === "tutorial"
      ? T.tutorial.subBaseline
      : T.sub.baseline;

  // Dónde se dibuja cada cosa según el layout. En `alterna` ambos ocupan el
  // lienzo entero y la cobertura tapa; en `tutorial` se reparten; en `pip` la
  // pantalla manda y la cara se encoge a un recuadro.
  const marcoPlano: React.CSSProperties =
    layout === "tutorial" || esMotion
      ? { position: "absolute", top: 0, left: 0, right: 0, height: bandaCara, overflow: "hidden" }
      : layout === "pip"
        ? {
            position: "absolute",
            top: T.safe.top,
            left: T.safe.sides,
            width: T.pip.lado,
            height: T.pip.lado,
            borderRadius: T.pip.radio,
            overflow: "hidden",
            border: `3px solid ${T.color.accent}`,
            zIndex: 4,
          }
        // `overflow: hidden` para que el punch-in no desborde el lienzo.
        : { position: "absolute", inset: 0, overflow: "hidden" };

  const marcoPantalla: React.CSSProperties =
    layout === "tutorial" || esMotion
      ? { position: "absolute", top: bandaCara, left: 0, right: 0, bottom: 0, background: T.color.bg }
      : { position: "absolute", inset: 0, background: T.color.bg };

  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {/* 1 · El plano: tú a cámara. No se le corrige el color ni se le mete LUT:
              el sistema dice que la marca vive en los bordes, no en el plano. */}
      <Sequence durationInFrames={finCuerpo} name="plano">
        <div style={marcoPlano}>
          <Plano
            pieza={pieza}
            apertura={esMotion ? apertura : layout === "tutorial" ? 1 : 0}
          />
        </div>
      </Sequence>

      {/* 3 · El panel de marca del layout `motion`. Sólo existe mientras hay un
              dato que enseñar: el resto del tiempo el plano ocupa el lienzo. */}
      {panelVisible ? (
        <div
          style={{
            position: "absolute",
            top: bandaCara,
            left: 0,
            right: 0,
            bottom: 0,
            background: T.panel.panelFondo,
            borderTop: `2px solid ${T.panel.panelBorde}`,
          }}
        >
          <PanelEnReposoSiToca pieza={pieza} />
        </div>
      ) : null}

      {/* 2 · La pantalla de la app. En `alterna` tapa el plano por tramos; en
              `tutorial` y `pip` convive con él. */}
      {pieza.cobertura.map((c, i) => (
        <Sequence
          key={i}
          from={ms(c.desdeMs)}
          durationInFrames={ms(c.hastaMs - c.desdeMs)}
          name={`cobertura-${i}`}
        >
          {c.sfx ? <Audio src={staticFile(c.sfx)} volume={0.55} /> : null}
          <div style={marcoPantalla}>
            <Pantalla c={c} enPanel={esMotion} />
          </div>
        </Sequence>
      ))}

      {/* 4 · Gráficos. Superpuestos al plano en `alterna`; dentro del panel en
              `motion`, donde se centran solos gracias al contexto. */}
      {(pieza.graficos ?? []).map((g, i) => (
        <Sequence
          key={i}
          from={ms(g.desdeMs)}
          durationInFrames={ms(g.hastaMs - g.desdeMs)}
          name={`grafico-${g.tipo}`}
        >
          {g.sfx ? <Audio src={staticFile(g.sfx)} volume={0.7} /> : null}
          {esMotion && g.tipo !== "cortinilla" ? (
            <div style={{ position: "absolute", top: bandaCara, left: 0, right: 0, bottom: 0 }}>
              <EnPanel.Provider value={true}>
                <PintaGrafico g={g} />
              </EnPanel.Provider>
            </div>
          ) : (
            <PintaGrafico g={g} />
          )}
        </Sequence>
      ))}

      {/* 5 · Rótulo de apertura, subtítulos y cartelito: siempre por encima. */}
      <Sequence durationInFrames={finCuerpo} name="subtitulos">
        {pieza.gancho ? <GanchoRotulo g={pieza.gancho} /> : null}
        <SubtitulosDePieza cues={cues} bloques={bloques} pieza={pieza} baseline={baseSub} />
        <Cartelito
          suelo={Math.max(T.safe.bottom, T.canvas.h - bandaCara + T.space[4])}
          arriba={esMotion && apertura > 0.5}
        />
      </Sequence>

      {/* 6 · Cama musical, si la hay: entra en medio segundo y se va con el cierre. */}
      {pieza.musica ? (
        <Audio
          src={staticFile(pieza.musica.src)}
          volume={(f) =>
            interpolate(
              f,
              [0, ms(600), finCuerpo - ms(400), finCuerpo + ms(CIERRE_MS)],
              [0, pieza.musica!.volumen, pieza.musica!.volumen, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      ) : null}

      {/* 7 · El cierre de marca. Un segundo, idéntico en todas las piezas. */}
      <Sequence from={finCuerpo} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * El cierre de marca: el monograma «T» (no el nombre en letras, a petición de Javier,
 * 29-09-2026). Se revela de arriba abajo, con un halo verde y un destello anamórfico de
 * los packs que lo cruza, teñido al verde de marca. Mismo en vertical y en 16:9.
 */
export const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lado = Math.round(Math.min(width, height) * 0.55);
  const t = interpolate(frame, [0, ms(380)], [0, 1], {
    easing: Easing.bezier(0.25, 1, 0.5, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: T.color.bg, alignItems: "center", justifyContent: "center" }}>
      <Img
        src={staticFile("img/logo-t.png")}
        style={{
          width: lado,
          height: lado,
          opacity: t,
          clipPath: `inset(0 0 ${(1 - t) * 100}% 0)`,
          transform: `scale(${0.94 + t * 0.06})`,
          filter: `drop-shadow(0 0 ${Math.round(lado * 0.08)}px rgba(0,223,130,${0.35 * t}))`,
        }}
      />
      <Sequence from={ms(120)} layout="none">
        <Efecto src="efectos/destello.mp4" tinte={TINTE_MARCA} opacidad={0.9} />
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.4} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Guías de zona segura. Se activan con el prop `guias` en el studio; nunca en el render final. */
export const Guias: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        borderTop: `${T.safe.top}px solid rgba(255,0,0,0.14)`,
        borderBottom: `${T.safe.bottom}px solid rgba(255,0,0,0.14)`,
        borderLeft: `${T.safe.sides}px solid rgba(255,0,0,0.14)`,
        borderRight: `${T.safe.sides}px solid rgba(255,0,0,0.14)`,
      }}
    />
    {/* La columna de iconos de la plataforma: aquí abajo no llega el contenido. */}
    <div
      style={{
        position: "absolute",
        left: T.safe.escalonX,
        top: T.safe.escalonY,
        right: 0,
        bottom: 0,
        background: "rgba(255,0,0,0.14)",
      }}
    />
  </AbsoluteFill>
);
