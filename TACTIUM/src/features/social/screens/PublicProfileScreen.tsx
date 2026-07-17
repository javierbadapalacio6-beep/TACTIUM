import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack, IconTeam } from '@components/ui';
import {
  getPublicUserProfile,
  getPublicClubProfile,
  followTarget,
  unfollowTarget,
  type PublicUserProfile,
  type PublicClubProfile,
  type FollowTargetType,
} from '@core/services/social';
import { CommunityAvatar, FollowButton } from '@features/social/components/social-ui';
import {
  FollowListSheet,
  type FollowListMode,
} from '@features/social/components/FollowListSheet';
import type { RootStackParamList } from '@navigation/types';

export const PublicProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
  const { type, id } = route.params;

  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [sheet, setSheet] = useState<FollowListMode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (type === 'user') {
        const p = await getPublicUserProfile(id);
        setUser(p);
        setFollowing(p.is_following);
        setFollowers(p.followers_count);
      } else {
        const p = await getPublicClubProfile(id);
        setClub(p);
        setFollowing(p.is_following);
        setFollowers(p.followers_count);
      }
    } catch (e) {
      console.warn('PublicProfile load', e);
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFollow = async () => {
    if (followBusy) return;
    const next = !following;
    setFollowBusy(true);
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) await followTarget(type, id);
      else await unfollowTarget(type, id);
    } catch (e) {
      setFollowing(!next);
      setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
      console.warn('toggleFollow', e);
    } finally {
      setFollowBusy(false);
    }
  };

  const openProfile = (t: FollowTargetType, pid: string) =>
    navigation.push('PublicProfile', { type: t, id: pid });

  const name =
    type === 'user'
      ? user?.username?.trim() || user?.full_name?.trim() || 'Jugador'
      : club?.name ?? 'Club';
  const secondary =
    type === 'user'
      ? user?.username && user?.full_name
        ? user.full_name
        : 'Jugador'
      : 'Club';
  const isMe = type === 'user' && !!user?.is_me;

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
        <Text style={styles.eyebrow}>PERFIL</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <CommunityAvatar name={name} avatarUrl={user?.avatar_url ?? null} size={96} />
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.secondary} numberOfLines={1}>
              {type === 'user' && user?.level_display != null
                ? `Nivel ${user.level_display} · ${secondary}`
                : secondary}
            </Text>

            {!isMe ? (
              <View style={{ marginTop: 16 }}>
                <FollowButton
                  following={following}
                  busy={followBusy}
                  onPress={toggleFollow}
                />
              </View>
            ) : (
              <View style={styles.mePill}>
                <Text style={styles.mePillText}>ESTE ERES TÚ</Text>
              </View>
            )}
          </View>

          {/* Contadores */}
          <View style={styles.countsRow}>
            <CountBox
              label="Seguidores"
              value={followers}
              onPress={() => setSheet('followers')}
            />
            {type === 'user' ? (
              <CountBox
                label="Siguiendo"
                value={user?.following_count ?? 0}
                onPress={() => setSheet('following')}
              />
            ) : (
              <CountBox label="Equipos" value={club?.teams_count ?? 0} />
            )}
            {type === 'user' ? (
              <CountBox label="Amistosos" value={user?.casual_played ?? 0} />
            ) : (
              <CountBox label="Miembros" value={club?.members_count ?? 0} />
            )}
          </View>

          {/* Stats de amistosos (solo jugadores) */}
          {type === 'user' ? (
            <>
              <Text style={styles.sectionLabel}>AMISTOSOS</Text>
              <View style={styles.statsCard}>
                <StatCell label="Jugados" value={String(user?.casual_played ?? 0)} />
                <View style={styles.statDivider} />
                <StatCell
                  label="Victorias"
                  value={String(user?.casual_won ?? 0)}
                  highlight
                />
                <View style={styles.statDivider} />
                <StatCell
                  label="Tasa V"
                  value={
                    user?.casual_win_rate != null
                      ? `${user.casual_win_rate}%`
                      : '—'
                  }
                />
              </View>

              {user?.teams && user.teams.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>EQUIPOS</Text>
                  <View style={styles.teamsCard}>
                    {user.teams.map((tm, i) => (
                      <View
                        key={`${tm.name}-${i}`}
                        style={[
                          styles.teamRow,
                          i < user.teams.length - 1 && styles.teamRowDivider,
                        ]}
                      >
                        <Text style={styles.teamNameTxt} numberOfLines={1}>
                          {tm.name}
                        </Text>
                        <Text style={styles.teamRoleTxt}>
                          {tm.role === 'captain' || tm.role === 'admin'
                            ? 'Capitán'
                            : 'Jugador'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>EL CLUB</Text>
              <View style={styles.clubCard}>
                <View style={styles.clubIcon}>
                  <IconTeam size={20} color={Colors.accent} />
                </View>
                <Text style={styles.clubMeta}>
                  {club?.teams_count ?? 0}{' '}
                  {club?.teams_count === 1 ? 'equipo' : 'equipos'} ·{' '}
                  {club?.members_count ?? 0}{' '}
                  {club?.members_count === 1 ? 'miembro' : 'miembros'}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <FollowListSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        mode={sheet ?? 'followers'}
        targetId={id}
        targetType={type}
        onOpenProfile={openProfile}
      />
    </View>
  );
};

const CountBox: React.FC<{
  label: string;
  value: number;
  onPress?: () => void;
}> = ({ label, value, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    style={({ pressed }) => [
      styles.countBox,
      pressed && onPress && { opacity: 0.7 },
    ]}
  >
    <Text style={styles.countValue}>{value}</Text>
    <Text style={styles.countLabel}>{label}</Text>
  </Pressable>
);

const StatCell: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <View style={styles.statCell}>
    <Text style={[styles.statValue, highlight && { color: Colors.accent }]}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
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
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 22, paddingTop: 14 },

  hero: { alignItems: 'center', marginBottom: 22 },
  name: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 14,
  },
  secondary: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  mePill: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: Colors.accent15,
  },
  mePillText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  countsRow: { flexDirection: 'row', gap: 8 },
  countBox: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
    alignItems: 'center',
  },
  countValue: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  countLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 5,
    textTransform: 'uppercase',
  },

  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.textFaint,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 10,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingVertical: 16,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, backgroundColor: Colors.hair, marginVertical: 4 },

  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubMeta: { color: Colors.textMuted, fontSize: 14, flex: 1 },

  teamsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  teamRowDivider: { borderBottomWidth: 1, borderColor: Colors.hair },
  teamNameTxt: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  teamRoleTxt: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
