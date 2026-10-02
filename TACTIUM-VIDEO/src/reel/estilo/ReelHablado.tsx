// Reels hablados con estilo cinético, en dos formatos con las mismas escenas:
//  · 16:9: tu plano en columna a la derecha y el texto grande en el hueco.
//  · 9:16 (`vertical`): tu plano a pantalla completa y el texto abajo, fuera de la cara.
//    Es el que se publica en Reels desde el 01-10: el 16:9 retenía la mitad (3,4 s de
//    media en A1 frente a ~6 s de los verticales anteriores).
// Tarjetas de color y pantallas de la app en móvil cuando toca.
//
// El texto sale de la transcripción del plano (palabras/<plano>.json), así que va clavado
// a la voz. Para montar uno nuevo: se une el plano (tomas por partes), se transcribe con
// scripts/transcribir.py y se añade un bloque a HABLADOS con sus escenas en ms del plano.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile } from "remotion";
import { T, ms } from "../tokens";
import { CIERRE_MS, Cierre, Pantalla } from "../Reel";
import { PALABRAS } from "../palabras";
import type { Palabra } from "../Karaoke";
import { AnimacionTexto, Efecto, Fondo, RiserGancho, TINTE_MARCA, TextoCinetico, WhooshCortes, esWhoosh, type AnimTexto, type IconoDe } from "./Cinetico";

const W = 1920;
const H = 1080;
const M = 72;
const COL_H = H - M * 2;
const COL_W = Math.round((COL_H * 9) / 16);

type EscenaH = {
  desde: number; // ms del plano
  hasta: number;
  /** `cara`: tu plano en columna + texto en el hueco. `tarjeta`: fondo de color y texto al
   *  centro. `pantalla`: texto a la izquierda y la app en un móvil a la derecha. */
  tipo: "cara" | "tarjeta" | "pantalla";
  tono?: "oscuro" | "claro";
  claves?: string[];
  serif?: string[];
  pantalla?: { src: string; pan?: [number, number] };
  sfx?: string;
  efecto?: "glitch";
  /** Icono junto a una palabra clave (clave → icono). Con moderación: los que ayudan a entender. */
  iconos?: Record<string, IconoDe>;
  /** Tarjeta sobre un clip de apoyo 16:9 a pantalla completa (oscurecido), no sobre color. */
  fondoClip?: string;
  /** En `cara`: otro clip vertical en la columna en vez de tu plano (p. ej. el móvil con WhatsApp). */
  clip?: { src: string; desdeS?: number; zoom?: number; origen?: string };
  /** Texto sin voz (p. ej. un cierre que no se grabó): palabras con su ms dentro de la escena. */
  frase?: [string, number][];
  /** Nota de voz que suena al empezar la escena (public/voz/…): la frase lleva sus tiempos. */
  voz?: { src: string; duracionMs: number };
};

export type ReelHabladoDef = {
  id: string;
  plano: string; // public/plano/<plano>.mp4 y palabras/<plano>.json
  animTexto: AnimTexto;
  musica?: { src: string; volumen: number; desdeMs?: number; volumenGancho?: number };
  escenas: EscenaH[];
};

