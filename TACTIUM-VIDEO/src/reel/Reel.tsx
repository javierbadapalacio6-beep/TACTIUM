import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { T, ms } from "./tokens";
import type { Frase, Grafico, Pieza } from "./piezas";
import { Contador, Cortinilla, ListaTicks, NumeroGrande, Resalte } from "./graficos";

/** El cierre de marca. Idéntico en todas las piezas: es la firma. */
export const CIERRE_MS = 1000;

export const durDePieza = (p: Pieza) => ms(p.duracionMs + CIERRE_MS);

// ─────────────────────────────────────────────────────────────────────────────
// Tiempos de los subtítulos
//
// Si una frase no trae `desdeMs`/`hastaMs`, el tramo se reparte proporcional al
// número de caracteres — que es una aproximación decente al tiempo que se tarda
// en decir algo. En cuanto exista la locución real, se ajustan a mano las que
// bailen: por eso los campos son opcionales y no calculados siempre.
// ─────────────────────────────────────────────────────────────────────────────
type Cue = { frase: Frase; desdeMs: number; hastaMs: number };

const repartir = (frases: Frase[], totalMs: number): Cue[] => {
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

const Subtitulos: React.FC<{ cues: Cue[]; sinEnfasis?: boolean }> = ({ cues, sinEnfasis }) => {
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
        paddingTop: T.canvas.h * T.sub.baseline,
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
const SubtitulosDePieza: React.FC<{ cues: Cue[]; pieza: Pieza }> = ({ cues, pieza }) => {
  const frame = useCurrentFrame();
  const hayGrafico = (pieza.graficos ?? []).some(
    (g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs),
  );
  return <Subtitulos cues={cues} sinEnfasis={hayGrafico} />;
};

/** Quién habla. Solo los dos primeros segundos, en una cuenta de marca hace falta. */
const Cartelito: React.FC = () => {
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
        justifyContent: "flex-end",
        alignItems: "flex-start",
        paddingBottom: T.safe.bottom,
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
        }}
      >
        {T.cartelito.texto}
      </div>
    </AbsoluteFill>
  );
};

/** Marcador de encuadre: lo que se ve mientras no hay plano rodado. */
const Marcador: React.FC<{ titulo: string; ruta: string; anclaY: number }> = ({
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
const PintaGrafico: React.FC<{ g: Grafico }> = ({ g }) => {
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
    default: {
      const _exhaustivo: never = g;
      return _exhaustivo;
    }
  }
};

export const Reel: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const cues = useMemo(() => repartir(pieza.frases, pieza.duracionMs), [pieza]);
  const finCuerpo = ms(pieza.duracionMs);

  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {/* 1 · El plano: tú a cámara. No se le corrige el color ni se le mete LUT:
              el sistema dice que la marca vive en los bordes, no en el plano. */}
      <Sequence durationInFrames={finCuerpo} name="plano">
        {pieza.plano ? (
          <OffthreadVideo src={staticFile(pieza.plano)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Marcador titulo="FALTA EL PLANO" ruta={`plano/${pieza.id}.mp4`} anclaY={0.22} />
        )}
      </Sequence>

      {/* 2 · Cobertura: pantallas de la app y pádel real, encima del plano. */}
      {pieza.cobertura.map((c, i) => (
        <Sequence
          key={i}
          from={ms(c.desdeMs)}
          durationInFrames={ms(c.hastaMs - c.desdeMs)}
          name={`cobertura-${i}`}
        >
          <AbsoluteFill style={{ background: T.color.bg }}>
            {c.src === null ? (
              // Aún sin grabar: se puede montar la pieza entera igualmente.
              <Marcador titulo="FALTA COBERTURA" ruta={c.nota ?? "cobertura/…"} anclaY={0.1} />
            ) : esVideo(c.src) ? (
              <OffthreadVideo
                src={staticFile(c.src)}
                startFrom={ms(c.offsetMs ?? 0)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              // `contain`, no `cover`: una captura de la app recortada pierde
              // justo lo que se quería enseñar (la cabecera, el total de abajo).
              <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </AbsoluteFill>
        </Sequence>
      ))}

      {/* 3 · Gráficos de dato. Por encima de la cobertura (un resalte tiene que
              poder señalar sobre ella) y por debajo del subtítulo. */}
      {(pieza.graficos ?? []).map((g, i) => (
        <Sequence
          key={i}
          from={ms(g.desdeMs)}
          durationInFrames={ms(g.hastaMs - g.desdeMs)}
          name={`grafico-${g.tipo}`}
        >
          <PintaGrafico g={g} />
        </Sequence>
      ))}

      {/* 4 · Subtítulos y cartelito, siempre por encima de todo. */}
      <Sequence durationInFrames={finCuerpo} name="subtitulos">
        <SubtitulosDePieza cues={cues} pieza={pieza} />
        <Cartelito />
      </Sequence>

      {/* 5 · El cierre de marca. Un segundo, idéntico en todas las piezas. */}
      <Sequence from={finCuerpo} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};

const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, ms(T.motion.base)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: T.color.bg, alignItems: "center", justifyContent: "center" }}>
      <Img
        src={staticFile("img/wordmark.png")}
        style={{ width: 620, opacity: t, transform: `scale(${0.98 + t * 0.02})` }}
      />
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
