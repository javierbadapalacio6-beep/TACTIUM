"use client";

import { BtnLink, Card } from "@/components/ui";
import { IconCheck } from "@/components/Icon";

/**
 * Pantalla de éxito (gratis / pago en el club) con forma de entrada: arriba
 * el torneo y la pareja, una línea troquelada y abajo el código de compañero.
 */
export function SuccessTicket({
  tournamentName,
  dates,
  place,
  entries,
  payInClub,
  codes,
}: {
  tournamentName: string;
  dates: string | null;
  place: string | null;
  entries: { pair: string; category: string | null }[];
  payInClub: boolean;
  codes: { partner: string; category: string | null; code: string }[];
}) {
  const notch: React.CSSProperties = {
    position: "absolute",
    top: -9,
    width: 18,
    height: 18,
    borderRadius: 999,
    background: "var(--bg)",
    border: "1px solid var(--line)",
  };
  return (
    <div className="tw-page-narrow">
      <Card flush style={{ maxWidth: 560, margin: "0 auto", overflow: "hidden" }}>
        <div style={{ padding: "32px 24px 24px", textAlign: "center" }}>
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--accent-10)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconCheck size={24} />
          </span>
          <h2 style={{ fontSize: 21 }}>Estáis dentro</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            {tournamentName}
            {dates ? ` · ${dates}` : ""}
            {place ? ` · ${place}` : ""}
          </p>

          <dl
            className="kv"
            style={{
              gridTemplateColumns: "minmax(0, 1fr) auto",
              marginTop: 20,
              textAlign: "left",
            }}
          >
            {entries.map((e, i) => (
              <div key={i} style={{ display: "contents" }}>
                <dt>{e.pair}</dt>
                <dd style={{ textAlign: "right" }}>{e.category ?? "Categoría única"}</dd>
              </div>
            ))}
          </dl>

          <p
            style={{
              margin: "16px 0 0",
              fontSize: 12.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            {payInClub
              ? "Pagáis la cuota en el club. Os avisaremos cuando salga el cuadro y vuestro horario."
              : "Os avisaremos cuando salga el cuadro y vuestro horario."}
          </p>
        </div>

        {/* Línea troquelada de la entrada */}
        <div style={{ position: "relative", borderTop: "1px dashed var(--line)" }}>
          <span aria-hidden="true" style={{ ...notch, left: -10 }} />
          <span aria-hidden="true" style={{ ...notch, right: -10 }} />
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {codes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Código para tu compañero</div>
              <p
                style={{
                  margin: "4px 0 10px",
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                Pásale este código a tu compañero. Cuando lo meta en{" "}
                <b>Mis torneos</b>, el torneo aparecerá también en su cuenta.
              </p>
              {codes.map((d, i) => (
                <div
                  key={`${d.code}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                    borderTop: i > 0 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {d.partner}
                    {d.category ? (
                      <span style={{ color: "var(--text-faint)" }}>
                        {" · "}
                        {d.category}
                      </span>
                    ) : null}
                  </span>
                  <span className="code" style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {d.code}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <BtnLink href="/torneos/mios" variant="accent">
              Ver mis torneos
            </BtnLink>
            <a href="tactium://" className="btn btn-ghost">
              Volver a la app
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
