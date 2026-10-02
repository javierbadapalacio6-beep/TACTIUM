import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
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

const PREVIEW_COUNT = 4;

/**
 * Sección «TU GENTE» al final de Inicio: las últimas actividades de la gente y
 * los clubes que sigues, con kudos, y «Ver todo» al feed completo. Sin nadie
 * a quien seguir, invita a buscar en la comunidad; con el feed vacío o con
 * poco movimiento, añade «GENTE QUE CONOCES» (sugerencias para seguir).
 */
export const FeedPreview: React.FC<{ style?: object }> = ({ style }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, loading, onKudos } = useFeed(PREVIEW_COUNT);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>TU GENTE</Text>
        {items.length > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('Feed')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver todas las novedades"
          >
            <Text style={styles.link}>Ver todo →</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : items.length === 0 ? (
        <Pressable
          onPress={() => navigation.navigate('SearchCommunity')}
          style={({ pressed }) => [styles.empty, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.emptyTitle}>Aún no sigues a nadie</Text>
          <Text style={styles.emptyText}>
            Sigue a tus compañeros y a tu club para ver aquí sus resultados y
            amistosos.
          </Text>
          <Text style={styles.link}>Buscar gente →</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 10 }}>
          {items.slice(0, PREVIEW_COUNT).map((it) => (
            <FeedItemCard key={feedItemKey(it)} it={it} onKudos={onKudos} />
          ))}
        </View>
      )}

      {/* Feed vacío o con poco movimiento: sugiere gente de tus equipos y
          clubes. Con el feed vacío, «Buscar gente →» ya está en la tarjeta. */}
      {!loading && items.length < FEW_FEED_ITEMS ? (
        <PeopleYouKnow bleed={22} showSearchLink={items.length > 0} />
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 28 },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
    },
    link: {
      color: c.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    loader: { paddingVertical: 20, alignItems: 'center' },
    empty: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 6,
    },
    emptyTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  });
