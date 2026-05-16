import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconChevron, NeonDot, Toggle } from '@components/ui';
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
import type { Database } from '@core/supabase/database.types';
import type { RootStackParamList } from '@navigation/types';

type TeamRole = Database['public']['Enums']['team_role'];

const ROLE_LABEL: Record<TeamRole, string> = {
  captain: 'CAPITÁN',
  admin:   'ADMIN',
  player:  'JUGADOR',
};

export const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user    = useAuthStore((s) => s.user);
  const userId  = useAuthStore((s) => s.user?.id ?? null);
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
  // Notificaciones: state local sincronizado con profiles.notifications_enabled.
  // Optimistic on toggle, revert on error.
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null);
  const [notifSaving, setNotifSaving]   = useState(false);

  // Hidratamos el flag desde DB al montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await ProfileApi.fetchMyProfile();
        if (!cancelled) setNotifEnabled(p?.notifications_enabled ?? true);
      } catch {
        if (!cancelled) setNotifEnabled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNotifications = async (next: boolean) => {
    if (notifSaving) return;
    setNotifEnabled(next); // optimistic
    setNotifSaving(true);
    try {
      await ProfileApi.setNotificationsEnabled(next);
    } catch (e: any) {
      setNotifEnabled(!next); // revert
      toast.error(
        'No se pudo guardar',
        e?.message ?? 'Inténtalo de nuevo.',
      );
    } finally {
      setNotifSaving(false);
    }
  };

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

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco
  // desde otra pantalla (tab o stack nested).
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didMountRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        didMountRef.current = true;
      }
    }, []),
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
      {/* No usamos AmbientBackdrop aquí: combinado con bottom-tabs lazy mount
          + custom FloatingTabBar dejaba el SVG <RadialGradient> visible pero
          el resto de la pantalla mid-mount al primer focus del tab (bug
          reportado 2026-05-16). El fondo plano Colors.background (verde
          oscuro de marca) es suficiente: el avatar gradient, las cards y
          los badges ya aportan profundidad visual. */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>PERFIL</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          // Reserva el alto del tab bar flotante (~64) + offset (12) + colchón (32)
          // para que el último item no quede pegado al pill cristal.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
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

        {/* Suscripción */}
        <SubscriptionCard
          activeRole={activeRole}
          userId={userId}
          onPressUser={() => navigation.navigate('Subscription')}
          onPressClub={() => navigation.navigate('ClubBilling')}
        />

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
            {
              label: 'Notificaciones',
              trailing: 'toggle',
              value: notifEnabled ?? true,
              onToggle: handleToggleNotifications,
              accessibilityLabel: 'Activar o desactivar notificaciones push',
            },
            { label: 'Apariencia', detail: 'Oscuro', trailing: 'soon' },
            { label: 'Idioma', detail: 'Español', trailing: 'soon' },
            { label: 'Privacidad', trailing: 'soon' },
          ]}
        />

        <Text style={styles.sectionLabel}>SOPORTE</Text>
        <SettingsList
          items={[
            {
              label: 'Centro de ayuda',
              onPress: () => openExternalUrl('https://tactium.io/help'),
            },
            {
              label: 'Términos y privacidad',
              onPress: () => openExternalUrl('https://tactium.io/legal'),
            },
            { label: 'Versión', detail: '1.0.0', trailing: 'static' },
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

// ─── SubscriptionCard ──────────────────────────────────────────────────────
// Resume el estado de la suscripción del user + entry-point a la pantalla
// de gestión. Para club_admin lleva a `ClubBillingScreen`; para el resto a
// `SubscriptionScreen`. Si no hay sub activa, el copy invita a probar Pro.
const SubscriptionCard: React.FC<{
  activeRole: ActiveRole | null;
  userId: string | null;
  onPressUser: () => void;
  onPressClub: () => void;
}> = ({ activeRole, userId, onPressUser, onPressClub }) => {
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
  const onPress = isClubAdmin ? onPressClub : onPressUser;

  // Días restantes si la sub está en trial. `null` si no aplica.
  // Usamos `trial_end` cuando exista, si no caemos a `current_period_end`
  // (en trial RC ambos suelen coincidir).
  const trialDaysLeft = React.useMemo(() => {
    if (!activeSub || activeSub.status !== 'trialing') return null;
    const endIso = activeSub.trial_end ?? activeSub.current_period_end;
    if (!endIso) return null;
    const ms = new Date(endIso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [activeSub]);

  // Color del contador según urgencia: ≤3 días → warning amarillo,
  // resto → accent verde. Da una pista visual sin frenar al usuario.
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
        onPress={onPress}
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
        {/* Pill con el contador de días de trial. Se pinta antes del chevron
            cuando hay trial activo, para que el usuario lo vea de un vistazo
            desde Perfil sin tener que entrar a Suscripción. */}
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
  // Render del lado derecho: por defecto chevron (navegable); 'static'
  // sin chevron (sólo lectura, ej. versión); 'toggle' switch reactivo;
  // 'soon' badge "PRONTO" para placeholders aún no funcionales.
  trailing?: 'chevron' | 'static' | 'toggle' | 'soon';
  // Estado del toggle (sólo si trailing='toggle')
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

  logout:      { marginTop: 24, height: 52, borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,107,107,0.4)', alignItems: 'center', justifyContent: 'center' },
  logoutLabel: { color: Colors.error, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  signature:   { fontFamily: Fonts.mono, color: Colors.textFaint, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 20 },
});
