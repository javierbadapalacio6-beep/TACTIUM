// Vídeo de lanzamiento (9:16): problema → un verbo por función → resultado → «Ya disponible».
//
// Sale de la referencia del 08-10-2026 (app de iPhone «Rotty», hecha con Opus 5.5): una cadena
// de verbos de una palabra con punto (DESLIZA. BORRA. CONSERVA.), cada uno con la app haciendo
// justo eso, luego el resultado y el cierre con «Ya disponible». El móvil se queda fijo y solo
// cambia lo que hay dentro; la palabra va ENCIMA del móvil, nunca sobre la pantalla.
//
// BORRADOR: las pantallas son capturas fijas (public/app/). Cuando haya grabaciones de 3 s por
// verbo, se cambia `img` por `video` en VERBOS y el resto no se toca.
//
//   composición `lanzamiento-L1` (variante «oscuro») y `lanzamiento-L2` (variante «color»: un fondo
//   de rejilla de color por escena, grano de película y papel que cubre la pantalla antes del
//   resultado; ver Recursos.tsx). Sin voz (solo música), así que el texto lleva el relato.
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { Fondo, SERIF, WhooshCortes } from "./Cinetico";
import { Cierre, CIERRE_MS } from "../Reel";
import { FondoPack, Grano, Papel, type Rejilla } from "./Recursos";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const suave = Easing.out(Easing.cubic);
const PROFUNDO = "#03624C";

// ── Guion ───────────────────────────────────────────────────────────────────
type Verbo = {
  palabra: string;
  etiqueta: string;
  /** Captura fija (public/…). */
  img?: string;
  /** Grabación vertical de la pantalla (public/…): sustituye a `img` cuando exista. */
  video?: string;
  /** Parte de arriba de la captura que se recorta (la barra de estado del móvil). */
  recorte?: number;
};

const VERBOS: Verbo[] = [
  { palabra: "CONFIRMA", etiqueta: "DISPONIBILIDAD", img: "app/disponibilidad.png", recorte: 0.055 },
  { palabra: "ALINEA", etiqueta: "ALINEACIONES", img: "img/alineacion-sinbarra.jpg" },
  { palabra: "COMPITE", etiqueta: "CLASIFICACIÓN", img: "app/fed-clasificacion.png", recorte: 0.055 },
  { palabra: "SIGUE", etiqueta: "JORNADAS", img: "app/fed-jornadas.png", recorte: 0.055 },
  { palabra: "INVITA", etiqueta: "EQUIPO", img: "app/equipo.png", recorte: 0.055 },
];

const AVISOS = [
  "¿Quién viene el sábado?",
  "Yo no puedo, me ha salido curro",
  "¿A qué hora era?",
  "¿Y quién trae bolas?",
  "Capi, ¿juego yo o no?",
];

// Tiempos (ms)
const AVISO_PASO = 430;
const AVISO_DESDE = 200;
const GANCHO_FIN = 2900; // entra el móvil y arranca el primer verbo
const VERBO_MS = 2300;
const VERBOS_FIN = GANCHO_FIN + VERBOS.length * VERBO_MS; // 14400
export type Variante = "oscuro" | "color";
// En «color» el papel cubre la pantalla hasta VERBOS_FIN + ~1,9 s: el corte a «Ya disponible» va debajo.
const resFin = (v: Variante) => VERBOS_FIN + (v === "color" ? 1950 : 2200);
const cuerpoMs = (v: Variante) => resFin(v) + 3300;
export const durLanzamiento = (v: Variante = "oscuro") => ms(cuerpoMs(v) + CIERRE_MS);

// ── Móvil ───────────────────────────────────────────────────────────────────
const VW = 1080;
const MOVIL_TOP = 476;
const MOVIL_ALTO = 1240;
const BORDE = 18;
const PANT_H = MOVIL_ALTO - BORDE * 2;
const PANT_W = Math.round(PANT_H * (1206 / 2622));

