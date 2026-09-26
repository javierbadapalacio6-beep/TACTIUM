import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos de uso de TACTIUM.",
  alternates: { canonical: "/legal/terminos" },
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de uso" updated="junio de 2026">
      <p>
        TACTIUM es una aplicación para la gestión de equipos de pádel federado
        (alineaciones, convocatorias, disponibilidad y resultados). Al usar la
        app aceptas estos términos.
      </p>
      <p>
        <strong>Suscripción y pago.</strong> El acceso a las funciones premium
        requiere una suscripción de pago, con 14 días de prueba gratuita. La
        compra, renovación y facturación las gestionan íntegramente App Store
        (Apple) o Google Play según tu dispositivo. La renovación es automática
        salvo que la canceles al menos 24 horas antes del final del periodo,
        desde los ajustes de tu cuenta de App Store o Google Play.
      </p>
      <p>
        <strong>Jugadores.</strong> Los jugadores invitados a un equipo acceden
        siempre de forma gratuita; solo paga el capitán o el club que gestiona
        el equipo.
      </p>
      <p>
        <strong>Tu cuenta.</strong> Puedes eliminar tu cuenta y tus datos en
        cualquier momento desde la propia app (Perfil → Eliminar cuenta).
        Eliminar la cuenta no cancela una suscripción activa de App Store o
        Google Play: hazlo desde los ajustes de tu cuenta de la tienda.
      </p>
      <p>
        Para cualquier consulta sobre estos términos, escríbenos a{" "}
        <a href="mailto:hola@tactium.io">hola@tactium.io</a>.
      </p>
    </LegalPage>
  );
}
