"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchClubTeams } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconChevronRight, IconPlus, IconSearch, IconShield } from "@/components/Icon";

const GENDERS = ["Todos", "Masculino", "Femenino", "Mixto"] as const;

export function ClubTeams() {
  const { clubId } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchClubTeams(clubId!),
    [clubId],
    !!clubId
  );
  const CLUB_TEAMS_FULL = data ?? [];

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("Todos");

  const rows = CLUB_TEAMS_FULL.filter((t) => {
    if (gender !== "Todos" && (t.gender ?? "").toLowerCase() !== gender.toLowerCase()) return false;
    const q = query.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q);
  });

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>CLUB · EQUIPOS</Eyebrow>
          <h1 style={{ marginTop: 10, fontSize: 30 }}>Equipos</h1>
        </div>
        <Link
          href="/empezar/equipo"
          className="btn btn-accent"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          <IconPlus size={15} />
          Crear nuevo equipo
        </Link>
      </div>

      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--hair-strong)",
              background: "var(--bg-card-2)",
              flex: 1,
              minWidth: 200,
            }}
          >
            <IconSearch size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar equipo"
              aria-label="Buscar equipo"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontSize: 13.5,
                outline: "none",
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GENDERS.map((g) => {
              const on = gender === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className="btn"
                  style={{
                    padding: "9px 15px",
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    background: on ? "var(--accent-10)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!clubId ? (
        <Card>
          <EmptyState icon={<IconShield size={34} />} title="Sin club activo" />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState icon={<IconShield size={34} />} title="No se pudieron cargar los equipos" body={error} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconShield size={34} />}
            title="Sin coincidencias"
            body="Prueba con otro filtro o nombre."
          />
        </Card>
      ) : (
        <div className="tw-club-teams">
          {rows.map((t) => (
            <Link key={t.id} href={`/club/equipos/${t.id}`} style={{ color: "inherit" }}>
              <Card style={{ padding: 22, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: "var(--primary-dim)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <IconShield size={18} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>
                      {t.name}
                    </span>
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        marginTop: 4,
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {[t.category, t.gender].filter(Boolean).join(" · ").toUpperCase() || "SIN CATEGORÍA"}
                    </span>
                  </span>
                  <IconChevronRight size={16} />
                </div>

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 14,
                    borderTop: "1px solid var(--hair)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {t.covered ? (
                    <span className="chip">Cubierto</span>
                  ) : (
                    <span className="chip chip-warning">No cubierto</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
