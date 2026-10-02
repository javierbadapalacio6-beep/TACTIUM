// Estilo cinético: la tipografía ES el montaje.
//
// Sale del análisis de un reel de referencia (28-09-2026) hecho también con
// Remotion. Lo que lo hace atractivo no es una librería: es ritmo y tipografía.
//  - El texto no va abajo como un subtítulo: vive en el hueco libre del plano,
//    palabra a palabra, y la palabra que carga el sentido sale GRANDE.
//  - Cada 2-4 segundos se corta a una tarjeta a pantalla completa (fondo de
//    color con luces suaves) donde la frase se convierte en un gráfico.
//  - Recursos de golpe: palabra gigante que llena el ancho, texto que se
//    «descifra» (scramble), rejilla de iconos, imagen de apoyo con zoom lento.
//  - Mezcla de letra: sans muy negra + una serif en cursiva para la palabra
//    emocional.
// Aquí va adaptado a la marca: lienzo #030F0F, verde #00DF82 y verde profundo.
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { limpia, type Palabra } from "../Karaoke";
import { Icono, type IconoNombre } from "./Iconos";

/** Icono para una palabra clave: el nombre, o nombre + texto del contador (p. ej. «84»). */
export type IconoDe = IconoNombre | { n: IconoNombre; extra?: string };

export const SERIF = "'Instrument Serif', Georgia, serif";
const PROFUNDO = "#03624C";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ahoraMs = (frame: number) => (frame / T.canvas.fps) * 1000;
const norm = (t: string) => limpia(t).toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Fondos
// ─────────────────────────────────────────────────────────────────────────────

/** Tarjeta de color con dos luces que se mueven despacio. `claro` u `oscuro`. */
export const Fondo: React.FC<{ tono: "oscuro" | "claro" }> = ({ tono }) => {
  const frame = useCurrentFrame();
  const d = frame / T.canvas.fps;
  const x1 = 20 + Math.sin(d * 0.6) * 8;
  const y1 = 18 + Math.cos(d * 0.5) * 6;
  const x2 = 82 + Math.cos(d * 0.4) * 7;
  const y2 = 88 + Math.sin(d * 0.7) * 5;
  const claro = tono === "claro";
  return (
    <AbsoluteFill
      style={{
        background: claro
          ? `radial-gradient(ellipse 45% 55% at ${x1}% ${y1}%, rgba(0,223,130,0.28), transparent 70%),
             radial-gradient(ellipse 50% 45% at ${x2}% ${y2}%, rgba(3,98,76,0.22), transparent 70%), #F3F9F6`
          : `radial-gradient(ellipse 45% 55% at ${x1}% ${y1}%, rgba(0,223,130,0.20), transparent 70%),
             radial-gradient(ellipse 55% 50% at ${x2}% ${y2}%, rgba(3,98,76,0.55), transparent 70%), ${T.color.bg}`,
      }}
    />
  );
};

/** Imagen de apoyo a pantalla completa, con zoom lento y oscurecida a la izquierda. */
export const Imagen: React.FC<{ src: string; durMs: number }> = ({ src, durMs }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, ms(durMs)], [1.02, 1.12], clamp);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: T.color.bg }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(3,15,15,0.82) 0%, rgba(3,15,15,0.45) 55%, rgba(3,15,15,0.15) 100%)" }} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Texto cinético: golpes de «palabras pequeñas + palabra clave grande»
// ─────────────────────────────────────────────────────────────────────────────

/** Parte en golpes: cada golpe acaba en su palabra clave. Lo que sobra al final va sin clave. */
export const golpes = (ws: Palabra[], claves: Set<string>): Palabra[][] => {
  const res: Palabra[][] = [];
  let cur: Palabra[] = [];
  for (const w of ws) {
    cur.push(w);
    if (claves.has(norm(w.t))) {
      res.push(cur);
      cur = [];
    }
  }
  if (cur.length) res.push(cur);
  return res;
};

/**
 * Cómo entra cada palabra. Cambia de un reel a otro para que la serie no se repita:
 *  - `desenfoque`: entra desenfocada y se enfoca (la de siempre).
 *  - `mascara`: sube desde debajo de una línea invisible, seca, sin desenfoque.
 *  - `maquina`: aparece letra a letra, como tecleada.
 */
