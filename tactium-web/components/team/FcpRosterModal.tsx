"use client";

import { useEffect, useState } from "react";

import {
  importFcpRosterIntoTeam,
  searchFcpClubs,
  type FcpClubGroup,
  type FcpTeamOption,
} from "@/lib/fcp-import";
import { guardedWrite } from "@/lib/writes";
import { Input, Modal, Note } from "@/components/ui";

/**
 * Traer la plantilla de la Federación Cántabra a un equipo que ya existe.
 * Es el mismo import que «Plantilla › Traer de la Federación» en /equipo
 * (`importFcpRosterIntoTeam`: vínculo + RPC `import_fcp_roster`). Aquí sin
 * muro de pago: en el onboarding la app lo deja libre (AddPlayersScreen).
 */
export function FcpRosterModal({
  open,
  teamId,
  onClose,
  onImported,
}: {
  open: boolean;
  teamId: string;
  onClose: () => void;
  onImported: (added: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FcpClubGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const id = setTimeout(() => {
      searchFcpClubs(query)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, query]);

  async function pick(t: FcpTeamOption) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("importar de la Federación", () =>
      importFcpRosterIntoTeam(teamId, t),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    setQuery("");
    onImported(res.data);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="fcp-roster-onb"
      width={560}
      title="Importar de la Federación"
      lede="Busca tu club, elige tu equipo y traemos su plantilla con los puntos oficiales."
    >
      <Input
        type="text"
        placeholder="Busca tu club"
        aria-label="Busca tu club"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {err && (
        <Note tone="error" style={{ marginTop: 10 }}>
          {err}
        </Note>
      )}
      <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
        Se añaden los que falten: si repites la importación no se duplica nadie.
      </p>
      <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
        {loading && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Buscando…</p>}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
            Sin resultados para «{query.trim()}».
          </p>
        )}
        {results.map((club) => (
          <div key={club.club} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{club.club}</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {club.teams.map((t) => (
                <button
                  key={t.id_equipo}
                  type="button"
                  disabled={busy}
                  onClick={() => void pick(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--line)",
                    background: "var(--bg-card-2)",
                    color: "var(--text)",
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.6 : 1,
                    textAlign: "left",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t.equipo}</span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {[t.category, t.gender].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
