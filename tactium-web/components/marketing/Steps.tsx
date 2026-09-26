import { PhoneFrame } from "./PhoneFrame";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Jornada en agenda",
    body: "Cada jornada con rival, sede, hora y estado. Tus jugadores marcan si pueden.",
    src: "/screens/jornada-pendiente.jpg",
    alt: "Pantalla de jornada pendiente con las parejas sin asignar",
  },
  {
    n: "02",
    title: "Alineación por puntos",
    body: "Ordena las parejas por fuerza respetando las reglas de tu federación. Hasta cinco variantes.",
    src: "/screens/alineacion.jpg",
    alt: "Pantalla de alineación con auto-orden y barras de puntos",
  },
  {
    n: "03",
    title: "Acta cerrada",
    body: "Marcador por sets, victoria, derrota o W.O. Resultado guardado y listo para compartir.",
    src: "/screens/jornada-resultados.png",
    alt: "Pantalla de jornada cerrada con el resultado por pareja",
  },
];

export function Steps() {
  return (
    <section id="flujo" className="mk-sec" aria-labelledby="mk-steps-title">
      <div className="mk-wrap">
        <Reveal className="mk-head mk-head--center">
          <p className="mk-kicker">Flujo de una jornada</p>
          <h2 id="mk-steps-title" className="mk-h2">
            De la convocatoria al acta cerrada
          </h2>
        </Reveal>
        <div className="mk-steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} className="mk-step" delay={i * 0.1}>
              <PhoneFrame src={s.src} alt={s.alt} />
              <div>
                <span className="mk-step-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
