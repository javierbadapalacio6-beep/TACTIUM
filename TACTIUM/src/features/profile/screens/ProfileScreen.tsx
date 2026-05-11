import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconChevron, NeonDot, AmbientBackdrop } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore, computeAvailableRoles, type ActiveRole } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { supabase } from '@core/supabase/client';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import * as PlayersApi from '@core/services/players';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';
import { ClaimPlayerSheet } from '@features/onboarding/components/ClaimPlayerSheet';
import type { Database } from '@core/supabase/database.types';

type TeamRole = Database['public']['Enums']['team_role'];

const ROLE_LABEL: Record<TeamRole, string> = {
  captain: 'CAPITÁN',
  admin:   'ADMIN',
  player:  'JUGADOR',
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const team    = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const activeRole              = useTeamStore((s) => s.activeRole);
  const memberships             = useTeamStore((s) => s.memberships);
  const setActiveRoleOverride   = useTeamStore((s) => s.setActiveRoleOverride);
  const myPlayerId              = useTeamStore((s) => s.myPlayerId);
  const refreshMyPlayer         = useTeamStore((s) => s.refreshMyPlayer);
  const clubs                   = useClubStore((s) => s.clubs);

  const availableRoles = useMemo(
    () => computeAvailableRoles(memberships, clubs.map((c) => c.id)),
    [memberships, clubs],
  );

  const [role, setRole]                 = useState<TeamRole | null>(null);
  const [activeSeason, setActiveSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays]       = useState<MatchdaysApi.Matchday[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [redeemOpen, setRedeemOpen]     = useState(false);
  const [claimOpen, setClaimOpen]       = useState(false);
  const [unlinking, setUnlinking]       = useState(false);

  const isPlayer = activeRole === 'player';
  const myPlayer = useMemo(
    () => (myPlayerId ? players.find((p) => p.id === myPlayerId) ?? null : null),
    [myPlayerId, players],
  );

  const handleUnlink = () => {
    if (!myPlayerId || unlinking) return;
    Alert.alert(
      'Desvincular jugador',
      `Vas a soltar la vinculación con "${myPlayer?.name ?? ''}". Después podrás elegir otro jugador de la plantilla.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await PlayersApi.unclaimPlayer(myPlayerId);
              await refreshMyPlayer();
              setClaimOpen(true);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Inténtalo de nuevo.');
            } finally {
              setUnlinking(false);
            }
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (!team || !user) return;
    const load = async () => {
      setLoadingStats(true);
      try {
        const { data: memberData } = await supabase
          .from('team_members')
          .select('role')
          .eq('team_id', team.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setRole((memberData?.role as TeamRole) ?? null);

        const season = await SeasonsApi.fetchActiveSeason(team.id);
        setActiveSeason(season);
        if (season) {
          const list = await MatchdaysApi.fetchMatchdays(season.id);
          setMatchdays(list);
        } else {
          setMatchdays([]);
        }
      } catch (e) {
        console.warn('ProfileScreen load error', e);
      } finally {
        setLoadingStats(false);
      }
    };
    load();
  }, [team, user]);

  const played  = matchdays.filter((m) => m.outcome !== null).length;
  const wins    = matchdays.filter((m) => m.outcome === 'win').length;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null;

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Capitán';

  const initials = displayName
    .split(' ')
    .map((p: string) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const teamMeta = [team?.category, team?.league].filter(Boolean).join(' · ') || null;

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.5} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>PERFIL</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 22 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarBlock}>
          <LinearGradient
            colors={[Colors.primary, Colors.bgCard2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email ?? '—'}</Text>
          {role ? (
            <View style={styles.rolePill}>
              <NeonDot size={5} />
              <Text style={styles.rolePillText}>{ROLE_LABEL[role]}</Text>
            </View>
          ) : null}
        </View>

        {/* Team */}
        <Text style={styles.sectionLabel}>EQUIPO ACTUAL</Text>
        <View style={styles.teamCard}>
          <TactiumMark size={42} gradient />
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team?.name ?? '—'}</Text>
            <Text style={styles.teamMeta} numberOfLines={1}>
              {[teamMeta, activeSeason?.name].filter(Boolean).join(' · ') || 'Sin temporada activa'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        {loadingStats ? (
          <View style={styles.statsLoading}>
            <ActivityIndicator color={Colors.accent} size="small" />
          </View>
        ) : activeSeason ? (
          <View style={styles.statsGrid}>
            <ProfileStat label="Jornadas" value={`${played}/${matchdays.length}`} />
            <ProfileStat label="Victorias" value={String(wins)} highlight />
            <ProfileStat label="Tasa V"    value={winRate !== null ? `${winRate}%` : '—'} />
          </View>
        ) : (
          <View style={styles.noSeasonBox}>
            <Text style={styles.noSeasonText}>Sin temporada activa</Text>
          </View>
        )}

        {/* Mi jugador (solo en rol player) */}
        {isPlayer ? (
          <>
            <Text style={styles.sectionLabel}>MI JUGADOR</Text>
            {myPlayer ? (
              <View style={styles.myPlayerCard}>
                <View style={styles.myPlayerAvatar}>
                  <Text style={styles.myPlayerAvatarText}>
                    {myPlayer.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.myPlayerName} numberOfLines={1}>
                    {myPlayer.name}
                  </Text>
                  <Text style={styles.myPlayerMeta} numberOfLines={1}>
                    {myPlayer.position} · {myPlayer.pts} pts
                  </Text>
                </View>
                <Pressable
                  onPress={handleUnlink}
                  disabled={unlinking}
                  style={({ pressed }) => [
                    styles.myPlayerBtn,
                    pressed && { opacity: 0.85 },
                    unlinking && { opacity: 0.5 },
                  ]}
                >
                  {unlinking ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Text style={styles.myPlayerBtnLabel}>Cambiar</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setClaimOpen(true)}
                style={({ pressed }) => [
                  styles.claimCard,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.redeemBadge}>
                  <Text style={styles.redeemBadgeText}>+</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.redeemTitle}>Vincúlate a un jugador</Text>
                  <Text style={styles.redeemHint} numberOfLines={1}>
                    Elige tu nombre en la plantilla
                  </Text>
                </View>
                <IconChevron size={14} color={Colors.textFaint} />
              </Pressable>
            )}
          </>
        ) : null}

        {/* Modo (selector de rol) — solo si el usuario tiene varios disponibles */}
        {availableRoles.length > 1 ? (
          <>
            <Text style={styles.sectionLabel}>MODO</Text>
            <View style={styles.modeRow}>
              {(['club_admin', 'captain', 'player'] as const).map((r) => {
                const enabled = availableRoles.includes(r);
                if (!enabled) return null;
                const sel = activeRole === r;
                const label =
                  r === 'club_admin' ? 'Club' :
                  r === 'captain'    ? 'Capitán' : 'Jugador';
                return (
                  <Pressable
                    key={r}
                    onPress={() => setActiveRoleOverride(r as ActiveRole)}
                    style={[
                      styles.modePill,
                      sel && {
                        backgroundColor: Colors.accent10,
                        borderColor: Colors.accent50,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modePillText,
                        { color: sel ? Colors.accent : Colors.textMuted },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.modeHint}>
              Cambia entre los modos disponibles. La interfaz se adaptará al
              rol que elijas.
            </Text>
          </>
        ) : null}

        {/* Invitaciones */}
        <Text style={styles.sectionLabel}>INVITACIONES</Text>
        <Pressable
          onPress={() => setRedeemOpen(true)}
          style={({ pressed }) => [
            styles.redeemCard,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.redeemBadge}>
            <Text style={styles.redeemBadgeText}>+</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.redeemTitle}>Unirme con código</Text>
            <Text style={styles.redeemHint} numberOfLines={1}>
              Si te han invitado a otro equipo
            </Text>
          </View>
          <IconChevron size={14} color={Colors.textFaint} />
        </Pressable>

        {/* Cuenta */}
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <SettingsList
          items={[
            { label: 'Notificaciones', detail: 'Activadas' },
            { label: 'Apariencia',     detail: 'Oscuro' },
            { label: 'Idioma',         detail: 'Español' },
            { label: 'Privacidad',     detail: '' },
          ]}
        />

        <Text style={styles.sectionLabel}>SOPORTE</Text>
        <SettingsList
          items={[
            { label: 'Centro de ayuda',       detail: '' },
            { label: 'Términos y privacidad', detail: '' },
            { label: 'Versión',               detail: '1.0.0', noChevron: true },
          ]}
        />

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.logoutLabel}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.signature}>
          {'TACTIUM · ' + players.length + ' JUGADORES' + (activeSeason ? ' · ' + activeSeason.name.toUpperCase() : '')}
        </Text>
      </ScrollView>

      <RedeemInvitationSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />

      <ClaimPlayerSheet
        open={claimOpen}
        teamId={team?.id ?? null}
        teamName={team?.name ?? null}
        onClose={() => setClaimOpen(false)}
      />
    </View>
  );
};

const ProfileStat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, highlight && { color: Colors.accent }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

interface SettingItem { label: string; detail?: string; noChevron?: boolean; }

const SettingsList: React.FC<{ items: SettingItem[] }> = ({ items }) => (
  <View style={styles.settingsList}>
    {items.map((it, i) => (
      <Pressable
        key={it.label}
        disabled={it.noChevron}
        style={({ pressed }) => [
          styles.settingRow,
          i < items.length - 1 && styles.settingDivider,
          pressed && !it.noChevron && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.settingLabel}>{it.label}</Text>
        {it.detail ? <Text style={styles.settingDetail}>{it.detail}</Text> : null}
        {!it.noChevron ? <IconChevron size={14} color={Colors.textFaint} /> : null}
      </Pressable>
    ))}
  </View>
);

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.accent, fontWeight: '500' },
  scroll:  { paddingHorizontal: 22, paddingTop: 18 },

  avatarBlock: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.accent40,
    shadowColor: Colors.accent, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
    marginBottom: 14,
  },
  avatarText:   { color: Colors.accent, fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  name:         { color: Colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  email:        { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  rolePill:     { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: Colors.accent15 },
  rolePillText: { fontFamily: Fonts.mono, color: Colors.accent, fontSize: 11, letterSpacing: 1, fontWeight: '600' },

  sectionLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.textFaint, fontWeight: '500', marginTop: 18, marginBottom: 10 },

  teamCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.hair },
  teamName:  { color: Colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  teamMeta:  { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  statsGrid:    { flexDirection: 'row', gap: 8, marginTop: 12 },
  statsLoading: { marginTop: 12, height: 70, alignItems: 'center', justifyContent: 'center' },
  noSeasonBox:  { marginTop: 12, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.hair },
  noSeasonText: { color: Colors.textMuted, fontSize: 13 },
  statBox:      { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.hair, alignItems: 'center' },
  statValue:    { fontFamily: Fonts.mono, fontSize: 18, fontWeight: '700', color: Colors.text },
  statLabel:    { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textFaint, letterSpacing: 1.5, marginTop: 6, textTransform: 'uppercase' },

  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  modeHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 8,
    lineHeight: 16,
  },
  redeemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent50,
  },
  claimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent50,
  },
  myPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  myPlayerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlayerAvatarText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  myPlayerName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  myPlayerMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  myPlayerBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlayerBtnLabel: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  redeemBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBadgeText: {
    color: Colors.accent,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  redeemTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  redeemHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  settingsList:   { backgroundColor: Colors.bgCard, borderRadius: 16, borderWidth: 1, borderColor: Colors.hair, overflow: 'hidden' },
  settingRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  settingDivider: { borderBottomWidth: 1, borderColor: Colors.hair },
  settingLabel:   { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  settingDetail:  { color: Colors.textMuted, fontSize: 13, marginRight: 8 },

  logout:      { marginTop: 24, height: 52, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', alignItems: 'center', justifyContent: 'center' },
  logoutLabel: { color: Colors.error, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  signature:   { fontFamily: Fonts.mono, color: Colors.textFaint, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 20 },
});
