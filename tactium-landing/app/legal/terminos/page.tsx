import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos de uso de TACTIUM.",
};

export default function TerminosPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
      >
        ← VOLVER
      </Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
        Términos de uso
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Última actualización: junio de 2026.
      </p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        <p>
          TACTIUM es una aplicación para la gestión de equipos de pádel
          federado (alineaciones, convocatorias, disponibilidad y resultados).
          Al usar la app aceptas estos términos.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Suscripción y pago.</strong>{" "}
          El acceso a las funciones premium requiere una suscripción de pago,
          con 14 días de prueba gratuita. La compra, renovación y facturación
          las gestionan íntegramente App Store (Apple) o Google Play según tu
          dispositivo. La renovación es automática salvo que la canceles al
          menos 24 horas antes del final del periodo, desde los ajustes de tu
          cuenta de App Store o Google Play.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Jugadores.</strong>{" "}
          Los jugadores invitados a un equipo acceden siempre de forma gratuita;
          solo paga el capitán o el club que gestiona el equipo.
        </p>
        <p>
          <strong className="text-[var(--color-text)]">Tu cuenta.</strong>{" "}
          Puedes eliminar tu cuenta y tus datos en cualquier momento desde la
          propia app (Perfil → Eliminar cuenta). Eliminar la cuenta no cancela
          una suscripción activa de App Store o Google Play: hazlo desde los
          ajustes de tu cuenta de la tienda.
        </p>
        <p>
          Para cualquier consulta sobre estos términos, escríbenos a{" "}
          <a
            href="mailto:hola@tactium.io"
            className="underline underline-offset-2 text-[var(--color-text)] hover:text-[var(--color-accent)]"
          >
            hola@tactium.io
          </a>
          .
        </p>
      </div>
    </main>
  );
}
