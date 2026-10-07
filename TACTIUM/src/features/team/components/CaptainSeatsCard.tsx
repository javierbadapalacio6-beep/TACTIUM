import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconPlus } from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import {
  CAPTAIN_SEATS,
  demoteTeamCaptain,
  formatCoverDate,
  type TeamCaptain,
} from '@core/services/teamCaptains';
import { useAuthStore } from '@store/authStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import type { RootStackParamList } from '@navigation/types';

/**
 * Bloque «Capitanes · 2 de 3» de la pestaña Equipo (equipos independientes).
 *
 * El plan Capitán cubre a TODOS los capitanes del equipo, hasta 3 (un plan, un solo equipo). Aquí se ve
 * quién paga y hasta cuándo, las plazas libres («Añadir capitán» comparte un
 * código de capitán de un solo uso) y se puede quitar a un capitán (pasa a
 * jugador): solo el dueño del equipo o quien paga el plan.
 *
 * Patrones (Mobbin): plazas libres como huecos con «+» — Tolan «Family · 5
 * seats left»; filas con rol bajo el nombre — Instacart «Your family»; estado
 * sin plan con el límite explicado — CLEAR «Manage Family»; confirmación de
 * quitar con el nombre — Mesh «Are you sure you want to remove…».
 */
export interface CaptainSeatsTeam {
  id: string;
  name: string;
  club_id: string | null;
  owner_id: string;
}

export const CaptainSeatsCard: React.FC<{
  team: CaptainSeatsTeam;
  /** Tras quitar a un capitán (para refrescar marcas de la plantilla). */
  onChanged?: () => void;
}> = ({ team, onChanged }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const row = useSubscriptionStore((s) => s.teamCoverage[team.id] ?? null);
  const refreshTeamCoverage = useSubscriptionStore((s) => s.refreshTeamCoverage);
  const [sharing, setSharing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // La cobertura no llega por realtime (es de otras personas): al entrar.
  useFocusEffect(
    useCallback(() => {
      void refreshTeamCoverage(team.id);
    }, [refreshTeamCoverage, team.id]),
  );

  if (team.club_id) return null;

  const captains: TeamCaptain[] = row?.captains ?? [];
  const count = row?.captain_count ?? captains.length;
  const covered = !!row?.covered;
  const freeSeats = Math.max(0, CAPTAIN_SEATS - count);
  const canRemove = !!userId && (userId === team.owner_id || userId === row?.payer_user_id);
  const until = formatCoverDate(row?.period_end ?? null);

  const addCaptain = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const inv = await InvitationsApi.createInvitation(team.id, 'captain');
      await Share.share({
        message: InvitationsApi.buildInviteMessage(team.name, inv.code, 'captain'),
      });
    } catch (e: any) {
      if (e?.message) toast.error('No se pudo crear el código', e.message);
    } finally {
      setSharing(false);
    }
  };

  const askRemove = (cap: TeamCaptain) => {
    const name = cap.name ?? 'este capitán';
    Alert.alert(
      `¿Quitar a ${name} como capitán?`,
      'Pasa a jugador: sigue en el equipo, pero ya no gestiona jornadas ni alineaciones. Su plaza queda libre.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(cap.user_id);
            try {
              await demoteTeamCaptain(team.id, cap.user_id);
              await refreshTeamCoverage(team.id);
              onChanged?.();
              toast.success(`${name} ya es jugador`, 'Su plaza de capitán queda libre.');
            } catch (e: any) {
              toast.error('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );
  };

  const metaOf = (cap: TeamCaptain): string => {
    if (cap.is_payer) return until ? `Cubre a todos hasta ${until}` : 'Cubre a todos';
    if (cap.is_owner) return 'Dueño del equipo';
    return covered ? 'Capitán · con Pro' : 'Capitán';
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>
          CAPITANES · {count} DE {CAPTAIN_SEATS}
        </Text>
        {covered ? <Text style={styles.chip}>PRO</Text> : null}
      </View>

      {captains.map((cap) => {
        const isMe = cap.user_id === userId;
        const initials = (cap.name ?? '?')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase())
          .join('');
        return (
          <View key={cap.user_id} style={styles.row}>
            <View style={styles.avatar}>
              {cap.avatar_url ? (
                <Image source={{ uri: cap.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitials}>{initials || '·'}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {cap.name ?? 'Sin nombre'}
                  {isMe ? <Text style={styles.you}>  (tú)</Text> : null}
                </Text>
                {cap.is_payer ? <Text style={styles.payTag}>Paga el plan</Text> : null}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {metaOf(cap)}
              </Text>
            </View>
            {canRemove && !cap.is_owner && !isMe ? (
              removingId === cap.user_id ? (
                <ActivityIndicator size="small" color={c.textFaint} />
              ) : (
                <Pressable
                  onPress={() => askRemove(cap)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar a ${cap.name ?? 'este capitán'} como capitán`}
                  style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.removeText}>Quitar</Text>
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}

      {Array.from({ length: freeSeats }).map((_, i) => (
        <Pressable
          key={`free-${i}`}
          onPress={addCaptain}
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel="Añadir capitán"
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
        >
          <View style={styles.slot}>
            {sharing && i === 0 ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <IconPlus size={14} color={c.accent} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.slotTitle}>Añadir capitán</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {covered ? 'Entra con Pro, sin pagar nada' : 'Código de un solo uso · 7 días'}
            </Text>
          </View>
        </Pressable>
      ))}

      {count > CAPTAIN_SEATS ? (
        <Text style={styles.note}>
          Sois {count}: no se pueden añadir más hasta bajar de {CAPTAIN_SEATS}.
        </Text>
      ) : null}

      {!covered && row ? (
        <Pressable
          onPress={() => navigation.navigate('Paywall', { intent: 'captain' })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.upsell, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.upsellText}>
            Con el plan Capitán, los {CAPTAIN_SEATS} capitanes tienen todas las funciones.
          </Text>
          <Text style={styles.upsellLink}>Ver el plan ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const AV = 34;

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 6,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    eyebrow: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 1.6 },
    chip: {
      fontFamily: Fonts.mono,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: 'hidden',
      color: c.accent,
      backgroundColor: c.accent10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 9,
    },
    avatar: {
      width: AV,
      height: AV,
      borderRadius: AV / 2,
      backgroundColor: c.accent15,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: AV, height: AV },
    avatarInitials: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '600', color: c.accent },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flexShrink: 1, color: c.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
    you: { color: c.textFaint, fontSize: 13, fontWeight: '500' },
    payTag: {
      fontSize: 10.5,
      fontWeight: '700',
      color: c.accent,
      backgroundColor: c.accent10,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
    },
    meta: { color: c.textFaint, fontSize: 11.5, marginTop: 2 },
    removeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    removeText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    slot: {
      width: AV,
      height: AV,
      borderRadius: AV / 2,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotTitle: { color: c.accent, fontSize: 14, fontWeight: '700' },
    note: { color: c.warning, fontSize: 12, marginTop: 4, marginBottom: 6 },
    upsell: {
      marginTop: 6,
      marginBottom: 8,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      gap: 4,
    },
    upsellText: { color: c.text, fontSize: 13, lineHeight: 18 },
    upsellLink: { color: c.accent, fontSize: 13, fontWeight: '700' },
  });
