import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/SettingsNav";
import { ProfileShortcuts } from "@/components/settings/ProfileShortcuts";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Ajustes" };

/**
 * Apartado «Perfil» de la navegación única: arriba los accesos al récord, la
 * suscripción y el perfil público; debajo, los ajustes con navegación
 * lateral secundaria. Cada sección tiene su propia URL
 * (`/ajustes/apariencia`, `/ajustes/notificaciones`…) — es justo lo que la
 * app móvil no puede dar: enlazar directamente a un ajuste concreto.
 */
export default function AjustesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tw-page">
      <PageHeader
        title="Perfil"
        lede="Tu récord, tu suscripción y los ajustes de tu cuenta."
        actions={<ProfileShortcuts />}
      />

      <div className="tw-settings-grid">
        <SettingsNav />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
