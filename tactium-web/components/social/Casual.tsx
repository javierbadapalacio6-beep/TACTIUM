"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchCasualMatches, type DbCasual } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  Note,
  PageHeader,
  Segmented,
  Table,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import {
  IconAlert,
  IconCopy,
  IconPlus,
  IconUpload,
  IconUsers,
} from "@/components/Icon";

/** Los tipos que guarda la base: amistoso · entreno · torneo. */
const TYPE_LABEL: Record<string, string> = {
  amistoso: "Amistoso",
  entreno: "Entrenamiento",
  torneo: "Torneo",
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

  if (loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title="Amistosos"
        lede="Los partidos que apuntas fuera de la liga: amistosos, entrenos y torneos."
        meta={[`${matches.length} ${matches.length === 1 ? "partido" : "partidos"}`]}
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      {error ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="No se pudieron cargar los amistosos"
            body={error}
          />
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Sin partidos todavía"
            body="Registra tu primer amistoso y empieza a acumular números."
            action={
              <BtnLink href="/amistosos/nuevo" variant="accent" size="sm">
                Registrar un amistoso
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead title="Partidos" count={matches.length} />
          <Table minWidth={620}>
            <thead>
              <tr>
                <th>Partido</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th className="num">Resultado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matches.map((c) => {
                const decided = c.winnerSide !== null;
                const won = wonByUs(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/amistosos/${c.id}`} style={{ color: "inherit" }}>
                        <span
                          className="cell-main truncate"
                          style={{ display: "block", maxWidth: 260 }}
                        >
                          {c.sideA.join(" · ") || "—"}
                        </span>
                        <span className="cell-sub truncate" style={{ maxWidth: 260 }}>
                          vs {c.sideB.join(" · ") || "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="cell-muted">{TYPE_LABEL[c.type] ?? c.type}</td>
                    <td className="cell-muted">{formatDate(c.playedOn)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatSets(c.sets) || "—"}
                    </td>
                    <td>
                      <div className="tw-table-actions">
                        {c.photoUrl && <Chip tone="mute">Foto</Chip>}
                        {decided ? (
                          <Chip tone={won ? "accent" : "error"}>
                            {won ? "Victoria" : "Derrota"}
                          </Chip>
                        ) : (
                          <Chip tone="mute">Sin resultado</Chip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
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

  if (loading) return <SkeletonPage />;
  if (error || !c) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Partido no encontrado"
            body={error ?? "Puede que no sea público o que se haya borrado."}
          />
        </Card>
      </div>
    );
  }

  const decided = c.winnerSide !== null;
  const won = wonByUs(c);

  return (
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: "/amistosos", label: "Amistosos" }}
        title={TYPE_LABEL[c.type] ?? c.type}
        meta={[formatDate(c.playedOn) || null, c.photoUrl ? "Con foto" : null].filter(
          Boolean
        ) as string[]}
      />

      {/* Marcador — el dato que se viene a ver. */}
      <Card flush>
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
          <div
            className="mono"
            style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}
          >
            {formatSets(c.sets) || "—"}
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Chip tone="mute" plain>
              {c.sideA.join(" · ") || "—"}
            </Chip>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>vs</span>
            <Chip tone="mute" plain>
              {c.sideB.join(" · ") || "—"}
            </Chip>
          </div>
          {decided && (
            <div style={{ marginTop: 16 }}>
              <Chip tone={won ? "accent" : "error"}>{won ? "Victoria" : "Derrota"}</Chip>
            </div>
          )}
        </div>
      </Card>

      {c.sets.length > 0 && (
        <Card flush style={{ marginTop: 16 }}>
          <CardHead title="Sets" count={c.sets.length} />
          <div className="card-body">
            <div className="tw-sets-row" style={{ marginTop: 0 }}>
              {c.sets.map(([a, b], i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      marginBottom: 7,
                    }}
                  >
                    Set {i + 1}
                  </div>
                  <div
                    className="mono"
                    style={{
                      padding: "12px 8px",
                      borderRadius: "var(--r-sm)",
                      background: "var(--bg-card-2)",
                      border: "1px solid var(--line)",
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
          </div>
        </Card>
      )}

      {c.claimCode && (
        <Card flush style={{ marginTop: 16 }}>
          <CardHead
            title="Código del partido"
            sub="Quien salga en este partido puede reclamarlo y sumarlo a sus estadísticas."
          />
          <div className="card-body">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: "var(--accent)",
                }}
              >
                {c.claimCode}
              </span>
              <Btn
                size="sm"
                aria-label="Copiar código"
                icon={<IconCopy size={15} />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.claimCode!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    /* se puede copiar a mano */
                  }
                }}
              >
                {copied ? "Copiado" : "Copiar"}
              </Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══ REGISTRAR AMISTOSO ══════════════════════════════════════════ */
const KINDS = [
  { key: "amistoso", label: "Amistoso" },
  { key: "entreno", label: "Entreno" },
] as const;

const PLAYER_FIELDS = [
  { id: "casual-jugador-1", label: "Jugador 1" },
  { id: "casual-jugador-2", label: "Jugador 2" },
  { id: "casual-rival-1", label: "Rival 1" },
  { id: "casual-rival-2", label: "Rival 2" },
];

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
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: "/amistosos", label: "Amistosos" }}
        title="Registrar amistoso"
        lede="Apunta el partido y el resultado: se suma a tus números."
      />

      <Card flush>
        <CardHead title="El partido" />
        <div className="card-body">
          <div className="field" style={{ alignItems: "flex-start" }}>
            <span className="field-label">Tipo de partido</span>
            <Segmented
              label="Tipo de partido"
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ value: k.key as string, label: k.label }))}
            />
          </div>

          <div className="tw-form-grid" style={{ marginTop: 16 }}>
            {PLAYER_FIELDS.map((f) => (
              <Field key={f.id} label={f.label} htmlFor={f.id}>
                <Input id={f.id} type="text" placeholder={f.label} aria-label={f.label} />
              </Field>
            ))}
          </div>
        </div>
      </Card>

      <Card flush style={{ marginTop: 16 }}>
        <CardHead title="Resultado" sub="Deja en blanco los sets que no se jugaron." />
        <div className="card-body">
          <div className="tw-sets-row" style={{ marginTop: 0 }}>
            {sets.map(([a, b], i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    marginBottom: 7,
                    textAlign: "center",
                  }}
                >
                  Set {i + 1}
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
            <div style={{ marginTop: 16 }}>
              <Chip tone={u > t ? "accent" : "error"}>{u > t ? "Victoria" : "Derrota"}</Chip>
            </div>
          )}

          {error && (
            <Note tone="error" icon={<IconAlert size={15} />} style={{ marginTop: 16 }}>
              {error}
            </Note>
          )}
        </div>
      </Card>

      <Card flush style={{ marginTop: 16 }}>
        <CardHead title="Foto del partido" sub="Opcional, sale en la tarjeta que compartes." />
        <div className="card-body">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: "var(--r-md)",
              border: "1px dashed var(--line-strong)",
              background: "var(--bg-card-2)",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "var(--accent)", display: "flex" }}>
              <IconUpload size={17} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-muted)" }}>
              Añadir foto del partido
            </span>
            <input type="file" accept="image/*" hidden />
          </label>
        </div>
      </Card>

      {!WRITES_ENABLED && (
        <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginTop: 16 }}>
          {READ_ONLY_MESSAGE}
        </Note>
      )}

      {result && (
        <Note style={{ marginTop: 16 }}>
          <span role="status">{result}</span>
        </Note>
      )}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <BtnLink href="/amistosos">Cancelar</BtnLink>
        <Btn variant="accent" onClick={() => void save()}>
          Guardar amistoso
        </Btn>
      </div>
    </div>
  );
}
