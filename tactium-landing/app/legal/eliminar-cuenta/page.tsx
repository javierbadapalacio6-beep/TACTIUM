import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminar tu cuenta",
  description:
    "Cómo eliminar tu cuenta de TACTIUM y qué datos se borran o se conservan.",
};

export default function EliminarCuentaPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
      >
        ← VOLVER
      </Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
        Eliminar tu cuenta de TACTIUM
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Última actualización: 9 de junio de 2026.
      </p>

      <div className="mt-10 prose-tactium space-y-6 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        <section>
          <p>
            En <strong>TACTIUM</strong> (la «app» y el sitio web{" "}
            <strong>tactium.io</strong>) puedes eliminar tu cuenta y los datos
            asociados en cualquier momento, directamente desde la aplicación.
            Esta página explica los pasos y qué ocurre con tus datos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Cómo eliminar tu cuenta desde la app
          </h2>
          <ol className="list-decimal pl-5 space-y-2 mt-3">
            <li>Abre la app TACTIUM e inicia sesión con tu cuenta.</li>
            <li>
              Ve a <strong>Perfil</strong> (pestaña inferior).
            </li>
            <li>
              Pulsa <strong>Eliminar cuenta</strong>.
            </li>
            <li>
              Confirma la acción. Tu cuenta y los datos asociados se eliminarán
              de forma permanente.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Cómo solicitarlo por correo
          </h2>
          <p>
            Si no puedes acceder a la app, escríbenos desde la dirección de
            correo de tu cuenta a{" "}
            <a
              href="mailto:hola@tactium.io"
              className="text-[var(--color-accent)] underline"
            >
              hola@tactium.io
            </a>{" "}
            con el asunto «Eliminar mi cuenta». Verificaremos tu identidad y
            procesaremos la eliminación en un plazo máximo de 30 días.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Qué datos se eliminan
          </h2>
          <p>
            Al eliminar tu cuenta borramos de forma permanente los datos
            personales y el contenido que has creado:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-3">
            <li>Tu perfil (nombre, correo electrónico y foto de avatar).</li>
            <li>Tu identificador de usuario y el de suscripción.</li>
            <li>
              El contenido que registraste: equipos, jugadores, clubs, jornadas,
              alineaciones, resultados e invitaciones.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">
            Qué datos se conservan y durante cuánto tiempo
          </h2>
          <p>
            Podemos conservar durante el plazo legal mínimo exigido por la
            normativa fiscal los registros de facturación de tus suscripciones.
            Estos registros se mantienen únicamente para cumplir obligaciones
            legales y no se utilizan para ningún otro fin. El resto de tus datos
            se elimina en un plazo máximo de 30 días desde la solicitud.
          </p>
          <p className="mt-3">
            Recuerda que la gestión del cobro y la cancelación del pago de tu
            suscripción la realizan App Store (Apple) o Google Play; eliminar tu
            cuenta en TACTIUM no cancela automáticamente la suscripción en la
            tienda, por lo que te recomendamos cancelarla también desde los
            ajustes de tu cuenta de App Store o Google Play.
          </p>
        </section>

        <section>
          <p>
            Para más detalles sobre cómo tratamos tus datos, consulta nuestra{" "}
            <Link
              href="/legal/privacidad"
              className="text-[var(--color-accent)] underline"
            >
              Política de Privacidad
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
