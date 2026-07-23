import React, { useCallback, useMemo, useState } from 'react';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, darkColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconBall, IconTicket, IconGift, IconTrophy } from '@components/ui';
import { TOURNAMENTS_ENABLED } from '@core/config/featureFlags';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { DOWNLOAD_URL } from '@core/config/referral';
import {
  fetchMyCasualMatches,
  type CasualMatchSummary,
} from '@core/services/casualMatches';
import type { HomeStackScreenProps, RootStackParamList } from '@navigation/types';

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // La tarjeta "registrar amistoso" es una pieza destacada de degradado
  // verde con texto claro: se mantiene SIEMPRE oscura (también en claro).
  const heroStyles = useMemo(() => makeStyles(darkColors), []);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    const meta = (user?.user_metadata ?? {}) as {
      full_name?: string;
      username?: string;
    };
    // El nombre de usuario (nombre corto) manda sobre el completo.
    const uname = (meta.username ?? '').trim();
    if (uname) return uname;
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
          style={({ pressed }) => [heroStyles.hero, pressed && { opacity: 0.95 }]}
        >
          <LinearGradient
            colors={[darkColors.primary, '#062520', darkColors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={heroStyles.heroIcon}>
            <IconBall size={26} color={darkColors.accent} />
          </View>
          <Text style={heroStyles.heroTitle}>Registrar un amistoso</Text>
          <Text style={heroStyles.heroText}>
            Apunta el partido con tus colegas: marcador en sets, foto y
            resumen para el grupo de WhatsApp.
          </Text>
          <View style={heroStyles.heroCta}>
            <Text style={heroStyles.heroCtaText}>EMPEZAR</Text>
          </View>
        </Pressable>

        {TOURNAMENTS_ENABLED ? (
          <Pressable
            onPress={() => rootNav.navigate('TournamentSignup')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: c.bgCard,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.hairStrong,
                padding: 14,
                marginTop: 12,
              },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.accent15,
              }}
            >
              <IconTrophy size={18} color={c.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>
                Apuntarme a un torneo
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                ¿Tienes un código? Inscríbete con tu pareja
              </Text>
            </View>
          </Pressable>
        ) : null}

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
                        { color: cm.won ? c.accent : c.error },
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
            <IconTicket size={20} color={c.accent} />
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
            <IconGift size={20} color={c.accent} />
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

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  brand: {
    color: c.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 10 },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
    marginBottom: 18,
  },
  hero: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
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
    color: c.text,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroText: {
    color: c.textMuted,
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
    backgroundColor: c.accent,
  },
  heroCtaText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10.5,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 8,
  },
  resultsCard: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
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
    borderColor: c.hair,
  },
  resultBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeTxt: { fontSize: 12, fontWeight: '800' },
  resultName: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  resultMeta: { color: c.textFaint, fontSize: 11.5, marginTop: 1 },
  resultSets: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 12,
    fontWeight: '600',
  },
  resultsAll: {
    color: c.accent,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
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
    color: c.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  cardText: {
    color: c.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
  teamBox: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    borderStyle: 'dashed',
    padding: 16,
    marginTop: 6,
  },
  teamBoxTitle: {
    color: c.text,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  teamBoxText: {
    color: c.textFaint,
    fontSize: 12.5,
    lineHeight: 18,
  },
  teamBoxLink: {
    color: c.accent,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 10,
  },
});
