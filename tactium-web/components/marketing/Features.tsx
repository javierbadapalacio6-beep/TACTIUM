import type { ReactNode } from "react";

import { IconTile } from "@/components/ui";
import {
  IconBell,
  IconCalendar,
  IconLayers,
  IconSparkles,
  IconUpload,
} from "@/components/Icon";
import { Reveal } from "./Reveal";

function Cell({
  icon,
  title,
  body,
  art,
  wide,
  delay,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  art?: ReactNode;
  wide?: boolean;
  delay: number;
}) {
  return (
    <Reveal as="article" className={"mk-cell" + (wide ? " is-wide" : "")} delay={delay}>
      <IconTile>{icon}</IconTile>
      <h3>{title}</h3>
      <p>{body}</p>
      {art}
    </Reveal>
  );
}

export function Features() {
  return (
    <section id="funciones" className="mk-sec" aria-labelledby="mk-feat-title">
      <div className="mk-wrap">
        <Reveal className="mk-head">
          <p className="mk-kicker">Funciones</p>
          <h2 id="mk-feat-title" className="mk-h2">
            Lo que hoy haces en Excel y WhatsApp, resuelto
          </h2>
        </Reveal>

        <div className="mk-bento">
          <Cell
            wide
            delay={0}
            icon={<IconSparkles size={16} />}
            title="Alineaciones con orden de fuerza"
            body="Balance automático por puntos y validación del orden de fuerza de tu federación. Lo que en una hoja de cálculo son veinte minutos, aquí es un toque."
            art={
              <div className="mk-cell-art mk-art-lineup" aria-hidden="true">
                <span><i>P1</i> Marcos · Álvaro <b>1.840</b></span>
                <span><i>P2</i> Jorge · Nacho <b>1.615</b></span>
                <span><i>P3</i> Dani · Rubén <b>1.390</b></span>
              </div>
            }
          />
          <Cell
            delay={0.06}
            icon={<IconLayers size={16} />}
            title="Hasta cinco variantes"
            body="Prueba escenarios sin perder la oficial y elige la definitiva el día del partido."
            art={
              <div className="mk-cell-art mk-art-variants" aria-hidden="true">
                <span className="is-on">A</span>
                <span>B</span>
                <span>C</span>
                <span>D</span>
                <span>E</span>
              </div>
            }
          />
          <Cell
            delay={0.12}
            icon={<IconBell size={16} />}
            title="Convocatoria en el móvil"
            body="Hora, pista y rival llegan a cada jugador en cuanto publicas la alineación."
            art={
              <div className="mk-cell-art mk-art-push" aria-hidden="true">
                <IconBell size={16} style={{ color: "var(--accent)" }} />
                <span>
                  <b>Alineación publicada</b>
                  <small>Sábado 10:30 · Pista 3 · vs. CD Bahía</small>
                </span>
              </div>
            }
          />
          <Cell
            delay={0.18}
            icon={<IconCalendar size={16} />}
            title="Disponibilidad por jornada"
            body="Cada jugador confirma si puede. Lo ves en una pantalla antes de alinear."
            art={
              <div className="mk-cell-art mk-art-avail" aria-hidden="true">
                <span className="is-ok">MA</span>
                <span className="is-ok">JG</span>
                <span className="is-no">DR</span>
                <span className="is-ok">NL</span>
                <span>RP</span>
                <span className="is-ok">AC</span>
              </div>
            }
          />
          <Cell
            delay={0.24}
            icon={<IconUpload size={16} />}
            title="Importa tu plantilla"
            body="Una foto del ranking o un archivo: nombres y puntos entran solos. También desde la federación. El histórico de temporadas y resultados se guarda para siempre."
          />
        </div>
      </div>
    </section>
  );
}
