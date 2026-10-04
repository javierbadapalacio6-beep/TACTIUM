"use client";

import { useState } from "react";

import { coverTeam, fetchClubTeams, fetchSubscription } from "@/lib/queries";
import { CLUB_PLANS } from "@/lib/plans";
import { proHref } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import { Btn, BtnLink, Card, CardHead, Chip, Modal, Note, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconBuilding, IconCheck } from "@/components/Icon";

const genderShort = (g: string | null) =>
  g === "femenino" ? "Fem." : g === "mixto" ? "Mixto" : g === "masculino" ? "Masc." : null;

/**
 * «Elige qué equipos cubre». Con más equipos que plazas, el club elige aquí
 * cuáles cubre, sabiendo que cubrir es permanente hasta que acabe el periodo.
 * Mismo `coverTeam` que el resto de la web, uno a uno.
 */
export function ClubCoverTeams() {
  const { clubId } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data, loading } = useAsync(
    async () => {
      const [teams, sub] = await Promise.all([fetchClubTeams(clubId!), fetchSubscription().catch(() => null)]);
      const plan = sub?.subjectType === "club" ? (CLUB_PLANS.find((p) => p.tier === sub.planTier) ?? null) : null;
      return { teams, plan };
    },
    [clubId, reloadKey],
    !!clubId,
  );

  if (!clubId) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState icon={<IconBuilding size={24} />} title="No gestionas ningún club" />
        </Card>
      </div>
    );
  }
  if (loading || !data) return <SkeletonPage />;

  const { teams, plan } = data;
  const sorted = teams.slice().sort((a, b) => Number(b.covered) - Number(a.covered) || a.name.localeCompare(b.name));
  const used = teams.filter((t) => t.covered).length;
  const quota = plan?.teamQuota ?? 0;
  const free = Math.max(0, quota - used);
  const nextPlan = plan ? (CLUB_PLANS.find((p) => p.teamQuota > plan.teamQuota) ?? null) : null;
  const left = teams.filter((t) => !t.covered && !picked.includes(t.id));

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < free ? [...prev, id] : prev,
    );

  async function doCover() {
    if (busy) return;
    setBusy(true);
    let ok = 0;
    let fallo: string | null = null;
    for (const id of picked) {
      const res = await guardedWrite("cubrir el equipo", () => coverTeam(id));
      if (res.ok) ok += 1;
      else fallo = res.reason;
    }
    setBusy(false);
    setConfirming(false);
    setPicked([]);
    setReloadKey((k) => k + 1);
    setToast(fallo ?? (ok === 1 ? "Equipo cubierto" : `${ok} equipos cubiertos`));
  }

  const pickedName = picked.length === 1 ? teams.find((t) => t.id === picked[0])?.name : null;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: "/club/facturacion", label: "Cobros y facturación" }}
        title="Elige qué equipos cubre"
        lede={
          plan
            ? `${plan.displayName} · ${quota} plazas. Tienes ${teams.length} equipos. Cubrir es permanente hasta que acabe el periodo.`
            : "El club no tiene un plan activo. Con un plan de club, sus capitanes tienen Pro sin pagar nada."
        }
      />

      <Card flush>
        <CardHead title="Equipos" count={teams.length} sub={plan ? `${used} de ${quota} cubiertos` : undefined} />
        {sorted.map((t) => {
          const on = picked.includes(t.id);
          const disabled = !plan || t.covered || (!on && picked.length >= free);
          return (
            <button
              key={t.id}
              type="button"
              role="checkbox"
              aria-checked={t.covered || on}
              disabled={disabled}
              onClick={() => toggle(t.id)}
              className="list-row"
              style={{
                width: "100%",
                border: "none",
                textAlign: "left",
                cursor: disabled ? "default" : "pointer",
                background: on ? "var(--accent-10)" : "transparent",
                opacity: disabled && !t.covered ? 0.55 : 1,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1.5px solid ${t.covered || on ? "var(--accent)" : "var(--line-strong)"}`,
                  background: t.covered || on ? "var(--accent)" : "transparent",
                  color: "var(--bg)",
                }}
              >
                {(t.covered || on) && <IconCheck size={13} />}
              </span>
              <span className="list-row-main">
                <span className="list-row-title truncate">{t.name}</span>
                <span className="list-row-sub">
                  {[genderShort(t.gender), t.category].filter(Boolean).join(" · ") || "Sin categoría"}
                </span>
              </span>
              {t.covered ? <Chip>Cubierto</Chip> : on ? <Chip tone="info">Elegido</Chip> : null}
            </button>
          );
        })}
        {plan && left.length > 0 && (
          <div className="card-foot" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            {left.length === 1 ? "El capitán de " : "Los capitanes de "}
            {left.map((t) => t.name).join(", ")} {left.length === 1 ? "sigue" : "siguen"} pudiendo usar
            TACTIUM gratis, o pagar su plan de capitán.
          </div>
        )}
      </Card>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {plan ? (
          <>
            <Btn variant="accent" disabled={picked.length === 0} onClick={() => setConfirming(true)}>
              {picked.length === 0
                ? free > 0
                  ? "Elige un equipo"
                  : "No te quedan plazas"
                : `Cubrir ${pickedName ?? `${picked.length} equipos`} · ${used + picked.length} de ${quota}`}
            </Btn>
            {nextPlan && (
              <BtnLink href={proHref(undefined, "club")} variant="quiet">
                o pasar a {nextPlan.displayName} ({nextPlan.teamQuota} equipos)
              </BtnLink>
            )}
          </>
        ) : (
          <BtnLink href={proHref(undefined, "club")} variant="accent">
            Ver planes de club
          </BtnLink>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        labelledBy="cubrir-confirmar"
        title={pickedName ? `Cubrir ${pickedName}` : `Cubrir ${picked.length} equipos`}
        lede="Cubrir un equipo es permanente hasta que acabe el periodo del plan."
        footer={
          <>
            <Btn onClick={() => setConfirming(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy || !WRITES_ENABLED} onClick={() => void doCover()}>
              {busy ? "Cubriendo…" : "Cubrir"}
            </Btn>
          </>
        }
      >
        {!WRITES_ENABLED ? (
          <Note tone="warning">{READ_ONLY_MESSAGE}</Note>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
            Su capitán tendrá Pro con el plan del club.
          </p>
        )}
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
