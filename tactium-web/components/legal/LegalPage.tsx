import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui";

/**
 * Marco de los textos legales: columna estrecha, título del panel y el cuerpo
 * con la receta `.tw-legal` (títulos de sección, listas y enlaces).
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="tw-page tw-page-narrow">
      <PageHeader
        title={title}
        lede={`Última actualización: ${updated}.`}
        back={{ href: "/", label: "Inicio" }}
      />
      <div className="tw-legal">{children}</div>
    </div>
  );
}