export const HABLADOS: ReelHabladoDef[] = [
  {
    id: "A1",
    plano: "A1-federaciones",
    animTexto: "desenfoque",
    musica: { src: "musica/pixabay-creative-technology-showreel.mp3", volumen: 0.07 },
    escenas: [
      { desde: 0, hasta: 4450, tipo: "cara", claves: ["tú", "federación"], serif: ["federación"] },
      { desde: 4450, hasta: 10350, tipo: "tarjeta", tono: "oscuro", claves: ["norma", "puntos"], iconos: { puntos: "libreta" }, sfx: "sfx/whoosh-1.mp3", efecto: "glitch" },
      { desde: 10350, hasta: 16050, tipo: "pantalla", tono: "claro", claves: ["jugadores", "orden"], iconos: { orden: "check" }, pantalla: { src: "img/alineacion-sinbarra.jpg", pan: [4, 40] }, sfx: "sfx/swoosh.wav" },
      { desde: 16050, hasta: 17550, tipo: "cara", claves: ["cantabria"], serif: ["cantabria"], iconos: { cantabria: "cantabria" } },
      // La última palabra se queda ~1,5 s antes del logo (regla de tiempo de lectura).
      // Dice «adentro», pero en pantalla va «dentro» (a petición de Javier): corregido a mano en
      // palabras/A1-federaciones.json. Si se vuelve a transcribir, repetir la corrección.
      { desde: 17550, hasta: 20400, tipo: "pantalla", tono: "oscuro", claves: ["dentro"], pantalla: { src: "app/reel/fed-clasificacion.png", pan: [6, 26] }, sfx: "sfx/whoosh-3.mp3" },
    ],
  },
  {
    id: "A2",
    plano: "A2-orden",
    animTexto: "mascara",
    musica: { src: "musica/pack-violin-epico.mp3", volumen: 0.07, desdeMs: 18000 },
    escenas: [
      { desde: 0, hasta: 3800, tipo: "cara", claves: ["caos"], serif: ["caos"] },
      { desde: 3800, hasta: 13300, tipo: "tarjeta", tono: "oscuro", claves: ["sumando", "restando", "peor"], iconos: { sumando: "libreta" }, sfx: "sfx/whoosh-1.mp3", efecto: "glitch", fondoClip: "broll/puntos-libreta.mp4" },
      // El cierre no llegó grabado: va en texto, sin voz, con la alineación en el móvil.
      // Cierre con la nota de voz de Javier (30-09): «TACTIUM, lo compruebas antes de mandarlo».
      { desde: 13300, hasta: 17800, tipo: "pantalla", tono: "claro", sfx: "sfx/swoosh.wav", voz: { src: "voz/A2-cierre.mp3", duracionMs: 4970 },
        pantalla: { src: "img/alineacion-sinbarra.jpg", pan: [4, 36] }, claves: ["compruebas"], iconos: { compruebas: "check" },
        frase: [["TACTIUM,", 400], ["lo", 1860], ["compruebas", 1920], ["antes", 2580], ["de", 2960], ["mandarlo.", 3120]] },
    ],
  },
  {
    id: "A3",
    plano: "A3-dos-minutos",
    animTexto: "maquina",
    musica: { src: "musica/pack-night-drive.mp3", volumen: 0.055, desdeMs: 16000, volumenGancho: 0.025 },
    escenas: [
      { desde: 0, hasta: 3700, tipo: "cara", claves: ["hora"], serif: ["hora"] },
      { desde: 3700, hasta: 8350, tipo: "tarjeta", tono: "oscuro", claves: ["whatsapp", "puntos"], iconos: { whatsapp: "chat" }, sfx: "sfx/whoosh-1.mp3", efecto: "glitch", fondoClip: "broll/movil-notificaciones.mp4" },
      { desde: 8350, hasta: 10900, tipo: "cara", claves: ["pala"], serif: ["pala"], iconos: { pala: "pala" } },
      // «solo en 2 minutos» entero en la misma tarjeta, con el 2 en número (a petición de Javier).
      { desde: 10900, hasta: 13900, tipo: "tarjeta", tono: "claro", claves: ["2 minutos"], iconos: { "2 minutos": "crono" }, sfx: "sfx/swoosh.wav" },
    ],
  },
  {
    id: "T1",
    plano: "T1-alineacion",
    animTexto: "desenfoque",
    musica: { src: "musica/pack-lofi-25.mp3", volumen: 0.07, desdeMs: 24000 },
    escenas: [
      { desde: 0, hasta: 3600, tipo: "cara", claves: ["20 segundos"], iconos: { "20 segundos": "crono" } },
      { desde: 3600, hasta: 6600, tipo: "pantalla", tono: "claro", claves: ["sábado"], iconos: { "sábado": "calendario" }, pantalla: { src: "app/reel/disponibilidad.png", pan: [0, 24] }, sfx: "sfx/swoosh.wav" },
      { desde: 6600, hasta: 9900, tipo: "pantalla", tono: "oscuro", claves: ["auto-orden", "puntos"], pantalla: { src: "img/alineacion-sinbarra.jpg", pan: [4, 40] }, sfx: "sfx/whoosh-1.mp3" },
      { desde: 9900, hasta: 12200, tipo: "pantalla", tono: "oscuro", claves: ["rojo"], iconos: { rojo: "aviso" }, pantalla: { src: "img/alineacion.jpg", pan: [10, 40] } },
      { desde: 12200, hasta: 17000, tipo: "cara", claves: ["publicas", "vez"], serif: ["vez"], iconos: { vez: "check" } },
    ],
  },
  {
    id: "R2",
    plano: "R2-capitan",
    animTexto: "desenfoque",
    // Música de los packs sin licencia verificada: riesgo asumido por Javier (30-09).
    musica: { src: "musica/pack-tension-heist.mp3", volumen: 0.07 },
    escenas: [
      { desde: 0, hasta: 3700, tipo: "cara", claves: ["doler"], serif: ["doler"] },
      // Tu clip real del grupo de WhatsApp (zoom para sacar la marca de agua de la app de edición).
      { desde: 3700, hasta: 7950, tipo: "cara", claves: ["noche", "84 mensajes"], iconos: { "84 mensajes": { n: "chat", extra: "84" } }, sfx: "sfx/whoosh-1.mp3", efecto: "glitch", clip: { src: "broll/juego-27.mp4", zoom: 1.2, origen: "85% 100%" } },
      { desde: 7950, hasta: 11900, tipo: "cara", claves: ["sábado", "todavía"] },
      { desde: 11900, hasta: 16400, tipo: "tarjeta", tono: "oscuro", claves: ["libreta", "parejas"], iconos: { libreta: "libreta" }, serif: ["libreta"], sfx: "sfx/swoosh.wav", fondoClip: "broll/libreta-parejas.mp4" },
      { desde: 16400, hasta: 19600, tipo: "pantalla", tono: "oscuro", claves: ["disponibles"], iconos: { disponibles: "check" }, pantalla: { src: "app/reel/disponibilidad.png", pan: [0, 26] }, sfx: "sfx/whoosh-3.mp3" },
      { desde: 19600, hasta: 23900, tipo: "pantalla", tono: "oscuro", claves: ["jornada", "alineación"], pantalla: { src: "img/alineacion-sinbarra.jpg", pan: [4, 40] } },
      { desde: 23900, hasta: 27700, tipo: "cara", claves: ["publicas", "vez"] },
      // El cierre del guion no llegó grabado: va en texto.
      { desde: 27700, hasta: 32000, tipo: "tarjeta", tono: "oscuro", sfx: "sfx/whoosh-1.mp3", efecto: "glitch", voz: { src: "voz/R2-cierre.mp3", duracionMs: 4290 }, claves: ["10 segundos", "chat"], iconos: { "10 segundos": "crono" }, serif: ["chat"],
        frase: [["10 segundos", 80], ["no", 1700], ["hora", 1860], ["y", 2180], ["media", 2280], ["de", 2440], ["chat", 2600]] },
    ],
  },
];

