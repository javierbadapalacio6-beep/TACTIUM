import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";
import { TRIAL_DURATION_DAYS } from "@/lib/plans";
import { GATEWAY_FEE_TEXT } from "@/lib/public-copy";
import { TOURNAMENT_FREE_PAIRS } from "@/lib/tournament-billing";

export const metadata: Metadata = {
  title: "Términos de uso",
  description:
    "Condiciones de uso de TACTIUM: suscripciones en la app y en la web, renovación y cancelación, torneos e inscripciones.",
  alternates: { canonical: "/legal/terminos" },
};

export default function TerminosPage() {
  const mail = <a href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</a>;
  return (
    <LegalPage title="Términos de uso" updated={LEGAL_UPDATED}>
      <section>
        <p>
          TACTIUM es una herramienta para gestionar equipos de pádel federado
          (convocatorias, disponibilidad, alineaciones y resultados), clubes y
          torneos. La presta {LEGAL_ENTITY.name} (más datos en el{" "}
          <Link href="/legal/aviso-legal">aviso legal</Link>). Al crear una
          cuenta o usar el servicio aceptas estos términos.
        </p>
      </section>

      <section>
        <h2>1. Prueba y planes</h2>
        <p>
          La gestión del equipo o del club requiere un plan de pago. Los planes
          empiezan con {TRIAL_DURATION_DAYS} días de prueba sin tarjeta; si al
          acabar no eliges plan, la cuenta pasa al plan gratis y no se cobra
          nada. Los jugadores invitados a un equipo no pagan nunca: paga el
          capitán o el club que lo gestiona. Los precios vigentes están en{" "}
          <Link href="/pro">tactium.io/pro</Link>.
        </p>
      </section>

      <section>
        <h2>2. Si contratas en la app (App Store o Google Play)</h2>
        <p>
          La compra, la renovación y la factura las gestiona la tienda. La
          suscripción se renueva sola al final de cada periodo salvo que la
          canceles al menos 24 horas antes, desde los ajustes de tu cuenta de
          App Store o Google Play.
        </p>
      </section>

      <section>
        <h2>3. Si contratas en la web (Stripe)</h2>
        <p>
          El pago se hace con tarjeta a través de Stripe. La suscripción se
          renueva automáticamente al final de cada periodo (mensual o anual)
          por el mismo importe, salvo que la canceles antes. Puedes cancelarla,
          cambiar de plan o actualizar la tarjeta cuando quieras desde{" "}
          la página <strong>Suscripción</strong> de tu cuenta (tactium.io/suscripcion), que abre el
          portal de clientes de Stripe. Al cancelar sigues teniendo el plan
          hasta el final del periodo ya pagado y no se vuelve a cobrar. Subir
          de plan se aplica al momento; bajar, al final del periodo.
        </p>
      </section>

      <section>
        <h2>4. Torneos</h2>
        <p>
          TACTIUM es la herramienta: el torneo lo organiza el club o la
          persona que lo crea, y es responsable de sus normas, premios,
          horarios y de la relación con los jugadores.
        </p>
        <ul>
          <li>
            <strong>Cuota de organización.</strong> Hasta{" "}
            {TOURNAMENT_FREE_PAIRS} parejas es gratis. Por encima, el
            organizador paga a TACTIUM según las parejas inscritas, salvo que
            su plan de club ya lo incluya. Se paga al cerrar la inscripción y
            antes de generar los cuadros.
          </li>
          <li>
            <strong>Inscripciones.</strong> Si el organizador cobra online, el
            pago se hace por Stripe Connect y el dinero va a la cuenta del
            club, que es quien vende la inscripción. TACTIUM no se queda
            margen: solo retiene el coste de la pasarela ({GATEWAY_FEE_TEXT}).
            El organizador también puede cobrar en mano. Las devoluciones y
            reclamaciones sobre la inscripción se dirigen al organizador; si
            el organizador rechaza una inscripción ya pagada, el importe se
            devuelve automáticamente.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Uso correcto</h2>
        <p>
          Eres responsable de lo que publicas y de tener permiso para dar de
          alta a otras personas. No está permitido usar TACTIUM para suplantar
          a nadie, publicar contenido ilícito u ofensivo o intentar acceder a
          datos ajenos. Podemos suspender las cuentas que lo hagan.
        </p>
      </section>

      <section>
        <h2>6. Tu cuenta</h2>
        <p>
          Puedes eliminarla cuando quieras (Perfil → Eliminar cuenta en la app,
          o siguiendo <Link href="/legal/eliminar-cuenta">estos pasos</Link>).
          Eliminar la cuenta no cancela una suscripción de App Store o Google
          Play: hazlo desde la tienda. Las suscripciones web se cancelan desde
          el portal de Stripe antes de borrar la cuenta.
        </p>
      </section>

      <section>
        <h2>7. Responsabilidad y ley aplicable</h2>
        <p>
          Trabajamos para que el servicio esté siempre disponible y los datos
          sean correctos, pero los datos de la competición federada proceden
          de la federación y pueden tener retrasos o errores de origen. Estos
          términos se rigen por la ley española. Si eres consumidor, te
          corresponden los tribunales de tu domicilio.
        </p>
        <p>Dudas sobre estos términos: {mail}.</p>
      </section>
    </LegalPage>
  );
}
