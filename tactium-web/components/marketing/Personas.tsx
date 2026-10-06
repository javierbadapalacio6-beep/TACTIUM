import Link from "next/link";

import { IconTile } from "@/components/ui";
import { IconBuilding, IconChevronRight, IconTrophy, IconUsers } from "@/components/Icon";
import { signupHref } from "@/lib/nav";

/**
 * Tres puertas justo debajo del hero: cada perfil va a lo suyo sin tener que
 * leerse la portada entera. El enlace principal lleva a su sección; el
 * secundario, al alta con el `next` de su onboarding.
 */
const PERSONAS = [
  {
    icon: IconUsers,
    title: "Soy capitán",
    body: "Convoca, alinea por puntos y cierra la jornada desde el móvil.",
    href: "#flujo",
    cta: "Cómo funciona",
    alta: signupHref("/empezar/equipo"),
  },
  {
    icon: IconBuilding,
    title: "Llevo un club",
    body: "Todos tus equipos, horarios de local y torneos en un panel.",
    href: "#clubs",
    cta: "Para clubs",
    alta: signupHref("/empezar/club"),
  },
  {
    icon: IconTrophy,
    title: "Organizo torneos",
    body: "Inscripción online, cuadros, horario por pistas y resultados en directo.",
    href: "/torneos/organizar",
    cta: "Organizar un torneo",
    alta: signupHref("/torneos/organizar"),
  },
];

export function Personas() {
  return (
    <nav className="mk-personas-wrap" aria-label="Empieza según tu perfil">
      <div className="mk-wrap mk-personas">
        {PERSONAS.map(({ icon: Icon, title, body, href, cta, alta }) => (
          <div key={title} className="mk-persona">
            <IconTile>
              <Icon size={16} />
            </IconTile>
            <div className="mk-persona-text">
              <h2>{title}</h2>
              <p>{body}</p>
              <div className="mk-persona-links">
                <Link href={href} className="link-action">
                  {cta}
                  <IconChevronRight size={13} />
                </Link>
                <Link href={alta} className="mk-persona-alta">
                  Crear cuenta
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
