"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useSession } from "@/lib/session";
import { useMatchdayTeam } from "@/lib/use-matchday-team";
import { useAsync } from "@/lib/use-async";
import {
  countAvail,
  fetchAvailabilityDetail,
  fetchLastReminder,
  fetchMatchday,
  fetchMaybeDeadline,
  fetchPlayers,
  fetchTeam,
  remindPendingAvailability,
  respondAvailability,
  clearPlayerAvailability,
  STATUS_LABEL,
  type AvailRow,
  type AvailStatus,
  type DbMatchday,
  type MaybeReason,
} from "@/lib/queries";
import { getCourtsForCompetition, type TeamGender } from "@/lib/courts";
import { guardedWrite, WRITES_ENABLED } from "@/lib/writes";
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Note,
  PageHeader,
  Segmented,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconUsers } from "@/components/Icon";
import {
  ConvoBar,
  RsvpButtons,
  STATUS_COLOR,
  formatDeadline,
  reasonLabel,
  timeLeft,
} from "@/components/team/AvailabilityControls";
import { proHref } from "@/lib/nav";

type Tab = "pending" | "yes" | "maybe" | "no";

const REMIND_COOLDOWN_MS = 12 * 3_600_000;

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Disponibilidad de una jornada — mismo modelo que la app: Voy · Duda ·
 * No puedo, «sin contestar» = sin fila. El capitán ve la plantilla por
 * estado, recuerda a los pendientes (premium, 1 vez / 12 h) y puede marcar
 * por cualquiera. Todas las escrituras pasan por `guardedWrite`.
 */
