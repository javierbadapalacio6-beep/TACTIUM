import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Input, IconBack, IconSearch } from '@components/ui';
import {
  searchCommunity,
  fetchPeopleYouKnow,
  followTarget,
  unfollowTarget,
  type CommunityResult,
  type FollowTargetType,
} from '@core/services/social';
import { fetchMyFrequentPartners } from '@core/services/casualMatches';
import { useAuthStore } from '@store/authStore';
import { DOWNLOAD_URL } from '@core/config/referral';
import { CommunityAvatar, FollowButton } from '@features/social/components/social-ui';
import { lightTap } from '@features/profile/components/CodeRedeemCard';
import type { RootStackParamList } from '@navigation/types';

type Filter = 'todos' | 'user' | 'club';

/** Fila de gente: la de la búsqueda y la de las sugerencias comparten forma. */
interface PersonRow {
  type: FollowTargetType;
  id: string;
  name: string;
  avatar_url: string | null;
  sub: string;
  following: boolean;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'user', label: 'Jugadores' },
  { key: 'club', label: 'Clubes' },
];

export const SearchCommunityScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [results, setResults] = useState<CommunityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [suggested, setSuggested] = useState<PersonRow[] | null>(null);
  // Estado de «seguir» tocado en esta pantalla (optimista), por id.
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Token para descartar respuestas de búsquedas viejas.
  const reqRef = useRef(0);

  // Antes de escribir: tu equipo y tu club. Sin equipo, la gente de tus
  // amistosos que tiene cuenta (de «Mis colegas»).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const people = await fetchPeopleYouKnow().catch(() => []);
        let rows: PersonRow[] = people.map((p) => ({
          type: 'user' as const,
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          sub: p.context === 'team' ? 'Tu equipo' : 'Tu club',
          following: false,
        }));
        if (rows.length === 0 && userId) {
          const partners = await fetchMyFrequentPartners(userId).catch(() => []);
          rows = partners
            .filter((fp) => !!fp.user_id && fp.user_id !== userId)
            .slice(0, 8)
            .map((fp) => ({
              type: 'user' as const,
              id: fp.user_id as string,
              name: fp.name,
              avatar_url: null,
              sub: `${fp.times} ${fp.times === 1 ? 'partido juntos' : 'partidos juntos'}`,
              following: false,
            }));
        }
        if (!cancelled) setSuggested(rows);
      } catch {
        if (!cancelled) setSuggested([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  const toggleFollow = async (row: PersonRow) => {
    if (busy) return;
    const now = follow[row.id] ?? row.following;
    setBusy(row.id);
    setFollow((f) => ({ ...f, [row.id]: !now }));
    try {
      if (now) await unfollowTarget(row.type, row.id);
      else await followTarget(row.type, row.id);
      if (!now) lightTap();
    } catch (e) {
      // Ya le seguías (fila duplicada): cuenta como hecho.
      const dup = String((e as Error)?.message ?? '').toLowerCase().includes('duplicate');
      if (!(dup && !now)) setFollow((f) => ({ ...f, [row.id]: now }));
    } finally {
      setBusy(null);
    }
  };

  const invite = async () => {
    try {
      await Share.share({
        message: `Te espero en TACTIUM para seguirnos y apuntar los partidos 🎾\n${DOWNLOAD_URL}`,
      });
    } catch {
      // cancelado
    }
  };

  const openProfile = (row: PersonRow) =>
    navigation.navigate('PublicProfile', { type: row.type, id: row.id });

  const searching = query.trim().length >= 2;
  const resultRows: PersonRow[] = results
    .filter((r) => filter === 'todos' || r.type === filter)
    .map((r) => ({
      type: r.type,
      id: r.id,
      name: r.name,
      avatar_url: r.avatar_url,
      sub: `${r.type === 'club' ? 'Club' : r.subtitle ?? 'Jugador'}${
        r.followers_count > 0
          ? ` · ${r.followers_count} ${r.followers_count === 1 ? 'seguidor' : 'seguidores'}`
          : ''
      }`,
      following: r.is_following,
    }));
  const suggestedRows = (suggested ?? []).filter(() => filter !== 'club');

  const renderRows = (rows: PersonRow[]) => (
    <View style={styles.card}>
      {rows.map((r, i) => (
        <View key={`${r.type}-${r.id}`} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Pressable
            onPress={() => openProfile(r)}
            style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`Ver el perfil de ${r.name}`}
          >
            <CommunityAvatar name={r.name} avatarUrl={r.avatar_url} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.sub}
              </Text>
            </View>
          </Pressable>
          <FollowButton
            size="sm"
            following={follow[r.id] ?? r.following}
            busy={busy === r.id}
            onPress={() => toggleFollow(r)}
          />
        </View>
      ))}
    </View>
  );

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
        <Text style={styles.eyebrow}>COMUNIDAD</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.searchWrap}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Busca jugadores o clubes"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={{ marginBottom: 0 }}
          rightSlot={<IconSearch size={16} color={c.textMuted} />}
        />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && { color: c.accent }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searching ? (
          loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : resultRows.length > 0 ? (
            renderRows(resultRows)
          ) : searched ? (
            <View style={styles.inviteCard}>
              <Text style={styles.emptyTitle}>¿No está?</Text>
              <Text style={styles.emptyHint}>
                Pásale un enlace y, cuando entre, os seguís.
              </Text>
              <Pressable onPress={invite} hitSlop={8} accessibilityRole="button">
                <Text style={styles.inviteLink}>Invitar por WhatsApp</Text>
              </Pressable>
            </View>
          ) : null
        ) : suggested === null ? (
          <View style={styles.state}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : suggestedRows.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>GENTE QUE CONOCES</Text>
            {renderRows(suggestedRows)}
          </>
        ) : (
          <View style={styles.inviteCard}>
            <Text style={styles.emptyTitle}>Busca a tu gente</Text>
            <Text style={styles.emptyHint}>
              Escribe un nombre o un @usuario. Si aún no tienen la app, invítales.
            </Text>
            <Pressable onPress={invite} hitSlop={8} accessibilityRole="button">
              <Text style={styles.inviteLink}>Invitar por WhatsApp</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
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
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 3,
      fontWeight: '500',
    },
    searchWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 10 },
    chips: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { borderColor: c.accent40, backgroundColor: c.accent10 },
    chipText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    list: { paddingHorizontal: 20, paddingTop: 8 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10.5,
      letterSpacing: 2,
      marginBottom: 8,
    },
    state: { paddingTop: 48, alignItems: 'center', gap: 6 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyHint: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 12,
      lineHeight: 19,
    },
    inviteCard: {
      marginTop: 16,
      alignItems: 'center',
      gap: 6,
      padding: 18,
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.hair,
    },
    inviteLink: { color: c.accent, fontSize: 13.5, fontWeight: '700', marginTop: 4 },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowDivider: { borderTopWidth: 1, borderColor: c.hair },
    name: { color: c.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
    meta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  });
