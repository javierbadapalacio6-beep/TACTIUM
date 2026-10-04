"use client";

import { ROLE_LABELS, useSession } from "@/lib/session";
import { Avatar, BtnLink, Card, CardHead, Segmented } from "@/components/ui";
import { Apariencia } from "@/components/settings/Apariencia";
import { Notificaciones } from "@/components/settings/Notificaciones";
import { MisDatos, TuPerfil } from "@/components/settings/MisDatos";
import { ZonaPeligro } from "@/components/settings/ZonaPeligro";
import {
  EquipoActual,
  Invitaciones,
  MiJugador,
  Soporte,
  SuscripcionResumen,
} from "@/components/settings/simple-sections";

/**
 * Las 5 secciones de Ajustes (igual que los 5 grupos de la app):
 * Perfil y plan · Tu equipo · Preferencias · Cuenta · Ayuda. Cada bloque
 * lleva un `id` para que las URLs antiguas (`/ajustes/notificaciones`…)
 * aterricen en su sitio.
 */

const stack = { display: "flex", flexDirection: "column", gap: 16 } as const;

/** Tu tarjeta arriba: foto, nombre, @usuario y rol; «Editar» baja al formulario. */
function MeCard() {
  const { user, role, activeTeam } = useSession();
  if (!user) return null;
  const roleText =
    role === "capitan" || role === "jugador"
      ? `${role === "capitan" ? "Capitán" : "Jugador"}${activeTeam ? ` de ${activeTeam.name}` : ""}`
      : ROLE_LABELS[role];
  const meta = [user.username ? `@${user.username}` : null, roleText].filter(Boolean).join(" · ");
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Avatar initials={user.initials} src={user.avatarUrl} size={52} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{user.name}</div>
          <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>{meta}</div>
        </div>
        <BtnLink href="#editar-perfil" size="sm">
          Editar
        </BtnLink>
      </div>
    </Card>
  );
}

/** «Ver como»: solo si la persona tiene varios roles de verdad. */
function VerComo() {
  const { availableRoles, role, setRole } = useSession();
  if (availableRoles.length < 2) return null;
  return (
    <Card flush>
      <CardHead title="Ver como" sub="Cambia la vista de la web al rol que elijas." />
      <div className="card-body">
        <Segmented
          label="Ver como"
          value={role}
          onChange={setRole}
          options={availableRoles.map((r) => ({
            value: r,
            label: r === "club" ? "Club" : r === "capitan" ? "Capitán" : "Jugador",
          }))}
        />
      </div>
    </Card>
  );
}

export function SeccionPerfil() {
  return (
    <div style={stack}>
      <MeCard />
      <div id="plan">
        <SuscripcionResumen />
      </div>
      <div id="editar-perfil" style={{ scrollMarginTop: 80 }}>
        <TuPerfil />
      </div>
    </div>
  );
}

export function SeccionEquipo() {
  const { role, activeTeam } = useSession();
  return (
    <div style={stack}>
      <EquipoActual />
      {role === "jugador" && activeTeam && (
        <div id="mi-ficha" style={{ scrollMarginTop: 80 }}>
          <MiJugador />
        </div>
      )}
      <div id="invitaciones" style={{ scrollMarginTop: 80 }}>
        <Invitaciones />
      </div>
      <VerComo />
    </div>
  );
}

export function SeccionPreferencias() {
  return (
    <div style={stack}>
      <div id="avisos" style={{ scrollMarginTop: 80 }}>
        <Notificaciones />
      </div>
      <div id="apariencia" style={{ scrollMarginTop: 80 }}>
        <Apariencia />
      </div>
    </div>
  );
}

export function SeccionCuenta() {
  return (
    <div style={stack}>
      <div id="mis-datos" style={{ scrollMarginTop: 80 }}>
        <MisDatos />
      </div>
      <ZonaPeligro />
    </div>
  );
}

export function SeccionAyuda() {
  return <Soporte />;
}
