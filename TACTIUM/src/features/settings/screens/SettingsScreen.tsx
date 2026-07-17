import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconBack, IconChevron, Toggle } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore, computeAvailableRoles, type ActiveRole } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import { PLAN_BY_TIER, PREMIUM_STATUSES } from '@core/subscriptions/plans';
import { supabase } from '@core/supabase/client';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import * as PlayersApi from '@core/services/players';
import * as ProfileApi from '@core/services/profile';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';
import { ClaimPlayerSheet } from '@features/onboarding/components/ClaimPlayerSheet';
import { InvitePlayersSheet } from '@features/team/components/InvitePlayersSheet';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import type { Database } from '@core/supabase/database.types';
import type { RootStackParamList } from '@navigation/types';

type TeamRole = Database['public']['Enums']['team_role'];

export const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user    = useAuthStore((s) => s.user);
  const userId  = useAuthStore((s) => s.user?.id ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const team    = useTeamStore((s) => s.team);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const players = useTeamStore((s) => s.players);
  const activeRole              = useTeamStore((s) => s.activeRole);
  const memberships             = useTeamStore((s) => s.memberships);
  const setActiveRoleOverride   = useTeamStore((s) => s.setActiveRoleOverride);
  const myPlayerId              = useTeamStore((s) => s.myPlayerId);
  const myPlayerTeamIds         = useTeamStore((s) => s.myPlayerTeamIds);
  const refreshMyPlayer         = useTeamStore((s) => s.refreshMyPlayer);
  const clubs                   = useClubStore((s) => s.clubs);

  const availableRoles = useMemo(
    () =>
      computeAvailableRoles(
        memberships,
        clubs.map((c) => c.id),
        myPlayerTeamIds,
      ),
    [memberships, clubs, myPlayerTeamIds],
  );

  const [role, setRole]                 = useState<TeamRole | null>(null);
  const [activeSeason, setActiveSeason] = useState<SeasonsApi.Season | null>(null);
  const [matchdays, setMatchdays]       = useState<MatchdaysApi.Matchday[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [redeemOpen, setRedeemOpen]     = useState(false);
  const [claimOpen, setClaimOpen]       = useState(false);
  const [inviteOpen, setInviteOpen]     = useState(false);
  // Reverse trial: invitar jugadores es premium → gate al paywall. Canjear /
  // vincularse con código (redeem) sigue siendo gratis (el jugador no paga).
  const gate = usePremiumGate();
  const openInvite = gate(() => setInviteOpen(true), 'invite_create');
  const [unlinking, setUnlinking]       = useState(false);
  const [deleting, setDeleting]         = useState(false);
  // Toggle de notificaciones push (profiles.notifications_enabled). El backend
  // YA lo respeta: send-push y el cron diario de recordatorios filtran por él.
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifLoaded, setNotifLoaded]   = useState(false);

  // Hidratamos el flag de notificaciones del profile una vez por ciclo de
  // focus. El state es la fuente de verdad.
  useFocusEffect(
    useCallback(() => {
      if (notifLoaded) return;
      let cancelled = false;
      (async () => {
        try {
          const p = await ProfileApi.fetchMyProfile();
          if (!cancelled) {
            setNotifEnabled(p?.notifications_enabled ?? true);
            setNotifLoaded(true);
          }
        } catch {
          if (!cancelled) setNotifLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [notifLoaded]),
  );

  const openExternalUrl = (url: string) => {
    Linking.openURL(url).catch(() =>
      toast.error('No se pudo abrir', 'Comprueba tu conexión.'),
    );
  };

  const isPlayer = activeRole === 'player';
  const myPlayer = useMemo(
    () => (myPlayerId ? players.find((p) => p.id === myPlayerId) ?? null : null),
    [myPlayerId, players],
  );

  // Toggle de notificaciones: update optimista + persistencia; revierte si
  // falla. El backend (send-push + cron) ya filtra por notifications_enabled.
  const handleToggleNotifications = useCallback((next: boolean) => {
    setNotifEnabled(next);
    ProfileApi.setNotificationsEnabled(next).catch(() => {
      setNotifEnabled(!next);
      toast.error('No se pudo guardar', 'Inténtalo de nuevo.');
    });
  }, []);

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

  // Carga de role + season + matchdays. Refetcha en CADA focus + cuando
  // cambian team o user.
  useFocusEffect(
    useCallback(() => {
      if (!team || !user) {
        setLoadingStats(false);
        return;
      }
      let cancelled = false;
      const load = async () => {
        setLoadingStats(true);
        try {
          const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', team.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (cancelled) return;
          setRole((memberData?.role as TeamRole) ?? null);

          const season = await SeasonsApi.fetchActiveSeason(team.id);
          if (cancelled) return;
          setActiveSeason(season);
          if (season) {
            const list = await MatchdaysApi.fetchMatchdays(season.id);
            if (cancelled) return;
            setMatchdays(list);
          } else {
            setMatchdays([]);
          }
        } catch (e) {
          console.warn('SettingsScreen load error', e);
        } finally {
          if (!cancelled) setLoadingStats(false);
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [team, user]),
  );

  const played  = matchdays.filter((m) => m.outcome !== null).length;
  const wins    = matchdays.filter((m) => m.outcome === 'win').length;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : null;

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const confirmDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      'Eliminar cuenta',
      'Esto borrará tu perfil, equipos, jornadas, alineaciones, resultados e invitaciones.\n\nESTA ACCIÓN ES IRREVERSIBLE.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '¿Seguro al 100%?',
              'No podremos recuperar tus datos. Si tienes una suscripción activa, seguirá activa: cancélala en App Store o Google Play para dejar de pagar.',
              [
                { text: 'Volver', style: 'cancel' },
                {
                  text: 'Sí, eliminar cuenta',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await ProfileApi.deleteMyAccount();
                      await signOut();
                    } catch (e: any) {
                      Alert.alert(
                        'No se puede eliminar',
                        e?.message ?? 'Inténtalo de nuevo.',
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const teamMeta = [team?.category, team?.league].filter(Boolean).join(' · ') || null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <IconBack size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.eyebrow}>AJUSTES</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Team (oculto en modo jugador suelto) */}
        {team ? (
          <>
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
          </>
        ) : null}

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

        {/* Suscripción · NO se muestra a los jugadores (rol player): para
            ellos la app es gratis, son participantes y no pagan ningún plan.
            También oculta para captains invitados por un club
            (team.club_id !== null): ese capitán está cubierto por la sub del
            club que lo invitó. */}
        {team && activeRole !== 'player' && !(activeRole === 'captain' && team.club_id) ? (
          <SubscriptionCard
            activeRole={activeRole}
            userId={userId}
            canBeClubAdmin={availableRoles.includes('club_admin')}
            onSwitchToClubMode={() => setActiveRoleOverride('club_admin')}
            onPressUser={() => navigation.navigate('Subscription')}
            onPressClub={() => navigation.navigate('ClubBilling')}
          />
        ) : null}

        {/* Invitaciones */}
        <Text style={styles.sectionLabel}>INVITACIONES</Text>
        <View style={styles.invitationsStack}>
          {/* Jugador suelto → gestor: vuelve a la elección inicial para
              crear su equipo o su club (sus amistosos se conservan). */}
          {!team ? (
            <Pressable
              onPress={() => {
                setSoloUpgrade(true);
                setSoloMode(false);
              }}
              style={({ pressed }) => [
                styles.redeemCard,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.redeemBadge}>
                <Text style={styles.redeemBadgeText}>+</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.redeemTitle}>Crear un equipo o club</Text>
                <Text style={styles.redeemHint} numberOfLines={1}>
                  Pasa a gestionar: plantilla, alineaciones y liga
                </Text>
              </View>
              <IconChevron size={14} color={Colors.textFaint} />
            </Pressable>
          ) : null}
          {activeRole === 'captain' && team ? (
            <Pressable
              onPress={openInvite}
              style={({ pressed }) => [
                styles.redeemCard,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.redeemBadge}>
                <Text style={styles.redeemBadgeText}>↗</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.redeemTitle}>Invitar jugadores</Text>
                <Text style={styles.redeemHint} numberOfLines={1}>
                  Genera códigos para que se unan a tu equipo
                </Text>
              </View>
              <IconChevron size={14} color={Colors.textFaint} />
            </Pressable>
          ) : null}
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
        </View>

        {/* Notificaciones */}
        <Text style={styles.sectionLabel}>NOTIFICACIONES</Text>
        <SettingsList
          items={[
            {
              label: 'Avisos del equipo',
              trailing: 'toggle',
              value: notifEnabled,
              onToggle: handleToggleNotifications,
              accessibilityLabel: 'Activar o desactivar las notificaciones del equipo',
            },
          ]}
        />
        <Text style={styles.notifHint}>
          Nueva jornada, alineación publicada y recordatorios para confirmar tu
          disponibilidad. Puedes desactivarlos cuando quieras.
        </Text>

        {/* Cuenta */}
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <SettingsList
          items={[
            {
              label: 'Mis estadísticas',
              onPress: () => navigation.navigate('MyStats'),
            },
            {
              label: 'Mis datos',
              onPress: () => navigation.navigate('MyData'),
            },
          ]}
        />

        <Text style={styles.sectionLabel}>SOPORTE</Text>
        <SettingsList
          items={[
            {
              label: 'Preguntas frecuentes',
              onPress: () => openExternalUrl('https://tactium.io/#faq'),
            },
            {
              label: 'Contactar con soporte',
              onPress: () =>
                openExternalUrl('mailto:hola@tactium.io?subject=Soporte%20TACTIUM'),
            },
            {
              label: 'Términos de uso',
              onPress: () =>
                openExternalUrl('https://tactium.io/legal/terminos'),
            },
            {
              label: 'Política de privacidad',
              onPress: () =>
                openExternalUrl('https://tactium.io/legal/privacidad'),
            },
            { label: 'Versión', detail: '1.0.2', trailing: 'static' },
          ]}
        />

        <Pressable
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.logoutLabel}>Cerrar sesión</Text>
        </Pressable>

        {/* ── ZONA DE PELIGRO · Eliminar cuenta ───────────────────────────
            Requisito Apple Guideline 5.1.1(v) y Google equivalente: si la
            app permite registro, DEBE permitir eliminar la cuenta desde la
            propia app. Doble confirmación para evitar accidentes. */}
        <Text style={styles.dangerLabel}>ZONA DE PELIGRO</Text>
        <Pressable
          onPress={confirmDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta"
          style={({ pressed }) => [
            styles.deleteAccount,
            pressed && !deleting && { opacity: 0.85 },
            deleting && { opacity: 0.5 },
          ]}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <Text style={styles.deleteAccountLabel}>Eliminar cuenta</Text>
          )}
        </Pressable>
        <Text style={styles.deleteAccountHint}>
          Borrarás tu perfil y todos tus datos. Si tienes una suscripción
          activa, recuerda cancelarla en App Store o Google Play para dejar
          de pagar.
        </Text>

        <Text style={styles.signature}>
          {'TACTIUM · ' + players.length + ' JUGADORES' + (activeSeason ? ' · ' + activeSeason.name.toUpperCase() : '')}
        </Text>
      </ScrollView>

      <RedeemInvitationSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />

      <InvitePlayersSheet
        open={inviteOpen}
        teamId={team?.id ?? null}
        teamName={team?.name ?? null}
        onClose={() => setInviteOpen(false)}
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

// ─── SubscriptionCard ──────────────────────────────────────────────────────
// Resume el estado de la suscripción del user + entry-point a la pantalla
// de gestión. Para club_admin lleva a `ClubBillingScreen`; para el resto a
// `SubscriptionScreen`. Si no hay sub activa, el copy invita a probar Pro.
const SubscriptionCard: React.FC<{
  activeRole: ActiveRole | null;
  userId: string | null;
  canBeClubAdmin: boolean;
  onSwitchToClubMode: () => void;
  onPressUser: () => void;
  onPressClub: () => void;
}> = ({
  activeRole,
  userId,
  canBeClubAdmin,
  onSwitchToClubMode,
  onPressUser,
  onPressClub,
}) => {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  // Sub activa propia o del club: mostramos lo más relevante.
  const activeSub = React.useMemo(() => {
    const candidates = subscriptions.filter((s) =>
      PREMIUM_STATUSES.includes(s.status),
    );
    // Preferimos sub de club si el user es club_admin.
    if (activeRole === 'club_admin') {
      return (
        candidates.find((s) => s.subject_type === 'club') ??
        candidates.find((s) => s.subject_type === 'user' && s.subject_id === userId) ??
        null
      );
    }
    return (
      candidates.find((s) => s.subject_type === 'user' && s.subject_id === userId) ??
      candidates.find((s) => s.subject_type === 'club') ??
      null
    );
  }, [subscriptions, activeRole, userId]);

  const plan = activeSub ? PLAN_BY_TIER[activeSub.plan_tier] : null;
  const isClubAdmin = activeRole === 'club_admin';
  // Caso especial: el usuario es club_admin a nivel de permisos pero está
  // operando en modo capitán. La gestión de suscripción del club vive en
  // Modo Club, así que en vez de abrir SubscriptionScreen le proponemos
  // cambiar de modo. Evita pagar dos planes.
  const isClubAdminInCaptainMode = canBeClubAdmin && activeRole === 'captain';
  const handlePress = () => {
    if (isClubAdminInCaptainMode) {
      Alert.alert(
        'Estás en modo capitán',
        'La suscripción del club se gestiona desde Modo Club. ¿Cambiamos de modo?',
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Cambiar a Modo Club',
            onPress: () => {
              onSwitchToClubMode();
            },
          },
        ],
      );
      return;
    }
    if (isClubAdmin) {
      onPressClub();
    } else {
      onPressUser();
    }
  };

  // Días restantes si la sub está en trial. `null` si no aplica.
  const trialDaysLeft = React.useMemo(() => {
    if (!activeSub || activeSub.status !== 'trialing') return null;
    const endIso = activeSub.trial_end ?? activeSub.current_period_end;
    if (!endIso) return null;
    const ms = new Date(endIso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [activeSub]);

  // Color del contador según urgencia: ≤3 días → warning amarillo,
  // resto → accent verde.
  const trialTint =
    trialDaysLeft != null && trialDaysLeft <= 3
      ? Colors.warning
      : Colors.accent;
  const trialBgTint =
    trialDaysLeft != null && trialDaysLeft <= 3
      ? 'rgba(242,201,76,0.12)'
      : Colors.accent10;
  const trialBorderTint =
    trialDaysLeft != null && trialDaysLeft <= 3
      ? 'rgba(242,201,76,0.45)'
      : Colors.accent40;

  return (
    <>
      <Text style={styles.sectionLabel}>SUSCRIPCIÓN</Text>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          activeSub
            ? `Plan ${plan?.displayName ?? ''}. Gestionar.`
            : 'Activar plan premium'
        }
        style={({ pressed }) => [
          styles.subCard,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View
          style={[
            styles.subBadge,
            activeSub && {
              backgroundColor: Colors.accent10,
              borderColor: Colors.accent40,
            },
          ]}
        >
          <Text
            style={[
              styles.subBadgeText,
              activeSub && { color: Colors.accent },
            ]}
          >
            {activeSub ? 'PRO' : 'FREE'}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subTitle}>
            {activeSub
              ? plan?.displayName ?? 'TACTIUM Pro'
              : isClubAdmin
                ? 'Suscribir el club'
                : 'Probar TACTIUM Pro'}
          </Text>
          <Text style={styles.subHint} numberOfLines={1}>
            {activeSub
              ? activeSub.status === 'trialing'
                ? trialDaysLeft === 0
                  ? 'Tu prueba termina hoy · Gestionar'
                  : trialDaysLeft === 1
                    ? 'Tu prueba termina mañana · Gestionar'
                    : `Te quedan ${trialDaysLeft} días de prueba · Gestionar`
                : activeSub.cancel_at_period_end
                  ? 'Termina pronto · Gestionar plan'
                  : 'Activa · Gestionar plan'
              : isClubAdmin
                ? 'Cubre a todos los capitanes del club'
                : 'Prueba 14 días · Sin compromiso'}
          </Text>
        </View>
        {trialDaysLeft != null ? (
          <View
            style={[
              styles.trialCounter,
              {
                backgroundColor: trialBgTint,
                borderColor: trialBorderTint,
              },
            ]}
          >
            <Text style={[styles.trialCounterNum, { color: trialTint }]}>
              {trialDaysLeft}
            </Text>
            <Text style={[styles.trialCounterUnit, { color: trialTint }]}>
              d
            </Text>
          </View>
        ) : null}
        <IconChevron size={14} color={Colors.textFaint} />
      </Pressable>
    </>
  );
};

interface SettingItem {
  label: string;
  detail?: string;
  trailing?: 'chevron' | 'static' | 'toggle' | 'soon';
  value?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const SettingsList: React.FC<{ items: SettingItem[] }> = ({ items }) => (
  <View style={styles.settingsList}>
    {items.map((it, i) => {
      const trailing = it.trailing ?? 'chevron';
      const interactive = trailing === 'chevron' && !!it.onPress;
      return (
        <Pressable
          key={it.label}
          disabled={!interactive}
          onPress={it.onPress}
          accessibilityRole={interactive ? 'button' : undefined}
          accessibilityLabel={it.accessibilityLabel ?? it.label}
          style={({ pressed }) => [
            styles.settingRow,
            i < items.length - 1 && styles.settingDivider,
            pressed && interactive && { opacity: 0.85 },
          ]}
        >
          <Text
            style={[
              styles.settingLabel,
              trailing === 'soon' && { color: Colors.textMuted },
            ]}
          >
            {it.label}
          </Text>
          {it.detail ? <Text style={styles.settingDetail}>{it.detail}</Text> : null}
          {trailing === 'chevron' ? (
            <IconChevron size={14} color={Colors.textFaint} />
          ) : trailing === 'toggle' ? (
            <Toggle
              size="sm"
              value={!!it.value}
              onChange={it.onToggle ?? (() => {})}
              accessibilityLabel={it.accessibilityLabel ?? it.label}
            />
          ) : trailing === 'soon' ? (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>PRONTO</Text>
            </View>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.accent, fontWeight: '500' },
  scroll:  { paddingHorizontal: 22, paddingTop: 8 },

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
  invitationsStack: {
    gap: 10,
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
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  subBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  subBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  subHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  trialCounter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 38,
    justifyContent: 'center',
  },
  trialCounterNum: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  trialCounterUnit: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 1,
    opacity: 0.85,
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
  soonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  soonBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  notifHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  logout:      { marginTop: 24, height: 52, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', alignItems: 'center', justifyContent: 'center' },
  logoutLabel: { color: Colors.error, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },

  dangerLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.error,
    fontWeight: '500',
    marginTop: 36,
    marginBottom: 10,
    opacity: 0.7,
  },
  deleteAccount: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountLabel: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  deleteAccountHint: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    lineHeight: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  signature:   { fontFamily: Fonts.mono, color: Colors.textFaint, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 20 },
});
