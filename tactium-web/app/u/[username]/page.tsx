import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicProfileView } from "@/components/social/social";
import { supabaseAnon } from "@/lib/supabase/anon";

type Params = Promise<{ username: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProfileHead {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
}

/**
 * Comprueba en servidor que el perfil existe (mismas RPC anon que la vista).
 * `undefined` = no se pudo comprobar (sin configuración o error de red): la
 * página sigue como antes, sin 404 falso.
 */
const loadProfileHead = cache(async (param: string): Promise<ProfileHead | null | undefined> => {
  const sb = supabaseAnon();
  if (!sb) return undefined;
  try {
    let id = param;
    if (!UUID_RE.test(param)) {
      const handle = decodeURIComponent(param).replace(/^@/, "");
      const { data, error } = await sb.rpc("resolve_username", { p_username: handle });
      if (error) return undefined;
      if (!data) return null;
      id = data as string;
    }
    const { data, error } = await sb.rpc("get_public_user_profile", { target: id });
    if (error) return undefined;
    return (data as ProfileHead | null) ?? null;
  } catch {
    return undefined;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const p = await loadProfileHead(username);
  if (!p) return { title: "Perfil", robots: { index: false, follow: false } };
  const name = p.full_name || (p.username ? `@${p.username}` : "Jugador");
  const path = `/u/${p.username ? encodeURIComponent(p.username) : p.id}`;
  return {
    title: `${name} · perfil de pádel`,
    description:
      p.bio?.slice(0, 160) ||
      `Perfil de ${name} en TACTIUM: equipos, amistosos y resultados de pádel.`,
    alternates: { canonical: path },
    // Solo se indexa quien ha elegido nombre de usuario (perfil público a
    // propósito); el resto se ve por enlace, pero fuera del buscador.
    robots: p.username ? undefined : { index: false, follow: true },
  };
}

export default async function PerfilPublicoPage({ params }: { params: Params }) {
  const { username } = await params;
  const p = await loadProfileHead(username);
  if (p === null) notFound();
  return <PublicProfileView username={username} />;
}
