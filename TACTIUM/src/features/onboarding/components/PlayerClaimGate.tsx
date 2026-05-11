import React, { useEffect, useState } from 'react';

import { useTeamStore } from '@store/teamStore';

import { ClaimPlayerSheet } from './ClaimPlayerSheet';

/**
 * Gate que abre automáticamente el `ClaimPlayerSheet` cuando un usuario con
 * rol player aún no se ha vinculado a una fila de la plantilla en el equipo
 * activo.
 *
 * Se cierra de forma "blanda": si el user dismissea el sheet, no se vuelve a
 * abrir hasta que cambia de equipo o reabre la app. No bloquea la navegación
 * — la app puede usarse en modo solo-lectura sin claim.
 */
export const PlayerClaimGate: React.FC = () => {
  const team = useTeamStore((s) => s.team);
  const activeRole = useTeamStore((s) => s.activeRole);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const myPlayerLoaded = useTeamStore((s) => s.myPlayerLoaded);

  const [dismissedTeamId, setDismissedTeamId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Si cambia de equipo, perdemos el dismiss anterior y volvemos a evaluar.
  useEffect(() => {
    if (team?.id && dismissedTeamId && team.id !== dismissedTeamId) {
      setDismissedTeamId(null);
    }
  }, [team?.id, dismissedTeamId]);

  useEffect(() => {
    if (!team) {
      setOpen(false);
      return;
    }
    if (activeRole !== 'player') {
      setOpen(false);
      return;
    }
    if (!myPlayerLoaded) return;
    if (myPlayerId !== null) {
      setOpen(false);
      return;
    }
    if (dismissedTeamId === team.id) return;
    setOpen(true);
  }, [team, activeRole, myPlayerId, myPlayerLoaded, dismissedTeamId]);

  const handleClose = () => {
    if (team?.id) setDismissedTeamId(team.id);
    setOpen(false);
  };

  return (
    <ClaimPlayerSheet
      open={open}
      teamId={team?.id ?? null}
      teamName={team?.name ?? null}
      onClose={handleClose}
    />
  );
};
