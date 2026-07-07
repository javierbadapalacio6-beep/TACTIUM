import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconRacket, IconTicket, IconGift } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { DOWNLOAD_URL } from '@core/config/referral';
import {
  fetchMyCasualMatches,
  type CasualMatchSummary,
} from '@core/services/casualMatches';
import type { HomeStackScreenProps } from '@navigation/types';

// Home del JUGADOR SUELTO (F8): usuario sin equipo. Tres acciones:
// registrar un amistoso, canjear un código de partido (en Stats) e
// invitar colegas. Es la landing del loop de adquisición: quien llega
// por el código de un amistoso aterriza aquí.

type Nav = HomeStackScreenProps<'HomeRoot'>['navigation'];

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const SoloHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const [matches, setMatches] = useState<CasualMatchSummary[]>([]);

  // Últimos partidos: se refresca al volver (p. ej. tras guardar uno).
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      fetchMyCasualMatches(user.id)
        .then((all) => setMatches(all.slice(0, 4)))
        .catch(() => setMatches([]));
    }, [user?.id]),
  );

  const firstName = (() => {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string };
    const n = (meta.full_name ?? '').trim();
    return n ? n.split(' ')[0] : null;
  })();

  const inviteFriends = async () => {
    try {
      await Share.share({
        message: [
          'Únete a TACTIUM y registramos nuestros partidos de pádel 🎾',
          `Descárgala aquí: ${DOWNLOAD_URL}`,
        ].join('\n'),
      });
    } catch {
      // cancelado
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <TactiumMark size={30} gradient />
        <Text style={styles.brand}>TACTIUM</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {firstName ? `HOLA, ${firstName.toUpperCase()}` : 'TU PÁDEL'}
        </Text>
        <Text style={styles.title}>Tus partidos,{'\n'}tus números.</Text>

        {/* Hero: registrar amistoso */}
        <Pressable
          onPress={() => navigation.navigate('Amistoso')}
          style={({ pressed }) => [styles.hero, pressed && { opacity: 0.95 }]}
        >
          <LinearGradient
            colors={[Colors.primary, '#062520', Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroIcon}>
            <IconRacket size={26} color={Colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Registrar un amistoso</Text>
          <Text style={styles.heroText}>
            Apunta el partido con tus colegas: marcador en sets, foto y
            resumen para el grupo de WhatsApp.
          </Text>
          <View style={styles.heroCta}>
            <Text style={styles.heroCtaText}>EMPEZAR</Text>
          </View>
        </Pressable>

        {/* Últimos partidos (si ya tiene alguno) */}
        {matches.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>ÚLTIMOS PARTIDOS</Text>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Stats')}
              style={({ pressed }) => [
                styles.resultsCard,
                pressed && { opacity: 0.92 },
              ]}
            >
              {matches.map((cm) => (
                <View key={cm.id} style={styles.resultRow}>
                  <View
                    style={[
                      styles.resultBadge,
                      {
                        backgroundColor: cm.won
                          ? 'rgba(0,255,170,0.12)'
                          : 'rgba(255,107,107,0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultBadgeTxt,
                        { color: cm.won ? Colors.accent : Colors.error },
                      ]}
                    >
                      {cm.won ? 'V' : 'D'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      vs {cm.rivals || 'rival'}
                    </Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {cm.partner ? `con ${cm.partner} · ` : ''}
                      {formatShortDate(cm.playedOn)}
                    </Text>
                  </View>
                  <Text style={styles.resultSets}>{cm.sets}</Text>
                </View>
              ))}
              <Text style={styles.resultsAll}>Ver todas mis stats →</Text>
            </Pressable>
          </>
        ) : null}

        {/* Canje de código */}
        <Pressable
          onPress={() => navigation.getParent()?.navigate('Stats')}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.cardIcon}>
            <IconTicket size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>¿Tienes un código de partido?</Text>
            <Text style={styles.cardText}>
              Canjéalo en Stats y ese partido contará en tus números.
            </Text>
          </View>
        </Pressable>

        {/* Invitar colegas */}
        <Pressable
          onPress={inviteFriends}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.cardIcon}>
            <IconGift size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>Invita a tus colegas</Text>
            <Text style={styles.cardText}>
              Con TACTIUM los partidos cuentan para todos.
            </Text>
          </View>
        </Pressable>

        {/* Puente al modo equipo */}
        <View style={styles.teamBox}>
          <Text style={styles.teamBoxTitle}>¿Juegas en un equipo?</Text>
          <Text style={styles.teamBoxText}>
            Si tu capitán usa TACTIUM, pídele una invitación y canjéala en
            Perfil ("Canjear invitación"). Verás tu liga, tus alineaciones y
            tus stats oficiales.
          </Text>
          {/* De jugador a gestor: apagar el modo suelto devuelve a la
              elección inicial (crear equipo / club). Sin equipo creado se
              puede volver eligiendo "Juego por mi cuenta" otra vez. */}
          <Pressable
            onPress={() => {
              setSoloUpgrade(true);
              setSoloMode(false);
            }}
            hitSlop={8}
          >
            <Text style={styles.teamBoxLink}>
              ¿Capitaneas o gestionas un club? Crea tu equipo →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  brand: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginBottom: 18,
  },
  hero: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,170,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,170,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.accent,
  },
  heroCtaText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 8,
  },
  resultsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair,
  },
  resultBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeTxt: { fontSize: 12, fontWeight: '800' },
  resultName: { color: Colors.text, fontSize: 13.5, fontWeight: '700' },
  resultMeta: { color: Colors.textFaint, fontSize: 11.5, marginTop: 1 },
  resultSets: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  resultsAll: {
    color: Colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 16,
    marginBottom: 12,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(0,255,170,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  cardText: {
    color: Colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  teamBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    borderStyle: 'dashed',
    padding: 16,
    marginTop: 6,
  },
  teamBoxTitle: {
    color: Colors.text,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  teamBoxText: {
    color: Colors.textFaint,
    fontSize: 12.5,
    lineHeight: 18,
  },
  teamBoxLink: {
    color: Colors.accent,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
});
