"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchCasualMatches, type DbCasual } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconUpload,
  IconUsers,
} from "@/components/Icon";

/** Los tipos que guarda la base: amistoso · entreno · torneo. */
const TYPE_LABEL: Record<string, string> = {
  amistoso: "AMISTOSO",
  entreno: "ENTRENAMIENTO",
  torneo: "TORNEO",
};

const formatSets = (sets: [number, number][]) =>
  sets.map(([a, b]) => `${a}-${b}`).join(" ");

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * `winner_side` guarda el lado ganador (0 o 1). El lado 0 es «nosotros» en los
 * amistosos creados desde la app, así que se usa como referencia.
 */
const wonByUs = (c: DbCasual) => c.winnerSide === 0;

/* ═══ LISTA DE AMISTOSOS ══════════════════════════════════════════ */
export function CasualList() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchCasualMatches(50),
    [user?.id],
    !!user
  );
  const matches = data ?? [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
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
          <Eyebrow>AMISTOSOS</Eyebrow>
          <h1 style={{ marginTop: 10, fontSize: 30 }}>Amistosos</h1>
          <p
            className="mono"
            style={{
              margin: "8px 0 0",
              fontSize: 10.5,
              letterSpacing: "0.14em",
              color: "var(--text-faint)",
            }}
          >
            {loading ? "CARGANDO…" : `${matches.length} PARTIDOS`}
          </p>
        </div>
        <Link
          href="/amistosos/nuevo"
          className="btn btn-accent"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          <IconPlus size={15} />
          Registrar amistoso
        </Link>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="No se pudieron cargar los amistosos"
            body={error}
          />
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="Sin partidos todavía"
            body="Registra tu primer amistoso y empieza a acumular números."
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {matches.map((c) => {
            const decided = c.winnerSide !== null;
            const won = wonByUs(c);
            return (
              <Link key={c.id} href={`/amistosos/${c.id}`} style={{ color: "inherit" }}>
                <Card style={{ padding: 20 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.16em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {TYPE_LABEL[c.type] ?? c.type.toUpperCase()}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-faint)" }}
                    >
                      {formatDate(c.playedOn)}
                    </span>
                    <div style={{ flex: 1 }} />
                    {decided && (
                      <span
                        className="chip"
                        style={{
                          color: won ? "var(--accent)" : "var(--error)",
                          borderColor: won ? "var(--accent-40)" : "var(--error)",
                        }}
                      >
                        {won ? "Victoria" : "Derrota"}
                      </span>
                    )}
                    {c.photoUrl && <span className="chip chip-mute">Foto</span>}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 160 }}>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>
                        {c.sideA.join(" · ") || "—"}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          fontSize: 13,
                          color: "var(--text-muted)",
                        }}
                      >
                        vs {c.sideB.join(" · ") || "—"}
                      </span>
                    </span>
                    <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                      {formatSets(c.sets)}
                    </span>
                    <IconChevronRight size={16} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ DETALLE DE AMISTOSO ═════════════════════════════════════════ */
export function CasualDetail({ id }: { id: string }) {
  const { user } = useSession();
  const [copied, setCopied] = useState(false);

  const { data, loading, error } = useAsync(
    () => fetchCasualMatches(100),
    [user?.id],
    !!user
  );
  const c = (data ?? []).find((m) => m.id === id) ?? null;

  if (loading) return <SkeletonCard />;
  if (error || !c) {
    return (
      <Card>
        <EmptyState
          icon={<IconUsers size={34} />}
          title="Partido no encontrado"
          body={error ?? "Puede que no sea público o que se haya borrado."}
        />
      </Card>
    );
  }

  const decided = c.winnerSide !== null;
  const won = wonByUs(c);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div
          className={c.photoUrl ? undefined : "amb"}
          style={
            c.photoUrl
              ? {
                  padding: 28,
                  textAlign: "center",
                  backgroundImage: `linear-gradient(180deg, rgba(3,15,15,.35), rgba(3,15,15,.88)), url(${c.photoUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { padding: 28, textAlign: "center" }
          }
        >
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.18em",
              color: "var(--accent)",
            }}
          >
            {TYPE_LABEL[c.type] ?? c.type.toUpperCase()}
          </span>
          <div
            className="mono"
            style={{
              marginTop: 20,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {formatSets(c.sets) || "—"}
          </div>
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <span className="chip chip-mute">{c.sideA.join(" · ") || "—"}</span>
            <span className="chip chip-mute">{c.sideB.join(" · ") || "—"}</span>
          </div>
          {decided && (
            <div style={{ marginTop: 18 }}>
              <span
                className="chip"
                style={{
                  color: won ? "var(--accent)" : "var(--error)",
                  borderColor: won ? "var(--accent-40)" : "var(--error)",
                }}
              >
                {won ? "Victoria" : "Derrota"}
              </span>
            </div>
          )}
        </div>
      </Card>

      {c.sets.length > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <Eyebrow>SETS</Eyebrow>
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: `repeat(${c.sets.length}, 1fr)`,
              gap: 14,
              maxWidth: 320,
            }}
          >
            {c.sets.map(([a, b], i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    color: "var(--text-faint)",
                    marginBottom: 8,
                  }}
                >
                  SET {i + 1}
                </div>
                <div
                  className="mono"
                  style={{
                    padding: "12px 8px",
                    borderRadius: 10,
                    background: "var(--bg-card-2)",
                    fontSize: 17,
                    fontWeight: 700,
                    color: a > b ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {a}-{b}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {c.claimCode && (
        <Card style={{ marginBottom: 20 }}>
          <Eyebrow>CÓDIGO DEL PARTIDO</Eyebrow>
          <p
            style={{
              margin: "14px 0 16px",
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Quien salga en este partido puede reclamarlo con el código y sumarlo
            a sus estadísticas.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "16px 20px",
              borderRadius: 12,
              background: "var(--bg-card-2)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "var(--accent)",
              }}
            >
              {c.claimCode}
            </span>
            <button
              type="button"
              aria-label="Copiar código"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(c.claimCode!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* se puede copiar a mano */
                }
              }}
              style={{
                border: "none",
                background: "transparent",
                color: copied ? "var(--accent)" : "var(--text-faint)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <IconCopy size={17} />
            </button>
          </div>
        </Card>
      )}

      <Link
        href="/amistosos"
        className="btn btn-ghost"
        style={{ padding: "12px 20px", fontSize: 13.5 }}
      >
        Volver a amistosos
      </Link>
    </div>
  );
}

/* ═══ REGISTRAR AMISTOSO ══════════════════════════════════════════ */
const KINDS = [
  { key: "amistoso", label: "Amistoso" },
  { key: "entreno", label: "Entreno" },
] as const;

export function NewCasual() {
  const [kind, setKind] = useState<string>("amistoso");
  const [sets, setSets] = useState<[number, number][]>([
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const u = sets.filter(([a, b]) => a > b).length;
  const t = sets.filter(([a, b]) => b > a).length;
  const hasResult = u + t > 0;

  function edit(i: number, side: 0 | 1, v: string) {
    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, "")) || 0));
    setSets((s) =>
      s.map((pair, k) =>
        k === i
          ? ((side === 0 ? [n, pair[1]] : [pair[0], n]) as [number, number])
          : pair
      )
    );
    setError(null);
  }

  async function save() {
    if (!hasResult) {
      setError("Introduce al menos un set completo en algún partido.");
      return;
    }
    const res = await guardedWrite("guardar el amistoso", async () => {
      throw new Error("pendiente de llamar al RPC create_casual_match");
    });
    setResult(res.ok ? "¡Amistoso guardado!" : res.reason);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>AMISTOSOS</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Registrar amistoso</h1>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>TIPO</Eyebrow>
        <div className="tw-type-grid" style={{ marginTop: 16 }}>
          {KINDS.map((k) => {
            const on = kind === k.key;
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 12,
                  cursor: "pointer",
                  background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                  border: `1.5px solid ${on ? "var(--accent)" : "transparent"}`,
                  color: "var(--text)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 700,
                    color: on ? "var(--accent)" : "var(--text)",
                  }}
                >
                  {k.label}
                </span>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    marginTop: 6,
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                  }}
                >
                  {TYPE_LABEL[k.key]}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>TU PAREJA · PAREJA RIVAL</Eyebrow>
        <div className="tw-form-grid" style={{ marginTop: 18 }}>
          {["Jugador 1", "Jugador 2", "Rival 1", "Rival 2"].map((ph) => (
            <input
              key={ph}
              type="text"
              placeholder={ph}
              aria-label={ph}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                background: "var(--bg-card-2)",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>RESULTADO</Eyebrow>
        <div className="tw-sets-row" style={{ marginTop: 18 }}>
          {sets.map(([a, b], i) => (
            <div key={i}>
              <div
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  color: "var(--text-faint)",
                  marginBottom: 7,
                  textAlign: "center",
                }}
              >
                SET {i + 1}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={a || ""}
                  placeholder="–"
                  aria-label={`Set ${i + 1} nuestro`}
                  onChange={(e) => edit(i, 0, e.target.value)}
                  className="mono tw-set-input"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={b || ""}
                  placeholder="–"
                  aria-label={`Set ${i + 1} rival`}
                  onChange={(e) => edit(i, 1, e.target.value)}
                  className="mono tw-set-input"
                />
              </div>
            </div>
          ))}
        </div>

        {hasResult && (
          <div style={{ marginTop: 20 }}>
            <span
              className="chip"
              style={{
                color: u > t ? "var(--accent)" : "var(--error)",
                borderColor: u > t ? "var(--accent-40)" : "var(--error)",
              }}
            >
              {u > t ? "Victoria" : "Derrota"}
            </span>
          </div>
        )}

        {error && (
          <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--error)" }}>
            {error}
          </p>
        )}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>FOTO DEL PARTIDO</Eyebrow>
        <label
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 18,
            borderRadius: 12,
            border: "1px dashed var(--hair-strong)",
            cursor: "pointer",
          }}
        >
          <span style={{ color: "var(--accent)", display: "flex" }}>
            <IconUpload size={20} />
          </span>
          <span style={{ flex: 1, fontSize: 13, color: "var(--text-muted)" }}>
            Añadir foto del partido
          </span>
          <input type="file" accept="image/*" hidden />
        </label>
      </Card>

      {!WRITES_ENABLED && (
        <p
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--warning-soft)",
            border: "1px solid var(--warning)",
            color: "var(--warning)",
            fontSize: 12.5,
          }}
        >
          {READ_ONLY_MESSAGE}
        </p>
      )}

      {result && (
        <p
          role="status"
          style={{
            margin: "0 0 16px",
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--bg-card-2)",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {result}
        </p>
      )}

      <button
        className="btn btn-accent"
        onClick={() => void save()}
        style={{ padding: "14px 24px", fontSize: 14.5 }}
      >
        Guardar amistoso
      </button>
    </div>
  );
}