export type AnimTexto = "desenfoque" | "mascara" | "maquina";
export const AnimacionTexto = React.createContext<AnimTexto>("desenfoque");

const Entra: React.FC<{ aMs: number; children: React.ReactNode; style?: React.CSSProperties; fuerte?: boolean }> = ({
  aMs,
  children,
  style,
  fuerte,
}) => {
  const frame = useCurrentFrame();
  const modo = React.useContext(AnimacionTexto);
  const now = ahoraMs(frame);
  if (modo === "maquina" && typeof children === "string") {
    const dur = Math.max(160, children.length * (fuerte ? 55 : 35));
    const n = Math.round(interpolate(now, [aMs - 40, aMs - 40 + dur], [0, children.length], clamp));
    return (
      <span style={{ display: "inline-block", ...style }}>
        {children.slice(0, n)}
        <span style={{ opacity: 0 }}>{children.slice(n)}</span>
      </span>
    );
  }
  const t = interpolate(now, [aMs - 60, aMs + (fuerte ? 220 : 140)], [0, 1], clamp);
  if (modo === "mascara") {
    const e = 1 - Math.pow(1 - t, 4);
    return (
      // La ventana que recorta tiene que dejar sitio a los rabos (j, g, p) y a las tildes: se
      // amplía por arriba y por abajo con padding y se compensa con margen negativo, así la
      // palabra no se mueve de su línea.
      <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", padding: "0.12em 0 0.3em", margin: "-0.12em 0 -0.3em", ...style }}>
        {/* Baja lo bastante para quedar entera por debajo de la ventana (que se amplió 0,3 em
            por abajo): si no, antes de entrar asoma el borde de la palabra. */}
        <span style={{ display: "inline-block", transform: `translateY(${(1 - e) * 160}%)`, opacity: e > 0 ? 1 : 0 }}>{children}</span>
      </span>
    );
  }
  if (t <= 0) return <span style={{ ...style, opacity: 0 }}>{children}</span>;
  return (
    <span
      style={{
        display: "inline-block",
        ...style,
        opacity: t,
        filter: `blur(${(1 - t) * (fuerte ? 14 : 6)}px)`,
        transform: `translateY(${(1 - t) * (fuerte ? 18 : 8)}px) scale(${fuerte ? 1 + (1 - t) * 0.06 : 1})`,
      }}
    >
      {children}
    </span>
  );
};

type Tono = "oscuro" | "claro";
const tinta = (tono: Tono) => ({
  suave: tono === "claro" ? "rgba(3,98,76,0.72)" : "rgba(232,245,239,0.78)",
  clave: tono === "claro" ? PROFUNDO : T.color.accent,
  media: tono === "claro" ? PROFUNDO : T.color.ink,
});

/**
 * El golpe que toca: palabras pequeñas en una línea y la clave debajo, grande.
 * Los tiempos de `ws` son relativos al inicio de la escena.
 */
