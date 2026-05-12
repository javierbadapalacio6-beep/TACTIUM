// Strip horizontal con nombres de federaciones autonómicas afiliadas a FEP.
// Social proof B2B: el viewer ve "ah, soporta mi federación".
//
// El loop infinito se consigue duplicando el array y animando -50%
// (mitad exacta). Pausa al hover para que se pueda leer.

const FEDERATIONS = [
  "Federación Andaluza",
  "Federació Catalana",
  "Madrileña de Pádel",
  "Federació Valenciana",
  "Federación Galega",
  "Federación Canaria",
  "Federación Cántabra",
  "Federació Balear",
  "Federación Aragonesa",
  "Castilla y León",
  "Castilla-La Mancha",
  "Federación Murciana",
  "Federación Navarra",
  "Euskadiko Pádel",
  "Federación Riojana",
  "Federación Extremeña",
  "Federación Asturiana",
];

export function FederationsMarquee() {
  // Doblamos el array para que el translate -50% encaje sin saltos.
  const doubled = [...FEDERATIONS, ...FEDERATIONS];

  return (
    <section
      aria-label="Federaciones autonómicas soportadas"
      className="py-12 border-y border-[var(--color-hair)] bg-[color-mix(in_srgb,var(--color-bg)_92%,var(--color-bg-card))]"
    >
      <div className="max-w-6xl mx-auto px-6">
        <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--color-text-faint)] text-center mb-6">
          DISEÑADO PARA LAS FEDERACIONES AUTONÓMICAS ESPAÑOLAS
        </p>

        <div className="marquee-wrap">
          <ul className="marquee">
            {doubled.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-3 px-7 text-sm font-mono tracking-wide text-[var(--color-text-muted)] whitespace-nowrap"
                aria-hidden={i >= FEDERATIONS.length}
              >
                {/* Dot accent — separador visual entre items. */}
                <span className="inline-block w-1 h-1 rounded-full bg-[var(--color-accent)] opacity-60" />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
