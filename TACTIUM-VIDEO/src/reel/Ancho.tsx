// Versión horizontal (16:9, 1920×1080) de una pieza.
//
// El plano vertical se ve ENTERO, sin recortarlo a una banda: ocupa toda la
// altura en una columna de 608px. Mientras no hay nada que enseñar, la columna
// va centrada; cuando entra una captura o un gráfico, se desplaza a la
// izquierda y el panel se abre a la derecha. Los datos son los mismos que en
// el reel vertical (`piezas.ts`): no hay que montar nada dos veces.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { T, ms } from "./tokens";
import type { Pieza } from "./piezas";
import {
  CIERRE_MS,
  Cartelito,
  Cierre,
  GanchoRotulo,
  Marcador,
  Pantalla,
  PintaGrafico,
  Subtitulos,
  repartir,
  tramosAbiertos,
} from "./Reel";
import { EnPanel } from "./graficos";
import { Karaoke, palabrasDe, trocear } from "./Karaoke";

export const ANCHO = { w: 1920, h: 1080, margen: 72 } as const;

/** La columna del plano: alto completo, proporción 9:16 exacta = sin recorte. */

const EASE = Easing.bezier(0.25, 1, 0.5, 1);

const useApertura = (pieza: Pieza): number => {
  const frame = useCurrentFrame();
  const tramos = useMemo(() => tramosAbiertos(pieza), [pieza]);
  const t = ms(T.motion.slow);
  let abierto = 0;
  for (const { a, b } of tramos) {
    const v = interpolate(frame, [ms(a) - t, ms(a), ms(b), ms(b) + t], [0, 1, 1, 0], {
      easing: EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    if (v > abierto) abierto = v;
  }
  return abierto;
};

const PlanoEntero: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const frame = useCurrentFrame();
  // Punch-in mínimo: en la columna sin recorte un 3% ya se nota, y más
  // empezaría a comerse los bordes, que es justo lo que no se quiere aquí.
  let escala = 1;
  if (pieza.cortes && pieza.cortes.length) {
    const cortes = pieza.cortes.map(ms);
    const idx = cortes.filter((c) => frame >= c).length;
    const ini = idx === 0 ? 0 : cortes[idx - 1];
    const fin = idx < cortes.length ? cortes[idx] : ms(pieza.duracionMs);
    const p = Math.min(1, Math.max(0, (frame - ini) / Math.max(1, fin - ini)));
    escala = (idx % 2 ? 1.04 : 1) + p * 0.03;
  }
  if (!pieza.plano) {
    return <Marcador titulo="FALTA EL PLANO" ruta={`plano/${pieza.id}.mp4`} anclaY={0.2} />;
  }
  return (
    <OffthreadVideo
      src={staticFile(pieza.plano)}
      trimBefore={pieza.planoDesdeMs ? ms(pieza.planoDesdeMs) : undefined}
      style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${escala})` }}
    />
  );
};

export const Ancho: React.FC<{ pieza: Pieza }> = ({ pieza }) => {
  const frame = useCurrentFrame();
  const cues = useMemo(() => repartir(pieza.frases, pieza.duracionMs), [pieza]);
  const bloques = useMemo(() => {
    const ps = palabrasDe(pieza);
    return ps ? trocear(ps) : null;
  }, [pieza]);
  const finCuerpo = ms(pieza.duracionMs);
  const apertura = useApertura(pieza);

  const { w: W, h: H, margen: M } = ANCHO;
  const colH = H - M * 2; // 936
  const colW = Math.round((colH * T.canvas.w) / T.canvas.h); // 527
  // De centrado a pegado a la izquierda.
  const colX = interpolate(apertura, [0, 1], [(W - colW) / 2, M]);

  // Panel a la derecha de la columna, con su hueco.
  const panelX = M + colW + 48;
  const panelW = W - M - panelX;
  // La tarjeta de la captura deja sitio abajo para el subtítulo.
  const subAlto = 150;
  const cardH = colH - subAlto;
  const cardW = 720;

  const activos = (pieza.graficos ?? []).filter((g) => frame >= ms(g.desdeMs) && frame < ms(g.hastaMs));
  const hayCortinilla = activos.some((g) => g.tipo === "cortinilla");
  const hayGrafico = activos.length > 0;
  const enGancho = !!pieza.gancho && frame < ms(pieza.gancho.hastaMs);

  // El subtítulo: centrado bajo el plano cuando está cerrado; centrado en el
  // panel cuando está abierto. Siempre en la franja de abajo.
  const subCentro = interpolate(apertura, [0, 1], [colX + colW / 2, panelX + panelW / 2]);
  const subAncho = interpolate(apertura, [0, 1], [colW - 48, panelW]);

  return (
    <AbsoluteFill style={{ background: T.color.bg }}>
      {/* 1 · El plano entero, en su columna redondeada. */}
      <Sequence durationInFrames={finCuerpo} name="plano">
        <div
          style={{
            position: "absolute",
            left: colX,
            top: M,
            width: colW,
            height: colH,
            borderRadius: 28,
            overflow: "hidden",
            background: T.color.card,
            boxShadow: `0 0 0 2px ${T.color.hair}`,
          }}
        >
          <PlanoEntero pieza={pieza} />
          {/* Degradado al pie de la columna: sobre él va el subtítulo mientras el
              panel está cerrado. Se va con la apertura, cuando el subtítulo se
              muda debajo de la tarjeta. */}
          {bloques ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 300,
                opacity: 1 - apertura,
                background: "linear-gradient(to bottom, rgba(3,15,15,0) 0%, rgba(3,15,15,0.55) 55%, rgba(3,15,15,0.8) 100%)",
              }}
            />
          ) : null}
          {/* Cartelito dentro de la columna, abajo a la izquierda. */}
          <div style={{ position: "absolute", inset: 0, transform: "scale(0.8)", transformOrigin: "left bottom" }}>
            <Cartelito suelo={24} />
          </div>
        </div>
      </Sequence>

      {/* 2 · El panel: tarjeta de captura o gráfico, a la derecha. */}
      {apertura > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: panelX,
            top: M,
            width: panelW,
            height: colH,
            opacity: apertura,
          }}
        >
          {/* Rejilla de reposo, tenue. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(${T.color.hair} 1px, transparent 1px), linear-gradient(90deg, ${T.color.hair} 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
              maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            }}
          />
          {pieza.cobertura.map((c, i) => (
            <Sequence key={i} from={ms(c.desdeMs)} durationInFrames={ms(c.hastaMs - c.desdeMs)} name={`cobertura-${i}`}>
              {c.sfx ? <Audio src={staticFile(c.sfx)} volume={0.55} /> : null}
              <div
                style={{
                  position: "absolute",
                  left: (panelW - cardW) / 2,
                  top: 0,
                  width: cardW,
                  height: cardH,
                  // Aquí la tarjeta no sangra por abajo: se redondea entera.
                  borderRadius: T.radius.phone,
                  overflow: "hidden",
                }}
              >
                <Pantalla c={c} enPanel />
              </div>
            </Sequence>
          ))}
          {(pieza.graficos ?? [])
            .filter((g) => g.tipo !== "cortinilla")
            .map((g, i) => (
              <Sequence key={i} from={ms(g.desdeMs)} durationInFrames={ms(g.hastaMs - g.desdeMs)} name={`grafico-${g.tipo}`}>
                {g.sfx ? <Audio src={staticFile(g.sfx)} volume={0.7} /> : null}
                <div style={{ position: "absolute", left: 0, top: 0, width: panelW, height: cardH }}>
                  <EnPanel.Provider value={true}>
                    <PintaGrafico g={g} />
                  </EnPanel.Provider>
                </div>
              </Sequence>
            ))}
        </div>
      ) : null}

      {/* 3 · Subtítulos: en la franja inferior, siguiendo al panel. */}
      {!enGancho && !hayCortinilla && bloques ? (
        // Siempre en la franja de abajo (centrada a 75px del pie de la columna):
        // cerrado, DENTRO de la columna y sin pasarse de su ancho; abierto, bajo
        // la tarjeta. Nunca se sale de su hueco, que era el fallo de la caja.
        <div
          style={{
            position: "absolute",
            left: subCentro - subAncho / 2,
            width: subAncho,
            top: M + colH - subAlto,
            height: subAlto,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Karaoke bloques={bloques} size={60} maxWidth={subAncho} apagado={hayGrafico} />
        </div>
      ) : null}
      {!enGancho && !hayCortinilla && !bloques ? (
        <div style={{ position: "absolute", left: subCentro - W / 2, top: 0, width: W, height: H }}>
          <Subtitulos cues={cues} sinEnfasis={hayGrafico} baseline={(H - M - subAlto + 20) / T.canvas.h} />
        </div>
      ) : null}
      {pieza.gancho ? <GanchoRotulo g={pieza.gancho} /> : null}

      {/* 4 · Cortinilla a pantalla completa, por encima de todo. */}
      {(pieza.graficos ?? [])
        .filter((g) => g.tipo === "cortinilla")
        .map((g, i) => (
          <Sequence key={`c${i}`} from={ms(g.desdeMs)} durationInFrames={ms(g.hastaMs - g.desdeMs)} name="cortinilla">
            {g.sfx ? <Audio src={staticFile(g.sfx)} volume={0.7} /> : null}
            <PintaGrafico g={g} />
          </Sequence>
        ))}

      {/* 5 · Música. */}
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

      {/* 6 · Cierre de marca. */}
      <Sequence from={finCuerpo} durationInFrames={ms(CIERRE_MS)} name="cierre">
        <Cierre />
      </Sequence>
    </AbsoluteFill>
  );
};