const Pantalla: React.FC<{ v: Verbo; durMs: number }> = ({ v, durMs }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, ms(durMs)], [1, 1.045], clamp);
  if (v.video) {
    return <OffthreadVideo src={staticFile(v.video)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />;
  }
  const rec = v.recorte ?? 0;
  const s = 1 / (1 - rec);
  return (
    <div style={{ width: PANT_W, height: PANT_H, overflow: "hidden", background: T.color.bg, position: "relative" }}>
      <Img
        src={staticFile(v.img!)}
        style={{
          position: "absolute",
          width: PANT_W * s,
          height: PANT_H * s,
          left: -(PANT_W * s - PANT_W) / 2,
          top: -rec * PANT_H * s,
          objectFit: "cover",
          objectPosition: "top",
          transform: `scale(${drift})`,
          transformOrigin: "50% 0%",
        }}
      />
    </div>
  );
};

/** El móvil fijo: entra desde abajo, cambia de pantalla con un empuje lateral y se va al llegar el resultado. */
const Movil: React.FC<{ nowMs: number }> = ({ nowMs }) => {
  const entra = interpolate(nowMs, [GANCHO_FIN - 420, GANCHO_FIN + 330], [0, 1], { ...clamp, easing: suave });
  const sale = interpolate(nowMs, [VERBOS_FIN - 120, VERBOS_FIN + 480], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (entra <= 0 || sale >= 1) return null;
  const y = (1 - entra) * 1500 + sale * 1500;
  const i = Math.min(VERBOS.length - 1, Math.max(0, Math.floor((nowMs - GANCHO_FIN) / VERBO_MS)));
  const local = nowMs - GANCHO_FIN - i * VERBO_MS;
  // Empuje lateral de 300 ms al cambiar de pantalla (no en la primera).
  const push = i === 0 ? 1 : interpolate(local, [0, 300], [0, 1], { ...clamp, easing: suave });
  const prev = i === 0 ? null : VERBOS[i - 1];
  return (
    <div
      style={{
        position: "absolute",
        left: (VW - PANT_W) / 2 - BORDE,
        top: MOVIL_TOP,
        width: PANT_W + BORDE * 2,
        height: MOVIL_ALTO,
        borderRadius: 86,
        background: "#0b1414",
        boxShadow: `0 0 0 2px ${T.color.hair}, 0 60px 120px -40px rgba(0,0,0,0.8), 0 0 90px rgba(0,223,130,0.10)`,
        transform: `translateY(${y}px)`,
      }}
    >
      <div style={{ position: "absolute", left: BORDE, top: BORDE, width: PANT_W, height: PANT_H, borderRadius: 70, overflow: "hidden", background: T.color.bg }}>
        {prev && push < 1 ? (
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${-push * PANT_W}px)` }}>
            <Pantalla v={prev} durMs={VERBO_MS} />
          </div>
        ) : null}
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - push) * PANT_W}px)` }}>
          <Sequence from={0} layout="none" key={i}>
            <Pantalla v={VERBOS[i]} durMs={VERBO_MS} />
          </Sequence>
        </div>
      </div>
    </div>
  );
};

// ── Texto ───────────────────────────────────────────────────────────────────
const Rico: React.FC<{ t: string }> = ({ t }) => (
  <>{t.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") ? <span key={i} style={{ color: T.color.accent }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}</>
);

/** Una línea que sube desde detrás de una ventana invisible (la entrada «máscara» del kit). */
const Sube: React.FC<{ nowMs: number; desdeMs: number; hastaMs?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ nowMs, desdeMs, hastaMs, children, style }) => {
  const e = interpolate(nowMs, [desdeMs, desdeMs + 340], [0, 1], { ...clamp, easing: Easing.out(Easing.poly(4)) });
  const sale = hastaMs ? interpolate(nowMs, [hastaMs - 200, hastaMs], [0, 1], clamp) : 0;
  if (nowMs < desdeMs - 20 || (hastaMs && nowMs > hastaMs)) return null;
  return (
    <span style={{ display: "block", overflow: "hidden", padding: "0.1em 0 0.28em", margin: "-0.1em 0 -0.28em", ...style }}>
      <span style={{ display: "block", transform: `translateY(${(1 - e) * 112 - sale * 40}%)`, opacity: 1 - sale }}>{children}</span>
    </span>
  );
};

