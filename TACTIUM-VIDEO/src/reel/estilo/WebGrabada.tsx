// Recorrido grabado de la web (scripts/grabar-web.mjs) montado en 9:16: la grabación dentro
// de un móvil, un dedo que llega a cada toque con su onda y un zoom suave hacia donde pasa
// la acción. Es lo que hace Recordly, pero repetible: si la web cambia, se vuelve a grabar.
//
//   composición `web-<recorrido>`; datos en public/web/grabaciones/<recorrido>.json
import React from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "../tokens";
import { Fondo } from "./Cinetico";
import torneosPublico from "../../../public/web/grabaciones/torneos-publico.json";
import buscaTuEquipo from "../../../public/web/grabaciones/busca-tu-equipo.json";

type Grabacion = { nombre: string; ancho: number; alto: number; inicioMs: number; finMs: number; toques: { ms: number; x: number; y: number }[] };

export const GRABACIONES: Grabacion[] = [torneosPublico as Grabacion, buscaTuEquipo as Grabacion];
export const durGrabacion = (g: Grabacion) => g.finMs - g.inicioMs;

const VW = 1080;
// El móvil, dentro de la zona segura de Reels (y 212-1547 por la guía; el móvil puede bajar algo más).
const MOVIL_ALTO = 1500;
const BORDE = 18;

