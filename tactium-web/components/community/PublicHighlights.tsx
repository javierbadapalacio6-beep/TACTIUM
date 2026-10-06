import { unstable_cache } from "next/cache";

import { Avatar, BtnLink, Card, CardHead, ListRow, SectionHead } from "@/components/ui";
import { supabaseAnon } from "@/lib/supabase/anon";
import { signupHref } from "@/lib/nav";

/**
 * /comunidad para el visitante: antes de buscar, quién hay. Sale de la RPC
 * anon `public_community_highlights()`, que solo devuelve lo que ya es público
 * (nombre de club, y jugadores con nombre de usuario, que tienen perfil en
 * /u/…), sin cuentas internas ni clubes demo. Cacheado 5 minutos.
 */

interface Highlight {
  type: "club" | "user";
  id: string;
  name: string;
  subtitle: string | null;
  followers_count: number;
}

const loadHighlights = unstable_cache(
  async (): Promise<Highlight[]> => {
    const sb = supabaseAnon();
    if (!sb) return [];
    const { data, error } = await sb.rpc("public_community_highlights");
    if (error) return [];
    return (data ?? []) as Highlight[];
  },
  ["public-community-highlights-v1"],
  { revalidate: 300 },
);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const followers = (n: number) => (n > 0 ? ` · ${n} ${n === 1 ? "seguidor" : "seguidores"}` : "");

export async function PublicHighlights() {
  const rows = await loadHighlights().catch(() => []);
  const clubs = rows.filter((r) => r.type === "club");
  const people = rows.filter((r) => r.type === "user");

  return (
    <div className="tw-page" style={{ paddingTop: 0 }}>
      <SectionHead
        title="Quién está ya en TACTIUM"
        sub="Clubes con equipos o torneos, y jugadores con perfil público."
      >
        <BtnLink href={signupHref("/comunidad")} variant="ghost" size="sm">
          Crear tu perfil
        </BtnLink>
      </SectionHead>
      {rows.length === 0 ? null : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {clubs.length > 0 && (
            <Card flush>
              <CardHead title="Clubes" count={clubs.length} />
              {clubs.map((c) => (
                <ListRow
                  key={c.id}
                  icon={<Avatar initials={initials(c.name)} size={36} />}
                  title={c.name}
                  sub={`${c.subtitle ?? "Club"}${followers(c.followers_count)}`}
                />
              ))}
            </Card>
          )}
          {people.length > 0 && (
            <Card flush>
              <CardHead title="Jugadores" count={people.length} />
              {people.map((p) => (
                <ListRow
                  key={p.id}
                  href={`/u/${p.id}`}
                  icon={<Avatar initials={initials(p.name)} size={36} />}
                  title={`@${p.name}`}
                  sub={`Jugador${followers(p.followers_count)}`}
                />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
