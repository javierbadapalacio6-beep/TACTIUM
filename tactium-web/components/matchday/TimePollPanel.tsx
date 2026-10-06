"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  canProposeTimes,
  cancelTimePoll,
  createTimePoll,
  fetchTimePollContext,
  fixTimePoll,
  optionDayLabel,
  optionLabel,
  remindTimePoll,
  RemindError,
  suggestOptions,
  tallyPoll,
  TimePollError,
  voteTimePoll,
  type TimePollContext,
} from "@/lib/time-polls";
import { fetchAvailabilityDetail, type AvailRow } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { proHref } from "@/lib/nav";
import { useAsync } from "@/lib/use-async";
import { useSession } from "@/lib/session";
import { Avatar, Btn, Card, CardHead, Field, Input, Modal, Note, Textarea, Toggle } from "@/components/ui";
import { Toast } from "@/components/states";
import { IconCheck, IconClock, IconPlus, IconX } from "@/components/Icon";

/*
 * Encuesta de hora de la jornada (web). Espejo de la app
 * (TACTIUM/src/features/timePoll). Todas las escrituras por `guardedWrite`.
 *
 * Referencias (Mobbin): el voto de «Meeting poll» de Calendly (marcar todas
 * las horas que te van, con la nota de que marcar varias ayuda) y su panel
 * «Top times» con «Book» en cada fila para fijar; la fila de opción con los
 * avatares de quién la eligió, de la encuesta de Messages (iOS).
 */

