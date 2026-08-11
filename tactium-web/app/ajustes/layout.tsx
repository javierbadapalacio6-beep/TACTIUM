import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SettingsNav } from "@/components/settings/SettingsNav";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Ajustes" };

/**
 * Ajustes con navegación lateral secundaria. Cada sección tiene su propia URL
 * (`/ajustes/apariencia`, `/ajustes/notificaciones`…) — es justo lo que la app
 * móvil no puede dar: enlazar directamente a un ajuste concreto.
 */
export default function AjustesLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <PageHeader
        eyebrow="CUENTA · AJUSTES"
        title="Ajustes"
        lede="Tu cuenta, tus avisos y cómo se ve TACTIUM en este navegador."
      />

      <div className="tw-settings-grid">
        <SettingsNav />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
