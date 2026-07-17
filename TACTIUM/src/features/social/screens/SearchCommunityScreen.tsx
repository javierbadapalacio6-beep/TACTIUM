import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Input, IconBack, IconSearch, IconChevron } from '@components/ui';
import {
  searchCommunity,
  type CommunityResult,
} from '@core/services/social';
import { CommunityAvatar } from '@features/social/components/social-ui';
import type { RootStackParamList } from '@navigation/types';

export const SearchCommunityScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CommunityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Token para descartar respuestas de búsquedas viejas (evita parpadeo
  // si una respuesta lenta llega después de una más reciente).
  const reqRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      try {
        const rows = await searchCommunity(term);
        if (reqRef.current === id) {
          setResults(rows);
          setSearched(true);
        }
      } catch (e) {
        console.warn('searchCommunity', e);
        if (reqRef.current === id) setResults([]);
      } finally {
        if (reqRef.current === id) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const openResult = (r: CommunityResult) =>
    navigation.navigate('PublicProfile', { type: r.type, id: r.id });

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
        <Text style={styles.eyebrow}>COMUNIDAD</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.searchWrap}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Busca jugadores o clubes"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={{ marginBottom: 0 }}
          rightSlot={<IconSearch size={16} color={Colors.textMuted} />}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : results.length > 0 ? (
          <View style={styles.card}>
            {results.map((r, i) => (
              <Pressable
                key={`${r.type}-${r.id}`}
                onPress={() => openResult(r)}
                style={({ pressed }) => [
                  styles.row,
                  i < results.length - 1 && styles.rowDivider,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <CommunityAvatar name={r.name} avatarUrl={r.avatar_url} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.type === 'club'
                      ? 'Club'
                      : r.subtitle ?? 'Jugador'}
                    {r.followers_count > 0
                      ? ` · ${r.followers_count} ${
                          r.followers_count === 1 ? 'seguidor' : 'seguidores'
                        }`
                      : ''}
                  </Text>
                </View>
                {r.is_following ? (
                  <View style={styles.followingPill}>
                    <Text style={styles.followingPillText}>SIGUIENDO</Text>
                  </View>
                ) : null}
                <IconChevron size={14} color={Colors.textFaint} />
              </Pressable>
            ))}
          </View>
        ) : searched ? (
          <View style={styles.state}>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyHint}>
              Prueba con otro nombre o nombre de usuario.
            </Text>
          </View>
        ) : (
          <View style={styles.state}>
            <Text style={styles.emptyHint}>
              Escribe al menos 2 letras para buscar jugadores y clubes.
            </Text>
          </View>
        )}
      </ScrollView>
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
  searchWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  state: { paddingTop: 48, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowDivider: { borderBottomWidth: 1, borderColor: Colors.hair },
  name: { color: Colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  followingPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  followingPillText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