const Dedo: React.FC<{ g: Grabacion; escala: number; now: number }> = ({ g, escala, now }) => {
  // Toque más reciente que ya ha empezado (el dedo aparece 450 ms antes y se va 700 ms después).
  const t = [...g.toques].reverse().find((x) => now >= x.ms - 450);
  if (!t || now > t.ms + 260 + 700) return null;
  const toque = t.ms + 260; // la página reacciona a los 260 ms (grabar-web.mjs)
  const entra = interpolate(now, [t.ms - 450, t.ms - 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sale = interpolate(now, [toque + 350, toque + 700], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const aprieta = interpolate(now, [toque - 90, toque, toque + 140], [1, 0.78, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const onda = interpolate(now, [toque, toque + 520], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const x = t.x * escala, y = t.y * escala;
  return (
    <>
      {now >= toque ? (
        <div style={{ position: "absolute", left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: "50%",
          border: `4px solid ${T.color.accent}`, opacity: (1 - onda) * 0.9, transform: `scale(${0.3 + onda * 0.9})` }} />
      ) : null}
      <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: "50%",
        background: "rgba(255,255,255,0.42)", boxShadow: "0 0 0 3px rgba(255,255,255,0.75), 0 10px 30px rgba(0,0,0,0.35)",
        opacity: entra * sale, transform: `scale(${(0.7 + entra * 0.3) * aprieta})` }} />
    </>
  );
};

export const WebGrabada: React.FC<{ nombre: string; top?: number; alto?: number; desdeMs?: number }> = ({ nombre, top = 190, alto = MOVIL_ALTO, desdeMs = 0 }) => {
  const g = GRABACIONES.find((x) => x.nombre === nombre)!;
  const frame = useCurrentFrame();
  const now = Math.min(g.finMs, g.inicioMs + (frame / T.canvas.fps) * 1000 - desdeMs); // ms de la grabación
  const altoPantalla = alto - BORDE * 2;
  const escala = altoPantalla / g.alto; // px CSS de la web → px del vídeo
  const anchoPantalla = g.ancho * escala;
  // Zoom suave hacia cada toque: sube al acercarse el dedo y vuelve después.
  let zoom = 1, ox = g.ancho / 2, oy = g.alto / 2;
  for (const t of g.toques) {
    const z = interpolate(now, [t.ms - 600, t.ms, t.ms + 900, t.ms + 1500], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
    if (z > 0) { zoom = 1 + 0.12 * z; ox = t.x; oy = t.y; }
  }
  const entra = interpolate(frame, [0, ms(500)], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Fondo tono="oscuro" />
      <div style={{ position: "absolute", left: (VW - anchoPantalla) / 2 - BORDE, top, width: anchoPantalla + BORDE * 2, height: alto,
        borderRadius: 86, background: "#0b1414", boxShadow: `0 0 0 2px ${T.color.hair}, 0 60px 120px -40px rgba(0,0,0,0.8)`,
        opacity: entra, transform: `translateY(${(1 - entra) * 60}px)` }}>
        <div style={{ position: "absolute", left: BORDE, top: BORDE, width: anchoPantalla, height: altoPantalla, borderRadius: 70, overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", transform: `scale(${zoom})`, transformOrigin: `${ox * escala}px ${oy * escala}px` }}>
            <OffthreadVideo src={staticFile(`web/grabaciones/${g.nombre}.mp4`)} trimBefore={ms(g.inicioMs)} muted style={{ width: "100%", height: "100%" }} />
            <Dedo g={g} escala={escala} now={now} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Reel montado sobre una grabación: gancho y pasos encima del móvil, cierre con la llamada ──
// Los textos van en la franja de arriba (y 250-430, dentro de la zona segura) y el móvil debajo.
// `*palabra*` sale en verde. Los tiempos son ms desde el inicio útil de la grabación.
type ReelWebDef = {
  id: string; grabacion: string; musica: string; volumen: number;
  textos: { desdeMs: number; texto: string }[];
  cierre: { titulo: string; sub: string; durMs: number };
};
export const REELS_WEB: ReelWebDef[] = [
  {
    id: "W1", grabacion: "busca-tu-equipo", musica: "musica/pixabay-creative-technology-showreel.mp3", volumen: 0.5,
    textos: [
      { desdeMs: 0, texto: "¿Contra quién juegas *este año?*" },
      { desdeMs: 2100, texto: "Buscas *tu equipo*" },
      { desdeMs: 8200, texto: "Tu grupo y *dónde juega* cada rival" },
      { desdeMs: 12100, texto: "Y su plantilla, *con sus puntos*" },
    ],
    cierre: { titulo: "Busca el tuyo en *tactium.io*", sub: "Liga Cántabra 2026/27 · gratis", durMs: 3200 },
  },
];
const g2 = (id: string) => GRABACIONES.find((x) => x.nombre === id)!;
export const durReelWeb = (r: ReelWebDef) => durGrabacion(g2(r.grabacion)) + r.cierre.durMs;

const Rico: React.FC<{ t: string }> = ({ t }) => (
  <>{t.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") ? <span key={i} style={{ color: T.color.accent }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}</>
);

export const ReelWeb: React.FC<{ id: string }> = ({ id }) => {
  const r = REELS_WEB.find((x) => x.id === id)!;
  const g = g2(r.grabacion);
  const frame = useCurrentFrame();
  const t = (frame / T.canvas.fps) * 1000;
  const finGrab = durGrabacion(g);
  const enCierre = interpolate(t, [finGrab - 200, finGrab + 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      <Audio src={staticFile(r.musica)} volume={(f) => r.volumen * interpolate(f, [0, 8, ms(durReelWeb(r)) - 20, ms(durReelWeb(r))], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      <div style={{ opacity: 1 - enCierre * 0.96, transform: `scale(${1 - enCierre * 0.06})`, position: "absolute", inset: 0 }}>
        <WebGrabada nombre={r.grabacion} top={470} alto={1120} />
      </div>
      {r.textos.map((x, i) => {
        const fin = r.textos[i + 1]?.desdeMs ?? finGrab;
        if (t < x.desdeMs - 50 || t > fin + 250) return null;
        const entra = interpolate(t, [x.desdeMs, x.desdeMs + 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const sale = interpolate(t, [fin - 30, fin + 200], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // El gancho entra ya en el primer fotograma: nada de esperar a que aparezca.
        const o = i === 0 ? sale : entra * sale;
        return (
          <div key={i} style={{ position: "absolute", left: 80, right: 170, top: 250, height: 190, display: "flex", alignItems: "flex-end",
            fontFamily: T.font.sans, fontWeight: 900, fontSize: x.texto.length > 30 ? 66 : 78, lineHeight: 1.02, letterSpacing: "-0.035em", color: T.color.ink,
            opacity: o, transform: `translateY(${(1 - (i === 0 ? 1 : entra)) * 26}px)`, filter: `blur(${(1 - (i === 0 ? 1 : entra)) * 8}px)` }}>
            <div><Rico t={x.texto} /></div>
          </div>
        );
      })}
      {enCierre > 0 ? (
        <div style={{ position: "absolute", left: 80, right: 170, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", opacity: enCierre }}>
          <div style={{ fontFamily: T.font.sans, fontWeight: 900, fontSize: 104, lineHeight: 0.98, letterSpacing: "-0.04em", color: T.color.ink, transform: `translateY(${(1 - enCierre) * 30}px)` }}>
            <Rico t={r.cierre.titulo} />
          </div>
          <div style={{ marginTop: 36, fontFamily: T.font.mono, fontSize: 34, letterSpacing: "0.08em", color: T.color.muted }}>{r.cierre.sub}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