const Verbos: React.FC<{ nowMs: number }> = ({ nowMs }) => (
  <>
    {VERBOS.map((v, i) => {
      const a = GANCHO_FIN + i * VERBO_MS;
      const b = a + VERBO_MS;
      if (nowMs < a - 20 || nowMs > b) return null;
      return (
        <div key={v.palabra} style={{ position: "absolute", left: 80, right: 170, top: 228, height: 214 }}>
          <Sube nowMs={nowMs} desdeMs={a + 40} hastaMs={i === VERBOS.length - 1 ? undefined : b}
            style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 30, letterSpacing: "0.16em", color: T.color.muted }}>
            {String(i + 1).padStart(2, "0")} · {v.etiqueta}
          </Sube>
          <Sube nowMs={nowMs} desdeMs={a + 110} hastaMs={i === VERBOS.length - 1 ? undefined : b}
            style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 146, lineHeight: 1, letterSpacing: "-0.05em", color: T.color.ink, marginTop: 14, whiteSpace: "nowrap" }}>
            {v.palabra}<span style={{ color: T.color.accent }}>.</span>
          </Sube>
        </div>
      );
    })}
  </>
);

// ── Gancho: los mensajes que se acumulan ────────────────────────────────────
const Gancho: React.FC<{ nowMs: number }> = ({ nowMs }) => {
  const sale = interpolate(nowMs, [GANCHO_FIN - 520, GANCHO_FIN - 120], [0, 1], clamp);
  if (sale >= 1) return null;
  // Cuántos avisos han llegado (continuo, para que el resto baje con suavidad).
  const llegada = (k: number) => interpolate(nowMs, [AVISO_DESDE + k * AVISO_PASO, AVISO_DESDE + k * AVISO_PASO + 340], [0, 1], { ...clamp, easing: suave });
  const n = AVISOS.reduce((a, _, k) => a + llegada(k), 0);
  return (
    <AbsoluteFill style={{ opacity: 1 - sale }}>
      {/* El gancho entra ya en el primer fotograma. */}
      <div style={{ position: "absolute", left: 80, right: 170, top: 250, height: 200, display: "flex", alignItems: "flex-end",
        fontFamily: T.font.sans, fontWeight: 900, fontSize: 80, lineHeight: 1.02, letterSpacing: "-0.04em", color: T.color.ink }}>
        <div><Rico t="Organizar el equipo *no debería ser esto*" /></div>
      </div>
      {AVISOS.map((txt, k) => {
        const e = llegada(k);
        if (e <= 0) return null;
        const p = n - 1 - k; // 0 = la más nueva, arriba
        return (
          <div key={k} style={{
            position: "absolute", left: 80, width: 780, top: 560 + p * 190 - (1 - e) * 70, height: 160,
            borderRadius: 40, background: "rgba(12,34,34,0.94)", boxShadow: `0 0 0 2px ${T.color.hair}, 0 24px 60px -20px rgba(0,0,0,0.7)`,
            display: "flex", alignItems: "center", gap: 28, padding: "0 34px",
            opacity: e * Math.max(0.35, 1 - p * 0.14), transform: `scale(${1 - Math.max(0, p) * 0.02})`, transformOrigin: "50% 0%",
          }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", background: "rgba(232,245,239,0.14)", flexShrink: 0, position: "relative" }}>
              <div style={{ position: "absolute", left: 25, top: 14, width: 28, height: 28, borderRadius: "50%", background: "rgba(232,245,239,0.5)" }} />
              <div style={{ position: "absolute", left: 14, top: 46, width: 50, height: 26, borderRadius: "26px 26px 4px 4px", background: "rgba(232,245,239,0.5)" }} />
            </div>
            <div>
              <div style={{ fontFamily: T.font.mono, fontWeight: 500, fontSize: 24, letterSpacing: "0.14em", color: T.color.muted }}>EQUIPO · AHORA</div>
              <div style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 42, lineHeight: 1.1, letterSpacing: "-0.02em", color: T.color.ink, marginTop: 6 }}>{txt}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Resultado: tarjeta clara ────────────────────────────────────────────────
const Resultado: React.FC<{ nowMs: number; v: Variante }> = ({ nowMs, v }) => {
  const a = VERBOS_FIN;
  const papel = v === "color"; // el texto va impreso sobre el papel, que ya hace de tarjeta
  const hasta = papel ? a + 1800 : undefined;
  const entra = interpolate(nowMs, [a - 40, a + 460], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (nowMs < a - 60 || nowMs > resFin(v) + 600) return null;
  return (
    <AbsoluteFill style={papel ? undefined : { clipPath: `inset(${(1 - entra) * 100}% 0 0 0)` }}>
      {papel ? null : <Fondo tono="claro" />}
      <div style={{ position: "absolute", left: 80, right: 170, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Sube nowMs={nowMs} desdeMs={a + (papel ? 300 : 200)} hastaMs={hasta} style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 190, lineHeight: 0.96, letterSpacing: "-0.055em", color: "#0E1A14" }}>TODO EL</Sube>
        <Sube nowMs={nowMs} desdeMs={a + (papel ? 420 : 320)} hastaMs={hasta} style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 190, lineHeight: 0.96, letterSpacing: "-0.055em", color: "#0E1A14" }}>EQUIPO</Sube>
        <Sube nowMs={nowMs} desdeMs={a + (papel ? 720 : 620)} hastaMs={hasta} style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 122, lineHeight: 1, letterSpacing: "-0.01em", color: PROFUNDO, marginTop: 26, whiteSpace: "nowrap" }}>en un solo sitio.</Sube>
      </div>
    </AbsoluteFill>
  );
};

// ── Ya disponible ───────────────────────────────────────────────────────────
// Insignias OFICIALES (public/img/tiendas/). Reglas de Apple y Google que se cumplen aquí:
// ni se modifican, ni se inclinan, ni se animan (entran de golpe, sin deslizar ni fundir);
// la de Apple es la negra, va primera y es la única de Apple; la de Google es igual o mayor;
// separación ≥ 1/4 del alto; alto ≥ 40 px (Apple) y 28 px (Google).
// El PNG de Google trae 29 px transparentes arriba y abajo de 250: se recortan con la ventana,
// no tocando el archivo.
const INSIGNIA_H = 112;
const Insignias: React.FC = () => {
  const gh = INSIGNIA_H * (250 / 192); // alto del PNG entero para que lo visible mida INSIGNIA_H
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 44, marginTop: 70 }}>
      <Img src={staticFile("img/tiendas/app-store-es.svg")} style={{ height: INSIGNIA_H, width: INSIGNIA_H * (119.66407 / 40), display: "block" }} />
      <div style={{ height: INSIGNIA_H, width: INSIGNIA_H * (646 / 192), overflow: "hidden" }}>
        <Img src={staticFile("img/tiendas/google-play-es.png")} style={{ height: gh, width: INSIGNIA_H * (646 / 192), display: "block", marginTop: -INSIGNIA_H * (29 / 192) }} />
      </div>
    </div>
  );
};

