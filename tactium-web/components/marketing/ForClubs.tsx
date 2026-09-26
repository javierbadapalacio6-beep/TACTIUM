import { Chip, IconTile } from "@/components/ui";
import {
  IconBuilding,
  IconCalendar,
  IconClock,
  IconShield,
  IconUsers,
} from "@/components/Icon";
import { Reveal } from "./Reveal";

const BULLETS = [
  { icon: IconShield, text: "Hasta 25 equipos bajo un mismo club, cada uno con su capitán" },
  { icon: IconCalendar, text: "Próximas jornadas y últimos resultados de todos, en una vista" },
  { icon: IconClock, text: "Horarios de local: día, hora y pista para cada equipo" },
  { icon: IconBuilding, text: "Una sola suscripción; los capitanes entran gratis bajo el plan" },
];

const TEAMS = [
  { name: "Masculino A", cat: "2ª masculina · Grupo B", next: "sáb 10:30" },
  { name: "Femenino A", cat: "3ª femenina · Grupo A", next: "sáb 12:00" },
  { name: "Masculino B", cat: "4ª masculina · Grupo C", next: "dom 10:00" },
  { name: "Veteranos", cat: "+45 masculina", next: "dom 11:30" },
];

export function ForClubs() {
  return (
    <section id="clubs" className="mk-sec" aria-labelledby="mk-clubs-title">
      <div className="mk-wrap mk-split">
        <div>
          <Reveal>
            <p className="mk-kicker">Para clubs</p>
            <h2 id="mk-clubs-title" className="mk-h2">
              El club ve todos sus equipos en un panel
            </h2>
            <p className="mk-lede">
              Los capitanes siguen llevando el suyo como siempre. El club pone el
              orden: horarios de local, pistas, torneos y quién juega dónde este
              fin de semana.
            </p>
          </Reveal>
          <ul className="mk-bullets">
            {BULLETS.map(({ icon: Icon, text }, i) => (
              <Reveal as="li" key={text} delay={0.06 * (i + 1)}>
                <IconTile>
                  <Icon size={16} />
                </IconTile>
                <span>{text}</span>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal className="mk-mockpair" delay={0.1} style={{ minHeight: 0 }}>
          <div className="mk-glow" aria-hidden="true" />
          <div className="mk-art-club" aria-hidden="true">
            <div className="mk-art-club-head">
              <span>Equipos del club</span>
              <Chip tone="mute">Temporada 2026-27</Chip>
            </div>
            {TEAMS.map((t) => (
              <div key={t.name} className="mk-art-club-row">
                <IconTile>
                  <IconUsers size={15} />
                </IconTile>
                <span>
                  <b>{t.name}</b>
                  <small>{t.cat}</small>
                </span>
                <span className="next">{t.next}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
