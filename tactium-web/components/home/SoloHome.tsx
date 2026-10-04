"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { BtnLink, Card, CardHead, Chip, ListRow, PageHeader } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { Ring } from "@/components/charts";
import { Feed } from "@/components/social/social";
import { CodeRedeem } from "@/components/settings/CodeRedeem";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { fetchCasualMatches, type DbCasual } from "@/lib/queries";
import { fetchFollowingCount } from "@/lib/account-queries";
import { IconCheck, IconChevronRight, IconPlus } from "@/components/Icon";

const FOLLOW_GOAL = 3;

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

/** Lado en el que jugó `uid` (0/1). NO siempre es el 0: si le apuntó otro,
 *  puede ir en el 1. null = no figura con su cuenta. */
function sideOf(m: DbCasual, uid: string | undefined): 0 | 1 | null {
  if (!uid) return null;
  if (m.userIdsA.includes(uid)) return 0;
  if (m.userIdsB.includes(uid)) return 1;
  return null;
}

/**
 * Inicio del jugador sin equipo (igual que la app): con partidos, tu récord
 * arriba, registrar, los 2 últimos resultados y Novedades; sin partidos, una
 * lista de 3 pasos que se termina. El campo de código vale para partidos y
 * para equipos, y el puente al equipo va al final.
 */
export function SoloHome() {
  const { user } = useSession();
  const reduce = useReducedMotion();
  const [reload, setReload] = useState(0);
  const { data, loading } = useAsync(
    async () => {
      const [matches, following] = await Promise.all([
        fetchCasualMatches(50),
        fetchFollowingCount(user!.id).catch(() => 0),
      ]);
      return { matches, following };
    },
    [user?.id, reload],
    !!user,
  );
  const matches: DbCasual[] = useMemo(() => data?.matches ?? [], [data]);
  const following = data?.following ?? 0;
  const uid = user?.id;

  // Partidos decididos en los que figuras con tu cuenta, del más reciente al
  // más antiguo, ya desde TU lado.
  const mine = useMemo(
    () =>
      matches
        .map((m) => ({ m, side: sideOf(m, uid) }))
        .filter((x) => x.side !== null && x.m.winnerSide !== null)
        .map((x) => ({ m: x.m, side: x.side as 0 | 1, won: x.m.winnerSide === x.side })),
    [matches, uid],
  );
  const won = mine.filter((g) => g.won).length;
  const lost = mine.length - won;
  const rate = mine.length ? Math.round((won / mine.length) * 100) : 0;
  const lastFive = mine.slice(0, 5).reverse();

  if (loading) return <SkeletonPage />;
  const firstName = user?.name?.split(" ")[0] ?? null;
  const hasMatches = matches.length > 0;

  return (
    <div className="tw-page">
      <PageHeader
        title={hasMatches ? "Tu pádel, tus números" : "Empieza en 3 pasos"}
        lede={firstName ? `Hola, ${firstName}.` : undefined}
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      {hasMatches ? (
        <div className="tw-home-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <Card>
              <Link href="/stats" style={{ color: "inherit", display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <Ring value={rate} label="de victorias en amistosos" size={96} />
                  <div style={{ display: "grid", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                      {won} V · {lost} D
                    </span>
                    {lastFive.length > 0 && (
                      <span style={{ display: "inline-flex", gap: 4 }} aria-label="Últimos resultados">
                        {lastFive.map((g, i) => (
                          <motion.span
                            key={g.m.id}
                            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              background: g.won ? "var(--accent)" : "var(--error)",
                            }}
                          />
                        ))}
                      </span>
                    )}
                    <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      Ver todos mis números ›
                    </span>
                  </div>
                </div>
              </Link>
            </Card>

            <Card flush>
              <CardHead title="Últimos resultados">
                <Link href="/stats" className="link-action">
                  Ver todo
                </Link>
              </CardHead>
              {matches.slice(0, 2).map((m) => {
                const side = sideOf(m, uid) ?? 0;
                const rivals = (side === 0 ? m.sideB : m.sideA).join(" / ") || "Rivales";
                const decided = m.winnerSide !== null;
                const win = m.winnerSide === side;
                return (
                  <ListRow
                    key={m.id}
                    href={`/amistosos/${m.id}`}
                    title={`vs ${rivals}`}
                    sub={fmtDate(m.playedOn)}
                    right={
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {m.sets.map(([a, b]) => (side === 1 ? `${b}-${a}` : `${a}-${b}`)).join(" ")}
                        </span>
                        {decided && <Chip tone={win ? "accent" : "error"}>{win ? "V" : "D"}</Chip>}
                      </span>
                    }
                  />
                );
              })}
            </Card>
          </div>
          <Feed embedded limit={4} />
        </div>
      ) : (
        <Card flush>
          <CardHead title="Tus primeros pasos" />
          <Step done title="Crear tu cuenta" />
          <Step title="Registrar tu primer amistoso" href="/amistosos/nuevo" action="Empezar" />
          <Step
            title={`Seguir a ${FOLLOW_GOAL} personas`}
            sub={`${Math.min(following, FOLLOW_GOAL)} de ${FOLLOW_GOAL}`}
            done={following >= FOLLOW_GOAL}
            href="/comunidad"
          />
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <CodeRedeem mode="any" onClaimed={() => setReload((k) => k + 1)} />
      </div>

      <Card style={{ marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>¿Juegas liga con un equipo?</div>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "var(--text-muted)" }}>
          Si tu capitán usa TACTIUM, pídele el enlace de invitación o su código y escríbelo
          arriba.
        </p>
        <Link href="/empezar" className="link-action">
          ¿Capitaneas tú? Crea tu equipo
        </Link>
      </Card>
    </div>
  );
}

/** Paso de la lista: círculo relleno y texto tachado cuando está hecho. */
function Step({
  title,
  sub,
  done,
  href,
  action,
}: {
  title: string;
  sub?: string;
  done?: boolean;
  href?: string;
  action?: string;
}) {
  const reduce = useReducedMotion();
  const circle = (
    <motion.span
      aria-hidden="true"
      initial={false}
      animate={{
        backgroundColor: done ? "var(--accent)" : "rgba(0,0,0,0)",
        borderColor: done ? "var(--accent)" : "var(--line-strong)",
      }}
      transition={{ duration: reduce ? 0 : 0.2 }}
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        border: "2px solid",
        display: "grid",
        placeItems: "center",
        color: "var(--text-inverse)",
        flex: "none",
      }}
    >
      {done && <IconCheck size={12} />}
    </motion.span>
  );
  return (
    <ListRow
      href={done ? undefined : href}
      icon={circle}
      title={
        <span
          style={{
            textDecoration: done ? "line-through" : undefined,
            color: done ? "var(--text-faint)" : undefined,
          }}
        >
          {title}
        </span>
      }
      sub={sub}
      chevron={false}
      right={
        !done && action ? (
          <span className="btn btn-accent btn-sm">{action}</span>
        ) : !done && href ? (
          <IconChevronRight size={16} />
        ) : undefined
      }
    />
  );
}
