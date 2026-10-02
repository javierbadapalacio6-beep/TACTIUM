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
  entrada?: "flash" | "barrido" | "zoom";
  /** `vertical`: clip 9:16, en columna redondeada al lado contrario del texto. */
  /** `zoom`: acerca el clip hacia `origen` (CSS transform-origin), para que la acción no
   *  quede diminuta o para sacar del cuadro algo que no debe verse (marcas de agua). */
  clip?: { src: string; desdeS: number; velocidad?: number; vertical?: boolean; zoom?: number; origen?: string };
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
  idea: string;
  /** Animación del texto de este reel (cada reel la suya, para no repetir la serie). */
  animTexto: AnimTexto;
  bpm: number;
  /** `subidaMs`: segundo de la canción en que entra la parte fuerte. Cae en la escena con
   *  `efecto: "quemado"` (el golpe); la música arranca lo que haga falta antes. */
  musica: { src: string; subidaMs: number };
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
const EscenaVertical: React.FC<{ e: Escena; ws: Palabra[]; dur: number }> = ({ e, ws, dur }) => {
  const tono = e.fondo === "claro" ? "claro" : "oscuro";
  const ancho = T.canvas.w - T.safe.sides * 2;
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {e.clip ? (
        <>
          <OffthreadVideo
            src={staticFile(e.clip.src)}
            trimBefore={Math.round(e.clip.desdeS * T.canvas.fps)}
            playbackRate={e.clip.velocidad ?? 1}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip.zoom ?? 1})`, transformOrigin: e.clip.origen ?? "center" }}
          />
          {e.texto ? <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,15,15,0.92) 0%, rgba(3,15,15,0.7) 30%, rgba(3,15,15,0) 52%)" }} /> : null}
        </>
      ) : (
        <Fondo tono={tono} />
      )}
      {e.texto?.lista ? (
        <div style={{ position: "absolute", left: T.safe.sides, right: T.safe.sides, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 46, color: "rgba(232,245,239,0.78)", marginBottom: 18 }}>{e.texto.lista}</div>
          <Lista ws={ws} claves={e.texto.claves} serif={e.texto.serif} tono={tono} />
        </div>
      ) : e.texto ? (
        <AbsoluteFill
          style={{
            justifyContent: e.clip ? "flex-start" : "center",
            alignItems: e.texto.centro ? "center" : "flex-start",
            paddingTop: e.clip ? T.safe.top + 60 : 0,
            paddingLeft: e.texto.centro ? 0 : T.safe.sides,
          }}
        >
          {/* Sobre el clip el techo de la pista es claro: sombra al texto (se hereda). */}
          <div style={{ textShadow: e.clip ? "0 4px 28px rgba(3,15,15,0.85), 0 1px 3px rgba(3,15,15,0.9)" : undefined }}>
            <TextoCinetico ws={ws} claves={e.texto.claves} serif={e.texto.serif} tono={tono} alinear={e.texto.centro ? "centro" : "izq"} ancho={ancho} finMs={dur} escala={1} iconos={e.texto.iconos} />
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

const EscenaJuego: React.FC<{ e: Escena & { desde: number; hasta: number }; pulso: number; vertical?: boolean }> = ({ e, pulso, vertical }) => {
  const dur = Math.round((e.hasta - e.desde) * pulso);
  const tono = e.fondo === "claro" ? "claro" : "oscuro";
  // Los tiempos del texto van en pulsos: aquí pasan a ms.
  const ws = (e.texto?.ws ?? []).map((p) => ({ ...p, a: Math.round(p.a * pulso), b: Math.round(p.b * pulso) }));
  if (vertical) return <Entrada tipo={e.entrada}><EscenaVertical e={e} ws={ws} dur={dur} /></Entrada>;
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
          <EscenaJuego e={e} pulso={pulso} vertical={vertical} />
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
          const base = interpolate(f, [0, ms(150), fin, fin + ms(CIERRE_MS)], [0, 0.85, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
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
