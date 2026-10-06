import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/SettingsNav";
import { ProfileShortcuts } from "@/components/settings/ProfileShortcuts";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Ajustes" };

/**
 * Ajustes de la cuenta. Desde la mejora de navegación, «Perfil» es el perfil
 * social (`/perfil`, como en la app) y los ajustes cuelgan de él: engranaje
 * en su cabecera y entrada en el menú del avatar. Cada sección tiene su
 * propia URL (`/ajustes/preferencias`, `/ajustes/cuenta`…) — es justo lo que
 * la app móvil no puede dar: enlazar directamente a un ajuste concreto.
 */
export default function AjustesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/perfil", label: "Perfil" }}
        title="Ajustes"
        lede="Tus datos, tu equipo, tus preferencias y tu cuenta."
        actions={<ProfileShortcuts />}
      />

      <div className="tw-settings-grid">
        <SettingsNav />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
