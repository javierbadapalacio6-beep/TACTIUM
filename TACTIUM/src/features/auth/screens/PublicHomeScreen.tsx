import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { AmbientBackdrop, IconTrophy, IconAnalytics, IconSearch } from '@components/ui';

import type { AuthStackScreenProps } from '@navigation/types';

/**
 * Home PÚBLICA — lo primero que ve quien abre la app sin cuenta.
 *
 * El orden importa: antes lo primero era el login, así que la app pedía
 * identificarse para dejarte mirar nada. Un club comparte su torneo por
 * WhatsApp y quien abre el enlace no tiene por qué tener cuenta; si lo
 * primero que ve es un formulario, se va.
 *
 * Aquí se enseña producto — torneos y federación, con datos reales — y la
 * cuenta se pide cuando hace falta saber quién eres: al inscribirte, al
 * seguir a alguien o al gestionar tu equipo.
 *
 * (Además, la guideline 5.1.1(v) de Apple dice que una app no puede exigir
 * registro para funciones que no lo necesitan.)
 */
export const PublicHomeScreen = ({
  navigation,
}: AuthStackScreenProps<'PublicHome'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const destinos = [
    {
      key: 'torneos',
      Icon: IconTrophy,
      title: 'Torneos',
      body: 'Cuadros, horarios y resultados en directo de los torneos que organizan los clubes.',
      onPress: () => navigation.getParent()?.navigate('ExploreTournaments'),
    },
    {
      key: 'federacion',
      Icon: IconAnalytics,
      title: 'Federación',
      body: 'Clasificaciones, jornadas, actas y rankings de la Federación Cántabra.',
      onPress: () => navigation.navigate('Federacion'),
    },
  ];

  return (
    <View style={styles.root}>
      <AmbientBackdrop />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <TactiumMark size={30} />
          <Text style={styles.brand}>TACTIUM</Text>
        </View>

        <Text style={styles.eyebrow}>EXPLORAR</Text>
        <Text style={styles.title}>Mira torneos y federación sin crear cuenta</Text>
        <Text style={styles.lede}>
          Entra sólo cuando quieras inscribirte en un torneo o gestionar tu
          equipo.
        </Text>

        {destinos.map((d) => (
          <Pressable
            key={d.key}
            onPress={d.onPress}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.cardIcon}>
              <d.Icon size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle}>{d.title}</Text>
              <Text style={styles.cardBody}>{d.body}</Text>
            </View>
          </Pressable>
        ))}

        {/* Atajo para quien llega con un código del club en la mano. */}
        <Pressable
          onPress={() => navigation.navigate('Login')}
          style={({ pressed }) => [styles.codeRow, pressed && { opacity: 0.8 }]}
        >
          <IconSearch size={15} color={c.textMuted} />
          <Text style={styles.codeText}>
            ¿Tienes un código de torneo? Entra para inscribirte
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        {/* ── Acceso ────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.primaryLabel}>Iniciar sesión</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.secondary,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.secondaryLabel}>Crear cuenta</Text>
          </Pressable>

          <Text style={styles.trial}>
            14 días de prueba gratis al crear tu primer equipo
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { flexGrow: 1, paddingHorizontal: 22, gap: 0 },

    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 34,
    },
    brand: {
      color: c.text,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: 3,
    },

    eyebrow: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 2.4,
      marginBottom: 10,
    },
    title: {
      color: c.text,
      fontSize: 30,
      lineHeight: 35,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    lede: {
      color: c.textMuted,
      fontSize: 14.5,
      lineHeight: 21,
      marginTop: 12,
      marginBottom: 26,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      padding: 18,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      marginBottom: 12,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primaryDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { color: c.text, fontSize: 16.5, fontWeight: '700' },
    cardBody: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 5,
    },

    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 14,
    },
    codeText: { color: c.textMuted, fontSize: 13, flex: 1 },

    actions: { marginTop: 28, gap: 10 },
    primary: {
      height: 54,
      borderRadius: 999,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: c.textInverse,
      fontSize: 15.5,
      fontWeight: '700',
    },
    secondary: {
      height: 54,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: { color: c.text, fontSize: 15.5, fontWeight: '700' },
    trial: {
      color: c.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 6,
    },
  });
