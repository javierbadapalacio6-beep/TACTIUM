import type { Metadata } from "next";

import { InviteLanding } from "@/components/invite/InviteLanding";
import { supabaseAnon } from "@/lib/supabase/anon";

type Params = Promise<{ code: string }>;

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Página pública de una invitación: `tactium.io/i/{CÓDIGO}`.
 *
 * Con la app instalada el enlace universal la abre directamente; si no, se
 * llega aquí. Los metadatos (para la tarjeta que pinta WhatsApp al pegar el
 * enlace) llevan el nombre real del equipo, leído con el cliente anónimo por
 * la RPC `preview_team_invitation`. Nada inventado: si el código no vale o no
 * hay conexión, se cae al título genérico.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const clean = safeDecode(code).replace(/\s+/g, "").toUpperCase();
  const base: Metadata = {
    title: "Invitación a un equipo",
    description: "Te han invitado a un equipo en TACTIUM.",
    // Un enlace de invitación es privado: fuera de los buscadores.
    robots: { index: false, follow: false },
  };
  const sb = supabaseAnon();
  if (!sb || !clean) return base;
  try {
    const { data } = await sb.rpc("preview_team_invitation", { p_code: clean });
    const d = data as { valid?: boolean; team?: { name?: string } } | null;
    const teamName = d?.valid ? d.team?.name : null;
    if (!teamName) return base;
    // La pestaña ya añade «· TACTIUM» (plantilla del layout); en la tarjeta
    // de WhatsApp/OG no hay plantilla, así que ahí va la marca explícita.
    const title = `Únete a ${teamName}`;
    const ogTitle = `Únete a ${teamName} en TACTIUM`;
    const description = `${teamName} ya está en TACTIUM: jornadas, alineaciones y resultados en un sitio.`;
    return {
      ...base,
      title,
      description,
      openGraph: { title: ogTitle, description, type: "website" },
      twitter: { card: "summary", title: ogTitle, description },
    };
  } catch {
    return base;
  }
}

export default async function InvitacionPage({ params }: { params: Params }) {
  const { code } = await params;
  return <InviteLanding code={safeDecode(code)} />;
}
