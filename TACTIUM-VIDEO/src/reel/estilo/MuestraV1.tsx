// Muestra del estilo cinético con el plano del V1 (los primeros 18 s), en 16:9.
// No se publica: sirve para comparar con el montaje anterior y decidir.
//
// Cada escena dice su fondo y su recurso; el texto sale solo de las palabras
// transcritas (palabras/V1-vuelta.json), así que va clavado a la voz.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile } from "remotion";
import { T, ms } from "../tokens";
import { CIERRE_MS, Cierre, Pantalla } from "../Reel";
import { PALABRAS } from "../palabras";
import type { Palabra } from "../Karaoke";
import { Descifra, Fondo, Gigante, Imagen, Lista, Rejilla, TextoCinetico } from "./Cinetico";
import { limpia } from "../Karaoke";

const W = 1920;
const H = 1080;
const M = 72;
const COL_H = H - M * 2;
const COL_W = Math.round((COL_H * 9) / 16);
const PLANO = "plano/V1-vuelta.mp4";

type Escena = {
  desde: number;
  hasta: number;
  fondo: "cara" | "oscuro" | "claro" | "imagen";
  recurso: "texto" | "gigante" | "descifra" | "rejilla" | "lista";
  claves?: string[];
  serif?: string[];
  imagen?: string;
  pantalla?: string;
  sfx?: string;
};

export const ESCENAS: Escena[] = [
  { desde: 0, hasta: 1150, fondo: "claro", recurso: "texto", claves: ["verano"], serif: ["verano"] },
  { desde: 1150, hasta: 3850, fondo: "cara", recurso: "texto", claves: ["liga", "parado"] },
  { desde: 3850, hasta: 4950, fondo: "oscuro", recurso: "gigante", sfx: "sfx/basshit.wav" },
  { desde: 4950, hasta: 6300, fondo: "oscuro", recurso: "descifra", claves: ["cambios"], sfx: "sfx/swoosh.wav" },
  { desde: 6300, hasta: 8350, fondo: "oscuro", recurso: "rejilla", claves: ["equipo", "jugar"], sfx: "sfx/whoosh-1.mp3" },
  { desde: 8350, hasta: 12550, fondo: "cara", recurso: "texto", claves: ["alineación", "normativa", "registrada"], serif: ["registrada"] },
  {
    desde: 12550, hasta: 16150, fondo: "claro", recurso: "lista",
    claves: ["torneos", "grupos", "eliminatorias", "consolación"], serif: ["consolación"],
    pantalla: "web/torneo-consolacion.png", sfx: "sfx/whoosh-3.mp3",
  },
  { desde: 16150, hasta: 18450, fondo: "imagen", recurso: "texto", claves: ["horarios", "pista"], imagen: "gen/pista-noche.png", sfx: "sfx/whoosh-1.mp3" },
];

export const MUESTRA_MS = ESCENAS[ESCENAS.length - 1].hasta;

/** Palabras de la escena, con tiempos relativos a su inicio. */
const deEscena = (e: Escena): Palabra[] =>
  PALABRAS["V1-vuelta"].palabras
    .filter((p) => p.a >= e.desde - 150 && p.a < e.hasta - 100)
    .map((p) => ({ ...p, a: p.a - e.desde, b: p.b - e.desde }));