export const durHablado = (r: ReelHabladoDef) => r.escenas[r.escenas.length - 1].hasta;

// 9:16: zona segura de Reels según la guía «MOTION GRAPICHS TACTIUM/PACKS/ZONA SEGURA/Margen
// seguro.png» (1080×1920): x 50-1028 e y 212-1547, salvo la esquina de abajo a la derecha
// (botones de me gusta, comentar…), que empieza en x 921 desde y 1118. Texto y móvil viven en
// x 80-910 e y 260-1540.
const VW = 1080;
const VM = 80;
const V_ANCHO = VW - VM - 170; // 830 px útiles para texto

const Escena: React.FC<{ r: ReelHabladoDef; e: EscenaH; vertical?: boolean }> = ({ r, e, vertical }) => {
  const ws: Palabra[] = e.frase
    ? e.frase.map(([t, a]) => ({ t, a, b: a + 300 }))
    : PALABRAS[r.plano].palabras
        // Cada palabra pertenece a UNA sola escena: la frontera es la misma por los dos lados
        // (antes, una palabra que empezaba justo en el corte salía en las dos: T1, 30-09).
        .filter((p) => p.a >= e.desde - 150 && p.a < e.hasta - 150)
        .map((p) => ({ ...p, a: p.a - e.desde, b: p.b - e.desde }));
  const dur = e.hasta - e.desde;
  const tono = e.tono ?? "oscuro";
  const texto = (ancho: number, alinear: "izq" | "centro", escala = 1) => (
    <TextoCinetico ws={ws} claves={e.claves ?? []} serif={e.serif} tono={tono} alinear={alinear} ancho={ancho} finMs={dur} escala={escala} iconos={e.iconos} />
  );
  const sonido = (
    <>
      {e.sfx && !esWhoosh(e.sfx) ? <Audio src={staticFile(e.sfx)} volume={0.45} /> : null}
      {e.voz ? <Audio src={staticFile(e.voz.src)} volume={1} /> : null}
    </>
  );
  if (vertical) {
    const video = e.clip ? (
      <OffthreadVideo src={staticFile(e.clip.src)} trimBefore={Math.round((e.clip.desdeS ?? 0) * T.canvas.fps)} muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip.zoom ?? 1})`, transformOrigin: e.clip.origen ?? "center" }} />
    ) : (
      <OffthreadVideo src={staticFile(`plano/${r.plano}.mp4`)} trimBefore={ms(e.desde)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    );
    return (
      <AbsoluteFill style={{ background: T.color.bg }}>
        {e.tipo === "cara" ? (
          <>
            {/* Tu plano entero, sin recortar: la cara arriba y el texto abajo, sobre las piernas. */}
            <AbsoluteFill>{video}</AbsoluteFill>
            <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(3,15,15,0) 45%, rgba(3,15,15,0.72) 66%, rgba(3,15,15,0.8) 100%)" }} />
            <div style={{ position: "absolute", left: VM, top: 1120 }}>{texto(V_ANCHO, "izq", 1.2)}</div>
          </>
        ) : e.tipo === "tarjeta" ? (
          <>
            {e.fondoClip ? (
              <>
                <OffthreadVideo src={staticFile(e.fondoClip)} muted playbackRate={Math.min(1, 5000 / dur)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(3,15,15,0.55) 0%, rgba(3,15,15,0.8) 70%)" }} />
              </>
            ) : (
              <Fondo tono={tono} />
            )}
            <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 160, paddingLeft: VM, paddingRight: VW - VM - V_ANCHO }}>{texto(V_ANCHO, "centro", 1.1)}</AbsoluteFill>
          </>
        ) : (
          <>
            <Fondo tono={tono} />
            <div style={{ position: "absolute", left: VM, top: 260 }}>{texto(V_ANCHO, "izq", 1.2)}</div>
            <div style={{ position: "absolute", left: VM + (V_ANCHO - 735) / 2, top: 560, width: 735, height: 980, borderRadius: 54, overflow: "hidden", boxShadow: "0 50px 100px -30px rgba(3,40,30,0.45)" }}>
              <Pantalla c={{ src: e.pantalla!.src, desdeMs: 0, hastaMs: dur, pan: e.pantalla!.pan }} enPanel />
            </div>
          </>
        )}
        {sonido}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {e.fondoClip ? (
        <>
          {/* Los clips de apoyo duran 5 s: si la escena es más larga, van a cámara lenta hasta
              cubrirla (antes se quedaban congelados mientras seguía la voz; A2, 30-09). */}
          <OffthreadVideo src={staticFile(e.fondoClip)} muted playbackRate={Math.min(1, 5000 / dur)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(3,15,15,0.55) 0%, rgba(3,15,15,0.78) 70%)" }} />
        </>
      ) : (
        <Fondo tono={tono} />
      )}
      {e.tipo === "cara" ? (
        <>
          <div style={{ position: "absolute", left: W - M - COL_W, top: M, width: COL_W, height: COL_H, borderRadius: 28, overflow: "hidden", boxShadow: `0 0 0 2px ${T.color.hair}, 0 40px 90px -30px rgba(0,0,0,0.7)` }}>
            {e.clip ? (
              <OffthreadVideo src={staticFile(e.clip.src)} trimBefore={Math.round((e.clip.desdeS ?? 0) * T.canvas.fps)} muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${e.clip.zoom ?? 1})`, transformOrigin: e.clip.origen ?? "center" }} />
            ) : (
              <OffthreadVideo src={staticFile(`plano/${r.plano}.mp4`)} trimBefore={ms(e.desde)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
          </div>
          <div style={{ position: "absolute", left: 150, top: 330 }}>{texto(W - COL_W - M - 270, "izq")}</div>
        </>
      ) : e.tipo === "tarjeta" ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>{texto(1300, "centro", 1.15)}</AbsoluteFill>
      ) : (
        <>
          <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>{texto(820, "izq", 1.05)}</div>
          <div style={{ position: "absolute", right: 150, top: 110, width: 660, height: 860, borderRadius: 64, overflow: "hidden", boxShadow: "0 50px 100px -30px rgba(3,40,30,0.45)" }}>
            <Pantalla c={{ src: e.pantalla!.src, desdeMs: 0, hastaMs: dur, pan: e.pantalla!.pan }} enPanel />
          </div>
        </>
      )}
      {sonido}
    </AbsoluteFill>
  );
};

