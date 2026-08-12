import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconCheck, IconTeam } from '@components/ui';
import { FEDERATIONS, type Federation } from '@core/data/federations';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';

import type { RootStackScreenProps } from '@navigation/types';

// Activar la gestión de equipos en un club creado en modo "solo torneos".
// Modelo reverse-trial: se DESBLOQUEA gratis (montar estructura es libre) y el
// paywall salta después como upsell. De paso se elige la federación del club
// (opcional): los equipos la heredan; sin ella solo hay ligas privadas.
export const ActivateTeamManagementScreen = ({
  navigation,
}: RootStackScreenProps<'ActivateTeamManagement'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const unlockTeamManagement = useClubStore((s) => s.unlockTeamManagement);

  const [fed, setFed] = useState<Federation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!club || submitting) return;
    setSubmitting(true);
    try {
      // Desbloquea (tournaments_only=false) y fija la federación elegida en un
      // solo update. Reverse-trial: no exige sub aquí; el paywall es el empujón.
      await unlockTeamManagement(club.id, fed?.code ?? null);
      toast.success(
        'Gestión de equipos activada',
        'Ya puedes crear equipos y plantillas desde las pestañas del club.',
      );
      // Upsell: mandamos al paywall de club. Con `replace`, al cerrarlo se
      // vuelve a las tabs (ya en modo club completo), no a esta pantalla.
      navigation.replace('Paywall', { intent: 'club' });
    } catch (e: any) {
      toast.error('No se pudo activar', e?.message ?? 'Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <IconBack size={18} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gestión de equipos</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <IconTeam size={22} color={c.accent} />
          </View>
          <Text style={styles.title}>Gestiona también tus equipos</Text>
          <Text style={styles.lede}>
            Alineaciones, jornadas, plantillas y capitanes — sin perder tus
            torneos. Si tus equipos juegan liga federada, elige la federación;
            si no, la dejas en blanco y usarás ligas privadas.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Federación · Opcional</Text>
        <View style={styles.list}>
          <Pressable
            onPress={() => setFed(null)}
            style={[
              styles.row,
              !fed && { backgroundColor: c.accent10, borderColor: c.accent50 },
            ]}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>—</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                Sin federación
              </Text>
              <Text style={styles.rowMeta}>SNP, LAPI, interempresas, ligas de club…</Text>
            </View>
            {!fed ? <IconCheck size={16} color={c.accent} /> : null}
          </Pressable>

          {FEDERATIONS.map((f) => {
            const sel = fed?.code === f.code;
            return (
              <Pressable
                key={f.code}
                onPress={() => setFed(f)}
                style={[
                  styles.row,
                  sel && { backgroundColor: c.accent10, borderColor: c.accent50 },
                ]}
              >
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{f.shortName}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.rowMeta}>{f.region}</Text>
                </View>
                {sel ? <IconCheck size={16} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          disabled={submitting}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.ctaBtn,
            submitting && { opacity: 0.5 },
            pressed && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.ctaLabel}>Continuar</Text>
          )}
        </Pressable>
        <Text style={styles.ctaHint}>
          Podrás cambiar la federación más adelante.
        </Text>
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
    hero: { marginBottom: 20 },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '600',
      letterSpacing: -0.6,
      lineHeight: 30,
      marginBottom: 8,
    },
    lede: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginBottom: 10,
    },
    list: { gap: 6 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    badge: {
      minWidth: 56,
      paddingHorizontal: 8,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: c.accent,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    rowName: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    rowMeta: { color: c.textFaint, fontSize: 11, marginTop: 2 },
    cta: { paddingHorizontal: 20, paddingTop: 8 },
    ctaBtn: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    ctaLabel: {
      color: '#001810',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    ctaHint: {
      color: c.textFaint,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 10,
    },
  });