export const TextoCinetico: React.FC<{
  ws: Palabra[];
  claves: string[];
  serif?: string[];
  tono: Tono;
  alinear?: "izq" | "centro";
  ancho: number;
  finMs: number;
  escala?: number;
  /** Icono que acompaña a una palabra clave (clave en minúsculas → icono). Uno por golpe. */
  iconos?: Record<string, IconoDe>;
}> = ({ ws, claves, serif = [], tono, alinear = "izq", ancho, finMs, escala = 1, iconos }) => {
  const frame = useCurrentFrame();
  const now = ahoraMs(frame);
  const gs = golpes(ws, new Set(claves.map((c) => c.toLowerCase())));
  // El último golpe se queda hasta el final de la escena (antes se iba 80 ms antes y el
  // corte llegaba con 2-3 fotogramas vacíos).
  const idx = gs.findIndex((g, i) => now >= g[0].a - 80 && now < (gs[i + 1] ? gs[i + 1][0].a - 80 : finMs + 1000));
  if (idx < 0) return null;
  const g = gs[idx];
  const c = tinta(tono);
  const setClaves = new Set(claves.map((x) => x.toLowerCase()));
  const setSerif = new Set(serif.map((x) => x.toLowerCase()));
  const ultima = g[g.length - 1];
  const hayClave = setClaves.has(norm(ultima.t));
  const pequenas = hayClave ? g.slice(0, -1) : g;
  const esSerif = hayClave && setSerif.has(norm(ultima.t));
  // La clave cabe siempre en `ancho`, icono incluido (en vertical «20 segundos» con su
  // cronómetro se salía por la derecha; T1, 01-10). ~0,6 em por letra en la sans negra.
  const conIcono = !!iconos?.[norm(ultima.t)];
  const cabe = ancho / ((esSerif ? 1.18 : 1) * (limpia(ultima.t).length * 0.6 + (conIcono ? 0.95 : 0)));
  const tamClave = Math.min(170 * escala, (ancho / Math.max(4, limpia(ultima.t).length)) * 1.7 * escala, cabe * 0.97);

  return (
    <div style={{ width: ancho, textAlign: alinear === "centro" ? "center" : "left" }}>
      <div
        style={{
          fontFamily: T.font.sans,
          fontWeight: hayClave ? 500 : 900,
          fontSize: (hayClave ? 50 : 84) * escala,
          lineHeight: 1.15,
          letterSpacing: hayClave ? "-0.01em" : "-0.03em",
          color: hayClave ? c.suave : c.media,
        }}
      >
        {pequenas.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 ? " " : null}
            <Entra aMs={p.a}>{limpia(p.t)}</Entra>
          </React.Fragment>
        ))}
      </div>
      {hayClave ? (
        <div
          style={{
            fontFamily: esSerif ? SERIF : T.font.sans,
            fontStyle: esSerif ? "italic" : "normal",
            fontWeight: esSerif ? 400 : 900,
            fontSize: esSerif ? tamClave * 1.18 : tamClave,
            lineHeight: 1,
            letterSpacing: esSerif ? "-0.01em" : "-0.045em",
            // «rojo» con su aviso va en rojo: el verde contaría lo contrario.
            color: (() => { const ic = iconos?.[norm(ultima.t)]; return ic && (typeof ic === "string" ? ic : ic.n) === "aviso" ? "#FF5A5F" : c.clave; })(),
            // El icono y la palabra, siempre en la misma línea.
            whiteSpace: "nowrap",
            marginTop: 6 * escala,
          }}
        >
          {(() => {
            const ic = iconos?.[norm(ultima.t)];
            if (!ic) return null;
            const n = typeof ic === "string" ? ic : ic.n;
            return <Icono nombre={n} extra={typeof ic === "string" ? undefined : ic.extra} aMs={ultima.a} size={Math.round((esSerif ? tamClave * 1.18 : tamClave) * 0.78)} tono={tono} />;
          })()}
          <Entra aMs={ultima.a} fuerte>
            {limpia(ultima.t)}
          </Entra>
        </div>
      ) : null}
    </div>
  );
};

