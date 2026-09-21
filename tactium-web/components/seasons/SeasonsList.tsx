"use client";

import { useState } from "react";

import { type SeasonFormat } from "@/lib/team-data";
import { createSeason, fetchSeasons, type DbSeason } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  ListRow,
  Modal,
  Note,
  PageHeader,
  SectionHead,
  Stat,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconPlus } from "@/components/Icon";

const FORMATS: { key: SeasonFormat; note: string }[] = [
  { key: "Liga regular", note: "Jornadas en orden" },
  { key: "Liga + Playoff", note: "Formato completo" },
  { key: "Eliminatorias", note: "Playoff" },
];

const FORMAT_TO_PHASE: Record<SeasonFormat, DbSeason["phase"]> = {
  "Liga regular": "liga",
  "Liga + Playoff": "mixto",
  Eliminatorias: "playoff",
};

/** Nombre legible de la fase que guarda la base de datos. */
const PHASE_LABEL: Record<DbSeason["phase"], string> = {
  liga: "Liga regular",
  playoff: "Eliminatorias",
  mixto: "Liga + Playoff",
};

export function SeasonsList() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync(
    () => fetchSeasons(teamId!),
    [teamId, reloadKey],
    !!teamId
  );
  const SEASONS = data ?? [];

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<SeasonFormat>("Liga + Playoff");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const active = SEASONS.filter((s) => s.active);
  const past = SEASONS.filter((s) => !s.active);

  async function saveSeason() {
    if (busy || !teamId) return;
    if (!name.trim()) {
      setToast("Ponle un nombre a la temporada.");
      return;
    }
    setBusy(true);
    const res = await guardedWrite("crear la temporada", () =>
      createSeason(teamId, {
        name: name.trim(),
        phase: FORMAT_TO_PHASE[format],
        category: activeTeam?.category ?? null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setName("");
      setReloadKey((k) => k + 1);
      setToast("Temporada creada");
    } else {
      setToast(res.reason);
    }
  }

  if (teamId && loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title="Temporadas"
        lede="Cada temporada agrupa las jornadas de una liga o un playoff."
        meta={[activeTeam?.name ?? null, activeTeam?.category ?? null]}
        actions={
          <Btn variant="accent" onClick={() => setOpen(true)} icon={<IconPlus size={15} />}>
            Nueva temporada
          </Btn>
        }
      />

      {!teamId ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
          />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="No se pudieron cargar las temporadas"
            body={error}
          />
        </Card>
      ) : SEASONS.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Sin temporadas"
            body="Crea la primera y empieza a planificar jornadas."
            action={
              <Btn variant="accent" onClick={() => setOpen(true)} icon={<IconPlus size={14} />}>
                Crear temporada
              </Btn>
            }
          />
        </Card>
      ) : (
        <>
          {active.map((s) => (
            <Card key={s.id} flush style={{ borderColor: "var(--accent-40)" }}>
              <CardHead title={s.name} sub={PHASE_LABEL[s.phase]}>
                <Chip>Activa</Chip>
                <BtnLink href={`/temporadas/${s.id}`} variant="accent" size="sm">
                  Abrir temporada
                </BtnLink>
              </CardHead>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                }}
              >
                <Stat label="Jornadas" value={s.totalMatchdays ?? "—"} />
                <Stat label="Categoría" value={s.category ?? "—"} />
                <Stat label="Formato" value={PHASE_LABEL[s.phase]} />
              </div>
            </Card>
          ))}

          {past.length > 0 && (
            <>
              <SectionHead title="Histórico" count={past.length} />
              <Card flush>
                {past.map((s) => (
                  <ListRow
                    key={s.id}
                    href={`/temporadas/${s.id}`}
                    icon={
                      <IconTile mute>
                        <IconCalendar size={16} />
                      </IconTile>
                    }
                    title={s.name}
                    sub={`${PHASE_LABEL[s.phase]} · ${s.totalMatchdays ?? "—"} jornadas`}
                    right={<Chip tone="mute">Archivada</Chip>}
                  />
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Crear temporada ──────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="nueva-temp"
        width={520}
        title="Crear temporada"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy} onClick={saveSeason}>
              {busy
                ? "Creando…"
                : active.length > 0
                  ? "Cerrar y crear nueva"
                  : "Crear temporada"}
            </Btn>
          </>
        }
      >
        {active.length > 0 && (
          <Note tone="warning" style={{ marginBottom: 18 }}>
            Ya tienes una temporada activa. Al crear una nueva, la actual se
            cierra y pasa al histórico.
          </Note>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Nombre" htmlFor="temporada-nombre">
            <Input
              id="temporada-nombre"
              type="text"
              placeholder="Temporada 26/27"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Formato">
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
              role="radiogroup"
              aria-label="Formato"
            >
              {FORMATS.map((f) => {
                const on = format === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFormat(f.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-ui)",
                      background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                      color: on ? "var(--accent)" : "var(--text)",
                      border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
                      transition:
                        "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: on ? 700 : 500 }}>
                      {f.key}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: on ? "var(--accent)" : "var(--text-faint)",
                      }}
                    >
                      {f.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="tw-form-grid">
            <Field label="Número de jornadas" hint="Opcional" htmlFor="temporada-jornadas">
              <Input id="temporada-jornadas" type="text" inputMode="numeric" className="mono" />
            </Field>
            <Field label="Número de eliminatorias" hint="Opcional" htmlFor="temporada-elim">
              <Input id="temporada-elim" type="text" inputMode="numeric" className="mono" />
            </Field>
          </div>
        </div>
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
