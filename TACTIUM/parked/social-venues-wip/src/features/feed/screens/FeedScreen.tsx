import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { listFeed, type FeedItem, type FeedMatch } from '@core/services/posts';

const WIN = Colors.accent;
const LOSS = Colors.error;
const FILTERS = ['Mi equipo', 'Mi club', 'Mi liga', 'Siguiendo'];

// ── Helpers compartidos ─────────────────────────────────────────────
const timeAgo = (iso: string): string => {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'ahora';
  const m = Math.floor(secs / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const AV_COLORS = ['#0B3B2C', '#1E5AA8', '#8A5A3B', '#5A1F1F', '#3B2C6B'];
const Avatar: React.FC<{ name: string; size?: number; uri?: string | null; square?: boolean }> = ({
  name,
  size = 40,
  uri,
  square,
}) => {
  const radius = square ? size * 0.28 : size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  const initials = name.trim().split(' ').slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  const color = AV_COLORS[name.length % AV_COLORS.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: radius, backgroundColor: color }]}>
      <Text style={[styles.avatarTxt, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
};

const AuthorRow: React.FC<{
  name: string;
  sub?: string;
  time: string;
  avatarUrl?: string | null;
  isVenue?: boolean;
  onPress?: () => void;
}> = ({ name, sub, time, avatarUrl, isVenue, onPress }) => {
  const inner = (
    <View style={styles.authorRow}>
      <Avatar name={name} uri={avatarUrl} square={isVenue} />
      <View style={{ flex: 1 }}>
        <Text style={styles.authorName} numberOfLines={1}>{name}</Text>
        <Text style={styles.authorSub} numberOfLines={1}>
          {isVenue ? 'Sede · ' : sub ? `${sub} · ` : ''}
          {time}
        </Text>
      </View>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {inner}
    </Pressable>
  );
};

const Engagement: React.FC<{ kudos: number; comments: number; kudoed?: boolean }> = ({
  kudos,
  comments,
  kudoed,
}) => (
  <View style={styles.engRow}>
    <View style={styles.engItem}>
      <Text style={styles.engIcon}>👏</Text>
      <Text style={[styles.engTxt, kudoed && { color: Colors.accent }]}>{kudos}</Text>
    </View>
    <View style={styles.engItem}>
      <Text style={styles.engIcon}>💬</Text>
      <Text style={styles.engTxt}>{comments}</Text>
    </View>
    <View style={{ flex: 1 }} />
    <Text style={styles.engShare}>↗ Compartir</Text>
  </View>
);

// ── Tarjeta de dato REAL ────────────────────────────────────────────
const pairFrom = (m: FeedMatch, side: number) =>
  m.participants
    .filter((p) => p.side === side)
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.name)
    .filter(Boolean)
    .join(' / ');

const setsStr = (sets: [number, number][]) => sets.map(([a, b]) => `${a}-${b}`).join('  ');

const RealCard: React.FC<{ item: FeedItem }> = ({ item }) => {
  const navigation = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const isVenue = !!item.author.is_venue;
  const name = item.author.name || (isVenue ? 'Club' : 'Jugador');
  const time = timeAgo(item.created_at);
  const openAuthor = isVenue
    ? () => navigation.navigate('VenuePublic', { venueId: item.author.id })
    : undefined;

  let body: React.ReactNode = null;
  if (item.kind === 'casual_match' && item.match) {
    const m = item.match;
    const p0 = pairFrom(m, 0);
    const p1 = pairFrom(m, 1);
    const win0 = m.winner_side === 0;
    const win1 = m.winner_side === 1;
    body = (
      <>
        <View style={styles.tagRow}>
          <View style={styles.hair} />
          <Text style={styles.tag}>{m.type.toUpperCase()}</Text>
          <View style={styles.hair} />
        </View>
        <View style={styles.matchup}>
          <Text style={[styles.mPair, win0 && { color: WIN }]} numberOfLines={1}>{p0 || '—'}</Text>
          <Text style={styles.mVs}>vs</Text>
          <Text style={[styles.mPair, win1 && { color: WIN }]} numberOfLines={1}>{p1 || '—'}</Text>
        </View>
        <Text style={styles.mSets}>{setsStr(m.sets)}</Text>
      </>
    );
  } else if (item.kind === 'photo' || item.kind === 'video') {
    body = (
      <>
        <View style={styles.media}>
          <Text style={styles.mediaEmoji}>{item.kind === 'video' ? '🎬' : '📷'}</Text>
        </View>
        {item.body ? <Text style={styles.postBody}>{item.body}</Text> : null}
      </>
    );
  } else {
    body = item.body ? <Text style={styles.postBody}>{item.body}</Text> : null;
  }

  return (
    <View style={styles.card}>
      <AuthorRow
        name={name}
        time={time}
        avatarUrl={item.author.avatar_url}
        isVenue={isVenue}
        onPress={openAuthor}
      />
      <View style={{ marginTop: 12 }}>{body}</View>
      <Engagement kudos={item.kudos_count} comments={item.comments_count} kudoed={item.viewer_kudoed} />
    </View>
  );
};

export const FeedScreen = () => {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    listFeed(30)
      .then((d) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const hasReal = items !== null && items.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.brand}>Feed</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f, i) => (
              <Pressable key={f} onPress={() => setActive(i)} style={[styles.chip, active === i && styles.chipActive]}>
                <Text style={[styles.chipTxt, active === i && styles.chipTxtActive]}>{f}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : hasReal ? (
          items!.map((it) => <RealCard key={it.id} item={it} />)
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎾</Text>
            <Text style={styles.emptyTitle}>Aún no hay actividad</Text>
            <Text style={styles.emptyTxt}>
              Registra un partido o publica algo desde el botón ➕ y aparecerá
              aquí, en el feed de tu club.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  brand: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  filters: { gap: 8, paddingTop: 14, paddingRight: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  chipActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  chipTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTxtActive: { color: Colors.accent },

  loader: { paddingTop: 60, alignItems: 'center' },
  empty: { paddingTop: 60, paddingHorizontal: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  emptyTxt: { color: Colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },

  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#EAF6F0', fontWeight: '700' },
  authorName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  authorSub: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  postBody: { color: Colors.text, fontSize: 15, lineHeight: 22 },

  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  hair: { height: 1, width: 24, backgroundColor: Colors.hairStrong },
  tag: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2.5, color: Colors.textMuted },
  matchup: { alignItems: 'center', gap: 3, marginTop: 12 },
  mPair: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  mVs: { color: Colors.textFaint, fontSize: 12 },
  mSets: { color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 10 },

  media: {
    height: 180,
    borderRadius: 14,
    backgroundColor: '#10201B',
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  mediaEmoji: { fontSize: 40 },

  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairStrong,
    paddingTop: 12,
  },
  engItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  engIcon: { fontSize: 15 },
  engTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  engShare: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
});