/** Lista que se acumula (TORNEOS / GRUPOS / …): la que se dice, en color; las dichas, pálidas. */
export const Lista: React.FC<{ ws: Palabra[]; claves: string[]; serif?: string[]; tono: Tono }> = ({
  ws,
  claves,
  serif = [],
  tono,
}) => {
  const frame = useCurrentFrame();
  const now = ahoraMs(frame);
  const setC = new Set(claves.map((x) => x.toLowerCase()));
  const setS = new Set(serif.map((x) => x.toLowerCase()));
  const items = ws.filter((w) => setC.has(norm(w.t)));
  const actual = items.reduce((acc, w, i) => (now >= w.a - 60 ? i : acc), -1);
  const c = tinta(tono);
  return (
    <div>
      {items.map((w, i) => {
        const s = setS.has(norm(w.t));
        return (
          <div
            key={i}
            style={{
              fontFamily: s ? SERIF : T.font.sans,
              fontStyle: s ? "italic" : "normal",
              fontWeight: s ? 400 : 900,
              fontSize: s ? 118 : 92,
              lineHeight: 1.02,
              letterSpacing: s ? "-0.01em" : "-0.04em",
              textTransform: s ? "none" : "uppercase",
              color: i === actual ? c.clave : tono === "claro" ? "rgba(3,98,76,0.28)" : "rgba(232,245,239,0.28)",
            }}
          >
            <Entra aMs={w.a} fuerte>
              {limpia(w.t)}
            </Entra>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Golpes gráficos
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras gigantes que llenan el ancho; cada una sube por su máscara cuando se dice. */
export const Gigante: React.FC<{ ws: Palabra[]; ancho: number; color?: string }> = ({ ws, ancho, color = T.color.accent }) => {
  const frame = useCurrentFrame();
  const now = ahoraMs(frame);
  const texto = ws.map((w) => limpia(w.t).toUpperCase()).join(" ");
  const size = Math.min(320, ancho / (texto.length * 0.6));
  return (
    <div
      style={{
        fontFamily: T.font.sans,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 0.9,
        letterSpacing: "-0.05em",
        color,
        whiteSpace: "nowrap",
        textAlign: "center",
      }}
    >
      {ws.map((w, i) => {
        const letras = limpia(w.t).toUpperCase().split("");
        return (
          <span key={i} style={{ display: "inline-block", marginRight: i < ws.length - 1 ? "0.22em" : 0, overflow: "hidden", verticalAlign: "bottom", padding: "0.12em 0 0.3em", margin: `-0.12em ${i < ws.length - 1 ? "0.22em" : "0"} -0.3em 0` }}>
            {letras.map((l, j) => {
              const t = interpolate(now, [w.a - 80 + j * 28, w.a + 180 + j * 28], [0, 1], clamp);
              const e = 1 - Math.pow(1 - t, 4);
              return (
                <span key={j} style={{ display: "inline-block", transform: `translateY(${(1 - e) * 105}%)` }}>
                  {l}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Una palabra que se «descifra» letra a letra antes de quedarse quieta. */
export const Descifra: React.FC<{ texto: string; aMs: number; durMs?: number; size: number; tono: Tono }> = ({
  texto,
  aMs,
  durMs = 520,
  size,
  tono,
}) => {
  const frame = useCurrentFrame();
  const now = ahoraMs(frame);
  if (now < aMs - 60) return <div style={{ height: size }} />;
  const p = interpolate(now, [aMs, aMs + durMs], [0, 1], clamp);
  const letras = texto.toUpperCase().split("");
  const fijas = Math.floor(p * letras.length);
  const paso = Math.floor(frame / 2);
  const hecho = p >= 1;
  return (
    <div
      style={{
        fontFamily: T.font.sans,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.03em",
        color: hecho ? tinta(tono).clave : tinta(tono).media,
      }}
    >
      {letras.map((l, i) =>
        i < fijas || l === " " ? l : ALFABETO[Math.floor(random(`${texto}-${i}-${paso}`) * ALFABETO.length)],
      ).join("")}
    </div>
  );
};

/** Rejilla de jugadores: se encienden de uno en uno; los últimos se quedan apagados (no pueden). */
export const Rejilla: React.FC<{ total: number; disponibles: number; desdeMs: number; pasoMs?: number; columnas?: number }> = ({
  total,
  disponibles,
  desdeMs,
  pasoMs = 70,
  columnas = 7,
}) => {
  const frame = useCurrentFrame();
  const now = ahoraMs(frame);
  const lado = 96;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnas}, ${lado}px)`, gap: 34, justifyContent: "center" }}>
      {Array.from({ length: total }).map((_, i) => {
        const t = interpolate(now, [desdeMs + i * pasoMs, desdeMs + i * pasoMs + 180], [0, 1], clamp);
        const on = i < disponibles;
        const col = on ? T.color.accent : "rgba(232,245,239,0.22)";
        return (
          <div key={i} style={{ width: lado, height: lado, position: "relative", opacity: 0.25 + 0.75 * t, transform: `scale(${0.85 + 0.15 * t})` }}>
            <div style={{ position: "absolute", left: lado * 0.3, top: 0, width: lado * 0.4, height: lado * 0.4, borderRadius: "50%", background: t > 0.5 ? col : "rgba(232,245,239,0.14)" }} />
            <div style={{ position: "absolute", left: lado * 0.12, top: lado * 0.48, width: lado * 0.76, height: lado * 0.46, borderRadius: `${lado}px ${lado}px 10px 10px`, background: t > 0.5 ? col : "rgba(232,245,239,0.14)" }} />
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Efectos de los packs (MOTION GRAPICHS TACTIUM/PACKS → public/efectos/)
// ─────────────────────────────────────────────────────────────────────────────

/** Los efectos de los packs vienen en azul: girando el tono ~75° caen en el verde de marca. */
export const TINTE_MARCA = -75;

/**
 * Un efecto sobre fondo negro (glitch, quemado de película, destello) fundido en modo
 * «pantalla»: el negro desaparece y solo queda la luz. Va en un Sequence con
 * `layout="none"` para que la fusión alcance a lo que hay debajo.
 */
export const Efecto: React.FC<{ src: string; tinte?: number; opacidad?: number; velocidad?: number }> = ({
  src,
  tinte,
  opacidad = 1,
  velocidad = 1,
}) => (
  <OffthreadVideo
    src={staticFile(src)}
    muted
    playbackRate={velocidad}
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      mixBlendMode: "screen",
      opacity: opacidad,
      filter: tinte ? `hue-rotate(${tinte}deg) saturate(1.4)` : undefined,
      pointerEvents: "none",
    }}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Riser del gancho (packs/SOUND EFFECTS): intriga que sube durante el gancho y cuyo pico
// cae justo en el corte, rematado con un golpe de sub. Se elige el que encaje con lo que
// dura el gancho (pico medido de cada archivo).
// ─────────────────────────────────────────────────────────────────────────────
// El riser lo eligió Javier (30-09): «RISER.mp3» del pack 1, pico a los 2,8 s. Si el gancho
// dura menos, se entra con el riser ya empezado para que el pico siga cayendo en el corte.
const RISERS = [{ src: "sfx/riser-gancho.mp3", picoMs: 2800 }];

export const RiserGancho: React.FC<{ finMs: number; volumen?: number }> = ({ finMs, volumen = 0.3 }) => {
  const r = RISERS[0];
  const inicio = finMs - r.picoMs;
  return (
    <>
      <Sequence from={ms(Math.max(0, inicio))} layout="none" name="riser-gancho">
        <Audio src={staticFile(r.src)} trimBefore={inicio < 0 ? ms(-inicio) : undefined} volume={volumen} />
      </Sequence>
      <Sequence from={ms(finMs)} layout="none" name="golpe-corte">
        <Audio src={staticFile("sfx/golpe-sub.wav")} volume={0.4} />
      </Sequence>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Whoosh en cada corte (packs): van rotando para no repetir y su pico cae en el corte.
// ─────────────────────────────────────────────────────────────────────────────
const WHOOSHES = [
  { src: "sfx/whoosh-1.mp3", picoMs: 500 },
  { src: "sfx/whip.mp3", picoMs: 500 },
  { src: "sfx/whoosh-4.mp3", picoMs: 550 },
  { src: "sfx/whoosh-2.wav", picoMs: 1050 },
  { src: "sfx/whoosh-3.mp3", picoMs: 550 },
];

export const WhooshCortes: React.FC<{ cortesMs: number[]; volumen?: number }> = ({ cortesMs, volumen = 0.35 }) => (
  <>
    {cortesMs.map((c, i) => {
      const w = WHOOSHES[i % WHOOSHES.length];
      return (
        <Sequence key={i} from={Math.max(0, ms(c - w.picoMs))} layout="none" name={`whoosh-${i + 1}`}>
          <Audio src={staticFile(w.src)} volume={volumen} />
        </Sequence>
      );
    })}
  </>
);

/** Los sonidos de escena que ya cubren los whoosh automáticos (no se duplican). */
export const esWhoosh = (sfx?: string) => !!sfx && /whoosh|swoosh|whip/.test(sfx);