export const ReelHablado: React.FC<{ id: string; vertical?: boolean }> = ({ id, vertical }) => {
  const r = HABLADOS.find((x) => x.id === id)!;
  const fin = ms(durHablado(r));
  // Cuando acaba la voz (tramos de solo texto), la música sube: si no, ese silencio suena a
  // fallo de audio (feedback del 29-09 sobre el A2).
  const ps = PALABRAS[r.plano].palabras;
  // Si alguna escena lleva nota de voz (cierre grabado aparte), la voz acaba al final de esa nota.
  const conVoz = r.escenas.filter((e) => e.voz);
  const finVoz = ms(Math.max(ps[ps.length - 1].b + 250, ...conVoz.map((e) => e.desde + e.voz!.duracionMs)));
  return (
    <AnimacionTexto.Provider value={r.animTexto}>
      <AbsoluteFill style={{ background: T.color.bg }}>
        {r.escenas.map((e, i) => (
          <Sequence key={i} from={ms(e.desde)} durationInFrames={ms(e.hasta - e.desde)} name={`${e.tipo}-${i + 1}`}>
            <Escena r={r} e={e} vertical={vertical} />
          </Sequence>
        ))}
        {r.escenas.filter((e) => e.efecto === "glitch").map((e, i) => (
          <Sequence key={`fx${i}`} from={Math.max(0, ms(e.desde) - 4)} durationInFrames={ms(900)} layout="none">
            <Efecto src="efectos/glitch.mp4" tinte={TINTE_MARCA} opacidad={0.9} />
          </Sequence>
        ))}
        {/* El gancho (primera escena) lleva riser: intriga hasta el corte. */}
        <RiserGancho finMs={r.escenas[0].hasta} />
        {/* Whoosh en el resto de cortes (el primero ya lo remata el golpe del riser). */}
        <WhooshCortes cortesMs={r.escenas.slice(2).map((e) => e.desde)} />
        {/* La voz, entera y aparte: los cortes de imagen no la cortan. */}
        <Sequence durationInFrames={fin}>
          <Audio src={staticFile(`plano/${r.plano}.mp4`)} />
        </Sequence>
        {r.musica ? (
          <Audio
            src={staticFile(r.musica.src)}
            trimBefore={ms(r.musica.desdeMs ?? 0)}
            volume={(f) => {
              const base = interpolate(f, [0, ms(400), fin, fin + ms(CIERRE_MS)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const sube = interpolate(f, [finVoz, finVoz + ms(450)], [1, 4.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              // En el gancho la música puede ir más baja (`volumenGancho`): ahí mandan la voz y el
              // riser. Vuelve a su nivel en el primer corte (A3, 30-09: «baja la música al principio»).
              const g = r.musica!.volumenGancho;
              const finGancho = ms(r.escenas[0].hasta);
              const gancho = g === undefined ? 1 : interpolate(f, [finGancho - ms(300), finGancho + ms(300)], [g / r.musica!.volumen, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return r.musica!.volumen * base * sube * gancho;
            }}
          />
        ) : null}
        <Sequence from={fin} durationInFrames={ms(CIERRE_MS)} name="cierre">
          <Cierre />
        </Sequence>
      </AbsoluteFill>
    </AnimacionTexto.Provider>
  );
};
