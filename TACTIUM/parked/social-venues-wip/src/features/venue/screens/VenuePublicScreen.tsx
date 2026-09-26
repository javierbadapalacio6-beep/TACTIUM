import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBack, IconPin, IconShare } from '@components/ui/Icon';
import { getVenueById, type MyVenue } from '@core/services/venues';
import { listVenuePosts, type FeedItem } from '@core/services/posts';
import { VenueInfoSections } from '../components/VenueInfoSections';
import { toast } from '@store/toastStore';

// Ficha PÚBLICA de una sede: se abre al tocar el club (feed/perfil). Read-only,
// con toda la info + los posts que la sede haya publicado. Desacoplada del
// ParamList concreto para poder vivir en varios stacks (Perfil y Feed).
export const VenuePublicScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const venueId = (route.params as { venueId: string }).venueId;

  const [venue, setVenue] = useState<MyVenue | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getVenueById(venueId)
        .then((v) => !cancelled && setVenue(v))
        .catch(() => !cancelled && setVenue(null))
        .finally(() => !cancelled && setLoading(false));
      listVenuePosts(venueId)
        .then((p) => !cancelled && setPosts(p))
        .catch(() => !cancelled && setPosts([]));
      return () => {
        cancelled = true;
      };
    }, [venueId]),
  );

  const openMap = () => {
    if (!venue) return;
    const q =
      venue.lat != null && venue.lng != null
        ? `${venue.lat},${venue.lng}`
        : encodeURIComponent(
            [venue.name, venue.location, venue.city].filter(Boolean).join(', '),
          );
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(
      () => toast.error('No se pudo abrir el mapa'),
    );
  };

  const openWebsite = () => {
    if (!venue?.website) return;
    const url = /^https?:\/\//i.test(venue.website) ? venue.website : `https://${venue.website}`;
    Linking.openURL(url).catch(() => toast.error('No se pudo abrir la web'));
  };

  const initials = (venue?.name ?? '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const place = [venue?.city, venue?.province].filter(Boolean).join(' · ');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconBtn}>
          <IconBack size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {venue?.name ?? 'Club'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : !venue ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Club no encontrado</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        >
          {/* Cabecera: logo + nombre + ubicación */}
          <View style={styles.hero}>
            {venue.logo_url ? (
              <Image source={{ uri: venue.logo_url }} style={styles.crestImg} />
            ) : (
              <View style={styles.crest}>
                <Text style={styles.crestText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.name}>{venue.name}</Text>
            {place ? <Text style={styles.sub}>{place}</Text> : null}
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>SEDE DE PÁDEL</Text>
            </View>
          </View>

          {/* Ubicación */}
          <Text style={styles.sectionLabel}>UBICACIÓN</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <IconPin size={18} color={Colors.accent} />
              <Text style={styles.cardText}>
                {venue.location || place || 'Sin dirección'}
              </Text>
            </View>
            <Pressable style={styles.inlineBtn} onPress={openMap}>
              <Text style={styles.inlineBtnTxt}>Ver en el mapa</Text>
            </Pressable>
          </View>

          {/* Web */}
          {venue.website ? (
            <>
              <Text style={styles.sectionLabel}>WEB</Text>
              <Pressable style={styles.card} onPress={openWebsite}>
                <View style={styles.cardRow}>
                  <IconShare size={16} color={Colors.accent} />
                  <Text style={[styles.cardText, { color: Colors.accent }]} numberOfLines={1}>
                    {venue.website}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}

          {/* Info rica compartida (sobre, datos, servicios, teléfono) */}
          <VenueInfoSections venue={venue} />

          {/* Publicaciones de la sede */}
          <Text style={styles.sectionLabel}>PUBLICACIONES</Text>
          {posts.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyPosts}>
                Este club aún no ha publicado nada.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {posts.map((p) => (
                <View key={p.id} style={styles.card}>
                  {p.body ? <Text style={styles.postBody}>{p.body}</Text> : null}
                  <Text style={styles.postMeta}>
                    {new Date(p.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    {p.kudos_count > 0 ? ` · ${p.kudos_count} 👏` : ''}
                  </Text>
                </View>
              ))}
            </View>
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 4 },
  crest: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  crestImg: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.accent40,
    marginBottom: 14,
  },
  crestText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  sub: { color: Colors.textMuted, fontSize: 13, marginTop: 6, fontFamily: Fonts.mono },
  badge: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  badgeTxt: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
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
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  inlineBtn: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
  },
  inlineBtnTxt: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  emptyPosts: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 6 },
  postBody: { color: Colors.text, fontSize: 14, lineHeight: 21 },
  postMeta: { color: Colors.textFaint, fontSize: 12, fontFamily: Fonts.mono, marginTop: 8 },
});
