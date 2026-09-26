import { IconChevronDown } from "@/components/Icon";
import { FAQ_QUESTIONS } from "@/lib/faq";
import { Reveal } from "./Reveal";

export function Faq() {
  return (
    <section id="faq" className="mk-sec" aria-labelledby="mk-faq-title">
      <div className="mk-wrap">
        <Reveal className="mk-head mk-head--center">
          <h2 id="mk-faq-title" className="mk-h2">
            Preguntas frecuentes
          </h2>
        </Reveal>
        <Reveal className="mk-faq">
          {FAQ_QUESTIONS.map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q}
                <IconChevronDown size={16} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
