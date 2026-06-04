import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo TACTIUM trata los datos personales de capitanes, jugadores y clubs.",
};

export default function PrivacidadPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
      >
        ← VOLVER
      </Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
        Política de Privacidad
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Última actualización: 4 de junio de 2026.
      </p>

      <div className="mt-10 prose-tactium space-y-6 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        <section>
          <p>
            Esta política explica qué datos personales trata TACTIUM (la
            «app» y el sitio web <strong>tactium.io</strong>), con qué
            finalidad y qué derechos tienes sobre ellos. TACTIUM es una
            herramienta para gestionar equipos de pádel federado: convocar
            jugadores, montar alineaciones y llevar el seguimiento de la
            temporada.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            1. Responsable del tratamiento
          </h2>
          <p>
            El responsable es TACTIUM. Para cualquier cuestión sobre tus
            datos o esta política puedes escribirnos a{" "}
            <a
              href="mailto:hola@tactium.io"
              className="text-[var(--color-accent)] underline"
            >
              hola@tactium.io
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            2. Datos que tratamos
          </h2>
          <p>Según cómo uses TACTIUM, tratamos los siguientes datos:</p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>
              <strong>Datos de cuenta.</strong> Tu dirección de correo
              electrónico y tu nombre, necesarios para crear y mantener tu
              cuenta e iniciar sesión.
            </li>
            <li>
              <strong>Foto de perfil (opcional).</strong> Si subes un avatar,
              la imagen se almacena para mostrarla a ti y a tus compañeros de
              equipo. Puedes quitarla en cualquier momento desde la app.
            </li>
            <li>
              <strong>Identificadores.</strong> Un identificador interno de
              usuario y el identificador que nos asigna nuestro proveedor de
              suscripciones (RevenueCat), para vincular tu cuenta con tu plan.
            </li>
            <li>
              <strong>Datos de suscripción y compras.</strong> El plan que
              contratas, su estado (prueba, activa, cancelada), las fechas y
              los identificadores de transacción de la tienda. <strong>No
              tratamos ni almacenamos los datos de tu tarjeta o método de
              pago</strong>: el cobro lo gestionan íntegramente App Store
              (Apple) o Google Play.
            </li>
            <li>
              <strong>Contenido que creas.</strong> Los equipos, jugadores
              (nombre y puntos), clubs, jornadas, alineaciones, resultados e
              invitaciones que registras para gestionar tu equipo.
            </li>
            <li>
              <strong>Metadatos técnicos del waitlist.</strong> Cuando te
              apuntas a la lista de espera en la web, guardamos datos técnicos
              no identificativos (idioma, navegador, referrer) para entender
              por qué canal nos descubres.
            </li>
          </ul>
          <p className="mt-3">
            <strong>No</strong> recopilamos tu ubicación, datos de salud,
            contactos, ni datos publicitarios, y <strong>no</strong> usamos
            herramientas de analítica de terceros dentro de la app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            3. Para qué usamos tus datos
          </h2>
          <p>
            Tratamos tus datos exclusivamente para que la app funcione:
            autenticarte, gestionar tu equipo, club, jornadas y alineaciones,
            administrar tu suscripción y, si te apuntaste al waitlist, avisarte
            del lanzamiento. <strong>No usamos tus datos con fines
            publicitarios, no elaboramos perfiles comerciales y no los
            vendemos a nadie.</strong> La base legal es la ejecución del
            contrato (los términos de uso) y, para los avisos del waitlist, tu
            consentimiento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            4. No te rastreamos
          </h2>
          <p>
            TACTIUM no rastrea tu actividad a través de apps o sitios web de
            otras empresas. No utilizamos el identificador de publicidad
            (IDFA), ni redes publicitarias, ni mostramos anuncios.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            5. Proveedores que nos ayudan
          </h2>
          <p>
            Compartimos datos únicamente con los proveedores estrictamente
            necesarios para prestar el servicio, que actúan como encargados del
            tratamiento bajo nuestras instrucciones:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>
              <strong>Supabase</strong> — base de datos, autenticación y
              almacenamiento (incluida la foto de avatar).
            </li>
            <li>
              <strong>RevenueCat</strong> — gestión técnica de las
              suscripciones in-app.
            </li>
            <li>
              <strong>Apple App Store</strong> y <strong>Google Play</strong> —
              procesamiento de los pagos de las suscripciones.
            </li>
            <li>
              <strong>Resend</strong> — envío de los correos del waitlist.
            </li>
            <li>
              <strong>Expo (EAS)</strong> — distribución de la app y de sus
              actualizaciones.
            </li>
          </ul>
          <p className="mt-3">
            Algunos de estos proveedores están ubicados fuera del Espacio
            Económico Europeo. En esos casos, las transferencias se amparan en
            las garantías adecuadas previstas por el RGPD (como las cláusulas
            contractuales tipo de la Comisión Europea).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            6. Cuánto tiempo conservamos tus datos
          </h2>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si eliminas
            tu cuenta desde la app, borramos tu perfil y el contenido asociado
            (equipos, jugadores, jornadas, alineaciones, resultados e
            invitaciones). Podemos conservar durante el plazo legal mínimo los
            registros de facturación exigidos por la normativa fiscal.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            7. Tus derechos
          </h2>
          <p>
            Puedes ejercer en cualquier momento tus derechos de acceso,
            rectificación, supresión, portabilidad, limitación y oposición.
            Desde la propia app tienes dos atajos directos:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>
              <strong>Perfil → Mis datos</strong>: exporta en un archivo todos
              los datos personales que guardamos sobre ti (derecho de
              portabilidad).
            </li>
            <li>
              <strong>Perfil → Eliminar cuenta</strong>: borra tu cuenta y tus
              datos (derecho de supresión).
            </li>
          </ul>
          <p className="mt-3">
            También puedes ejercerlos escribiéndonos a{" "}
            <a
              href="mailto:hola@tactium.io"
              className="text-[var(--color-accent)] underline"
            >
              hola@tactium.io
            </a>
            . Si consideras que no hemos atendido tu solicitud
            correctamente, tienes derecho a reclamar ante la Agencia Española
            de Protección de Datos (aepd.es).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            8. Datos de terceros y menores
          </h2>
          <p>
            Para usar TACTIUM debes ser mayor de 14 años. Cuando un capitán o
            un club da de alta a sus jugadores (nombre y puntos), lo hace bajo
            su responsabilidad y debe contar con la base legítima para ello;
            si alguno de esos jugadores es menor de edad, corresponde al club
            recabar el consentimiento necesario de sus tutores.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            9. Cambios en esta política
          </h2>
          <p>
            Podemos actualizar esta política para reflejar cambios en el
            servicio o en la normativa. Publicaremos siempre la versión vigente
            en esta página, con su fecha de última actualización.
          </p>
        </section>
      </div>
    </main>
  );
}
