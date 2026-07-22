import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconShare } from '@components/ui';
import { toast } from '@store/toastStore';
import {
  getTournament,
  listRegistrations,
  type Tournament,
  type TournamentRegistration,
} from '@core/services/tournaments';

import type { TournamentsStackScreenProps } from '@navigation/types';

export const TournamentDetailScreen = ({
  navigation,
  route,
}: TournamentsStackScreenProps<'TournamentDetail'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;

  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<TournamentRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tt, rr] = await Promise.all([
        getTournament(tournamentId),
        listRegistrations(tournamentId),
      ]);
      setT(tt);
      setRegs(rr);
    } catch (e: any) {
      toast.error('No se pudo cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shareCode = async () => {
    if (!t?.signup_code) return;
    try {
      await Share.share({
        message:
          `🎾 Apúntate al torneo "${t.name}" en TACTIUM.\n` +
          `Código de inscripción: ${t.signup_code}`,
      });
    } catch {
      // cancelado
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>TORNEO</Text>
          <Text style={styles.title} numberOfLines={1}>
            {t?.name ?? ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Código de inscripción */}
          {t?.signup_code ? (
            <View style={styles.codeCard}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.codeLabel}>CÓDIGO DE INSCRIPCIÓN</Text>
                <Text style={styles.code}>{t.signup_code}</Text>
                <Text style={styles.codeHint}>
                  Compártelo para que se apunten desde la app.
                </Text>
              </View>
              <Pressable
                onPress={shareCode}
                hitSlop={8}
                style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
              >
                <IconShare size={16} color={c.accent} />
              </Pressable>
            </View>
          ) : null}

          {/* Inscritos */}
          <Text style={styles.sectionLabel}>
            INSCRITOS · {regs.length}
            {t?.max_pairs ? `/${t.max_pairs}` : ''}
          </Text>
          {regs.length === 0 ? (
            <Text style={styles.emptyText}>
              Aún no hay parejas inscritas. Cuando se apunten, aparecerán aquí y
              podrás generar el cuadro.
            </Text>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              {regs.map((r, i) => (
                <View key={r.id} style={styles.regRow}>
                  <Text style={styles.regIdx}>{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.regName} numberOfLines={1}>
                      {r.p1_name}
                      {r.p2_name ? ` / ${r.p2_name}` : ''}
                    </Text>
                    {r.availability.length > 0 ? (
                      <Text style={styles.regMeta} numberOfLines={1}>
                        {r.availability.join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Cuadro (próximo paso) */}
          <View style={styles.bracketPlaceholder}>
            <Text style={styles.bracketTitle}>Cuadro</Text>
            <Text style={styles.bracketText}>
              Cuando cierres la inscripción, la app sembrará por puntos/categoría
              y generará el cuadro. (En construcción.)
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 2,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    codeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent25,
      padding: 16,
      marginTop: 8,
    },
    codeLabel: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '500',
    },
    code: {
      fontFamily: Fonts.mono,
      fontSize: 28,
      fontWeight: '800',
      color: c.accent,
      letterSpacing: 4,
      marginTop: 4,
    },
    codeHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    shareBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    regRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    regIdx: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '700',
      color: c.textFaint,
      width: 20,
    },
    regName: { color: c.text, fontSize: 15, fontWeight: '600' },
    regMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    bracketPlaceholder: {
      marginTop: 24,
      padding: 16,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderStyle: 'dashed',
      backgroundColor: c.bgCard,
    },
    bracketTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    bracketText: { color: c.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 },
  });