const REMIND_COOLDOWN_MS = 12 * 3_600_000;
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function shortWhen(d: Date): string {
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} a las ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function initials(n: string) {
  return n
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function TimePollPanel({
  matchdayId,
  canManage,
  variant = "full",
}: {
  matchdayId: string;
  /** Capitán o gestor del club del equipo. */
  canManage: boolean;
  /** `full`: bloque de la jornada. `home`: dentro de «Próxima jornada», solo con encuesta abierta. */
  variant?: "full" | "home";
}) {
  const router = useRouter();
  const { user } = useSession();
  const [nonce, setNonce] = useState(0);
  const ctx = useAsync<[TimePollContext | null, Record<string, AvailRow>]>(
    () =>
      Promise.all([
        fetchTimePollContext(matchdayId),
        fetchAvailabilityDetail(matchdayId).catch(() => ({}) as Record<string, AvailRow>),
      ]),
    [matchdayId, user?.id, nonce],
    !!user,
  );
  const reload = () => setNonce((n) => n + 1);

  const [myVoteLocal, setMyVoteLocal] = useState<string[] | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [remindedAt, setRemindedAt] = useState<Date | null>(null);
  const [fixAsk, setFixAsk] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ optionId: string; current: string } | null>(null);

  useEffect(() => setMyVoteLocal(undefined), [ctx.data]);

  const data = ctx.data?.[0] ?? null;
  const availability = ctx.data?.[1] ?? {};
  if (ctx.loading || !data) return null;

  const { poll, matchday, team, players, myPlayerId } = data;
  const isOpen = poll?.status === "open";
  const deadlinePassed = !!poll?.deadline && poll.deadline.getTime() <= Date.now();
  const canVote = isOpen && !deadlinePassed && !!myPlayerId;
  const title = `J${String(matchday.jornada_number ?? "").padStart(2, "0")} vs ${matchday.opponent ?? "rival"}`;

  const toastEl = toast ? <Toast title={toast} onClose={() => setToast(null)} /> : null;

  // ── Sin encuesta abierta ─────────────────────────────────────────────
  if (!isOpen) {
    if (variant === "home") return null;
    const fixedOpt = poll?.status === "fixed" ? poll.options.find((o) => o.id === poll.fixedOptionId) : null;
    const offer = canManage && canProposeTimes(team, matchday);
    if (!fixedOpt && !offer) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <Card>
          {fixedOpt && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-muted)" }}>
              <IconCheck size={16} style={{ color: "var(--accent)" }} />
              <span>
                Hora elegida por encuesta: <b className="mono" style={{ color: "var(--text)" }}>{optionLabel(fixedOpt)}</b>
              </span>
            </div>
          )}
          {offer && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                ...(fixedOpt ? { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" } : null),
              }}
            >
              <IconClock size={17} style={{ color: "var(--accent)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Proponer horas</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {matchday.match_time
                    ? "Pregunta al equipo qué día y hora les va mejor."
                    : "Esta jornada aún no tiene hora. Que vote el equipo."}
                </div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setProposeOpen(true)}>
                Proponer horas
              </Btn>
            </div>
          )}
        </Card>
        <ProposeModal
          open={proposeOpen}
          onClose={() => setProposeOpen(false)}
          title={title}
          matchDate={matchday.match_date}
          matchTime={matchday.match_time}
          slots={team?.preferred_home_slots ?? []}
          onSubmit={async (input) => {
            let premium = false;
            const res = await guardedWrite("crear la encuesta de hora", async () => {
              try {
                return await createTimePoll({ matchdayId, ...input });
              } catch (e) {
                if (e instanceof TimePollError && e.kind === "premium") {
                  premium = true;
                  return null;
                }
                throw e;
              }
            });
            if (premium) {
              router.push(proHref("time_poll"));
              return null;
            }
            if (!res.ok) return res.reason;
            setProposeOpen(false);
            setToast("Encuesta enviada. Tu equipo ya puede votar.");
            reload();
            return null;
          }}
        />
        {toastEl}
      </div>
    );
  }

  // ── Encuesta abierta ────────────────────────────────────────────────
  const p = poll!;
  const myVote = myVoteLocal !== undefined ? myVoteLocal : myPlayerId ? p.votes[myPlayerId] ?? null : null;
  const votes = myPlayerId && myVote !== null ? { ...p.votes, [myPlayerId]: myVote } : p.votes;
  const ids = players.map((x) => x.id);
  const tally = tallyPoll({ ...p, votes }, ids);
  const byId = new Map(players.map((x) => [x.id, x]));
  const maxCount = Math.max(1, ...Object.values(tally.byOption).map((a) => a.length));
  const hasAvail = Object.keys(availability).length > 0;

  async function vote(next: string[]) {
    if (!canVote) return;
    const prev = myVote;
    setMyVoteLocal(next);
    const res = await guardedWrite("guardar tu voto", () => voteTimePoll(p.id, next));
    if (!res.ok) {
      setMyVoteLocal(prev);
      setToast(res.reason);
    }
  }
  const toggle = (oid: string) => {
    const cur = myVote ?? [];
    vote(cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid]);
  };

  async function doFix(optionId: string, overwrite = false) {
    setBusy(optionId);
    let conflictAt: string | null = null;
    const res = await guardedWrite("fijar la hora", async () => {
      try {
        await fixTimePoll(p.id, optionId, overwrite);
      } catch (e) {
        if (e instanceof TimePollError && e.kind === "time_changed" && e.current) {
          conflictAt = e.current;
          return false;
        }
        throw e;
      }
      return true;
    });
    setBusy(null);
    setFixAsk(null);
    if (!res.ok) return setToast(res.reason);
    if (conflictAt) return setConflict({ optionId, current: conflictAt });
    setConflict(null);
    // La cabecera de la jornada muestra la hora nueva al recargar.
    window.location.reload();
  }

  async function remind() {
    setBusy("remind");
    const res = await guardedWrite("recordar a los que faltan", async () => {
      try {
        return { ok: true as const, r: await remindTimePoll(p.id) };
      } catch (e) {
        if (e instanceof RemindError) return { ok: false as const, kind: e.kind, message: e.message };
        throw e;
      }
    });
    setBusy(null);
    if (!res.ok) return setToast(res.reason);
    const out = res.data;
    if (out.ok) {
      setRemindedAt(new Date());
      const noApp = tally.pending.filter((id) => !byId.get(id)?.hasApp).map((id) => byId.get(id)?.name);
      setToast(
        (out.r.reminded === 0
          ? "Todos los que tienen la app ya han votado"
          : `Recordatorio enviado a ${out.r.reminded}`) +
          (noApp.length ? `. Sin la app: ${noApp.join(", ")} (pregúntales por WhatsApp)` : ""),
      );
    } else if (out.kind === "premium") router.push(proHref("time_poll"));
    else if (out.kind === "cooldown") {
      setRemindedAt(new Date());
      setToast("Ya recordaste hace menos de 12 horas.");
    } else setToast(out.message);
  }

  async function cancel() {
    const res = await guardedWrite("cerrar la encuesta", () => cancelTimePoll(p.id));
    setConflict(null);
    if (!res.ok) return setToast(res.reason);
    reload();
  }

  const meta =
    `${tally.voted.length} de ${ids.length} han votado` +
    (p.deadline ? (deadlinePassed ? " · votación cerrada" : ` · hasta el ${shortWhen(p.deadline)}`) : "");

  // ── Inicio: compacto ────────────────────────────────────────────────
  if (variant === "home") {
    const top = p.options.find((o) => o.id === tally.topIds[0]);
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {canVote ? "Vota la hora" : "Encuesta de hora"}
          <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
            {" "}
            · {canManage && top ? `${meta} · va ganando ${optionLabel(top)}` : canVote ? "marca todas las que te van" : meta}
          </span>
        </div>
        {canVote ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {p.options.map((o) => {
              const on = !!myVote?.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(o.id)}
                  className="btn btn-ghost btn-sm mono"
                  style={
                    on
                      ? { background: "var(--accent)", color: "var(--text-inverse)", borderColor: "var(--accent)", fontWeight: 700 }
                      : undefined
                  }
                >
                  {on && <IconCheck size={14} />}
                  {optionLabel(o)}
                </button>
              );
            })}
          </div>
        ) : (
          <Link href={`/jornada/${matchday.id}`} className="btn btn-ghost btn-sm">
            Ver la encuesta
          </Link>
        )}
        {toastEl}
      </div>
    );
  }

  // ── Jornada: completo ──────────────────────────────────────────────
  const ordered = canManage
    ? [...p.options].sort(
        (a, b) => tally.byOption[b.id].length - tally.byOption[a.id].length || a.position - b.position,
      )
    : p.options;
  const lastReminder = remindedAt ?? p.lastRemindedAt;
  const cooldown =
    lastReminder && Date.now() - lastReminder.getTime() < REMIND_COOLDOWN_MS
      ? new Date(lastReminder.getTime() + REMIND_COOLDOWN_MS)
      : null;
  const fixOpt = fixAsk ? p.options.find((o) => o.id === fixAsk) : null;
  const conflictOpt = conflict ? p.options.find((o) => o.id === conflict.optionId) : null;
  const conflictNow = conflict
    ? optionLabel({ date: conflict.current.split("T")[0], time: conflict.current.split("T")[1] })
    : "";

  return (
    <div style={{ marginBottom: 16 }}>
      <Card flush>
        <CardHead title="¿A qué hora jugamos?" sub={meta} />
        <div style={{ padding: "0 18px 18px", display: "grid", gap: 10 }}>
          {p.message && <div style={{ fontSize: 13.5, fontStyle: "italic" }}>«{p.message}»</div>}
          {canVote && (
            <Note icon={<IconClock size={16} />}>
              Marca todas las que te van: cuantas más, más fácil le resulta al capitán cuadrar la hora. Puedes cambiarlo
              hasta que se cierre.
            </Note>
          )}

          {ordered.map((o) => {
            const who = tally.byOption[o.id];
            const on = !!myVote?.includes(o.id);
            const isTop = tally.topIds.includes(o.id);
            const goingYes = hasAvail ? who.filter((id) => availability[id]?.status === "yes").length : 0;
            return (
              <div
                key={o.id}
                role={canVote ? "checkbox" : undefined}
                aria-checked={canVote ? on : undefined}
                tabIndex={canVote ? 0 : undefined}
                onClick={canVote ? () => toggle(o.id) : undefined}
                onKeyDown={
                  canVote
                    ? (e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggle(o.id);
                        }
                      }
                    : undefined
                }
                style={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 10,
                  border: `1px solid ${isTop ? "var(--accent-40)" : "var(--line)"}`,
                  background: "var(--bg-card-2)",
                  cursor: canVote ? "pointer" : "default",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${(who.length / maxCount) * 100}%`,
                    background: isTop ? "var(--accent-10)" : "var(--surface-line)",
                  }}
                />
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
                  {canVote && (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        flex: "none",
                        display: "grid",
                        placeItems: "center",
                        border: `1.5px solid ${on ? "var(--accent)" : "var(--text-faint)"}`,
                        background: on ? "var(--accent)" : "transparent",
                        color: "var(--text-inverse)",
                      }}
                    >
                      {on && <IconCheck size={12} />}
                    </span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 14.5, fontWeight: 700 }}>
                      {optionLabel(o)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {who.length === 0 ? "Nadie todavía" : `${who.length} ${who.length === 1 ? "puede" : "pueden"}`}
                      {hasAvail && who.length > 0 ? ` · ${goingYes} con «Voy»` : ""}
                      {isTop ? " · la más votada" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }} title={who.map((id) => byId.get(id)?.name).join(", ")}>
                    {who.slice(0, 5).map((id, i) => {
                      const pl = byId.get(id);
                      return (
                        <Avatar
                          key={id}
                          size={24}
                          initials={initials(pl?.name ?? "?")}
                          src={pl?.photoUrl}
                          style={{ marginLeft: i ? -7 : 0, boxShadow: "0 0 0 2px var(--bg-card)" }}
                        />
                      );
                    })}
                    {who.length > 5 && (
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>
                        +{who.length - 5}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <Btn
                      variant={isTop ? "accent" : "ghost"}
                      size="sm"
                      disabled={!!busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFixAsk(o.id);
                      }}
                    >
                      Fijar
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}

          {canVote && (
            <Btn
              variant="quiet"
              size="sm"
              onClick={() => vote([])}
              style={myVote && myVote.length === 0 ? { color: "var(--error)" } : undefined}
            >
              {myVote && myVote.length === 0 ? "Has dicho que ninguna te va" : "Ninguna me va"}
            </Btn>
          )}

          {tally.pending.length > 0 && (
            <div style={{ fontSize: 13 }}>
              <b>Sin votar ({tally.pending.length})</b>
              <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 2 }}>
                {tally.pending.map((id) => byId.get(id)?.name).join(", ")}
              </div>
            </div>
          )}

          {canManage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              {!deadlinePassed && tally.pending.length > 0 && (
                <Btn variant="ghost" size="sm" disabled={!!cooldown || busy === "remind"} onClick={remind}>
                  {busy === "remind"
                    ? "Enviando…"
                    : cooldown
                      ? `Podrás recordar el ${shortWhen(cooldown)}`
                      : "Recordar a los que faltan"}
                </Btn>
              )}
              <Btn variant="quiet" size="sm" onClick={cancel}>
                Cerrar sin fijar
              </Btn>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={!!fixOpt}
        onClose={() => !busy && setFixAsk(null)}
        labelledBy="fijar-hora-titulo"
        width={440}
        title={fixOpt ? `¿Fijar ${optionLabel(fixOpt)}?` : ""}
        lede={
          fixOpt
            ? `${tally.byOption[fixOpt.id].length} ${tally.byOption[fixOpt.id].length === 1 ? "jugador puede" : "jugadores pueden"}. Se guarda en la jornada, se cierra la encuesta y avisamos a todo el equipo.`
            : ""
        }
        footer={
          <>
            <Btn variant="ghost" onClick={() => setFixAsk(null)} disabled={!!busy}>
              Cancelar
            </Btn>
            <Btn variant="accent" onClick={() => fixOpt && doFix(fixOpt.id)} disabled={!!busy}>
              {busy ? "Fijando…" : "Fijar"}
            </Btn>
          </>
        }
      >
        {null}
      </Modal>

      <Modal
        open={!!conflict}
        onClose={() => !busy && setConflict(null)}
        labelledBy="hora-cambiada-titulo"
        width={460}
        title="Ya tiene otra hora"
        lede={`Mientras votabais se puso ${conflictNow} en la jornada (normalmente lo hace el club). ¿Qué hacemos?`}
        footer={
          <>
            <Btn variant="ghost" onClick={cancel} disabled={!!busy}>
              Mantener {conflictNow}
            </Btn>
            <Btn
              variant="accent"
              onClick={() => conflict && doFix(conflict.optionId, true)}
              disabled={!!busy}
            >
              Cambiar a {conflictOpt ? optionLabel(conflictOpt) : "la de la encuesta"}
            </Btn>
          </>
        }
      >
        {null}
      </Modal>
      {toastEl}
    </div>
  );
}

/* ── Proponer horas ──────────────────────────────────────────────────
 * Patrón «Create a poll» de LinkedIn: filas de opción + «Añadir opción» +
 * duración (aquí, fecha límite opcional). */
function ProposeModal({
  open,
  onClose,
  title,
  matchDate,
  matchTime,
  slots,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  matchDate: string | null;
  matchTime: string | null;
  slots: string[];
  /** Devuelve un error para enseñar, o null si fue bien. */
  onSubmit: (input: {
    options: { date: string; time: string }[];
    message: string | null;
    deadline: Date | null;
  }) => Promise<string | null>;
}) {
  const today = isoDay(new Date());
  const [options, setOptions] = useState<{ date: string; time: string }[]>([]);
  const [message, setMessage] = useState("");
  const [withDeadline, setWithDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotsKey = slots.join(",");
  useEffect(() => {
    if (!open) return;
    const sug = suggestOptions(matchDate, matchTime, slots).filter((o) => o.date >= today);
    const base = matchDate && matchDate >= today ? matchDate : today;
    while (sug.length < 2) sug.push({ date: base, time: sug.length ? "18:00" : "10:00" });
    setOptions(sug.slice(0, 4));
    setMessage("");
    setWithDeadline(false);
    const md = matchDate ? new Date(`${matchDate}T21:00:00`) : null;
    const def =
      md && md.getTime() - 2 * 86_400_000 > Date.now()
        ? new Date(md.getTime() - 2 * 86_400_000)
        : new Date(Date.now() + 86_400_000);
    setDeadline(`${isoDay(def)}T21:00`);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchDate, matchTime, slotsKey]);

  const keys = useMemo(() => options.map((o) => `${o.date} ${o.time}`), [options]);
  const dupes = keys.length !== new Set(keys).size;
  const incomplete = options.some((o) => !o.date || !o.time);
  const past = options.some((o) => o.date && o.date < today);
  const deadlineDate = withDeadline && deadline ? new Date(deadline) : null;
  const deadlinePast = !!deadlineDate && deadlineDate.getTime() <= Date.now();
  const valid = options.length >= 2 && options.length <= 4 && !dupes && !incomplete && !past && !deadlinePast;

  const update = (i: number, patch: Partial<{ date: string; time: string }>) =>
    setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <Modal
      open={open}
      onClose={() => !sending && onClose()}
      labelledBy="proponer-horas-titulo"
      width={520}
      title="Proponer horas"
      lede={`${title}. Tu equipo marca las que le van y tú fijas la que más convenga.`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Btn>
          <Btn
            variant="accent"
            disabled={!valid || sending}
            onClick={async () => {
              setSending(true);
              const err = await onSubmit({ options, message: message.trim() || null, deadline: deadlineDate });
              setSending(false);
              setError(err);
            }}
          >
            {sending ? "Enviando…" : "Enviar al equipo"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        {options.map((o, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
              gap: 8,
              alignItems: "end",
            }}
          >
            <Field label={`Opción ${i + 1}${o.date ? ` · ${optionDayLabel(o.date)}` : ""}`}>
              <Input type="date" value={o.date} min={today} onChange={(e) => update(i, { date: e.target.value })} />
            </Field>
            <Field label="Hora">
              <Input type="time" value={o.time} step={900} onChange={(e) => update(i, { time: e.target.value.slice(0, 5) })} />
            </Field>
            <Btn
              variant="quiet"
              size="sm"
              aria-label={`Quitar la opción ${i + 1}`}
              disabled={options.length <= 2}
              onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
              icon={<IconX size={15} />}
            />
          </div>
        ))}
        {dupes && <div style={{ fontSize: 12.5, color: "var(--error)" }}>Hay dos opciones iguales.</div>}
        {past && <div style={{ fontSize: 12.5, color: "var(--error)" }}>Alguna opción es de un día pasado.</div>}
        {options.length < 4 && (
          <Btn
            variant="ghost"
            size="sm"
            icon={<IconPlus size={15} />}
            onClick={() =>
              setOptions((os) => [...os, { date: os[os.length - 1]?.date ?? today, time: "18:00" }])
            }
          >
            Añadir opción
          </Btn>
        )}

        <Field label="Mensaje (opcional)">
          <Textarea
            rows={2}
            maxLength={280}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="«El domingo hay pistas libres desde las 10»"
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Fecha límite para votar</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Después nadie puede cambiar su voto.</div>
          </div>
          <Toggle on={withDeadline} onChange={() => setWithDeadline((v) => !v)} label="Poner fecha límite" />
        </div>
        {withDeadline && (
          <Field error={deadlinePast ? "La fecha límite ya ha pasado." : undefined}>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        )}
        {error && <Note tone="error">{error}</Note>}
      </div>
    </Modal>
  );
}
