import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack, IconChevron } from '@components/ui';
import { fetchFeed, type FeedItem } from '@core/services/social';
import { CommunityAvatar } from '@features/social/components/social-ui';
import type { RootStackParamList } from '@navigation/types';

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

export const FeedScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await fetchFeed(40));
    } catch (e) {
      console.warn('feed load', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openActor = (it: FeedItem) => {
    if (!it.actor_id) return;
    navigation.navigate('PublicProfile', {
      type: it.kind === 'casual' ? 'user' : 'club',
      id: it.actor_id,
    });
  };

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
        <Text style={styles.eyebrow}>NOVEDADES</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.accent}
            />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aún no hay novedades</Text>
              <Text style={styles.emptyHint}>
                Sigue a jugadores y clubes para ver aquí sus resultados y
                amistosos.
              </Text>
            </View>
          ) : (
            items.map((it) => (
              <Pressable
                key={`${it.kind}-${it.ref_id}`}
                onPress={() => openActor(it)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <CommunityAvatar
                  name={it.actor_name ?? '—'}
                  avatarUrl={it.avatar_url}
                  size={44}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.title,
                      it.positive === true && { color: Colors.accent },
                    ]}
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
                </View>
                <IconChevron size={14} color={Colors.textFaint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

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
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  title: {
    color: Colors.text,
    fontSize: 14.5,
    fontWeight: '650',
    letterSpacing: -0.1,
  },
  subtitle: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  kindTag: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  date: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