const Columna: React.FC<{ desde: number }> = ({ desde }) => (
  <div
    style={{
      position: "absolute",
      left: W - M - COL_W,
      top: M,
      width: COL_W,
      height: COL_H,
      borderRadius: 28,
      overflow: "hidden",
      boxShadow: `0 0 0 2px ${T.color.hair}, 0 40px 90px -30px rgba(0,0,0,0.7)`,
    }}
  >
    <OffthreadVideo src={staticFile(PLANO)} trimBefore={ms(desde)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  </div>
);

const Escena: React.FC<{ e: Escena }> = ({ e }) => {
  const ws = deEscena(e);
  const dur = e.hasta - e.desde;
  const tono = e.fondo === "claro" ? "claro" : "oscuro";

  let fondo: React.ReactNode;
  if (e.fondo === "imagen") fondo = <Imagen src={e.imagen!} durMs={dur} />;
  else fondo = <Fondo tono={tono} />;

  let contenido: React.ReactNode = null;
  if (e.recurso === "texto" && e.fondo === "cara") {
    // El texto en el hueco libre, a la izquierda del plano (como la referencia).
    contenido = (
      <div style={{ position: "absolute", left: 150, top: 330, width: W - COL_W - M - 150 - 120 }}>
        <TextoCinetico ws={ws} claves={e.claves ?? []} serif={e.serif} tono="oscuro" ancho={W - COL_W - M - 270} finMs={dur} />
      </div>
    );
  } else if (e.recurso === "texto") {
    contenido = (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: e.fondo === "imagen" ? "flex-start" : "center", paddingLeft: e.fondo === "imagen" ? 150 : 0 }}>
        <TextoCinetico ws={ws} claves={e.claves ?? []} serif={e.serif} tono={tono} alinear={e.fondo === "imagen" ? "izq" : "centro"} ancho={1100} finMs={dur} escala={1.15} />
      </AbsoluteFill>
    );
  } else if (e.recurso === "gigante") {
    contenido = (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Gigante ws={ws} ancho={W - 200} />
      </AbsoluteFill>
    );
  } else if (e.recurso === "descifra") {
    const clave = ws.find((w) => (e.claves ?? []).includes(limpia(w.t).toLowerCase()));
    const i = clave ? ws.indexOf(clave) : ws.length;
    contenido = (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 18 }}>
        <TextoCinetico ws={ws.slice(0, i)} claves={[]} tono="oscuro" alinear="centro" ancho={1200} finMs={dur} escala={0.55} />
        {clave ? <Descifra texto={limpia(clave.t)} aMs={clave.a} size={230} tono="oscuro" /> : null}
        <TextoCinetico ws={ws.slice(i + 1)} claves={[]} tono="oscuro" alinear="centro" ancho={1200} finMs={dur} escala={0.55} />
      </AbsoluteFill>
    );
  } else if (e.recurso === "rejilla") {
    contenido = (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 70 }}>
        <div style={{ height: 250, display: "flex", alignItems: "flex-end" }}>
          <TextoCinetico ws={ws} claves={e.claves ?? []} tono="oscuro" alinear="centro" ancho={1300} finMs={dur} />
        </div>
        <Rejilla total={14} disponibles={10} desdeMs={ws.find((w) => /qui/.test(w.t))?.a ?? 400} />
      </AbsoluteFill>
    );
  } else if (e.recurso === "lista") {
    contenido = (
      <>
        <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
          <Lista ws={ws} claves={e.claves ?? []} serif={e.serif} tono={tono} />
        </div>
        {e.pantalla ? (
          <div style={{ position: "absolute", right: 150, top: 110, width: 660, height: 860, borderRadius: 64, overflow: "hidden", boxShadow: "0 50px 100px -30px rgba(3,40,30,0.45)" }}>
            <Pantalla c={{ src: e.pantalla, desdeMs: 0, hastaMs: dur, pan: [0, 16] }} enPanel />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {fondo}
      {e.fondo === "cara" ? <Columna desde={e.desde} /> : null}
      {contenido}
      {e.sfx ? <Audio src={staticFile(e.sfx)} volume={0.5} /> : null}
    </AbsoluteFill>
  );
};

export const MuestraV1: React.FC = () => {
  const fin = ms(MUESTRA_MS);
  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {ESCENAS.map((e, i) => (
        <Sequence key={i} from={ms(e.desde)} durationInFrames={ms(e.hasta - e.desde)} name={`${e.fondo}-${e.recurso}`}>
          <Escena e={e} />
        </Sequence>
      ))}
      {/* La voz va entera y aparte: así los cortes de imagen no la cortan. */}
      <Sequence durationInFrames={fin}>
        <Audio src={staticFile(PLANO)} />
      </Sequence>
      <Audio
        src={staticFile("musica/ncs-hold-you.mp3")}
        volume={(f) => interpolate(f, [0, ms(500), fin - ms(300), fin + ms(CIERRE_MS)], [0, 0.1, 0.1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      <Sequence from={fin} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