const Disponible: React.FC<{ nowMs: number; v: Variante }> = ({ nowMs, v }) => {
  const a = resFin(v);
  const entra = interpolate(nowMs, [a - 40, a + 460], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  if (nowMs < a - 60) return null;
  return (
    <AbsoluteFill style={v === "color" ? undefined : { clipPath: `inset(${(1 - entra) * 100}% 0 0 0)` }}>
      {v === "color" ? null : <Fondo tono="oscuro" />}
      <div style={{ position: "absolute", left: 80, right: 170, top: 560 }}>
        <Sube nowMs={nowMs} desdeMs={a + 80} style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 210, lineHeight: 0.96, letterSpacing: "-0.055em", color: T.color.ink }}>YA</Sube>
        <Sube nowMs={nowMs} desdeMs={a + 220} style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 210, lineHeight: 1, letterSpacing: "-0.01em", color: T.color.accent }}>disponible</Sube>
        {nowMs >= a + 700 ? <Insignias /> : <div style={{ height: INSIGNIA_H, marginTop: 70 }} />}
        <div style={{ marginTop: 48, opacity: interpolate(nowMs, [a + 1200, a + 1500], [0, 1], clamp), fontFamily: T.font.mono, fontSize: 38, letterSpacing: "0.12em", color: T.color.muted }}>
          tactium.io
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Fondos de color (variante «color») ──────────────────────────────────────
// Una rejilla por escena. La rejilla de partida y el tono objetivo (grados de hue) se eligen
// para que todo quede en la familia verde de la marca y solo el gancho rompa a rojo: es el
// problema, y el verde llega con la solución.
type Seg = { desde: number; hasta: number; rejilla: Rejilla; tono?: number; sat?: number; brillo?: number; off: number };
const PALETA: Omit<Seg, "desde" | "hasta" | "off">[] = [
  { rejilla: "azul", tono: 154, brillo: 1.25 }, // verde de marca
  { rejilla: "azul", tono: 170, brillo: 1.25 }, // turquesa verdoso
  { rejilla: "oro", tono: 116, brillo: 1.9, sat: 1.4 }, // lima
  { rejilla: "azul", tono: 160, brillo: 1.1 }, // esmeralda
  { rejilla: "rojo", tono: 146, brillo: 1.7 }, // verde fresco
];
const SEGS_COLOR: Seg[] = [
  { desde: 0, hasta: GANCHO_FIN, rejilla: "rojo", sat: 1.15, brillo: 1.45, off: 0 },
  ...VERBOS.map((_, i): Seg => ({ ...PALETA[i], desde: GANCHO_FIN + i * VERBO_MS, hasta: GANCHO_FIN + (i + 1) * VERBO_MS, off: 900 + i * 1700 })),
  { desde: resFin("color"), hasta: cuerpoMs("color"), rejilla: "azul", tono: 154, brillo: 1.5, off: 4000 },
];

