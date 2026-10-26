"use client";

import { Modal } from "@/components/ui";
import { optionDayLabel, type TimePoll } from "@/lib/time-polls";
import type { AvailRow } from "@/lib/queries";

interface Person {
  id: string;
  name: string;
  hasApp: boolean;
}

const STATUS_LABEL = { yes: "Voy", maybe: "Duda", no: "No" } as const;
const STATUS_COLOR = { yes: "var(--accent)", maybe: "var(--warning)", no: "var(--error)" } as const;

/**
 * «Quién ha votado»: una fila por jugador y una columna por hora. Se ve de un
 * vistazo quién puede cada hora, quién dijo que ninguna y quién falta, con su
 * Voy/Duda/No al lado. Espejo de `PollWhoSheet` de la app.
 */
export function PollWhoModal({
  open,
  onClose,
  poll,
  votes,
  players,
  availability,
  topIds,
}: {
  open: boolean;
  onClose: () => void;
  poll: TimePoll;
  /** Votos con el voto propio ya aplicado (el optimista). */
  votes: Record<string, string[]>;
  players: Person[];
  availability: Record<string, AvailRow>;
  topIds: string[];
}) {
  const voted = players.filter((p) => (votes[p.id]?.length ?? 0) > 0);
  const none = players.filter((p) => votes[p.id] && votes[p.id].length === 0);
  const pending = players.filter((p) => !votes[p.id]);
  const sorted = [...voted].sort(
    (a, b) => votes[b.id].length - votes[a.id].length || a.name.localeCompare(b.name, "es"),
  );
  const count = (oid: string) => voted.filter((p) => votes[p.id].includes(oid)).length;

  const Status = ({ id }: { id: string }) => {
    const s = availability[id]?.status as keyof typeof STATUS_LABEL | undefined;
    return (
      <td style={{ textAlign: "right", fontWeight: 700, fontSize: 12.5, color: s ? STATUS_COLOR[s] : "var(--text-faint)" }}>
        {s ? STATUS_LABEL[s] : "—"}
      </td>
    );
  };

  const th = { padding: "6px 4px", fontWeight: 600, fontSize: 11.5, color: "var(--text-muted)", textAlign: "center" as const };
  const td = { padding: "7px 4px", textAlign: "center" as const, borderTop: "1px solid var(--line)" };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="quien-ha-votado-titulo"
      width={560}
      title="Quién ha votado"
      lede={
        <>
          {voted.length + none.length} de {players.length} han respondido
          {pending.length > 0 ? ` · faltan ${pending.length}` : ""}
        </>
      }
    >
      {sorted.length > 0 ? (
        <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--accent-10)" }}>
                <th style={{ ...th, textAlign: "left", paddingLeft: 10 }} />
                {poll.options.map((o) => {
                  const top = topIds.includes(o.id);
                  return (
                    <th key={o.id} style={{ ...th, background: top ? "var(--accent-10)" : undefined }}>
                      <div>{optionDayLabel(o.date)}</div>
                      <div className="mono" style={{ fontSize: 12.5, color: top ? "var(--accent)" : "var(--text)" }}>
                        {o.time.slice(0, 5)}
                      </div>
                    </th>
                  );
                })}
                <th style={{ ...th, textAlign: "right", paddingRight: 10 }}>Partido</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...td, textAlign: "left", paddingLeft: 10, fontWeight: 600 }}>{p.name}</td>
                  {poll.options.map((o) => {
                    const on = votes[p.id].includes(o.id);
                    return (
                      <td
                        key={o.id}
                        style={{
                          ...td,
                          fontWeight: 700,
                          color: on ? "var(--accent)" : "var(--text-faint)",
                          background: topIds.includes(o.id) ? "var(--accent-10)" : undefined,
                        }}
                        aria-label={on ? "Puede" : "No marcada"}
                      >
                        {on ? "✓" : "·"}
                      </td>
                    );
                  })}
                  <Status id={p.id} />
                </tr>
              ))}
              <tr style={{ background: "var(--accent-10)" }}>
                <td style={{ ...td, textAlign: "left", paddingLeft: 10, fontWeight: 700, color: "var(--text-muted)" }}>Pueden</td>
                {poll.options.map((o) => (
                  <td
                    key={o.id}
                    className="mono"
                    style={{ ...td, fontWeight: 700, color: topIds.includes(o.id) ? "var(--accent)" : "var(--text)" }}
                  >
                    {count(o.id)}
                  </td>
                ))}
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>Todavía nadie ha marcado ninguna hora.</p>
      )}

      {none.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <b>Dicen que ninguna les va ({none.length})</b>
          <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
            {none.map((p) => (
              <li key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>{p.name}</span>
                <table style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <Status id={p.id} />
                    </tr>
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <b>Sin votar ({pending.length})</b>
          <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
            {pending.map((p) => (
              <li key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span>
                  {p.name}
                  {p.hasApp ? "" : <span style={{ color: "var(--text-muted)" }}> · sin la app</span>}
                </span>
                <table style={{ borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <Status id={p.id} />
                    </tr>
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
