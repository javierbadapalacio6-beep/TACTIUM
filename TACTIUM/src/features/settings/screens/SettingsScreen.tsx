import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@core/theme/useColors';
import type { Palette } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  BottomSheet,
  IconBack,
  IconChevron,
  IconCheck,
  IconLink,
  IconMail,
  IconFile,
  IconPlus,
  IconTeam,
  IconUser,
  IconBell,
  IconTicket,
  Toggle,
} from '@components/ui';
import { SegmentedControl } from '@components/ui/SegmentedControl';
import { useAuthStore } from '@store/authStore';
import { useTeamStore, computeAvailableRoles, type ActiveRole } from '@store/teamStore';
import { useClubStore } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import { useThemeStore } from '@store/themeStore';
import { PLAN_BY_TIER, isLiveSub } from '@core/subscriptions/plans';
import { displayNameOf } from '@core/utils/format';
import * as PlayersApi from '@core/services/players';
import * as ProfileApi from '@core/services/profile';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';
import { ClaimPlayerSheet } from '@features/onboarding/components/ClaimPlayerSheet';
import { InvitePlayersSheet } from '@features/team/components/InvitePlayersSheet';
import { EditProfileSheet } from '@features/profile/components/EditProfileSheet';
import { CommunityAvatar } from '@features/social/components/social-ui';
import { lightTap } from '@features/profile/components/CodeRedeemCard';
import { useTeamPro } from '@features/settings/useTeamPro';
import type { RootStackParamList } from '@navigation/types';
import { SplitView, useIsSplit } from '@components/layout';
import { SubscriptionScreen } from '@features/subscription/screens/SubscriptionScreen';

/** Sección abierta a la derecha en tablet (lista + detalle). */
type SettingsSection = 'subscription' | 'help';

/** Número de build REAL del binario. `Constants.nativeBuildVersion` está
 *  obsoleto y llega vacío (en Android siempre; en iOS bajo una OTA también).
 *  La fuente buena es `expo-application`, con require + try/catch para que,
 *  si el módulo nativo no estuviera enlazado, la pantalla no se caiga. */
function buildNumber(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const App = require('expo-application') as { nativeBuildVersion?: string | null };
    if (App?.nativeBuildVersion) return String(App.nativeBuildVersion);
  } catch {
    /* módulo no disponible */
  }
  const native = Constants.nativeBuildVersion;
  return native ? String(native) : '?';
}

/** Qué bundle corre: el embebido o una OTA (id corto + fecha). Solo soporte. */
function otaLabel(): string {
  if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'sin OTA';
  const date = Updates.createdAt
    ? ` ${Updates.createdAt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`
    : '';
  return `OTA ${Updates.updateId.slice(-6)}${date}`;
}

