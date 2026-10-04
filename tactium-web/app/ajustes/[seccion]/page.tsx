import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  LEGACY_SETTINGS_REDIRECTS,
  SETTINGS_SECTIONS,
  isSettingsSlug,
  type SettingsSlug,
} from "@/lib/account-data";
import {
  SeccionAyuda,
  SeccionCuenta,
  SeccionEquipo,
  SeccionPerfil,
  SeccionPreferencias,
} from "@/components/settings/sections";

/** Prerenderiza las 5 secciones: son fijas y conocidas. */
export function generateStaticParams() {
  return SETTINGS_SECTIONS.map((s) => ({ seccion: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ seccion: string }>;
}): Promise<Metadata> {
  const { seccion } = await params;
  const match = SETTINGS_SECTIONS.find((s) => s.slug === seccion);
  if (!match) return { title: "Ajustes" };
  return { title: `${match.label} · Ajustes` };
}

const SECTION_VIEWS: Record<SettingsSlug, () => React.ReactElement> = {
  perfil: SeccionPerfil,
  equipo: SeccionEquipo,
  preferencias: SeccionPreferencias,
  cuenta: SeccionCuenta,
  ayuda: SeccionAyuda,
};

export default async function SeccionAjustes({
  params,
}: {
  params: Promise<{ seccion: string }>;
}) {
  const { seccion } = await params;
  // Las 10 secciones antiguas se juntaron en 5: sus URLs siguen funcionando.
  const legacy = Object.prototype.hasOwnProperty.call(LEGACY_SETTINGS_REDIRECTS, seccion)
    ? LEGACY_SETTINGS_REDIRECTS[seccion]
    : null;
  if (legacy) permanentRedirect(legacy);
  if (!isSettingsSlug(seccion)) notFound();

  const View = SECTION_VIEWS[seccion];
  return <View />;
}