const SegFondo: React.FC<{ s: Seg; primero: boolean }> = ({ s, primero }) => {
  const frame = useCurrentFrame();
  const o = primero ? 1 : interpolate(frame, [0, ms(320)], [0, 1], clamp);
  return <FondoPack rejilla={s.rejilla} tono={s.tono} sat={s.sat} brillo={s.brillo} desdeMs={s.off} opacidad={o} />;
};

const FondosColor: React.FC = () => (
  <>
    {SEGS_COLOR.map((s, i) => (
      <Sequence key={i} from={ms(s.desde)} durationInFrames={ms(s.hasta - s.desde + 450)} layout="none" name={`fondo-${i}`}>
        <SegFondo s={s} primero={i === 0} />
      </Sequence>
    ))}
  </>
);

// ── Composición ─────────────────────────────────────────────────────────────
const whooshEn = (v: Variante) => [
  GANCHO_FIN,
  ...VERBOS.slice(1).map((_, i) => GANCHO_FIN + (i + 1) * VERBO_MS),
  ...(v === "color" ? [VERBOS_FIN - 520] : [VERBOS_FIN]), // en «color», la bola de papel llega antes
  resFin(v),
];

export const Lanzamiento: React.FC<{ variante?: Variante }> = ({ variante = "oscuro" }) => {
  const frame = useCurrentFrame();
  const nowMs = (frame / T.canvas.fps) * 1000;
  const v = variante;
  const color = v === "color";
  const total = cuerpoMs(v) + CIERRE_MS;
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Audio
        src={staticFile("musica/pixabay-music-promotion.mp3")}
        volume={(f) => 0.2 * interpolate(f, [0, 8, ms(total) - ms(700), ms(total)], [0, 1, 1, 0], clamp)}
      />
      {nowMs < cuerpoMs(v) ? (
        <>
          <Fondo tono="oscuro" />
          {color ? <FondosColor /> : null}
          {color ? <Grano opacidad={0.28} /> : null}
          <Gancho nowMs={nowMs} />
          <Movil nowMs={nowMs} />
          <Verbos nowMs={nowMs} />
          {color ? (
            <>
              <Disponible nowMs={nowMs} v={v} />
              <Sequence from={ms(VERBOS_FIN - 1250)} durationInFrames={ms(5300)} layout="none" name="papel">
                <Papel clip="08" velocidad={0.8} />
              </Sequence>
              <Resultado nowMs={nowMs} v={v} />
            </>
          ) : (
            <>
              <Resultado nowMs={nowMs} v={v} />
              <Disponible nowMs={nowMs} v={v} />
            </>
          )}
        </>
      ) : null}
      {AVISOS.map((_, k) => (
        <Sequence key={k} from={ms(AVISO_DESDE + k * AVISO_PASO)} layout="none" name={`aviso-${k + 1}`}>
          <Audio src={staticFile("sfx/notif.wav")} volume={0.3} />
        </Sequence>
      ))}
      <WhooshCortes cortesMs={whooshEn(v)} volumen={0.3} />
      <Sequence from={ms(cuerpoMs(v))} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
