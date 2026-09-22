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
import type { Cobertura, Frase, Grafico, Pieza } from "./piezas";
import { Contador, Cortinilla, EnPanel, ListaTicks, Mockup, NumeroGrande, Resalte } from "./graficos";

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

const Subtitulos: React.FC<{ cues: Cue[]; sinEnfasis?: boolean; baseline?: number }> = ({
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
const SubtitulosDePieza: React.FC<{ cues: Cue[]; pieza: Pieza; baseline: number }> = ({
  cues,
  pieza,
  baseline,
}) => {
  const frame = useCurrentFrame();
  // El rótulo de apertura y el subtítulo nunca se solapan: dos textos en el
  // mismo segundo no se leen, compiten.
  if (pieza.gancho && frame < ms(pieza.gancho.hastaMs)) return null;
  const hayGrafico = (pieza.graficos ?? []).some(
    (g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs),
  );
  // El baseline lo decide `Reel`, porque en `motion` se mueve con el panel.
  return <Subtitulos cues={cues} sinEnfasis={hayGrafico} baseline={baseline} />;
};

/** Quién habla. Solo los dos primeros segundos, en una cuenta de marca hace falta. */
const Cartelito: React.FC<{ suelo: number }> = ({ suelo }) => {
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
        // Se queda dentro de la banda de la cara: por debajo taparía la app
        // o el panel de gráficos. Con el panel cerrado cae en la zona segura.
        paddingBottom: suelo,
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
const tramosAbiertos = (pieza: Pieza): { a: number; b: number }[] => {
  const holgura = T.motion.slow * 2;
  const gs = [...(pieza.graficos ?? [])].sort((x, y) => x.desdeMs - y.desdeMs);
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
  const escala = interpolate(frame, [0, ms(pieza.duracionMs)], [zIni, zFin], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Al recortar 1920px a una banda, el centro geométrico cae por el pecho y la
  // cabeza se queda fuera: con el panel abierto el ancla sube al 10%. Con el
  // panel cerrado no hay recorte y el encuadre es el que se rodó.
  const anclaY = interpolate(apertura, [0, 1], [50, 10]);

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
const GanchoRotulo: React.FC<{ g: NonNullable<Pieza["gancho"]> }> = ({ g }) => {
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

const Pantalla: React.FC<{ c: Cobertura }> = ({ c }) =>
  c.src === null ? (
    // Aún sin grabar: se puede montar la pieza entera igualmente.
    <Marcador titulo="FALTA COBERTURA" ruta={c.nota ?? "cobertura/…"} anclaY={0.1} />
  ) : esVideo(c.src) ? (
    <OffthreadVideo
      src={staticFile(c.src)}
      startFrom={ms(c.offsetMs ?? 0)}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  ) : (
    // `contain`, no `cover`: una captura de la app recortada pierde justo lo
    // que se quería enseñar (la cabecera, el total de abajo).
    <Img src={staticFile(c.src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  );

/** Pinta el reposo solo en los frames en que ningún gráfico ocupa el panel. */
const PanelEnReposoSiToca: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const frame = useCurrentFrame();
  const ocupado = (pieza.graficos ?? []).some(
    (g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs),
  );
  return ocupado ? null : <PanelTextura />;
};

export const Reel: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const cues = useMemo(() => repartir(pieza.frases, pieza.duracionMs), [pieza]);
  const finCuerpo = ms(pieza.duracionMs);
  const layout = pieza.layout ?? "alterna";
  const esMotion = layout === "motion";
  const apertura = useApertura(pieza);

  // En `motion` la banda de la cara respira: ocupa el lienzo entero mientras no
  // hay dato que enseñar, y se retira al 45% cuando el panel se abre. Así el
  // gancho se ve a pantalla completa y el panel sólo existe cuando aporta.
  const bandaCara = Math.round(
    esMotion
      ? interpolate(apertura, [0, 1], [T.canvas.h, T.canvas.h * T.panel.caraAlto])
      : T.canvas.h * T.tutorial.caraAlto,
  );
  const panelVisible = esMotion && apertura > 0.001;

  // El subtítulo acompaña a la juntura: al 62% sobre el plano entero, al 46%
  // —justo debajo del borde— cuando el panel está abierto.
  const baseSub = esMotion
    ? interpolate(apertura, [0, 1], [T.sub.baseline, T.panel.subBaseline])
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

      {/* 2 · La pantalla de la app. En `alterna` tapa el plano por tramos; en
              `tutorial` y `pip` convive con él. */}
      {pieza.cobertura.map((c, i) => (
        <Sequence
          key={i}
          from={ms(c.desdeMs)}
          durationInFrames={ms(c.hastaMs - c.desdeMs)}
          name={`cobertura-${i}`}
        >
          <div style={marcoPantalla}>
            <Pantalla c={c} />
          </div>
        </Sequence>
      ))}

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

      {/* 4 · Gráficos. Superpuestos al plano en `alterna`; dentro del panel en
              `motion`, donde se centran solos gracias al contexto. */}
      {(pieza.graficos ?? []).map((g, i) => (
        <Sequence
          key={i}
          from={ms(g.desdeMs)}
          durationInFrames={ms(g.hastaMs - g.desdeMs)}
          name={`grafico-${g.tipo}`}
        >
          {esMotion ? (
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
        <SubtitulosDePieza cues={cues} pieza={pieza} baseline={baseSub} />
        <Cartelito suelo={Math.max(T.safe.bottom, T.canvas.h - bandaCara + T.space[4])} />
      </Sequence>

      {/* 6 · El cierre de marca. Un segundo, idéntico en todas las piezas. */}
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
