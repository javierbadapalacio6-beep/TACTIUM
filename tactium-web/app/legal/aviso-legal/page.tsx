import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso legal",
  description: "Titular del sitio tactium.io y condiciones de uso de la web.",
  alternates: { canonical: "/legal/aviso-legal" },
};

/** Datos que exige el art. 10 de la LSSI (Ley 34/2002). */
export default function AvisoLegalPage() {
  return (
    <LegalPage title="Aviso legal" updated={LEGAL_UPDATED}>
      <section>
        <h2>Titular</h2>
        <ul>
          <li>
            <strong>Titular:</strong> {LEGAL_ENTITY.name}
          </li>
          <li>
            <strong>NIF:</strong> {LEGAL_ENTITY.nif}
          </li>
          <li>
            <strong>Domicilio:</strong> {LEGAL_ENTITY.address}
          </li>
          <li>
            <strong>Correo:</strong>{" "}
            <a href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</a>
          </li>
          <li>
            <strong>Sitio web:</strong> {LEGAL_ENTITY.site}
          </li>
        </ul>
      </section>

      <section>
        <h2>Objeto</h2>
        <p>
          Este sitio presenta TACTIUM, una herramienta para gestionar equipos
          de pádel federado, clubes y torneos, y da acceso a su versión web.
          Usar la web implica aceptar este aviso; el uso de la cuenta se rige
          además por los <Link href="/legal/terminos">términos de uso</Link>.
        </p>
      </section>

      <section>
        <h2>Propiedad intelectual</h2>
        <p>
          La marca, el diseño, el código y los textos de TACTIUM pertenecen a
          su titular. Los datos de la competición federada proceden de la
          federación correspondiente y los torneos son de quien los organiza.
          No se permite copiar o reutilizar el contenido del sitio con fines
          comerciales sin permiso.
        </p>
      </section>

      <section>
        <h2>Responsabilidad</h2>
        <p>
          Cuidamos que la información sea correcta y esté al día, pero no
          respondemos de errores en datos que vienen de terceros (federaciones
          u organizadores) ni del contenido de los sitios a los que enlazamos.
        </p>
      </section>

      <section>
        <h2>Privacidad y cookies</h2>
        <p>
          Cómo tratamos los datos está en la{" "}
          <Link href="/legal/privacidad">política de privacidad</Link>, y qué
          guarda la web en tu navegador, en la{" "}
          <Link href="/legal/cookies">política de cookies</Link>.
        </p>
      </section>

      <section>
        <h2>Ley aplicable</h2>
        <p>
          Este aviso se rige por la ley española. Para cualquier conflicto, y
          salvo que la ley disponga otra cosa para los consumidores, son
          competentes los juzgados y tribunales del domicilio del titular.
        </p>
      </section>
    </LegalPage>
  );
}
