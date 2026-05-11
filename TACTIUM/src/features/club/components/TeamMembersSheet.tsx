import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  BottomSheet,
  IconTrash,
  IconCheck,
  IconPlus,
  IconShare,
} from '@components/ui';
import * as TeamMembersApi from '@core/services/teamMembers';
import * as InvitationsApi from '@core/services/invitations';
import * as PlayersApi from '@core/services/players';

const ROLE_LABEL: Record<TeamMembersApi.TeamRole, string> = {
  captain: 'Capitán',
  admin: 'Admin',
  player: 'Jugador',
};

const ROLE_OPTIONS: TeamMembersApi.TeamRole[] = ['captain', 'player'];

export const TeamMembersSheet: React.FC<{
  open: boolean;
  teamId: string | null;
  teamName: string | null;
  onClose: () => void;
}> = ({ open, teamId, teamName, onClose }) => {
  const [members, setMembers] = useState<TeamMembersApi.TeamMemberWithProfile[]>(
    [],
  );
  const [invitations, setInvitations] = useState<InvitationsApi.TeamInvitation[]>(
    [],
  );
  const [players, setPlayers] = useState<PlayersApi.Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !teamId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [list, invs, pls] = await Promise.all([
          TeamMembersApi.fetchTeamMembersWithProfiles(teamId),
          InvitationsApi.fetchTeamInvitations(teamId),
          PlayersApi.fetchPlayers(teamId),
        ]);
        if (!cancelled) {
          setMembers(list);
          setInvitations(invs);
          setPlayers(pls);
        }
      } catch (e: any) {
        if (!cancelled) Alert.alert('Error', e?.message ?? 'No se pudo cargar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teamId]);

  // Map user_id → player slot reclamado en este equipo. Se reconstruye con
  // cada cambio de `players` (por ejemplo tras liberar un slot).
  const playerByUserId = React.useMemo(() => {
    const m = new Map<string, PlayersApi.Player>();
    for (const p of players) {
      if (p.user_id) m.set(p.user_id, p);
    }
    return m;
  }, [players]);

  const handleCreateInvitation = async (role: InvitationsApi.InvitableRole) => {
    if (!teamId || generating) return;
    setGenerating(true);
    try {
      const inv = await InvitationsApi.createInvitation(teamId, role);
      setInvitations((list) => [inv, ...list]);
      // Abrimos el share sheet directamente: el caso típico es enviar el code
      // por WhatsApp al capitán inmediatamente después de generarlo.
      const label = role === 'captain' ? 'capitán' : 'jugador';
      try {
        await Share.share({
          message: `Únete como ${label} a "${teamName ?? 'el equipo'}" en TACTIUM con este código: ${inv.code}`,
        });
      } catch {
        /* user cancelado, no es error */
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo generar el código.');
    } finally {
      setGenerating(false);
    }
  };

  const handleShareCode = async (code: string, role: InvitationsApi.InvitableRole) => {
    const label = role === 'captain' ? 'capitán' : 'jugador';
    try {
      await Share.share({
        message: `Únete como ${label} a "${teamName ?? 'el equipo'}" en TACTIUM con este código: ${code}`,
      });
    } catch {
      /* sin error si cancelan */
    }
  };

  const handleRevokeInvitation = (inv: InvitationsApi.TeamInvitation) => {
    Alert.alert('Revocar código', `¿Anular el código ${inv.code}?`, [
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
    ]);
  };

  const handleRoleChange = async (
    member: TeamMembersApi.TeamMemberWithProfile,
    role: TeamMembersApi.TeamRole,
  ) => {
    if (member.role === role) return;
    setSavingId(member.id);
    try {
      const updated = await TeamMembersApi.updateTeamMemberRole(member.id, role);
      setMembers((ms) => ms.map((m) => (m.id === member.id ? { ...m, ...updated } : m)));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo actualizar.');
    } finally {
      setSavingId(null);
    }
  };

  const handleUnclaimSlot = (
    member: TeamMembersApi.TeamMemberWithProfile,
    player: PlayersApi.Player,
  ) => {
    const memberLabel =
      member.profile?.full_name ?? member.profile?.email ?? 'este miembro';
    Alert.alert(
      'Liberar slot',
      `¿Desvincular a ${memberLabel} del slot "${player.name}"? El slot quedará disponible para que otro jugador lo reclame.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          style: 'destructive',
          onPress: async () => {
            setSavingId(member.id);
            try {
              const updated = await PlayersApi.captainUnclaimPlayer(player.id);
              setPlayers((list) =>
                list.map((p) => (p.id === updated.id ? updated : p)),
              );
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo liberar el slot.');
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    );
  };

  const handleRemove = (member: TeamMembersApi.TeamMemberWithProfile) => {
    Alert.alert(
      'Eliminar miembro',
      `¿Quitar a ${member.profile?.full_name ?? member.profile?.email ?? 'este miembro'} del equipo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSavingId(member.id);
            try {
              await TeamMembersApi.removeTeamMember(member.id);
              setMembers((ms) => ms.filter((m) => m.id !== member.id));
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>EQUIPO</Text>
      <Text style={styles.title} numberOfLines={1}>
        {teamName ?? 'Miembros'}
      </Text>
      <Text style={styles.lede}>
        Asigna capitán o gestiona quién pertenece al equipo.
      </Text>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Aún no hay miembros.</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {members.map((m) => {
            const name =
              m.profile?.full_name?.trim() ||
              m.profile?.email ||
              'Sin nombre';
            const initials = (m.profile?.full_name ?? m.profile?.email ?? '?')
              .split(/[\s@.]+/)
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const isSaving = savingId === m.id;
            const linkedPlayer =
              m.role === 'player' ? playerByUserId.get(m.user_id) : undefined;

            return (
              <View key={m.id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {name}
                    </Text>
                    {m.profile?.email && m.profile.full_name ? (
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {m.profile.email}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => handleRemove(m)}
                    disabled={isSaving}
                    hitSlop={8}
                    style={styles.removeBtn}
                  >
                    <IconTrash size={16} color={Colors.err} />
                  </Pressable>
                </View>

                <View style={styles.roleRow}>
                  {ROLE_OPTIONS.map((r) => {
                    const sel = m.role === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => handleRoleChange(m, r)}
                        disabled={isSaving}
                        style={[
                          styles.rolePill,
                          sel && {
                            backgroundColor: Colors.accent10,
                            borderColor: Colors.accent50,
                          },
                        ]}
                      >
                        {sel ? (
                          <IconCheck size={11} color={Colors.accent} />
                        ) : null}
                        <Text
                          style={[
                            styles.rolePillText,
                            { color: sel ? Colors.accent : Colors.textMuted },
                          ]}
                        >
                          {ROLE_LABEL[r]}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {m.role === 'admin' ? (
                    <View style={[styles.rolePill, styles.rolePillReadOnly]}>
                      <Text style={styles.rolePillText}>{ROLE_LABEL.admin}</Text>
                    </View>
                  ) : null}
                </View>

                {m.role === 'player' ? (
                  linkedPlayer ? (
                    <View style={styles.slotRow}>
                      <View style={styles.slotBadge}>
                        <Text style={styles.slotBadgeLabel}>SLOT</Text>
                        <Text style={styles.slotBadgeName} numberOfLines={1}>
                          {linkedPlayer.name}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleUnclaimSlot(m, linkedPlayer)}
                        disabled={isSaving}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.slotReleaseBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={styles.slotReleaseText}>Liberar</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.slotRow}>
                      <View style={[styles.slotBadge, styles.slotBadgeEmpty]}>
                        <Text style={styles.slotBadgeEmptyText}>
                          Sin slot reclamado
                        </Text>
                      </View>
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.invitesSection}>
        <View style={styles.invitesHeader}>
          <Text style={styles.invitesEyebrow}>INVITACIONES</Text>
          {generating ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
        </View>

        <View style={styles.inviteCtas}>
          <Pressable
            onPress={() => handleCreateInvitation('captain')}
            disabled={generating || !teamId}
            style={({ pressed }) => [
              styles.inviteBtn,
              styles.inviteBtnPrimary,
              (generating || !teamId) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <IconPlus size={14} color={Colors.accent} />
            <Text style={[styles.inviteBtnText, { color: Colors.accent }]}>
              Invitar capitán
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleCreateInvitation('player')}
            disabled={generating || !teamId}
            style={({ pressed }) => [
              styles.inviteBtn,
              (generating || !teamId) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <IconPlus size={14} color={Colors.textMuted} />
            <Text style={styles.inviteBtnText}>Invitar jugador</Text>
          </Pressable>
        </View>

        {invitations.length > 0 ? (
          <View style={{ gap: 6, marginTop: 10 }}>
            {invitations.map((inv) => {
              const active = InvitationsApi.isInvitationActive(inv);
              const role = inv.role as InvitationsApi.InvitableRole;
              const status = inv.used_at
                ? 'Usado'
                : new Date(inv.expires_at) < new Date()
                  ? 'Caducado'
                  : 'Pendiente';
              return (
                <View key={inv.id} style={styles.inviteRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.inviteCode,
                        !active && { color: Colors.textFaint },
                      ]}
                    >
                      {inv.code}
                    </Text>
                    <Text style={styles.inviteMeta} numberOfLines={1}>
                      {role === 'captain' ? 'Capitán' : 'Jugador'} · {status}
                    </Text>
                  </View>
                  {active ? (
                    <Pressable
                      onPress={() => handleShareCode(inv.code, role)}
                      hitSlop={6}
                      style={styles.inviteActionBtn}
                    >
                      <IconShare size={14} color={Colors.accent} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => handleRevokeInvitation(inv)}
                    hitSlop={6}
                    style={styles.inviteActionBtn}
                  >
                    <IconTrash size={14} color={Colors.err} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
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
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  loader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCard: {
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  memberCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  memberName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  memberEmail: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hair,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rolePillReadOnly: {
    opacity: 0.7,
  },
  rolePillText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.textMuted,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  slotBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent40,
    backgroundColor: Colors.accent10,
  },
  slotBadgeLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: Colors.accent,
  },
  slotBadgeName: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  slotBadgeEmpty: {
    borderColor: Colors.hair,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  slotBadgeEmptyText: {
    color: Colors.textFaint,
    fontSize: 11,
    fontStyle: 'italic',
  },
  slotReleaseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.hair,
    backgroundColor: Colors.bgCard,
  },
  slotReleaseText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.err,
  },
  invitesSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  invitesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  invitesEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '500',
  },
  inviteCtas: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  inviteBtnPrimary: {
    backgroundColor: Colors.accent10,
    borderColor: Colors.accent50,
  },
  inviteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  inviteCode: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inviteMeta: {
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  inviteActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
