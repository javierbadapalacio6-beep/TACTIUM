import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SETTINGS_SECTIONS,
  isSettingsSlug,
  type SettingsSlug,
} from "@/lib/account-data";
import { Apariencia } from "@/components/settings/Apariencia";
import { Notificaciones } from "@/components/settings/Notificaciones";
import { MisDatos } from "@/components/settings/MisDatos";
import { ZonaPeligro } from "@/components/settings/ZonaPeligro";
import {
  EquipoActual,
  Invitaciones,
  MiJugador,
  Soporte,
  SuscripcionResumen,
  Torneos,
} from "@/components/settings/simple-sections";

/** Prerenderiza las 10 secciones: son fijas y conocidas. */
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
  // El label va en mayúsculas para el eyebrow; en el <title> se ve mejor
  // con la inicial en mayúscula y el resto tal cual.
  const nice = match.label.charAt(0) + match.label.slice(1).toLowerCase();
  return { title: `${nice} · Ajustes` };
}

const SECTION_VIEWS: Record<SettingsSlug, () => React.ReactElement> = {
  apariencia: Apariencia,
  notificaciones: Notificaciones,
  jugador: MiJugador,
  equipo: EquipoActual,
  invitaciones: Invitaciones,
  suscripcion: SuscripcionResumen,
  torneos: Torneos,
  soporte: Soporte,
  datos: MisDatos,
  peligro: ZonaPeligro,
};

export default async function SeccionAjustes({
  params,
}: {
  params: Promise<{ seccion: string }>;
}) {
  const { seccion } = await params;
  if (!isSettingsSlug(seccion)) notFound();

  const View = SECTION_VIEWS[seccion];
  return <View />;
}