const ROLE_LABEL: Record<string, string> = {
  club_admin: 'Club',
  captain: 'Capitán',
  player: 'Jugador',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ajustes en 5 grupos: tu tarjeta arriba (con «Editar»), el plan, y luego
 * Tu equipo · Preferencias · Cuenta y ayuda · Salir. Fuera las estadísticas
 * repetidas del equipo, «Explorar torneos» (está en Competir) y la firma.
 */
export const SettingsScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const team = useTeamStore((s) => s.team);
  const teams = useTeamStore((s) => s.teams);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const players = useTeamStore((s) => s.players);
  const activeRole = useTeamStore((s) => s.activeRole);
  const memberships = useTeamStore((s) => s.memberships);
  const setActiveRoleOverride = useTeamStore((s) => s.setActiveRoleOverride);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const myPlayerTeamIds = useTeamStore((s) => s.myPlayerTeamIds);
  const refreshMyPlayer = useTeamStore((s) => s.refreshMyPlayer);
  const clubs = useClubStore((s) => s.clubs);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const availableRoles = useMemo(
    () => computeAvailableRoles(memberships, clubs.map((cl) => cl.id), myPlayerTeamIds),
    [memberships, clubs, myPlayerTeamIds],
  );

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<ProfileApi.Profile | null>(null);
  // Interruptor de avisos (profiles.notifications_enabled). El backend YA lo
  // respeta: send-push y el cron de recordatorios filtran por él.
  const [notifEnabled, setNotifEnabled] = useState(true);
  // La versión con la OTA se ve con 5 toques (para soporte).
  const [showOta, setShowOta] = useState(false);
  const taps = useRef(0);
  // TABLET: como los Ajustes del iPad. La lista a la izquierda y la sección
  // elegida a la derecha, sin tapar la lista. En móvil se navega como siempre.
  const split = useIsSplit();
  const [section, setSection] = useState<SettingsSection | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const p = await ProfileApi.fetchMyProfile();
      setProfile(p);
      setNotifEnabled(p?.notifications_enabled ?? true);
    } catch {
      /* se queda con lo que había */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const openExternalUrl = (url: string) => {
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir', 'Comprueba tu conexión.'));
  };

  const isPlayer = activeRole === 'player';
  const isCaptain = activeRole === 'captain';
  const myPlayer = useMemo(
    () => (myPlayerId ? players.find((p) => p.id === myPlayerId) ?? null : null),
    [myPlayerId, players],
  );
  const teamPro = useTeamPro(team, isPlayer);

  // Optimista + persistencia; revierte si falla.
  const handleToggleNotifications = useCallback((next: boolean) => {
    setNotifEnabled(next);
    lightTap();
    ProfileApi.setNotificationsEnabled(next).catch(() => {
      setNotifEnabled(!next);
      toast.error('No se pudo guardar', 'Inténtalo de nuevo.');
    });
  }, []);

  const handleUnlink = () => {
    if (!myPlayerId || unlinking) return;
    Alert.alert(
      'Cambiar de ficha',
      `Vas a soltar «${myPlayer?.name ?? ''}». Después podrás elegir otra ficha de la plantilla.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Soltar y elegir otra',
          style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await PlayersApi.unclaimPlayer(myPlayerId);
              await refreshMyPlayer();
              setClaimOpen(true);
            } catch {
              Alert.alert('No se pudo cambiar', 'Inténtalo de nuevo en unos segundos.');
            } finally {
              setUnlinking(false);
            }
          },
        },
      ],
    );
  };

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await ProfileApi.deleteMyAccount();
      setDeleteOpen(false);
      await signOut();
    } catch {
      Alert.alert(
        'No se ha podido eliminar',
        'Tu cuenta sigue activa. Inténtalo de nuevo o escríbenos a hola@tactium.io.',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Qué se pierde al borrar la cuenta (según el rol) ────────────────────
  const ownedTeams = teams.filter((t) => t.owner_id === userId && !t.club_id);
  const storeSub = subscriptions.find(
    (s) =>
      s.payer_user_id === userId &&
      isLiveSub(s) &&
      (s.platform === 'ios' || s.platform === 'android') &&
      !(s.product_id ?? '').startsWith('trial_'),
  );
  const deleteItems: string[] = [
    'Tu perfil, tu foto y tus amistosos',
    ...clubs.map((cl) => `${cl.name}, con sus equipos`),
    ...ownedTeams.map((t) => `${t.name}, con sus jornadas y alineaciones`),
    'Tus invitaciones pendientes',
  ];

  // ── Tarjeta de la persona ───────────────────────────────────────────────
  const displayName = profile?.full_name?.trim() || displayNameOf(user);
  const roleLabel = activeRole ? ROLE_LABEL[activeRole] : null;
  // `username` vive en profiles pero no está en los tipos generados; se
  // espeja en user_metadata (fuente síncrona de toda la app).
  const uname =
    ((profile as { username?: string | null } | null)?.username ??
      ((user?.user_metadata ?? {}) as { username?: string }).username ??
      '').trim();
  const handle = uname ? `@${uname}` : null;
  const meLine =
    [handle, roleLabel ? (team ? `${roleLabel} de ${team.name}` : roleLabel) : null]
      .filter(Boolean)
      .join(' · ') || 'Tu cuenta';

  // Qué se abre a la derecha si aún no se ha elegido nada: «Mi suscripción»
  // cuando hay tarjeta de plan; si no, la ayuda.
  const hasPlanCard = !!team && (isPlayer || !(isCaptain && team.club_id));
  const openSection: SettingsSection = section ?? (hasPlanCard ? 'subscription' : 'help');
  const goSubscription = () =>
    split ? setSection('subscription') : navigation.navigate('Subscription');
  const openHelp = () => (split ? setSection('help') : setHelpOpen(true));

  const version = `TACTIUM ${Constants.expoConfig?.version ?? ''} (${buildNumber()})${
    showOta ? ` · ${otaLabel()}` : ''
  }`;
  const onVersionTap = () => {
    taps.current += 1;
    if (taps.current >= 5) {
      taps.current = 0;
      setShowOta((v) => !v);
    }
  };

  const listBody = (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <Text style={styles.eyebrow}>AJUSTES</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 64 + 12 + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tú arriba */}
        <View style={styles.meCard}>
          <CommunityAvatar name={displayName} avatarUrl={profile?.avatar_url ?? null} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.meName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.meSub} numberOfLines={1}>
              {meLine}
            </Text>
          </View>
          <Pressable
            onPress={() => setEditOpen(true)}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
          >
            <Text style={styles.pillText}>Editar</Text>
          </Pressable>
        </View>

        {/* El plan debajo */}
        {isPlayer && team ? (
          <Pressable
            onPress={goSubscription}
            style={({ pressed }) => [
              styles.planCard,
              styles.planCardCov,
              split && openSection === 'subscription' && styles.planCardSel,
              pressed && { opacity: 0.88 },
            ]}
            accessibilityRole="button"
          >
            <View style={styles.planDays}>
              <IconCheck size={16} color={c.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.planTitle}>
                {teamPro === false ? `${team.name} está en el plan gratis` : 'Te cubre tu equipo'}
              </Text>
              <Text style={styles.planSub} numberOfLines={1}>
                {teamPro === false
                  ? 'Lo activa tu capitán. Tú no pagas nada.'
                  : `${team.name} tiene Pro. No pagas nada.`}
              </Text>
            </View>
            <IconChevron size={14} color={c.textFaint} />
          </Pressable>
        ) : team && !isPlayer && !(isCaptain && team.club_id) ? (
          <PlanCard
            activeRole={activeRole}
            userId={userId}
            canBeClubAdmin={availableRoles.includes('club_admin')}
            onSwitchToClubMode={() => setActiveRoleOverride('club_admin')}
            onPressUser={goSubscription}
            selected={split && openSection === 'subscription'}
            onPressClub={() => navigation.navigate('ClubBilling')}
          />
        ) : null}

        {/* ── TU EQUIPO ── */}
        <Text style={styles.groupLabel}>TU EQUIPO</Text>
        <Group>
          {!team ? (
            <Row
              icon={<IconPlus size={14} color={c.accent} />}
              accent
              title="Crear un equipo o club"
              sub="Plantilla, alineaciones y liga"
              onPress={() => {
                setSoloUpgrade(true);
                setSoloMode(false);
              }}
            />
          ) : null}
          {isCaptain && team ? (
            <Row
              icon={<IconLink size={14} color={c.accent} />}
              accent
              title="Invitar jugadores"
              sub={`Enlace para ${team.name}`}
              onPress={() => setInviteOpen(true)}
            />
          ) : null}
          {isPlayer && team ? (
            myPlayer ? (
              <Row
                icon={<CommunityAvatar name={myPlayer.name} size={24} />}
                title={`Tu ficha: ${myPlayer.name}`}
                sub={[
                  myPlayer.position,
                  myPlayer.pts != null ? `${myPlayer.pts} puntos de la federación` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  unlinking ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : (
                    <Text style={styles.rowAction}>Cambiar</Text>
                  )
                }
                onPress={handleUnlink}
              />
            ) : (
              <Row
                icon={<IconUser size={14} color={c.accent} />}
                accent
                title="Elige tu ficha"
                sub="Tu nombre en la plantilla"
                onPress={() => setClaimOpen(true)}
              />
            )
          ) : null}
          <Row
            icon={<IconTicket size={14} color={c.textMuted} />}
            title="Unirme con código"
            sub="Si te invitan a otro equipo"
            onPress={() => setRedeemOpen(true)}
          />
          {availableRoles.length > 1 ? (
            <View style={[styles.row, styles.rowStack]}>
              <Text style={styles.rowTitle}>Ver como</Text>
              <SegmentedControl<'club_admin' | 'captain' | 'player'>
                options={(['club_admin', 'captain', 'player'] as const)
                  .filter((r) => availableRoles.includes(r))
                  .map((r) => ({ key: r, label: ROLE_LABEL[r] }))}
                value={activeRole ?? 'player'}
                onChange={(r) => {
                  lightTap();
                  setActiveRoleOverride(r);
                }}
              />
            </View>
          ) : null}
        </Group>

        {/* ── PREFERENCIAS ── */}
        <Text style={styles.groupLabel}>PREFERENCIAS</Text>
        <Group>
          <Row
            icon={<IconBell size={14} color={c.textMuted} />}
            title="Avisos del equipo"
            sub="Convocatoria, alineación y recordatorios"
            right={
              <Toggle
                size="sm"
                value={notifEnabled}
                onChange={handleToggleNotifications}
                accessibilityLabel="Activar o desactivar los avisos del equipo"
              />
            }
          />
          <View style={[styles.row, styles.rowStack]}>
            <Text style={styles.rowTitle}>Apariencia</Text>
            <SegmentedControl<'light' | 'dark' | 'system'>
              options={[
                { key: 'light', label: 'Claro' },
                { key: 'dark', label: 'Oscuro' },
                { key: 'system', label: 'Auto' },
              ]}
              value={themeMode}
              onChange={(m) => {
                lightTap();
                setThemeMode(m);
              }}
            />
            <Text style={styles.rowHint}>«Auto» sigue el modo claro u oscuro de tu móvil.</Text>
          </View>
        </Group>

        {/* ── CUENTA Y AYUDA ── */}
        <Text style={styles.groupLabel}>CUENTA Y AYUDA</Text>
        <Group>
          <Row
            icon={<IconFile size={14} color={c.textMuted} />}
            title="Mis datos"
            onPress={() => navigation.navigate('MyData')}
          />
          <Row
            icon={<IconMail size={14} color={c.textMuted} />}
            title="Ayuda y contacto"
            sub="Preguntas, soporte, términos y privacidad"
            onPress={openHelp}
          />
        </Group>

        {/* ── Salir ── */}
        <Group style={{ marginTop: 18 }}>
          <Row title="Cerrar sesión" onPress={confirmLogout} chevron={false} />
          <Row
            title="Eliminar cuenta"
            danger
            chevron={false}
            onPress={() => setDeleteOpen(true)}
          />
        </Group>

        <Pressable onPress={onVersionTap} accessibilityRole="text" style={{ marginTop: 18 }}>
          <Text style={styles.version}>{version}</Text>
        </Pressable>
      </ScrollView>
    </>
  );

  const helpRows = (
    <Group style={{ marginTop: 12 }}>
      <Row title="Preguntas frecuentes" onPress={() => openExternalUrl('https://tactium.io/#faq')} />
      <Row
        title="Escribir a soporte"
        sub="hola@tactium.io"
        onPress={() => openExternalUrl('mailto:hola@tactium.io?subject=Soporte%20TACTIUM')}
      />
      <Row title="Términos de uso" onPress={() => openExternalUrl('https://tactium.io/legal/terminos')} />
      <Row
        title="Política de privacidad"
        onPress={() => openExternalUrl('https://tactium.io/legal/privacidad')}
      />
    </Group>
  );

  return (
    <View style={styles.root}>
      {split ? (
        <SplitView
          list={<View style={{ flex: 1 }}>{listBody}</View>}
          detail={
            openSection === 'subscription' ? (
              <SubscriptionScreen embedded />
            ) : (
              <ScrollView
                contentContainerStyle={[
                  styles.scroll,
                  { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
                ]}
              >
                <Text style={styles.sheetEyebrow}>AYUDA Y CONTACTO</Text>
                {helpRows}
              </ScrollView>
            )
          }
        />
      ) : (
        listBody
      )}

      {/* Ayuda y contacto */}
      <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)}>
        <Text style={styles.sheetEyebrow}>AYUDA Y CONTACTO</Text>
        {helpRows}
      </BottomSheet>

      {/* Eliminar cuenta: una hoja que explica qué se pierde. Requisito Apple
          5.1.1(v): si la app permite registro, debe permitir borrar la cuenta. */}
      <BottomSheet
        open={deleteOpen}
        onClose={() => (deleting ? undefined : setDeleteOpen(false))}
        footer={
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={doDelete}
              disabled={deleting}
              style={({ pressed }) => [
                styles.dangerBtn,
                pressed && !deleting && { opacity: 0.88 },
                deleting && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Eliminar mi cuenta"
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#2a0905" />
              ) : (
                <Text style={styles.dangerBtnLabel}>Eliminar mi cuenta</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setDeleteOpen(false)}
              disabled={deleting}
              style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={styles.ghostBtnLabel}>Volver</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.sheetTitle}>¿Eliminar tu cuenta?</Text>
        <Text style={styles.sheetLede}>Se borra para siempre y no se puede deshacer:</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {deleteItems.map((it) => (
            <View key={it} style={styles.lossRow}>
              <Text style={styles.lossBullet}>✕</Text>
              <Text style={styles.lossText}>{it}</Text>
            </View>
          ))}
        </View>
        {storeSub ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Tu suscripción no se cancela sola</Text>
            <Text style={styles.warnText}>
              La pagas en {storeSub.platform === 'ios' ? 'App Store' : 'Google Play'}:
              cancélala allí. Borrar la cuenta no la cancela.
            </Text>
            <Pressable
              onPress={() =>
                openExternalUrl(
                  Platform.OS === 'ios'
                    ? 'https://apps.apple.com/account/subscriptions'
                    : 'https://play.google.com/store/account/subscriptions',
                )
              }
              hitSlop={6}
            >
              <Text style={styles.warnLink}>Abrir mis suscripciones</Text>
            </Pressable>
          </View>
        ) : null}
      </BottomSheet>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} onSaved={loadProfile} />
      <RedeemInvitationSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} />
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

// ─── Grupo de filas con separadores ────────────────────────────────────────
const Group: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
};

// ─── Fila de un grupo ──────────────────────────────────────────────────────
const Row: React.FC<{
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}> = ({ title, sub, icon, accent, danger, right, chevron = true, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const content = (
    <>
      {icon ? <View style={[styles.rowIcon, accent && styles.rowIconAccent]}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, danger && { color: c.error }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress && chevron ? <IconChevron size={14} color={c.textFaint} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}. ${sub}` : title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      {content}
    </Pressable>
  );
};

// ─── Tarjeta del plan (capitán y club) ─────────────────────────────────────
// Contador de días de la prueba (verde; ámbar a 3 días o menos) y entrada a
// «Mi suscripción» o a la facturación del club.
const PlanCard: React.FC<{
  activeRole: ActiveRole | null;
  userId: string | null;
  canBeClubAdmin: boolean;
  onSwitchToClubMode: () => void;
  onPressUser: () => void;
  onPressClub: () => void;
  /** Tablet: «Mi suscripción» está abierta a la derecha. */
  selected?: boolean;
}> = ({
  activeRole,
  userId,
  canBeClubAdmin,
  onSwitchToClubMode,
  onPressUser,
  onPressClub,
  selected = false,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  // Plan Capitán compartido: me cubre el plan de otra capitana del equipo.
  const activeTeam = useTeamStore((s) => s.team);
  const mateCover = useSubscriptionStore((s) => {
    if (activeRole !== 'captain' || !activeTeam || activeTeam.club_id) return null;
    const row = s.teamCoverage[activeTeam.id];
    return row?.covered && row.payer_user_id !== userId ? row : null;
  });

  const activeSub = useMemo(() => {
    const live = subscriptions.filter((s) => isLiveSub(s));
    if (activeRole === 'club_admin') {
      return (
        live.find((s) => s.subject_type === 'club') ??
        live.find((s) => s.subject_type === 'user' && s.subject_id === userId) ??
        null
      );
    }
    return (
      live.find((s) => s.subject_type === 'user' && s.subject_id === userId) ??
      live.find((s) => s.subject_type === 'club') ??
      null
    );
  }, [subscriptions, activeRole, userId]);

  const plan = activeSub ? PLAN_BY_TIER[activeSub.plan_tier] : null;
  const isClubAdmin = activeRole === 'club_admin';
  const isClubAdminInCaptainMode = canBeClubAdmin && activeRole === 'captain';

  const handlePress = () => {
    if (isClubAdminInCaptainMode) {
      Alert.alert(
        'Estás viendo como capitán',
        'La suscripción del club se gestiona viendo la app como Club. ¿Cambiamos?',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ver como Club', onPress: onSwitchToClubMode },
        ],
      );
      return;
    }
    if (isClubAdmin) onPressClub();
    else onPressUser();
  };

  const trialDaysLeft = useMemo(() => {
    if (!activeSub || activeSub.status !== 'trialing') return null;
    const endIso = activeSub.trial_end ?? activeSub.current_period_end;
    if (!endIso) return null;
    return Math.max(0, Math.ceil((new Date(endIso).getTime() - Date.now()) / DAY_MS));
  }, [activeSub]);
  const urgent = trialDaysLeft != null && trialDaysLeft <= 3;
  const tint = urgent ? c.warning : c.accent;
  const endDate = activeSub
    ? new Date(activeSub.trial_end ?? activeSub.current_period_end).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      })
    : null;
  const noCard = !!activeSub && (activeSub.product_id ?? '').startsWith('trial_');

  const title = activeSub
    ? trialDaysLeft != null
      ? `Prueba de Pro · ${plan?.displayName ?? 'Pro'}`
      : plan?.displayName ?? 'TACTIUM Pro'
    : isClubAdmin
      ? 'Suscribir el club'
      : mateCover
        ? 'TACTIUM Pro · Capitán'
        : 'Probar TACTIUM Pro';
  const sub = activeSub
    ? activeSub.cancel_at_period_end
      ? `No se renovará · termina el ${endDate}`
      : trialDaysLeft != null
        ? `Termina el ${endDate}${noCard ? ' · sin tarjeta' : ''}`
        : 'Activa · Gestionar plan'
    : isClubAdmin
      ? 'Cubre a todos los capitanes del club'
      : mateCover
        ? `Te cubre el plan de ${mateCover.payer_name?.split(/\s+/)[0] ?? 'otra capitana'}`
        : '14 días de prueba, sin compromiso';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [
        styles.planCard,
        selected && !isClubAdmin && styles.planCardSel,
        pressed && { opacity: 0.88 },
      ]}
    >
      <View
        style={[
          styles.planDays,
          urgent && { borderColor: 'rgba(242,201,76,0.45)', backgroundColor: 'rgba(242,201,76,0.12)' },
        ]}
      >
        {trialDaysLeft != null ? (
          <>
            <Text style={[styles.planDaysNum, { color: tint }]}>{trialDaysLeft}</Text>
            <Text style={[styles.planDaysUnit, { color: tint }]}>
              {trialDaysLeft === 1 ? 'DÍA' : 'DÍAS'}
            </Text>
          </>
        ) : activeSub || mateCover ? (
          <Text style={[styles.planDaysUnit, { color: c.accent, fontSize: 10 }]}>PRO</Text>
        ) : (
          <IconTeam size={16} color={c.accent} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.planTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.planSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
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
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    scroll: { paddingHorizontal: 20, paddingTop: 8 },

    meCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    meName: { color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    meSub: { color: c.textFaint, fontSize: 12, marginTop: 2 },
    pill: {
      paddingHorizontal: 12,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },

    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 10,
      padding: 12,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    planCardCov: { borderColor: c.hairStrong },
    planCardSel: { borderColor: c.accent, borderWidth: 1.5 },
    planDays: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planDaysNum: { fontFamily: Fonts.mono, fontSize: 17, fontWeight: '800', lineHeight: 19 },
    planDaysUnit: { fontFamily: Fonts.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
    planTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    planSub: { color: c.textFaint, fontSize: 12, marginTop: 2 },

    groupLabel: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.2,
      color: c.textFaint,
      marginTop: 22,
      marginBottom: 8,
      marginLeft: 2,
    },
    group: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.hair, marginLeft: 14 },
    rowStack: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
    rowIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowIconAccent: { backgroundColor: c.accent10, borderColor: c.accent40 },
    rowTitle: { color: c.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
    rowSub: { color: c.textFaint, fontSize: 12, marginTop: 2 },
    rowHint: { color: c.textFaint, fontSize: 11.5 },
    rowAction: { color: c.accent, fontSize: 13, fontWeight: '700' },

    version: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10.5,
      letterSpacing: 0.5,
      textAlign: 'center',
    },

    sheetEyebrow: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, letterSpacing: 2 },
    sheetTitle: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
    sheetLede: { color: c.textMuted, fontSize: 13, marginTop: 4 },
    lossRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    lossBullet: { color: c.error, fontSize: 12, fontWeight: '800', marginTop: 1 },
    lossText: { color: c.text, fontSize: 13.5, flex: 1, lineHeight: 19 },
    warnBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(242,180,75,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(242,180,75,0.45)',
      gap: 4,
    },
    warnTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    warnText: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
    warnLink: { color: c.warning, fontSize: 12.5, fontWeight: '700', marginTop: 4 },
    dangerBtn: {
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerBtnLabel: { color: '#2a0905', fontSize: 15, fontWeight: '700' },
    ghostBtn: {
      height: 48,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
