import React, { useState } from 'react';

import { useColors } from '@core/theme';
import { IconTeam } from '@components/ui';
import { TabEmptyState } from '@components/ui/TabEmptyState';
import { useTeamStore } from '@store/teamStore';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';

/**
 * Jugador SUELTO (sin equipo): «Crea o únete a un equipo». Se usa en la
 * pestaña Equipo y en el segmento Liga de Competir.
 *  · Unirme → canjear la invitación del capitán.
 *  · Crear → sale del modo suelto hacia la elección inicial (crear equipo o
 *    club), igual que el enlace de la Home del suelto.
 */
export const NoTeamState: React.FC<{ text?: string }> = ({ text }) => {
  const c = useColors();
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const [redeemOpen, setRedeemOpen] = useState(false);

  return (
    <>
      <TabEmptyState
        icon={<IconTeam size={24} color={c.accent} />}
        eyebrow="SIN EQUIPO"
        title="Crea o únete a un equipo"
        text={
          text ??
          'Con un equipo tendrás tu liga, tus alineaciones y tus estadísticas oficiales. Si tu capitán ya usa TACTIUM, pídele la invitación.'
        }
        primary={{
          label: 'Unirme a un equipo',
          onPress: () => setRedeemOpen(true),
        }}
        secondary={{
          label: 'Crear mi equipo',
          onPress: () => {
            setSoloUpgrade(true);
            setSoloMode(false);
          },
        }}
      />
      <RedeemInvitationSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
    </>
  );
};
