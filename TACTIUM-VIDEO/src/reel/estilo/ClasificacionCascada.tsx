// Cascada de la clasificación (Creator Club de Diego NXT, pr-15 «Anima perfiles de redes sociales», 12-10):
// las filas de una tabla REAL entran de arriba abajo con 3 fotogramas de retraso entre cada una, cada una con
// desenfoque + desplazamiento + opacidad, y los puntos suben con un contador (Math.round) en vez de aparecer
// ya escritos. Después, la fila del líder se «asienta» (escala + brillo) y la cámara empuja despacio.
//
// Los datos NO son una captura: son filas de fcp_clasificacion (lectura pública) dibujadas en DOM, así que
// se ven nítidas y sirven para cualquier grupo/temporada. Rellenar con `scripts/liga-clasificacion.mjs`.
// Reglas de marca: sin voz ni anotaciones; todo en la zona segura estricta (x 80-910 · y 260-1540).
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { CIERRE_MS, Cierre } from "../Reel";
import { Fondo, SERIF } from "./Cinetico";
import datosDemo from "../datos/clasificacion-demo.json";

const Z = { x0: 80, x1: 910, y0: 260, y1: 1540 } as const;
const ANCHO = Z.x1 - Z.x0;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MUTED = "rgba(232,245,239,0.58)";

/** Una fila de fcp_clasificacion. */
export type FilaClasif = { posicion: number; equipo: string; enf?: number; puntos: number; sets_favor?: number; sets_contra?: number };
export type DatosClasif = { liga: string; grupo: string; filas: FilaClasif[] };

// Tiempos (ms de la pieza). El retraso entre filas es el del curso: 2-3 fotogramas (aquí 3).
const ENTRA_MS = 500; // la cabecera ya está; la primera fila entra aquí
const RETRASO_F = 3;
const FILA_F = 12; // lo que dura la entrada de cada fila
const CONTADOR_F = 24; // lo que tarda el contador de puntos en llegar
export const DUR_CLASIF_MS = 6000;

/** «ALDAY BOUCO A» → «Alday Bouco A»; las letras sueltas y los códigos con cifras («G6») se quedan en mayúsculas. */
const bonito = (s: string) =>
  s.toLowerCase().split(" ").map((p) => (p.length <= 1 || /\d/.test(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");

/** «1ª CATEGORIA MASCULINA - GRUPO A» → { categoria: «1ª Masculina», grupo: «Grupo A» }. */
const partirGrupo = (g: string) => {
  const [cat, grupo = ""] = g.split(" - ");
  const limpio = cat.replace(/CATEGORIA/i, "").replace(/\s+/g, " ").trim();
  return { categoria: bonito(limpio), grupo: bonito(grupo) };
};

const Fila: React.FC<{ f: FilaClasif; i: number; alto: number; lider: boolean }> = ({ f, i, alto, lider }) => {
  const frame = useCurrentFrame();
  const ini = ms(ENTRA_MS) + i * RETRASO_F;
  const k = Easing.out(Easing.cubic)(interpolate(frame, [ini, ini + FILA_F], [0, 1], clamp));
  const opacidad = interpolate(frame, [ini, ini + FILA_F * 0.4], [0, 1], clamp);
  const puntos = Math.round(interpolate(frame, [ini, ini + CONTADOR_F], [0, f.puntos], { ...clamp, easing: Easing.out(Easing.cubic) }));
  // El líder se asienta cuando ha terminado la cascada: un pequeño golpe de escala y brillo.
  const finCascada = ms(ENTRA_MS) + 8 * RETRASO_F + CONTADOR_F + 4;
  const asienta = lider ? interpolate(frame, [finCascada, finCascada + 8, finCascada + 22], [0, 1, 0.55], clamp) : 0;
  const escala = 1 + 0.025 * asienta;
  const sets = f.sets_favor !== undefined && f.sets_contra !== undefined ? `sets ${f.sets_favor}–${f.sets_contra}` : "";
  return (
    <div
      style={{
        height: alto,
        borderRadius: 30,
        display: "flex",
        alignItems: "center",
        padding: "0 30px 0 22px",
        gap: 24,
        background: lider ? `rgba(0,223,130,${0.1 + 0.08 * asienta})` : "rgba(232,245,239,0.055)",
        border: `1.5px solid ${lider ? T.color.accent : "rgba(232,245,239,0.10)"}`,
        boxShadow: lider ? `0 0 ${30 + 40 * asienta}px rgba(0,223,130,${0.18 + 0.22 * asienta})` : "none",
        opacity: opacidad,
        transform: `translateY(${(1 - k) * 46}px) scale(${escala})`,
        filter: `blur(${(1 - k) * 12}px)`,
        transformOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: 32, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.font.sans, fontWeight: 800, fontSize: 34,
          background: lider ? T.color.accent : "rgba(232,245,239,0.10)", color: lider ? "#04130E" : T.color.ink,
        }}
      >
        {f.posicion}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.font.sans, fontWeight: 650, fontSize: 40, letterSpacing: -0.5, color: T.color.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bonito(f.equipo)}</div>
        {sets ? <div style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 25, color: MUTED, marginTop: 2 }}>{sets}</div> : null}
      </div>
      <div style={{ textAlign: "right", flex: "none" }}>
        <span style={{ fontFamily: T.font.sans, fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: lider ? T.color.accent : T.color.ink, fontVariantNumeric: "tabular-nums" }}>{puntos}</span>
        <span style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 26, color: MUTED, marginLeft: 8 }}>pts</span>
      </div>
    </div>
  );
};

