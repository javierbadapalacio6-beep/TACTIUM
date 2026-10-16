"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fmtRango } from "@/lib/fcp-range";
import { optionLabel } from "@/lib/time-polls";
import {
  fetchPublicAvailability,
  longDate,
  pollProblemText,
  respondProblemText,
  respondViaLink,
  voteTimePollViaLink,
  type InvalidAvailability,
  type PublicAvailability as PublicAvailabilityData,
} from "@/lib/availability-link";
import { STATUS_LABEL, type AvailRow, type AvailStatus, type MaybeReason } from "@/lib/queries";
import { Btn, BtnLink, Card, Chip, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconCheck } from "@/components/Icon";
import {
  ConvoBar,
  RsvpButtons,
  STATUS_COLOR,
  formatDeadline,
} from "@/components/team/AvailabilityControls";

/**
 * Página pública de disponibilidad (/d/[token]), sin login: la abre un jugador
 * desde el grupo de WhatsApp, se elige en la lista y marca Voy / Duda / No.
 *
 * Qué recuerda: en este dispositivo, quién eres (localStorage, por enlace), para
 * que la segunda vez vaya directo a los botones. «No soy yo» lo borra. Se
 * refresca cada 10 s con la RPC anon (como el directo: Realtime no sirve para
 * anon). La duda cierra 24 h antes del partido (lo decide el servidor).
 */
const POLL_MS = 10_000;

const storeKey = (token: string) => `tactium.avail.${token}`;

function readMe(token: string): string | null {
  try {
    return window.localStorage.getItem(storeKey(token));
  } catch {
    return null;
  }
}
function saveMe(token: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(storeKey(token), id);
    else window.localStorage.removeItem(storeKey(token));
  } catch {
    /* sin almacenamiento: tendrá que elegirse cada vez */
  }
}

function fmtWhen(d: string | null, t: string | null, range?: string | null): string | null {
  const day = longDate(d);
  if (!day) return range ? `${fmtRango(range)} · día y hora por confirmar` : null;
  return t ? `${day} · ${t.slice(0, 5)}` : day;
}

