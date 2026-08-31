"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useSession } from "@/lib/session";
import { Card, Eyebrow } from "@/components/ui";
import { IconChevronRight, IconDownload } from "@/components/Icon";

/**
 * Mis datos (RGPD). La exportación se genera en cliente a partir de las filas
 * que ya se muestran: lo que el usuario descarga es exactamente lo que ve.
 * Cuando haya backend, esto pasa a pedir el volcado completo al servidor.
 */
export function MisDatos() {
  const { user, role, teams, clubId } = useSession();
  const [downloading, setDownloading] = useState(false);

  // Datos REALES de la sesión (no maqueta). Un usuario nuevo ve lo suyo (o
  // vacío), nunca los de una cuenta demo.
  const rows = useMemo(
    () =>
      [
        { label: "Nombre", value: user?.name || "—", mono: false },
        { label: "Email", value: user?.email || "—", mono: false },
        { label: "Rol", value: user?.roleLabel || role, mono: false },
        {
          label: "Equipos a los que perteneces",
          value: String(teams.length),
          mono: true,
        },
        {
          label: "Club",
          value: clubId ? "Sí" : "No",
          mono: true,
        },
        { label: "ID interno", value: user?.id || "—", mono: true },
      ] as { label: string; value: string; mono: boolean }[],
    [user, role, teams, clubId],
  );

  function exportJson() {
    setDownloading(true);
    try {
      const payload = {
        exportadoEl: new Date().toISOString(),
        origen: "TACTIUM web",
        datos: Object.fromEntries(rows.map((d) => [d.label, d.value])),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mis-datos-tactium.json";
      a.click();
      // Liberamos el object URL: si no, el blob se queda en memoria toda la sesión.
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <Eyebrow>MIS DATOS</Eyebrow>
        <h2 style={{ margin: "14px 0 20px", fontSize: 24 }}>
          Resumen de tus datos
        </h2>

        <div
          style={{
            borderRadius: 12,
            background: "var(--bg-card-2)",
            overflow: "hidden",
          }}
        >
          {rows.map((d, i) => (
            <div
              key={d.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: 20,
                padding: "12px 18px",
                borderBottom:
                  i === rows.length - 1
                    ? "none"
                    : "1px solid var(--hair)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                }}
              >
                {d.label}
              </span>
              <span
                className={d.mono ? "mono" : undefined}
                style={
                  d.mono
                    ? { fontSize: 13, letterSpacing: "0.08em" }
                    : { fontSize: 13.5 }
                }
              >
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <Card
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Eyebrow>EXPORTAR</Eyebrow>
            <div
              style={{
                marginTop: 12,
                fontSize: 13.5,
                color: "var(--text-muted)",
                maxWidth: "36ch",
                textWrap: "pretty",
              }}
            >
              Un archivo con todo lo que guardamos de ti.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-accent"
            onClick={exportJson}
            disabled={downloading}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            <IconDownload size={15} />
            Descargar mis datos como JSON
          </button>
        </Card>

        <Card style={{ padding: 24 }}>
          <Eyebrow>POLÍTICAS</Eyebrow>
          <div style={{ marginTop: 16 }}>
            <Link
              href="/legal/terminos"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--hair)",
                color: "var(--text)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5 }}>
                Términos del servicio
              </span>
              <span style={{ color: "var(--text-faint)", display: "flex" }}>
                <IconChevronRight size={15} />
              </span>
            </Link>
            <Link
              href="/legal/privacidad"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                color: "var(--text)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5 }}>
                Política de privacidad
              </span>
              <span style={{ color: "var(--text-faint)", display: "flex" }}>
                <IconChevronRight size={15} />
              </span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
