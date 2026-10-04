"use client";

import { useState } from "react";

import { fetchPublicMatchday } from "@/lib/match-data";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { BtnLink, Card, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconShare } from "@/components/Icon";

import { KudosButton, MatchRow, MatchScoreboard } from "./MatchScoreboard";

/**
 * /partido/[id] — detalle PÚBLICO de una jornada de liga (espejo de
 * LeagueMatchDetailScreen en la app). Usa la RPC `public_get_matchday`, que ya
 * existe y admite anon: cualquiera puede verla; los kudos, con sesión.
 */
const OUTCOME: Record<string, { label: string; tone: "accent" | "error" | "warning" }> = {
  win: { label: "Victoria", tone: "accent" },
  loss: { label: "Derrota", tone: "error" },
  draw: { label: "Empate", tone: "warning" },
};

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function PublicMatchday({ id }: { id: string }) {
  const { user, activeTeam } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  const { data: md, loading, error } = useAsync(() => fetchPublicMatchday(id), [id], true);

  if (loading) return <SkeletonPage />;
  if (error || !md) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState icon={<IconCalendar size={22} />} title="Partido no disponible" body={error ?? "Puede que se haya borrado."} />
        </Card>
      </div>
    );
  }

  const oc = md.outcome ? OUTCOME[md.outcome] ?? null : null;
  const isMyTeam = !!activeTeam && !!md.team_name && activeTeam.name.trim() === md.team_name.trim();
  const courts = md.courts.map((ct) => {
    let won: boolean | null = null;
    if (ct.forfeit) won = !ct.forfeit_us;
    else if (ct.sets.length) {
      const u = ct.sets.filter((s) => s.us > s.them).length;
      const t = ct.sets.filter((s) => s.them > s.us).length;
      won = u === t ? null : u > t;
    }
    return { ...ct, won };
  });
  const eyebrow = [md.category, md.group_name ? `Grupo ${md.group_name}` : null, md.jornada_number != null ? `J${md.jornada_number}` : null, shortDate(md.match_date)]
    .filter(Boolean)
    .join(" · ");

  async function share() {
    const text = `🎾 ${md!.team_name ?? ""} ${md!.score_for ?? 0}–${md!.score_against ?? 0} ${md!.opponent ?? ""}${
      md!.jornada_number != null ? ` · Jornada ${md!.jornada_number}` : ""
    }`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        setToast("Enlace copiado");
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title={`${md.team_name ?? "Equipo"} vs ${md.opponent ?? "Rival"}`}
        meta={[md.jornada_number != null ? `Jornada ${md.jornada_number}` : null, md.is_home != null ? (md.is_home ? "En casa" : "Fuera") : null].filter(Boolean) as string[]}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void share()}>
            <IconShare size={15} />
            Compartir
          </button>
        }
      />

      <MatchScoreboard
        eyebrow={eyebrow}
        left={md.team_name ?? "Equipo"}
        right={md.opponent ?? "Rival"}
        us={md.score_for}
        them={md.score_against}
        status={oc?.label ?? "Sin acta"}
        tone={oc?.tone ?? "text"}
        photoUrl={md.photo_url}
      />

      {oc && user && (
        <div style={{ marginTop: 16 }}>
          <KudosButton
            kind="league"
            targetId={md.id}
            userId={user.id}
            initialCount={md.kudos_count ?? null}
            initialGiven={md.i_gave_kudos ?? null}
            onError={setToast}
          />
        </div>
      )}

      {isMyTeam && (
        <div style={{ marginTop: 12 }}>
          <BtnLink href={`/jornada/${md.id}`} variant="quiet" size="sm">
            Abrir jornada ›
          </BtnLink>
        </div>
      )}

      {courts.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", margin: "20px 0 8px" }}>Pista a pista</div>
          <div style={{ display: "grid", gap: 8 }}>
            {courts.map((ct) => (
              <MatchRow
                key={ct.court_number}
                badge={`P${ct.court_number}`}
                title={ct.pair ?? `Pista ${ct.court_number}`}
                sub={
                  ct.forfeit
                    ? `W.O. ${ct.forfeit_us ? "en contra" : "a favor"}`
                    : ct.sets.length
                      ? ct.sets.map((s) => `${s.us}-${s.them}`).join(" ")
                      : "Sin resultado"
                }
                right={ct.won === true ? "✓" : ct.won === false ? "✕" : "—"}
                tone={ct.won === true ? "win" : ct.won === false ? "loss" : "muted"}
              />
            ))}
          </div>
        </>
      )}

      {toast && <Toast tone="warning" title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