export function PublicAvailability({ token }: { token: string }) {
  const [data, setData] = useState<PublicAvailabilityData | InvalidAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "warning"; title: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMe(readMe(token));
  }, [token]);

  const load = useCallback(async () => {
    try {
      setData(await fetchPublicAvailability(token));
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const valid = data?.valid === true;
  useEffect(() => {
    if (!valid) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !saving) void load();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, valid, saving]);

  const player = useMemo(
    () => (data?.valid ? data.players.find((p) => p.id === me) ?? null : null),
    [data, me],
  );
  // Si el jugador recordado ya no está en la plantilla, se vuelve a preguntar.
  useEffect(() => {
    if (data?.valid && me && !player) {
      setMe(null);
      saveMe(token, null);
    }
  }, [data, me, player, token]);

  if (loading) return <SkeletonPage />;

  if (!data) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState
            icon={<IconCalendar size={22} />}
            title="No se pudo cargar"
            body="Comprueba la conexión y vuelve a abrir el enlace."
            action={
              <Btn variant="accent" onClick={() => void load()}>
                Reintentar
              </Btn>
            }
          />
        </Card>
      </div>
    );
  }

  if (!data.valid) {
    const copy =
      data.reason === "expired"
        ? {
            title: "Esta jornada ya ha empezado",
            body: `${data.opponent ? `El partido contra ${data.opponent} ` : "El partido "}ya no admite respuestas.`,
          }
        : data.reason === "revoked"
          ? { title: "El enlace ha cambiado", body: "Pídele al capitán el enlace nuevo." }
          : { title: "Este enlace no existe", body: "Puede que esté mal copiado. Pídeselo otra vez al capitán." };
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState icon={<IconCalendar size={22} />} title={copy.title} body={copy.body} />
        </Card>
      </div>
    );
  }

  const d = data;
  const deadline = d.maybe_deadline ? new Date(d.maybe_deadline) : null;
  const maybeClosed = deadline ? Date.now() >= deadline.getTime() : false;
  const total = d.counts.yes + d.counts.maybe + d.counts.no + d.counts.pending;
  const meta = [
    d.jornada_number != null ? `Jornada ${d.jornada_number}` : null,
    d.category,
    fmtWhen(d.match_date, d.match_time, d.fcp_date_range),
    d.location,
    d.is_home ? "En casa" : "Fuera",
  ]
    .filter(Boolean)
    .join(" · ");

  function pick(id: string) {
    setMe(id);
    saveMe(token, id);
  }
  function notMe() {
    setMe(null);
    saveMe(token, null);
  }

  async function answer(status: AvailStatus, reason?: MaybeReason | null, note?: string | null) {
    if (!player) return;
    setSaving(true);
    // Optimista: se ve al instante y el servidor lo confirma o lo deshace.
    setData((cur) =>
      cur && cur.valid
        ? {
            ...cur,
            players: cur.players.map((p) =>
              p.id === player.id ? { ...p, status, reason: status === "maybe" ? reason ?? null : null } : p,
            ),
          }
        : cur,
    );
    const res = await respondViaLink(token, player.id, status, reason, note);
    setSaving(false);
    if (!res.ok) {
      setToast({ tone: "warning", title: res.reason });
    } else if (!res.data.ok) {
      setToast({ tone: "warning", title: respondProblemText(res.data.reason) });
    } else {
      setToast({ tone: "success", title: `Guardado: ${STATUS_LABEL[status]}` });
    }
    void load();
  }

  // Encuesta de hora de la jornada: se vota con el mismo enlace (multiselección, editable hasta que se cierre).
  const poll = d.time_poll ?? null;
  const pollClosed = !!poll?.deadline && new Date(poll.deadline).getTime() <= Date.now();
  const myPollVote = poll && player ? poll.votes[player.id] : undefined;
  async function votePoll(next: string[]) {
    if (!player || !poll || pollClosed) return;
    setSaving(true);
    setData((cur) =>
      cur && cur.valid && cur.time_poll
        ? { ...cur, time_poll: { ...cur.time_poll, votes: { ...cur.time_poll.votes, [player.id]: next } } }
        : cur,
    );
    const res = await voteTimePollViaLink(token, player.id, next);
    setSaving(false);
    if (!res.ok) setToast({ tone: "warning", title: res.reason });
    else if (!res.data.ok) setToast({ tone: "warning", title: pollProblemText(res.data.reason) });
    else setToast({ tone: "success", title: next.length ? "Guardadas tus horas" : "Guardado: ninguna te va" });
    void load();
  }
  function togglePollOption(optionId: string) {
    const cur = myPollVote ?? [];
    void votePoll(cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]);
  }

  const value: AvailRow | undefined = player?.status
    ? { status: player.status, reason: player.reason, note: null, autoResolved: false }
    : undefined;

  const byStatus: { key: AvailStatus | null; label: string }[] = [
    { key: "yes", label: "Van" },
    { key: "maybe", label: "Duda" },
    { key: "no", label: "No pueden" },
    { key: null, label: "Sin contestar" },
  ];

  return (
    <div className="tw-page-narrow">
      <Card style={{ padding: "18px 16px 20px", marginBottom: 16 }}>
        <Eyebrow tone="accent">¿Puedes jugar?</Eyebrow>
        <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 800, lineHeight: 1.2, overflowWrap: "anywhere" }}>
          {d.team_name} <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>vs</span> {d.opponent}
        </h1>
        {meta && <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>{meta}</p>}
        <div style={{ marginTop: 16 }}>
          <ConvoBar counts={{ ...d.counts, total }} />
        </div>
      </Card>

      {!player ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>¿Quién eres?</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Toca tu nombre. Este móvil se acordará de ti la próxima vez.
            </span>
            <div style={{ display: "grid", gap: 8 }}>
              {d.players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => pick(p.id)}
                  style={{ justifyContent: "space-between", minHeight: 44 }}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.status ? (
                    <Chip tone={p.status === "yes" ? "accent" : p.status === "maybe" ? "warning" : "error"}>
                      {STATUS_LABEL[p.status]}
                    </Chip>
                  ) : (
                    <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Sin contestar</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Hola, {player.name}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={notMe}>
                No soy yo
              </button>
            </div>
            <span
              className="eyebrow"
              style={{ color: player.status ? STATUS_COLOR[player.status].c : undefined }}
            >
              {player.status === "yes"
                ? "VAS"
                : player.status === "maybe"
                  ? "ESTÁS EN DUDA"
                  : player.status === "no"
                    ? "NO PUEDES"
                    : "¿PUEDES JUGAR?"}
            </span>
            <RsvpButtons
              key={player.id}
              value={value}
              maybeClosed={maybeClosed}
              deadline={deadline}
              disabled={saving}
              onAnswer={(s, r, n) => void answer(s, r, n)}
            />
            {deadline && !maybeClosed && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Las dudas se cierran el {formatDeadline(deadline)}.
              </span>
            )}
          </div>
        </Card>
      )}

      {poll && poll.options.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>¿A qué hora puedes?</span>
            {poll.message && <span style={{ fontSize: 13.5, fontStyle: "italic" }}>«{poll.message}»</span>}
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {pollClosed
                ? "La votación de la hora está cerrada."
                : player
                  ? "Marca todas las horas que te van. Puedes cambiarlo hasta que se cierre."
                  : "Elige tu nombre arriba para marcar las horas que te van."}
              {poll.deadline && !pollClosed ? ` Hasta el ${formatDeadline(new Date(poll.deadline))}.` : ""}
            </span>
            <div style={{ display: "grid", gap: 8 }}>
              {poll.options.map((o) => {
                const n = Object.values(poll.votes).filter((ids) => ids.includes(o.id)).length;
                const on = !!myPollVote?.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!player || pollClosed || saving}
                    onClick={() => togglePollOption(o.id)}
                    className="btn btn-ghost"
                    style={{
                      justifyContent: "space-between",
                      minHeight: 46,
                      ...(on
                        ? { background: "var(--accent)", color: "var(--text-inverse)", borderColor: "var(--accent)", fontWeight: 700 }
                        : {}),
                    }}
                  >
                    <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {on && <IconCheck size={14} />}
                      {optionLabel(o)}
                    </span>
                    <span style={{ fontSize: 12.5, opacity: 0.85 }}>{n === 0 ? "Nadie todavía" : `${n} ${n === 1 ? "puede" : "pueden"}`}</span>
                  </button>
                );
              })}
            </div>
            {player && !pollClosed && (
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                disabled={saving}
                onClick={() => void votePoll([])}
                style={myPollVote && myPollVote.length === 0 ? { color: "var(--error)" } : undefined}
              >
                {myPollVote && myPollVote.length === 0 ? "Has dicho que ninguna te va" : "Ninguna me va"}
              </button>
            )}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {byStatus.map(({ key, label }) => {
            const list = d.players.filter((p) => p.status === key);
            if (list.length === 0) return null;
            return (
              <div key={label} style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: key ? STATUS_COLOR[key].c : "var(--text-muted)" }}>
                  {label} · <span className="mono">{list.length}</span>
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.5 }}>{list.map((p) => p.name).join(" · ")}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card quiet>
        <div style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>¿Eres capitán?</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            TACTIUM es la app de gestión de equipos de pádel federado: convoca, alinea y cierra la jornada.
          </span>
          <div>
            <BtnLink href="/" variant="ghost" size="sm">
              Conoce TACTIUM
            </BtnLink>
          </div>
        </div>
      </Card>

      {toast && <Toast tone={toast.tone} title={toast.title} onClose={() => setToast(null)} />}
    </div>
  );
}
