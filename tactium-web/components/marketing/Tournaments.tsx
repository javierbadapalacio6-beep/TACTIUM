import { BtnLink, IconTile } from "@/components/ui";
import {
  IconCalendar,
  IconReceipt,
  IconShield,
  IconUsers,
} from "@/components/Icon";
import { Reveal } from "./Reveal";

const FORMATS = [
  { tag: "KO", name: "Eliminación directa", desc: "Un cuadro. Pierdes y fuera." },
  { tag: "KO+", name: "Con consolación", desc: "Quien cae en primera ronda sigue jugando." },
  { tag: "Liga", name: "Todos contra todos", desc: "Gana quien más suma. Sin cuadro." },
  { tag: "G+KO", name: "Grupos y eliminatorias", desc: "Liguilla y luego cuadro. El de club." },
];

const BULLETS = [
  { icon: IconUsers, text: "Inscripción desde la web o la app, por categorías y con reglas de nivel y puntos" },
  { icon: IconCalendar, text: "Horario automático por pistas, y una rejilla para moverlo a mano" },
  { icon: IconShield, text: "Grupos, cuadros y consolación que se generan solos" },
  { icon: IconReceipt, text: "El dinero de las inscripciones llega a la cuenta del club" },
];

export function Tournaments() {
  return (
    <section id="torneos" className="mk-sec" aria-labelledby="mk-tour-title">
      <div className="mk-wrap">
        <Reveal className="mk-head">
          <p className="mk-kicker">Torneos</p>
          <h2 id="mk-tour-title" className="mk-h2">
            Torneos completos, del cartel a la final
          </h2>
          <p className="mk-lede">
            Eliges el formato, los jugadores se apuntan, los cuadros se generan
            solos y el horario se reparte por pistas. Todo el mundo sigue los
            resultados en directo, sin hojas de cálculo.
          </p>
        </Reveal>

        <div className="mk-formats">
          {FORMATS.map((f, i) => (
            <Reveal as="div" key={f.tag} className="mk-format" delay={0.05 * i}>
              <span className="tag">{f.tag}</span>
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
            </Reveal>
          ))}
        </div>

        <ul className="mk-bullets" style={{ marginTop: 36 }}>
          {BULLETS.map(({ icon: Icon, text }, i) => (
            <Reveal as="li" key={text} delay={0.05 * i}>
              <IconTile>
                <Icon size={16} />
              </IconTile>
              <span>{text}</span>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mk-actions">
          <BtnLink href="/torneos" variant="ghost">
            Ver torneos en marcha
          </BtnLink>
        </Reveal>
      </div>
    </section>
  );
}
