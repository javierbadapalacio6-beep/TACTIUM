import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconMenu, IconSearch } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { displayNameOf } from '@core/utils/format';
import { DOWNLOAD_URL } from '@core/config/referral';
import {
  getPublicUserProfile,
  type PublicUserProfile,
  type FollowTargetType,
} from '@core/services/social';
import { CommunityAvatar } from '@features/social/components/social-ui';
import {
  FollowListSheet,
  type FollowListMode,
} from '@features/social/components/FollowListSheet';
import { EditProfileSheet } from '@features/profile/components/EditProfileSheet';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import type { RootStackParamList } from '@navigation/types';

// Rejilla de fotos a 3 columnas. El item es cuadrado y se calcula a partir
// del ancho de pantalla menos el padding horizontal (22*2) y los 2 gaps.
const GRID_GAP = 6;
const H_PADDING = 22;
const SCREEN_W = Dimensions.get('window').width;
const GRID_ITEM = Math.floor((SCREEN_W - H_PADDING * 2 - GRID_GAP * 2) / 3);

const ROLE_LABEL: Record<string, string> = {
  club_admin: 'Club',
  captain: 'Capitán',
  player: 'Jugador',
};

export const ProfileScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user   = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeRole = useTeamStore((s) => s.activeRole);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [followSheet, setFollowSheet] = useState<FollowListMode | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const displayName = displayNameOf(user);
  const roleLabel = activeRole ? ROLE_LABEL[activeRole] ?? null : null;

  // Carga del perfil público (escaparate) en cada focus. Reutilizable tras
  // editar el perfil (onSaved).
  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await getPublicUserProfile(userId);
      setProfile(p);
    } catch (e) {
      console.warn('ProfileScreen load', e);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco.
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

  const onShare = async () => {
    try {
      await Share.share({
        message: `Sígueme en TACTIUM 🎾\n${DOWNLOAD_URL}`,
      });
    } catch {
      // cancelado por el usuario
    }
  };

  const openFollowProfile = (t: FollowTargetType, pid: string) =>
    navigation.navigate('PublicProfile', { type: t, id: pid });

  const followers = profile?.followers_count ?? 0;
  const following = profile?.following_count ?? 0;
  const casualPlayed = profile?.casual_played ?? 0;
  const bio = profile?.bio?.trim() || null;
  const photos = profile?.photos ?? [];

  return (
    <View style={styles.root}>
      {/* Header: nombre a la izquierda; campana + menú a la derecha. */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('SearchCommunity')}
            accessibilityRole="button"
            accessibilityLabel="Buscar en la comunidad"
            style={({ pressed }) => [
              styles.menuBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconSearch size={22} color={c.text} />
          </Pressable>
          <NotificationBell />
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
            style={({ pressed }) => [
              styles.menuBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconMenu size={22} color={c.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Escaparate: avatar + 3 columnas de stats */}
        <View style={styles.showcase}>
          <CommunityAvatar
            name={displayName}
            avatarUrl={profile?.avatar_url ?? null}
            size={86}
          />
          <View style={styles.statsRow}>
            <StatColumn
              value={casualPlayed}
              label="Amistosos"
              onPress={() => navigation.navigate('MyStats')}
            />
            <StatColumn
              value={followers}
              label="Seguidores"
              onPress={() => setFollowSheet('followers')}
            />
            <StatColumn
              value={following}
              label="Siguiendo"
              onPress={() => setFollowSheet('following')}
            />
          </View>
        </View>

        {/* Nombre + rol/nivel */}
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        {roleLabel || profile?.level_display != null ? (
          <Text style={styles.role} numberOfLines={1}>
            {[
              profile?.level_display != null
                ? `Nivel ${profile.level_display}`
                : null,
              roleLabel,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}

        {/* Bio */}
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        {/* Acciones: editar perfil + compartir */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
            style={({ pressed }) => [
              styles.pillBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.pillBtnLabel}>Editar perfil</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Compartir perfil"
            style={({ pressed }) => [
              styles.pillBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.pillBtnLabel}>Compartir</Text>
          </Pressable>
        </View>

        {/* Rejilla de fotos: amistosos (jugador) + portadas de jornada (capitán) */}
        {photos.length > 0 ? (
          <View style={styles.grid}>
            {photos.map((ph) => {
              const isCasual = ph.kind !== 'jornada' && !!ph.match_id;
              return (
              <Pressable
                key={ph.match_id ?? ph.matchday_id ?? ph.photo_url}
                disabled={!isCasual}
                onPress={
                  isCasual
                    ? () =>
                        navigation.navigate('CasualMatchDetail', {
                          matchId: ph.match_id as string,
                        })
                    : undefined
                }
                style={({ pressed }) => [
                  styles.gridItem,
                  pressed && isCasual && { opacity: 0.85 },
                ]}
              >
                <Image
                  source={{ uri: ph.photo_url }}
                  style={styles.gridImg}
                  resizeMode="cover"
                />
                {ph.positive !== null ? (
                  <View style={styles.gridResult}>
                    <View
                      style={[
                        styles.gridResultDot,
                        { backgroundColor: ph.positive ? c.accent : c.error },
                      ]}
                    />
                    <Text style={styles.gridResultText}>
                      {ph.positive ? 'GANADO' : 'PERDIDO'}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>
              Tus fotos de partidos aparecerán aquí
            </Text>
          </View>
        )}
      </ScrollView>

      <FollowListSheet
        open={followSheet !== null}
        onClose={() => setFollowSheet(null)}
        mode={followSheet ?? 'followers'}
        targetId={userId ?? ''}
        targetType="user"
        onOpenProfile={openFollowProfile}
      />

      <EditProfileSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={load}
      />
    </View>
  );
};

const StatColumn: React.FC<{
  value: number;
  label: string;
  onPress?: () => void;
}> = ({ value, label, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [
        styles.statColumn,
        pressed && onPress && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: H_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerName: {
    flex: 1,
    color: c.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: H_PADDING, paddingTop: 20 },

  showcase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statColumn: { alignItems: 'center', flex: 1 },
  statValue: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
  },

  name: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 16,
  },
  role: { color: c.textMuted, fontSize: 13, marginTop: 3 },
  bio: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  pillBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },

  communityRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chipLabel: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  chipEmoji: { fontSize: 14 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 20,
  },
  gridItem: {
    width: GRID_ITEM,
    height: GRID_ITEM,
    borderRadius: 10,
    backgroundColor: c.bgCard,
    overflow: 'hidden',
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  gridResult: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  gridResultDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gridResultText: {
    color: '#FFFFFF',
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  emptyGrid: {
    marginTop: 28,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGridText: {
    color: c.textFaint,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
});
