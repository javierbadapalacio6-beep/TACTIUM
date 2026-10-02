import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconChevron } from '@components/ui';
import {
  fetchFeed,
  toggleActivityKudos,
  type FeedItem,
} from '@core/services/social';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import { CommunityAvatar } from '@features/social/components/social-ui';
import type { RootStackParamList } from '@navigation/types';

/**
 * Piezas del feed social («Novedades» / «TU GENTE»), compartidas por la
 * pantalla completa (FeedScreen) y la sección embebida al final de Inicio
 * (FeedPreview): carga + kudos optimista + tarjeta.
 */

export const feedItemKey = (it: FeedItem) => `${it.kind}-${it.ref_id}`;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
};

/** Carga el feed en cada focus y expone el kudos optimista. */
export function useFeed(limit: number) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Ítems con un kudos en vuelo: evita dobles toques mientras responde el RPC.
  const pending = useRef(new Set<string>());

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        setItems(await fetchFeed(limit));
      } catch (e) {
        console.warn('feed load', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [limit],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const patchItem = (key: string, patch: Partial<FeedItem>) =>
    setItems((prev) =>
      prev.map((x) => (feedItemKey(x) === key ? { ...x, ...patch } : x)),
    );

  // Kudos optimista: se pinta al momento y, si el servidor falla, se deshace.
  const onKudos = async (it: FeedItem) => {
    const key = feedItemKey(it);
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const prevGiven = !!it.i_gave_kudos;
    const prevCount = it.kudos_count ?? 0;
    patchItem(key, {
      i_gave_kudos: !prevGiven,
      kudos_count: Math.max(0, prevCount + (prevGiven ? -1 : 1)),
    });
    try {
      const r = await toggleActivityKudos(
        it.kind,
        it.ref_id,
        it.kind === 'casual' ? it.actor_id : null,
      );
      patchItem(key, { i_gave_kudos: r.given, kudos_count: r.count });
    } catch (e) {
      console.warn('kudos', e);
      patchItem(key, { i_gave_kudos: prevGiven, kudos_count: prevCount });
      toast.error('No se pudo dar kudos', 'Inténtalo de nuevo en un momento.');
    } finally {
      pending.current.delete(key);
    }
  };

  return { items, loading, refreshing, load, onKudos };
}

/** Tarjeta de una actividad del feed (abre el perfil del autor). */
export const FeedItemCard: React.FC<{
  it: FeedItem;
  onKudos: (it: FeedItem) => void;
}> = ({ it, onKudos }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const myId = useAuthStore((s) => s.user?.id ?? null);

  const openActor = () => {
    if (!it.actor_id) return;
    navigation.navigate('PublicProfile', {
      type: it.kind === 'casual' ? 'user' : 'club',
      id: it.actor_id,
    });
  };

  const count = it.kudos_count ?? 0;
  // Tu propio amistoso: no puedes aplaudirte; solo el contador (si hay).
  const own = it.kind === 'casual' && !!myId && it.actor_id === myId;
  const given = !!it.i_gave_kudos;

  return (
    <Pressable
      onPress={openActor}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <CommunityAvatar
        name={it.actor_name ?? '—'}
        avatarUrl={it.avatar_url}
        size={44}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.title, it.positive === true && { color: c.accent }]}
          numberOfLines={2}
        >
          {it.title}
        </Text>
        {it.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {it.subtitle}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.kindTag}>
            {it.kind === 'casual' ? 'AMISTOSO' : 'LIGA'}
          </Text>
          <Text style={styles.date}>{fmtDate(it.occurred_on)}</Text>
        </View>
        {own ? (
          count > 0 ? (
            <View style={styles.kudosRow}>
              <Text style={styles.kudosCount}>👏 Kudos · {count}</Text>
            </View>
          ) : null
        ) : (
          <View style={styles.kudosRow}>
            <Pressable
              onPress={() => onKudos(it)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: given }}
              accessibilityLabel={
                given
                  ? `Quitar kudos. ${count} kudos`
                  : `Dar kudos. ${count} kudos`
              }
              style={({ pressed }) => [
                styles.kudosBtn,
                given && styles.kudosBtnOn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.kudosText, given && { color: c.accent }]}>
                {given ? `👏 Kudos · ${count}` : `👏 Dar kudos · ${count}`}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    title: {
      color: c.text,
      fontSize: 14.5,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    subtitle: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 12,
      marginTop: 4,
      lineHeight: 17,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    kindTag: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: '700',
    },
    date: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 0.4,
    },
    kudosRow: { flexDirection: 'row', marginTop: 10 },
    kudosBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.background,
    },
    kudosBtnOn: { borderColor: c.accent40, backgroundColor: c.accent10 },
    kudosText: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    kudosCount: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 0.2,
    },
  });
