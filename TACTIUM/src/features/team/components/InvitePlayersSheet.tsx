import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconTrash, IconPlus, IconShare } from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';

// Sheet de invitación de jugadores para captains independientes. Solo
// gestiona códigos de role='player' — la gestión de members con roles
// existe en TeamMembersSheet del flow club (más completo) y aquí no
// aplica porque un equipo independiente no invita capitanes.
export const InvitePlayersSheet: React.FC<{
  open: boolean;
  teamId: string | null;
  teamName: string | null;
  onClose: () => void;
}> = ({ open, teamId, teamName, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [invitations, setInvitations] = useState<
    InvitationsApi.TeamInvitationWithRedeemer[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const invs = await InvitationsApi.fetchTeamInvitationsWithRedeemers(
          teamId,
        );
        if (!cancelled) setInvitations(invs);
      } catch (e: any) {
        if (!cancelled) {
          Alert.alert('Error', e?.message ?? 'No se pudo cargar.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teamId]);

  // Separamos en dos grupos para presentación:
  //  · Activos = no canjeados y no caducados (acción posible: compartir/revocar)
  //  · Canjeados = used_at != null (informativo: muestra a quién se unió)
  // Los caducados sin canjear se omiten para no ensuciar.
  const activeCodes = invitations.filter(InvitationsApi.isInvitationActive);
  const redeemedCodes = invitations.filter((i) => i.used_at !== null);

  const buildShareMessage = (code: string) =>
    `Únete como jugador a "${teamName ?? 'el equipo'}" en TACTIUM con este código: ${code}`;

  const handleCreate = async () => {
    if (!teamId || generating) return;
    setGenerating(true);
    try {
      const inv = await InvitationsApi.createInvitation(teamId, 'player');
      setInvitations((list) => [{ ...inv, redeemer: null }, ...list]);
      // Abrimos share inmediatamente: el caso típico es enviar el código
      // por WhatsApp al jugador justo después de generarlo.
      try {
        await Share.share({ message: buildShareMessage(inv.code) });
      } catch {
        /* usuario canceló share, no es error */
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo generar el código.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async (code: string) => {
    try {
      await Share.share({ message: buildShareMessage(code) });
    } catch {
      /* cancelado */
    }
  };

  const handleRevoke = (inv: InvitationsApi.TeamInvitation) => {
    Alert.alert(
      'Revocar código',
      `¿Anular el código ${inv.code}? El jugador no podrá usarlo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            try {
              await InvitationsApi.revokeInvitation(inv.id);
              setInvitations((list) => list.filter((i) => i.id !== inv.id));
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo revocar.');
            }
          },
        },
      ],
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>INVITAR JUGADORES</Text>
      <Text style={styles.title}>Códigos de invitación</Text>
      <Text style={styles.lede}>
        Cada código permite a un jugador unirse al equipo desde la app.
        Compártelo por WhatsApp, mensaje o como prefieras.
      </Text>

      <Pressable
        onPress={handleCreate}
        disabled={generating || !teamId}
        style={({ pressed }) => [
          styles.generateBtn,
          (generating || !teamId) && { opacity: 0.5 },
          pressed && !generating && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Generar nuevo código de invitación"
      >
        {generating ? (
          <ActivityIndicator color={c.textInverse} />
        ) : (
          <>
            <IconPlus size={14} color={c.textInverse} />
            <Text style={styles.generateBtnLabel}>
              Generar código nuevo
            </Text>
          </>
        )}
      </Pressable>

      {loading ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <>
          <Text style={styles.groupLabel}>ACTIVOS</Text>
          <View style={styles.list}>
            {activeCodes.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  No hay códigos activos. Genera uno arriba.
                </Text>
              </View>
            ) : (
              activeCodes.map((inv) => (
                <View key={inv.id} style={styles.row}>
                  <View style={styles.codeBlock}>
                    <Text style={styles.codeText}>{inv.code}</Text>
                    <Text style={styles.codeMeta}>
                      Expira {formatExpiry(inv.expires_at)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleShare(inv.code)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Compartir código"
                  >
                    <IconShare size={14} color={c.accent} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleRevoke(inv)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Revocar código"
                  >
                    <IconTrash size={14} color={c.error} />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {redeemedCodes.length > 0 ? (
            <>
              <Text style={[styles.groupLabel, { marginTop: 18 }]}>
                CANJEADOS
              </Text>
              <View style={styles.list}>
                {redeemedCodes.map((inv) => {
                  const who =
                    inv.redeemer?.full_name?.trim() ||
                    inv.redeemer?.email ||
                    'Jugador';
                  return (
                    <View key={inv.id} style={[styles.row, styles.rowMuted]}>
                      <View style={styles.codeBlock}>
                        <Text style={[styles.codeText, styles.codeTextMuted]}>
                          {inv.code}
                        </Text>
                        <Text style={styles.codeMeta} numberOfLines={1}>
                          {who} · {formatRedeemedAt(inv.used_at!)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
};

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'mañana';
  if (diffDays < 30) return `en ${diffDays} días`;
  return `el ${date.getDate()}/${date.getMonth() + 1}`;
}

function formatRedeemedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'unido hoy';
  if (diffDays === 1) return 'unido ayer';
  if (diffDays < 30) return `unido hace ${diffDays} días`;
  return `unido el ${date.getDate()}/${date.getMonth() + 1}`;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  title: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 6,
  },
  lede: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: Radius.md,
    marginBottom: 16,
  },
  generateBtnLabel: {
    color: c.textInverse,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  list: { gap: 8 },
  groupLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: 8,
  },
  rowMuted: {
    opacity: 0.7,
    backgroundColor: c.bgRaised,
    borderColor: c.hair,
  },
  codeTextMuted: {
    color: c.textMuted,
    textDecorationLine: 'line-through',
  },
  loaderRow: { paddingVertical: 24, alignItems: 'center' },
  empty: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.hair,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  codeBlock: { flex: 1, minWidth: 0 },
  codeText: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    letterSpacing: 1,
  },
  codeMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
