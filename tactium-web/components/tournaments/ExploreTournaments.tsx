"use client";

import Link from "next/link";
import { useState } from "react";

import { exploreTournaments, type DbTournament } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconSearch, IconTicket, IconTrophy } from "@/components/Icon";

/**
 * Explorar torneos — datos REALES.
 *
 * Se leen con la RPC `explore_tournaments`, que es `SECURITY DEFINER` y está
 * concedida a `anon`: por eso esta pantalla funciona sin sesión, igual que en
 * la app. La tabla `tournaments` en sí no tiene política de SELECT, así que
 * leerla directamente no devolvería nada aunque hubiera sesión.
 */

/** Estados que guarda la base de datos, con su etiqueta y su tono. */
const STATUS: Record<
  string,
  { label: string; color: string; border: string }
> = {
  open: { label: "Inscripción abierta", color: "var(--accent)", border: "var(--accent-40)" },
  in_progress: { label: "En juego", color: "var(--warning)", border: "var(--warning)" },
  finished: { label: "Finalizado", color: "var(--text-faint)", border: "var(--hair-strong)" },
  draft: { label: "Borrador", color: "var(--text-faint)", border: "var(--hair-strong)" },
  cancelled: { label: "Cancelado", color: "var(--error)", border: "var(--error)" },
};

function statusOf(s: string) {
  return (
    STATUS[s] ?? {
      label: s,
      color: "var(--text-faint)",
      border: "var(--hair-strong)",
    }
  );
}

const FORMAT_LABEL: Record<string, string> = {
  americano: "Americano",
  ko: "Cuadro",
  groups_ko: "Grupos + Cuadro",
  ko_consolation: "Cuadro con consolación",
};

function formatFee(t: DbTournament): string | null {
  if (t.entry_fee == null) return null;
  const n = Number(t.entry_fee);
  if (!Number.isFinite(n) || n === 0) return null;
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ExploreTournaments() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [code, setCode] = useState("");

  const { data, loading, error } = useAsync(
    () => exploreTournaments(),
    [],
    true
  );
  const all = data ?? [];

  const q = query.trim().toLowerCase();
  const rows = all.filter((t) => {
    if (filter !== "todos" && t.status !== filter) return false;
    if (!q) return true;
    return `${t.name} ${t.club_name ?? ""} ${t.location ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  // Los filtros salen de lo que realmente hay, no de una lista fija.
  const statuses = Array.from(new Set(all.map((t) => t.status)));

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>TORNEOS</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Torneos</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {loading ? "CARGANDO…" : `${all.length} TORNEOS · DATOS REALES`}
        </p>
      </div>

      <div className="tw-tourney-grid">
        <div>
          <Card style={{ padding: 18, marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--hair-strong)",
                background: "var(--bg-card-2)",
              }}
            >
              <IconSearch size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por nombre, club o lugar"
                aria-label="Buscar torneo"
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

            {statuses.length > 1 && (
              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["todos", ...statuses].map((f) => {
                  const on = filter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className="btn"
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: on ? 700 : 500,
                        background: on ? "var(--accent-10)" : "transparent",
                        color: on ? "var(--accent)" : "var(--text-muted)",
                        border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                      }}
                    >
                      {f === "todos" ? "Todos" : statusOf(f).label}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {loading ? (
            <div className="tw-tourney-cards">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <Card>
              <EmptyState
                icon={<IconTrophy size={34} />}
                title="No se pudieron cargar los torneos"
                body={error}
              />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconTrophy size={34} />}
                title="No hay torneos que encajen"
                body="Prueba con otra búsqueda."
              />
            </Card>
          ) : (
            <div className="tw-tourney-cards">
              {rows.map((t) => {
                const st = statusOf(t.status);
                const fee = formatFee(t);
                return (
                  <Link key={t.id} href={`/torneos/${t.id}`} style={{ color: "inherit" }}>
                    <Card style={{ padding: 0, overflow: "hidden", height: "100%" }}>
                      <div
                        className={t.cover_url ? undefined : "tw-tourney-cover amb"}
                        style={
                          t.cover_url
                            ? {
                                position: "relative",
                                height: 110,
                                borderBottom: "1px solid var(--hair)",
                                backgroundImage: `url(${t.cover_url})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      >
                        <span
                          className="chip"
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            color: st.color,
                            borderColor: st.border,
                            background: "var(--bg-card)",
                          }}
                        >
                          {st.label}
                        </span>
                      </div>

                      <div style={{ padding: 20 }}>
                        <div
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          className="mono"
                          style={{
                            marginTop: 6,
                            fontSize: 10,
                            letterSpacing: "0.14em",
                            color: "var(--text-faint)",
                          }}
                        >
                          {(t.club_name ?? "Sin club").toUpperCase()}
                          {t.location ? ` · ${t.location.toUpperCase()}` : ""}
                        </div>
                        <div
                          className="mono"
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            letterSpacing: "0.08em",
                            color: "var(--text-muted)",
                          }}
                        >
                          {formatDate(t.starts_on)}
                          {t.format ? ` · ${FORMAT_LABEL[t.format] ?? t.format}` : ""}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {(t.categories ?? []).map((c) => (
                            <span key={c} className="chip chip-mute">
                              {c}
                            </span>
                          ))}
                          {(t.genders ?? []).map((g) => (
                            <span key={g} className="chip chip-mute">
                              {g}
                            </span>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: 16,
                            paddingTop: 14,
                            borderTop: "1px solid var(--hair)",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {t.players != null && (
                            <span
                              className="mono"
                              style={{ fontSize: 11.5, color: "var(--text-muted)" }}
                            >
                              {t.players} {t.pair_based ? "jugadores" : "plazas"}
                            </span>
                          )}
                          <div style={{ flex: 1 }} />
                          {fee && (
                            <span
                              className="mono"
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--accent)",
                              }}
                            >
                              {fee}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Códigos ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Eyebrow>TENGO UN CÓDIGO</Eyebrow>
            <p
              style={{
                margin: "14px 0 16px",
                fontSize: 13,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              Entra directo al torneo con el código que te ha pasado el club.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej. K7P2QX"
                aria-label="Código del torneo"
                className="mono"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--hair-strong)",
                  background: "var(--bg-card-2)",
                  color: "var(--text)",
                  fontSize: 14,
                  letterSpacing: "0.18em",
                  outline: "none",
                }}
              />
              <button
                className="btn btn-accent"
                disabled={code.trim().length < 4}
                onClick={() => {
                  const hit = all.find(
                    (t) => t.signup_code?.toUpperCase() === code.trim()
                  );
                  if (hit) window.location.href = `/torneos/${hit.id}`;
                  else setQuery(code.trim());
                }}
                style={{ padding: "12px 20px", fontSize: 13, borderRadius: 10 }}
              >
                Buscar
              </button>
            </div>
          </Card>

          <Link href="/club/torneos" style={{ color: "inherit" }}>
            <Card
              style={{
                padding: 20,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--accent-10)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <IconTicket size={17} />
              </span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                Organizo torneos
              </span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
