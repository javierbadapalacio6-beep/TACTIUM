import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconChevron } from '@components/ui';
import * as PlayersApi from '@core/services/players';
import { useTeamStore } from '@store/teamStore';

type Player = PlayersApi.Player;

/**
 * Sheet de "Soy yo" para players. Se muestra la primera vez que un usuario
 * con rol player entra a la app y aún no se ha vinculado con una fila de la
 * plantilla (`players`). Cargada por `PlayerClaimGate`.
 *
 * El sheet permite:
 *   - Ver los slots libres del equipo activo.
 *   - Reclamar uno (RPC `claim_player`).
 *   - Salir sin reclamar (modo solo-lectura) — el gate lo volverá a abrir
 *     al cambiar de equipo o reabrir la app.
 */
export const ClaimPlayerSheet: React.FC<{
  open: boolean;
  teamId: string | null;
  teamName: string | null;
  onClose: () => void;
  onClaimed?: () => void;
}> = ({ open, teamId, teamName, onClose, onClaimed }) => {
  const refreshMyPlayer = useTeamStore((s) => s.refreshMyPlayer);

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Player[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const reload = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await PlayersApi.listUnclaimedPlayers(teamId);
      setList(data);
    } catch (e: any) {
      console.warn('listUnclaimedPlayers', e);
      Alert.alert('Error', e?.message ?? 'No se pudo cargar la plantilla.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && teamId) {
      reload();
    } else if (!open) {
      setList([]);
      setSubmittingId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamId]);

  const handlePick = (player: Player) => {
    if (submittingId) return;
    Alert.alert(
      '¿Eres tú?',
      `Vas a vincular tu cuenta al jugador "${player.name}". Después podrás marcar tu disponibilidad y ver los partidos como ese jugador.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, soy yo',
          style: 'default',
          onPress: () => doClaim(player),
        },
      ],
    );
  };

  const doClaim = async (player: Player) => {
    setSubmittingId(player.id);
    try {
      await PlayersApi.claimPlayer(player.id);
      await refreshMyPlayer();
      onClaimed?.();
      onClose();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === '23505') {
        // Slot ya reclamado por otro o yo ya tengo otro vinculado.
        Alert.alert(
          'No se pudo vincular',
          'Ese jugador ya ha sido reclamado o ya estás vinculado a otro jugador del equipo.',
        );
        await reload();
      } else if (code === '42501') {
        Alert.alert(
          'Sin permisos',
          'No perteneces a este equipo o tu sesión ha caducado.',
        );
      } else {
        Alert.alert('Error', e?.message ?? 'Inténtalo de nuevo.');
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const handleNotInRoster = () => {
    Alert.alert(
      'No estoy en la plantilla',
      'Pide al capitán del equipo que te añada como jugador. Mientras tanto puedes ver los datos del equipo en modo lectura.',
      [{ text: 'Entendido', style: 'default', onPress: onClose }],
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>BIENVENIDO</Text>
      <Text style={styles.title}>¿Cuál eres tú?</Text>
      <Text style={styles.lede}>
        {teamName
          ? `Selecciona tu nombre en la plantilla de ${teamName} para vincular tu cuenta.`
          : 'Selecciona tu nombre en la plantilla para vincular tu cuenta.'}
      </Text>

      {loading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No hay slots libres</Text>
          <Text style={styles.emptyText}>
            Todos los jugadores de la plantilla ya están vinculados a una
            cuenta. Pide al capitán que te añada o libere un slot.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((p, idx) => {
            const isLast = idx === list.length - 1;
            const submitting = submittingId === p.id;
            const meta = `${p.position} · ${p.pts} pts`;
            return (
              <Pressable
                key={p.id}
                onPress={() => handlePick(p)}
                disabled={!!submittingId}
                style={({ pressed }) => [
                  styles.row,
                  !isLast && styles.rowDivider,
                  pressed && { opacity: 0.85 },
                  submittingId && !submitting && { opacity: 0.5 },
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                {submitting ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <IconChevron size={14} color={Colors.textFaint} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        onPress={handleNotInRoster}
        disabled={!!submittingId}
        style={({ pressed }) => [
          styles.secondary,
          pressed && { opacity: 0.85 },
          submittingId && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.secondaryLabel}>No estoy en la plantilla</Text>
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  loaderBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  list: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: Colors.hair,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  secondary: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
