import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { BottomSheet } from '@components/ui';
import {
  listFollowers,
  listFollowing,
  followTarget,
  unfollowTarget,
  type FollowTargetType,
} from '@core/services/social';
import { CommunityAvatar, FollowButton } from './social-ui';

export type FollowListMode = 'followers' | 'following';

interface DisplayRow {
  type: FollowTargetType;
  id: string;
  name: string;
  subtitle: string | null;
  avatar_url: string | null;
  is_following: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: FollowListMode;
  /** Usuario o club cuyo listado mostramos. */
  targetId: string;
  targetType: FollowTargetType;
  onOpenProfile: (type: FollowTargetType, id: string) => void;
}

export const FollowListSheet: React.FC<Props> = ({
  open,
  onClose,
  mode,
  targetId,
  targetType,
  onOpenProfile,
}) => {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data: DisplayRow[] =
          mode === 'followers'
            ? (await listFollowers(targetId, targetType)).map((r) => ({
                type: 'user' as const,
                id: r.id,
                name: r.name,
                subtitle: null,
                avatar_url: r.avatar_url,
                is_following: r.is_following,
              }))
            : (await listFollowing(targetId)).map((r) => ({
                type: r.type,
                id: r.id,
                name: r.name,
                subtitle: r.subtitle,
                avatar_url: r.avatar_url,
                is_following: r.is_following,
              }));
        if (!cancelled) setRows(data);
      } catch (e) {
        console.warn('FollowListSheet load', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, targetId, targetType]);

  const toggle = async (row: DisplayRow) => {
    if (busyId) return;
    const next = !row.is_following;
    setBusyId(row.id);
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_following: next } : r)),
    );
    try {
      if (next) await followTarget(row.type, row.id);
      else await unfollowTarget(row.type, row.id);
    } catch (e) {
      // revertir
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, is_following: !next } : r,
        ),
      );
      console.warn('toggle follow', e);
    } finally {
      setBusyId(null);
    }
  };

  const title = mode === 'followers' ? 'Seguidores' : 'Siguiendo';

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>COMUNIDAD</Text>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          {mode === 'followers'
            ? 'Todavía no hay seguidores.'
            : 'Aún no sigue a nadie.'}
        </Text>
      ) : (
        <View style={styles.card}>
          {rows.map((r, i) => (
            <View
              key={`${r.type}-${r.id}`}
              style={[styles.row, i < rows.length - 1 && styles.rowDivider]}
            >
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenProfile(r.type, r.id);
                }}
                style={styles.rowMain}
              >
                <CommunityAvatar name={r.name} avatarUrl={r.avatar_url} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.type === 'club' ? 'Club' : r.subtitle ?? 'Jugador'}
                  </Text>
                </View>
              </Pressable>
              <FollowButton
                following={r.is_following}
                busy={busyId === r.id}
                onPress={() => toggle(r)}
                size="sm"
              />
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  state: { paddingVertical: 30, alignItems: 'center' },
  empty: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingVertical: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  rowDivider: { borderBottomWidth: 1, borderColor: Colors.hair },
  name: { color: Colors.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
