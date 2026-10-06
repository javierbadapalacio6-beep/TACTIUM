import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "TACTIUM solo usa cookies técnicas para mantener tu sesión. Sin analítica ni publicidad.",
  alternates: { canonical: "/legal/cookies" },
};

/**
 * Comprobado en el código (2026-10-06): no hay analítica, ni píxeles, ni
 * publicidad. Solo la cookie de sesión de Supabase y preferencias en
 * `localStorage`. Por eso no hace falta banner de consentimiento: las cookies
 * técnicas están exentas (art. 22.2 LSSI). Si algún día se añade analítica,
 * esta página y el banner van juntos.
 */
export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies" updated={LEGAL_UPDATED}>
      <section>
        <p>
          La web de TACTIUM solo guarda en tu navegador lo imprescindible para
          funcionar. <strong>No usamos cookies de analítica, de publicidad ni
          de redes sociales</strong>, así que no te pedimos consentimiento: las
          cookies técnicas no lo necesitan.
        </p>
      </section>

      <section>
        <h2>Qué guardamos</h2>
        <ul>
          <li>
            <strong>Sesión</strong> (cookies <code>sb-…-auth-token</code>, de
            Supabase): mantienen tu sesión iniciada. Solo existen si entras en
            tu cuenta y se borran al cerrar sesión.
          </li>
          <li>
            <strong>Preferencias</strong> (almacenamiento local del navegador,
            no cookies): el tema claro u oscuro, el equipo o club activo y los
            filtros que dejaste puestos. No salen de tu dispositivo.
          </li>
          <li>
            <strong>Pagos</strong>: si pagas una suscripción o una inscripción,
            lo haces en la página de Stripe, que usa sus propias cookies para
            el pago y la prevención del fraude.
          </li>
        </ul>
      </section>

      <section>
        <h2>Recursos de terceros</h2>
        <p>
          La tipografía de la web se descarga de Fontshare. Esa petición no
          instala cookies, pero el proveedor recibe tu dirección IP, como
          cualquier servidor al que se pide un archivo.
        </p>
      </section>

      <section>
        <h2>Cómo borrarlas</h2>
        <p>
          Cerrando sesión, o desde los ajustes de privacidad de tu navegador.
          Si las bloqueas no podrás iniciar sesión, pero sí ver torneos y la
          competición federada.
        </p>
        <p>
          Más sobre tus datos en la{" "}
          <Link href="/legal/privacidad">política de privacidad</Link>. Dudas:{" "}
          <a href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
