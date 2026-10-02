import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import {
  fetchPeopleYouKnow,
  followTarget,
  type PersonSuggestion,
} from '@core/services/social';
import { CommunityAvatar } from '@features/social/components/social-ui';
import type { RootStackParamList } from '@navigation/types';

/** Con menos entradas que esto en el feed, se sugiere gente a quien seguir. */
export const FEW_FEED_ITEMS = 3;

/**
 * «GENTE QUE CONOCES»: compañeros de tus equipos y miembros de tus clubes con
 * cuenta a los que aún no sigues, en una fila deslizable con «Seguir». Si no
 * hay nadie que sugerir, no pinta nada.
 */
export const PeopleYouKnow: React.FC<{
  style?: object;
  /** Muestra «Buscar gente →» en la cabecera de la sección. */
  showSearchLink?: boolean;
  /** Margen lateral del contenedor padre, para que la fila sangre a los bordes. */
  bleed?: number;
}> = ({ style, showSearchLink = true, bleed = 20 }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [people, setPeople] = useState<PersonSuggestion[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchPeopleYouKnow()
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      .catch((e) => console.warn('people you know', e));
    return () => {
      cancelled = true;
    };
  }, []);

  const follow = async (id: string) => {
    if (busy.has(id) || followed.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await followTarget('user', id);
      setFollowed((s) => new Set(s).add(id));
    } catch (e) {
      // Si ya lo seguía (fila duplicada), lo damos por seguido igualmente.
      if (String((e as Error)?.message ?? '').toLowerCase().includes('duplicate')) {
        setFollowed((s) => new Set(s).add(id));
      } else {
        console.warn('follow suggestion', e);
      }
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  if (people.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>GENTE QUE CONOCES</Text>
        {showSearchLink ? (
          <Pressable
            onPress={() => navigation.navigate('SearchCommunity')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Buscar gente"
          >
            <Text style={styles.link}>Buscar gente →</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={{ paddingHorizontal: bleed, gap: 10 }}
      >
        {people.map((p) => {
          const isFollowing = followed.has(p.id);
          const isBusy = busy.has(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => navigation.navigate('PublicProfile', { type: 'user', id: p.id })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel={`Ver perfil de ${p.name}`}
            >
              <CommunityAvatar name={p.name} avatarUrl={p.avatar_url} size={52} />
              <Text style={styles.name} numberOfLines={2}>
                {p.name}
              </Text>
              <Text style={styles.ctx} numberOfLines={1}>
                {p.context === 'team' ? 'TU EQUIPO' : 'TU CLUB'}
              </Text>
              <Pressable
                onPress={() => follow(p.id)}
                disabled={isFollowing || isBusy}
                accessibilityRole="button"
                accessibilityLabel={isFollowing ? `Siguiendo a ${p.name}` : `Seguir a ${p.name}`}
                style={({ pressed }) => [
                  styles.btn,
                  isFollowing ? styles.btnFollowing : styles.btnFollow,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color={c.textInverse} />
                ) : (
                  <Text
                    style={[
                      styles.btnLabel,
                      { color: isFollowing ? c.textMuted : c.textInverse },
                    ]}
                  >
                    {isFollowing ? '✓ Siguiendo' : 'Seguir'}
                  </Text>
                )}
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: 20 },
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
    link: { color: c.accent, fontSize: 13, fontWeight: '700' },
    card: {
      width: 132,
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      alignItems: 'center',
      gap: 6,
    },
    name: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
      minHeight: 34,
      lineHeight: 17,
    },
    ctx: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 9,
      letterSpacing: 1.4,
    },
    btn: {
      marginTop: 4,
      alignSelf: 'stretch',
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    btnFollow: { backgroundColor: c.accent, borderColor: c.accent },
    btnFollowing: { backgroundColor: 'transparent', borderColor: c.hairStrong },
    btnLabel: { fontSize: 13, fontWeight: '700' },
  });
