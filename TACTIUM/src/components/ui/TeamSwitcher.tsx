import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';

import { BottomSheet } from './BottomSheet';
import { IconChevron, IconCheck } from './Icon';

/**
 * Botón de cambio de equipo activo.
 * Solo se muestra si el usuario tiene >1 equipo visible.
 * Para users con 1 equipo (capitán independiente típico) renderiza
 * un fallback no-interactivo con el nombre del equipo.
 */
export const TeamSwitcher: React.FC<{
  compact?: boolean;
}> = ({ compact }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((s) => s.team);
  const teams = useTeamStore((s) => s.teams);
  const activeRole = useTeamStore((s) => s.activeRole);
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!team) return null;

  const hasMultiple = teams.length > 1;
  const subtitle = [team.category, team.group_name && `Grupo ${team.group_name}`]
    .filter(Boolean)
    .join(' · ');
  const roleLabel =
    activeRole === 'club_admin'
      ? 'CLUB ADMIN'
      : activeRole === 'player'
        ? 'JUGADOR'
        : 'CAPITÁN';

  if (!hasMultiple) {
    return (
      <View style={styles.staticBlock}>
        <Text style={styles.label}>{roleLabel}</Text>
        <Text style={styles.teamName} numberOfLines={1}>
          {subtitle ? `${team.name} · ${subtitle}` : team.name}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          compact && styles.buttonCompact,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>EQUIPO ACTIVO</Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
        </View>
        <IconChevron size={14} color={c.textFaint} />
      </Pressable>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetEyebrow}>EQUIPOS</Text>
        <Text style={styles.sheetTitle}>Cambiar equipo activo</Text>
        <View style={{ gap: 6 }}>
          {teams.map((t) => {
            const sel = t.id === team.id;
            return (
              <Pressable
                key={t.id}
                disabled={switching}
                onPress={async () => {
                  // Si ya está seleccionado: solo cierra el sheet.
                  if (sel) {
                    setOpen(false);
                    return;
                  }
                  // Bloqueamos taps adicionales mientras conmuta para
                  // evitar carreras (fetch players + resolveMyPlayer).
                  if (switching) return;
                  setSwitching(true);
                  try {
                    await setActiveTeam(t.id);
                  } catch (e: any) {
                    console.warn('TeamSwitcher:setActiveTeam', e);
                    toast.error(
                      'No se pudo cambiar de equipo',
                      e?.message ?? 'Inténtalo de nuevo.',
                    );
                  } finally {
                    setSwitching(false);
                    setOpen(false);
                  }
                }}
                style={[
                  styles.teamRow,
                  sel && {
                    backgroundColor: c.accent10,
                    borderColor: c.accent50,
                  },
                ]}
              >
                <View style={styles.teamBadge}>
                  <Text style={styles.teamBadgeText}>
                    {(t.category ?? 'EQ').slice(0, 3).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.teamRowName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={styles.teamRowMeta} numberOfLines={1}>
                    {[t.category, t.group_name && `Grupo ${t.group_name}`, t.league]
                      .filter(Boolean)
                      .join(' · ') || 'Sin configurar'}
                  </Text>
                </View>
                {sel ? <IconCheck size={16} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    staticBlock: {
      minWidth: 0,
      flexShrink: 1,
    },
    label: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 1.6,
      fontWeight: '500',
    },
    teamName: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 2,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.sm,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexShrink: 1,
      minWidth: 0,
    },
    buttonCompact: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    sheetTitle: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
      marginBottom: 12,
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    teamBadge: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamBadgeText: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    teamRowName: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    teamRowMeta: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      marginTop: 2,
      letterSpacing: 0.4,
    },
  });