export function AvailabilityView({ id }: { id: string }) {
  const { role, user } = useSession();
  // El equipo (y la capitanía) es el de la jornada, no el activo: el club abre
  // la de cualquiera de sus equipos desde su panel. El club gestiona la
  // convocatoria como el capitán.
  const owner = useMatchdayTeam(id);
  const teamId = owner.teamId;
  const isCaptain = (role === "capitan" && owner.isTeamCaptain) || role === "club";

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([
        fetchMatchday(id),
        fetchPlayers(teamId!),
        fetchAvailabilityDetail(id),
        fetchMaybeDeadline(id),
        fetchLastReminder(id),
        fetchTeam(teamId!),
      ]),
    [id, teamId],
    !!teamId,
  );

  const matchday: DbMatchday | null = data?.[0] ?? null;
  const players = useMemo(() => (data?.[1] ?? []).filter((p) => p.active), [data]);
  const deadline = data?.[3] ?? null;

  const [map, setMap] = useState<Record<string, AvailRow>>({});
  const [lastReminder, setLastReminder] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (data) {
      setMap(data[2]);
      setLastReminder(data[4]);
      const c = countAvail(data[1].filter((p) => p.active).map((p) => p.id), data[2]);
      setTab(!isCaptain || c.pending === 0 ? "yes" : "pending");
    }
  }, [data, isCaptain]);

  if (owner.loading) return <SkeletonPage />;
  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconUsers size={24} />} title="Sin equipo activo" body="Entra con una cuenta que pertenezca a un equipo." />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconUsers size={24} />} title="No se pudo cargar la disponibilidad" body={error} />
        </Card>
      </div>
    );
  }
  if (!matchday) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconUsers size={24} />} title="Jornada no encontrada" body="Abre una jornada del calendario para ver la disponibilidad." />
        </Card>
      </div>
    );
  }

  const maybeClosed = deadline ? Date.now() >= deadline.getTime() : false;
  const counts = countAvail(players.map((p) => p.id), map);
  const team = data?.[5] ?? null;
  const courts = getCourtsForCompetition(
    team?.federation,
    team?.league,
    (team?.gender as TeamGender | null | undefined) ?? null,
  );
  const needed = courts * 2;
  const missing = Math.max(0, needed - counts.yes);
  const me = players.find((p) => !!user && p.userId === user.id) ?? null;
  const cooldownUntil =
    lastReminder && Date.now() - lastReminder.getTime() < REMIND_COOLDOWN_MS
      ? new Date(lastReminder.getTime() + REMIND_COOLDOWN_MS)
      : null;
  const toRemind = counts.pending + counts.maybe;

  async function answer(playerId: string, status: AvailStatus, reason?: MaybeReason | null, note?: string | null) {
    const prev = map[playerId];
    setMap((m) => ({ ...m, [playerId]: { status, reason: status === "maybe" ? reason ?? null : null, note: note ?? null, autoResolved: false } }));
    const res = await guardedWrite("guardar la disponibilidad", () =>
      respondAvailability(id, playerId, status, reason, note),
    );
    if (!res.ok) {
      setMap((m) => {
        const next = { ...m };
        if (prev) next[playerId] = prev;
        else delete next[playerId];
        return next;
      });
      setToast(res.reason);
    }
  }

  async function clear(playerId: string) {
    const prev = map[playerId];
    setMap((m) => {
      const next = { ...m };
      delete next[playerId];
      return next;
    });
    const res = await guardedWrite("quitar la respuesta", () => clearPlayerAvailability(id, playerId));
    if (!res.ok) {
      if (prev) setMap((m) => ({ ...m, [playerId]: prev }));
      setToast(res.reason);
    }
  }

  async function remind() {
    setSending(true);
    const res = await guardedWrite("recordar a los pendientes", () => remindPendingAvailability(id));
    setSending(false);
    if (!res.ok) return setToast(res.reason);
    const out = res.data;
    if (out.ok) {
      setLastReminder(new Date());
      setToast(
        (out.reminded === 0 ? "Nadie con la app tenía la respuesta pendiente" : `Recordatorio enviado a ${out.reminded}`) +
          (out.withoutApp.length ? ` · Sin la app: ${out.withoutApp.join(", ")} (escríbeles por WhatsApp)` : ""),
      );
    } else if (out.kind === "premium") {
      // Igual que en la app: el gate abre el paywall con su motivo.
      router.push(proHref("availability_remind"));
    } else if (out.kind === "cooldown") {
      setLastReminder(new Date());
      setToast("Ya recordaste hace menos de 12 horas.");
    } else setToast(out.message);
  }

  const rows = players
    .filter((p) => {
      const s = map[p.id]?.status ?? null;
      return tab === "pending" ? s === null : s === tab;
    })
    .sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id));

  return (
    <div className="tw-page">
      <PageHeader
        title={isCaptain ? "¿Quién juega?" : "¿Puedes jugar?"}
        meta={[
          `Jornada ${matchday.round}`,
          `vs ${matchday.opponent}`,
          deadline
            ? maybeClosed
              ? "Dudas cerradas: solo Voy o No puedo"
              : `Las dudas se cierran el ${formatDeadline(deadline)}`
            : "",
        ].filter(Boolean)}
      />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", marginBottom: 16 }}>
        {me && (
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <span className="eyebrow" style={{ color: STATUS_COLOR[map[me.id]?.status ?? "yes"].c }}>
                {map[me.id]?.status === "maybe"
                  ? "ESTÁS EN DUDA"
                  : map[me.id]?.status === "yes"
                    ? "VAS"
                    : map[me.id]?.status === "no"
                      ? "NO PUEDES"
                      : "¿PUEDES JUGAR?"}
              </span>
              {map[me.id]?.status === "maybe" && deadline && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  <b className="mono" style={{ fontSize: 22, color: "var(--warning)" }}>{timeLeft(deadline)}</b>{" "}
                  para decidir · si no, contarás como «No puedo».
                </span>
              )}
              <RsvpButtons
                value={map[me.id]}
                maybeClosed={maybeClosed}
                deadline={deadline}
                onAnswer={(s, r, n) => answer(me.id, s, r, n)}
              />
            </div>
          </Card>
        )}

        {isCaptain && (
          <Card>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="eyebrow">CONVOCATORIA</span>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {counts.yes}/{counts.total} van
                </span>
              </div>
              <ConvoBar counts={counts} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: missing === 0 ? "var(--accent)" : undefined }}>
                {missing === 0
                  ? `Tienes ${counts.yes} para ${courts} pistas: equipo completo`
                  : `Necesitas ${needed} para ${courts} pistas: te ${missing === 1 ? "falta 1" : `faltan ${missing}`}`}
              </span>
              {toRemind > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Btn variant="accent" onClick={remind} disabled={sending || !!cooldownUntil}>
                    {sending ? "Enviando…" : cooldownUntil ? "Recordado" : `Recordar ahora a ${toRemind}`}
                  </Btn>
                  <Chip tone="mute" plain>PRO</Chip>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {cooldownUntil
                      ? `Podrás volver a recordar a las ${formatDeadline(cooldownUntil).split(" ")[1]}`
                      : "Recordatorio automático a las 9:00 y a las 21:00"}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <div className="tw-toolbar">
        <Segmented
          label="Filtrar por respuesta"
          value={tab}
          onChange={setTab}
          options={[
            { value: "pending", label: `Sin contestar ${counts.pending}` },
            { value: "yes", label: `Van ${counts.yes}` },
            { value: "maybe", label: `Duda ${counts.maybe}` },
            { value: "no", label: `No ${counts.no}` },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title={tab === "pending" ? "Todos han contestado" : "Nadie en este grupo"}
            body={tab === "pending" ? "No queda nadie por responder a esta jornada." : "Prueba con otra pestaña."}
          />
        </Card>
      ) : (
        <div className="tw-avail-grid">
          {rows.map((p) => {
            const a = map[p.id];
            const isMe = p.id === me?.id;
            const meta = [
              reasonLabel(a?.reason),
              a?.note ? `«${a.note}»` : null,
              a?.autoResolved ? "duda sin resolver" : null,
              !a && !p.userId ? "sin la app" : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Card key={p.id} style={{ borderColor: isMe ? "var(--accent-40)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar initials={initials(p.name)} size={36} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="truncate" style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                      {p.name}
                    </span>
                    <span className="truncate" style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
                      {meta || (
                        <>
                          {p.position} · <span className="mono">{p.pts}</span> pts
                        </>
                      )}
                    </span>
                  </span>
                  {isMe && <Chip plain>Soy yo</Chip>}
                  {a ? (
                    <Chip tone={a.status === "yes" ? "accent" : a.status === "maybe" ? "warning" : "error"}>
                      {STATUS_LABEL[a.status]}
                    </Chip>
                  ) : (
                    <Chip tone="mute">Sin contestar</Chip>
                  )}
                </div>
                {isCaptain && !isMe && (
                  <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                    <RsvpButtons
                      value={a}
                      maybeClosed={maybeClosed}
                      deadline={deadline}
                      forName={p.name.split(" ")[0]}
                      onAnswer={(s, r, n) => answer(p.id, s, r, n)}
                    />
                    {a && (
                      <button type="button" className="link-action" style={{ justifySelf: "start", fontSize: 12.5 }} onClick={() => clear(p.id)}>
                        Quitar respuesta
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!WRITES_ENABLED && (
        <Note tone="warning" style={{ marginTop: 16 }}>
          Modo solo lectura: los cambios aún no se guardan.
        </Note>
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
