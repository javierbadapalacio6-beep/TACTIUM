import React, { useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconBack } from '@components/ui';
import {
  FeedItemCard,
  feedItemKey,
  useFeed,
} from '@features/social/components/FeedItems';
import {
  PeopleYouKnow,
  FEW_FEED_ITEMS,
} from '@features/social/components/PeopleYouKnow';
import type { RootStackParamList } from '@navigation/types';

/** Feed completo («Novedades»): se abre con «Ver todo» desde Inicio y Perfil. */
export const FeedScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, loading, refreshing, load, onKudos } = useFeed(40);

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
          <IconBack size={20} color={c.text} />
        </Pressable>
        <Text style={styles.eyebrow}>NOVEDADES</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={c.accent} />
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
              tintColor={c.accent}
            />
          }
        >
          {items.length < FEW_FEED_ITEMS ? (
            <PeopleYouKnow
              style={{ marginTop: 0, marginBottom: 10 }}
              showSearchLink={items.length > 0}
            />
          ) : null}
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aún no hay novedades</Text>
              <Text style={styles.emptyHint}>
                Sigue a jugadores y clubes para ver aquí sus resultados y
                amistosos.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('SearchCommunity')}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.emptyLink}>Buscar gente →</Text>
              </Pressable>
            </View>
          ) : (
            items.map((it) => (
              <FeedItemCard key={feedItemKey(it)} it={it} onKudos={onKudos} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
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
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  empty: { paddingTop: 60, alignItems: 'center', gap: 8 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  emptyLink: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
  emptyHint: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 24,
  },
});