/** Cabecera + cascada de filas. Va dentro de un fondo; no incluye sonido ni cierre. */
export const ClasificacionCascada: React.FC<{ datos: DatosClasif }> = ({ datos }) => {
  const frame = useCurrentFrame();
  const { categoria, grupo } = partirGrupo(datos.grupo);
  const n = datos.filas.length;
  const hueco = 14;
  const top = 560;
  const alto = Math.min(112, (Z.y1 - top - hueco * (n - 1)) / n);
  // Empuje de cámara lento sobre toda la pizarra (la cabecera y las filas), sin salirse de la zona segura.
  const empuje = interpolate(frame, [0, ms(DUR_CLASIF_MS)], [1, 1.022], clamp);
  const cab = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ transform: `scale(${empuje})`, transformOrigin: "50% 50%" }}>
      <div style={{ position: "absolute", left: Z.x0, width: ANCHO, top: Z.y0, opacity: cab, transform: `translateY(${(1 - cab) * 18}px)`, filter: `blur(${(1 - cab) * 8}px)` }}>
        <div style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: MUTED }}>{datos.liga} · fase regular</div>
        <div style={{ fontFamily: T.font.sans, fontWeight: 800, fontSize: 84, letterSpacing: -2.5, lineHeight: 1.02, color: T.color.ink, marginTop: 14 }}>{categoria}</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, fontSize: 108, lineHeight: 1, color: T.color.accent, marginTop: 4 }}>{grupo}</div>
      </div>
      <div style={{ position: "absolute", left: Z.x0, width: ANCHO, top, display: "flex", flexDirection: "column", gap: hueco }}>
        {datos.filas.map((f, i) => (
          <Fila key={f.posicion} f={f} i={i} alto={alto} lider={i === 0} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Pieza completa 9:16: fondo + cascada + sonido + cierre de TACTIUM. */
export const ReelClasificacion: React.FC<{ datos?: DatosClasif }> = ({ datos = datosDemo as DatosClasif }) => {
  const finCascada = ENTRA_MS + ((8 * RETRASO_F + CONTADOR_F + 4) / T.canvas.fps) * 1000;
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Sequence durationInFrames={ms(DUR_CLASIF_MS)} name="clasificacion">
        <Fondo tono="oscuro" />
        <ClasificacionCascada datos={datos} />
        {/* Sonido: un whoosh que arranca justo antes de la cascada y un golpe grave cuando el líder se asienta. */}
        <Sequence from={Math.max(0, ms(ENTRA_MS - 450))} layout="none" name="whoosh-cascada">
          <Audio src={staticFile("sfx/whoosh-3.mp3")} volume={0.35} />
        </Sequence>
        <Sequence from={ms(finCascada)} layout="none" name="golpe-lider">
          <Audio src={staticFile("sfx/golpe-sub.wav")} volume={0.4} />
        </Sequence>
        <Audio
          src={staticFile("musica/pixabay-creative-technology-showreel.mp3")}
          volume={(f) => 0.07 * interpolate(f, [0, ms(400), ms(DUR_CLASIF_MS), ms(DUR_CLASIF_MS + CIERRE_MS)], [0, 1, 1, 0], clamp)}
        />
      </Sequence>
      <Sequence from={ms(DUR_CLASIF_MS)} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};

export const durClasif = () => DUR_CLASIF_MS + CIERRE_MS;
