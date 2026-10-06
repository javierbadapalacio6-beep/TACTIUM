import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";
import { GATEWAY_FEE_TEXT } from "@/lib/public-copy";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos trata TACTIUM, para qué, con qué proveedores (incluido Stripe para los cobros en la web) y cómo ejercer tus derechos.",
  alternates: { canonical: "/legal/privacidad" },
};

export default function PrivacidadPage() {
  const mail = <a href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</a>;
  return (
    <LegalPage title="Política de privacidad" updated={LEGAL_UPDATED}>
      <section>
        <p>
          Esta política explica qué datos personales trata TACTIUM (la app para
          iOS y Android y la web <strong>{LEGAL_ENTITY.site}</strong>), con qué
          finalidad y qué derechos tienes sobre ellos. TACTIUM es una
          herramienta para gestionar equipos de pádel federado, clubes y
          torneos.
        </p>
      </section>

      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p>
          {LEGAL_ENTITY.name}, con NIF {LEGAL_ENTITY.nif} y domicilio en{" "}
          {LEGAL_ENTITY.address}. Para cualquier cuestión sobre tus datos
          escríbenos a {mail}.
        </p>
      </section>

      <section>
        <h2>2. Datos que tratamos</h2>
        <ul>
          <li>
            <strong>Datos de cuenta.</strong> Correo electrónico, nombre y, si
            lo eliges, un nombre de usuario público. Si entras con Google o
            Apple, recibimos el correo y el nombre que ese proveedor nos da.
          </li>
          <li>
            <strong>Foto de perfil (opcional).</strong> Se guarda para
            mostrarla a ti y a tus compañeros. Puedes quitarla cuando quieras.
          </li>
          <li>
            <strong>Contenido que creas.</strong> Equipos, jugadores (nombre y
            puntos), clubes, jornadas, alineaciones, resultados, torneos,
            inscripciones, amistosos, publicaciones e invitaciones.
          </li>
          <li>
            <strong>Datos de suscripción y de pago.</strong> El plan, su estado
            (prueba, activa, cancelada), fechas e identificadores de la
            transacción. <strong>No vemos ni guardamos los datos de tu
            tarjeta</strong>: el cobro lo hacen Apple, Google o Stripe, según
            dónde pagues.
          </li>
          <li>
            <strong>Datos de cobro de los clubes.</strong> Si un club activa el
            cobro de inscripciones, Stripe le pide los datos que exige la ley
            para abrir una cuenta de pagos (titular, IBAN, identificación). Esos
            datos los recoge y guarda Stripe en su formulario; TACTIUM solo
            guarda el identificador de la cuenta conectada y su estado.
          </li>
          <li>
            <strong>Datos técnicos.</strong> Los imprescindibles para que la
            sesión funcione (ver la <Link href="/legal/cookies">política de
            cookies</Link>) y, en la app, el token de notificaciones si las
            activas.
          </li>
        </ul>
        <p>
          <strong>No</strong> recogemos tu ubicación, datos de salud ni
          contactos, y <strong>no</strong> usamos analítica ni publicidad de
          terceros, ni en la app ni en la web.
        </p>
      </section>

      <section>
        <h2>3. Para qué los usamos y con qué base</h2>
        <ul>
          <li>
            Prestar el servicio: tu cuenta, tu equipo o club, jornadas,
            alineaciones, torneos e inscripciones. Base: la ejecución del
            contrato (los <Link href="/legal/terminos">términos de uso</Link>).
          </li>
          <li>
            Cobrar suscripciones e inscripciones y cumplir las obligaciones
            fiscales y contables. Base: contrato y obligación legal.
          </li>
          <li>
            Enviarte los correos del servicio (confirmaciones, avisos de pago,
            recuperación de contraseña) y, si las activas, notificaciones.
            Base: contrato.
          </li>
        </ul>
        <p>
          <strong>No vendemos tus datos, no hacemos perfiles comerciales y no
          los usamos para publicidad.</strong>
        </p>
      </section>

      <section>
        <h2>4. Qué es público</h2>
        <p>
          Algunas cosas se ven sin cuenta porque esa es su función: los
          torneos que un club publica (con los nombres de las parejas inscritas
          y sus resultados), los datos de la competición federada que publica
          la propia federación y tu perfil si eliges un nombre de usuario. Lo
          demás (plantillas, alineaciones, jornadas de tu equipo, fotos que
          subes) solo lo ve tu equipo o tu club.
        </p>
      </section>

      <section>
        <h2>5. Proveedores (encargados del tratamiento)</h2>
        <p>
          Solo compartimos datos con los proveedores necesarios para prestar el
          servicio, que los tratan siguiendo nuestras instrucciones:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong>: base de datos, autenticación y
            almacenamiento de archivos.
          </li>
          <li>
            <strong>Stripe</strong>: cobro de las suscripciones contratadas en
            la web, de las cuotas de organización de torneos y de las
            inscripciones online. Para las inscripciones usamos Stripe Connect:
            el dinero va a la cuenta del club, que es quien vende la
            inscripción, y TACTIUM retiene solo el coste de la pasarela (
            {GATEWAY_FEE_TEXT}). Stripe trata además algunos datos como
            responsable propio para prevenir el fraude y cumplir la normativa
            de pagos.
          </li>
          <li>
            <strong>Apple App Store y Google Play</strong>: cobro de las
            suscripciones contratadas dentro de la app.
          </li>
          <li>
            <strong>RevenueCat</strong>: gestión técnica de las suscripciones de
            la app.
          </li>
          <li>
            <strong>Resend</strong>: envío de los correos del servicio.
          </li>
          <li>
            <strong>Vercel</strong>: alojamiento de la web.
          </li>
          <li>
            <strong>Expo (EAS)</strong>: distribución de la app, sus
            actualizaciones y las notificaciones.
          </li>
        </ul>
        <p>
          Algunos están fuera del Espacio Económico Europeo. En esos casos la
          transferencia se ampara en las garantías del RGPD (cláusulas
          contractuales tipo de la Comisión Europea o marco de privacidad
          UE-EE. UU.).
        </p>
      </section>

      <section>
        <h2>6. Cuánto tiempo los conservamos</h2>
        <p>
          Mientras tu cuenta esté activa. Si la eliminas, borramos tu perfil y
          el contenido asociado. Los registros de facturación y de pagos se
          conservan el plazo que exige la normativa fiscal y mercantil.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>
          Puedes pedir acceso, rectificación, supresión, portabilidad,
          limitación y oposición. En la app tienes dos atajos: <strong>Perfil →
          Mis datos</strong> (exporta tus datos) y <strong>Perfil → Eliminar
          cuenta</strong>; en la web, <Link href="/legal/eliminar-cuenta">cómo
          eliminar tu cuenta</Link>. También puedes escribirnos a {mail}. Si
          crees que no hemos atendido bien tu solicitud, puedes reclamar ante
          la Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>

      <section>
        <h2>8. Datos de terceros y menores</h2>
        <p>
          Para usar TACTIUM hay que tener al menos 14 años. Cuando un capitán o
          un club da de alta a sus jugadores, lo hace bajo su responsabilidad y
          con base legítima para ello; si alguno es menor, corresponde al club
          recabar el consentimiento de sus tutores.
        </p>
      </section>

      <section>
        <h2>9. Cambios</h2>
        <p>
          Publicaremos siempre aquí la versión vigente, con su fecha. Si el
          cambio es importante, te avisaremos por correo o en la app.
        </p>
      </section>
    </LegalPage>
  );
}
