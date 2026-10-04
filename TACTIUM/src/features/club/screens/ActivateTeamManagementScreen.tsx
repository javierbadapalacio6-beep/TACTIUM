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
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconCheck, IconChevron } from '@components/ui';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';
import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { StaggerRow, lightTap } from '@features/team/components/TeamMotion';

import type { RootStackScreenProps } from '@navigation/types';

type Choice = 'fcp' | 'privada';

/**
 * Activar la gestión de equipos en un club «solo torneos». Rediseño 2026-10:
 *
 *  1. ¿En qué liga juegan? Tres opciones, no veinte: la Cántabra (la única
 *     federación activa hoy), «Liga privada» (el «Sin federación» de antes) y
 *     «Otra federación · irán entrando», que no se puede elegir todavía.
 *  2. Tras activar, un PRIMER PASO (traer de la Federación o crear a mano) con
 *     el paywall como enlace, no de golpe (decisión 2). Antes saltaba al
 *     paywall y, al cerrarlo, dejaba una pestaña de equipos vacía.
 */
export const ActivateTeamManagementScreen = ({
  navigation,
}: RootStackScreenProps<'ActivateTeamManagement'>) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const club = useClubStore(selectActiveClub);
  const unlockTeamManagement = useClubStore((st) => st.unlockTeamManagement);

  const [choice, setChoice] = useState<Choice>('fcp');
  const [otherNote, setOtherNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [fcpOpen, setFcpOpen] = useState(false);

  const handleActivate = async () => {
    if (!club || submitting) return;
    setSubmitting(true);
    try {
      await unlockTeamManagement(
        club.id,
        choice === 'fcp' ? FCP_FEDERATION_CODE : null,
      );
      lightTap();
      setDone(true);
    } catch (e: any) {
      toast.error('No se pudo activar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const goCreate = () =>
    navigation.replace('MainTabs', {
      screen: 'Home',
      params: { screen: 'CreateTeamFromClub' },
    });
  const goTeams = () => navigation.replace('MainTabs', { screen: 'Team' });

  const Option = ({
    id,
    badge,
    title,
    sub,
  }: {
    id: Choice;
    badge: string;
    title: string;
    sub: string;
  }) => {
    const sel = choice === id;
    return (
      <Pressable
        onPress={() => setChoice(id)}
        accessibilityRole="radio"
        accessibilityState={{ checked: sel }}
        style={[s.row, sel && { backgroundColor: c.accent10, borderColor: c.accent50 }]}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rowName}>{title}</Text>
          <Text style={s.rowMeta}>{sub}</Text>
        </View>
        {sel ? <IconCheck size={16} color={c.accent} /> : null}
      </Pressable>
    );
  };

  if (done) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 24 }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={reduced ? undefined : ZoomIn.springify().damping(12)}
            style={s.doneIcon}
          >
            <IconCheck size={26} color={c.accent} />
          </Animated.View>
          <Text style={s.eyebrow}>EQUIPOS ACTIVADOS</Text>
          <Text style={s.title}>¿Por dónde empiezas?</Text>

          <View style={{ gap: 10, marginTop: 18 }}>
            {choice === 'fcp' ? (
              <StaggerRow index={0}>
                <Pressable
                  onPress={() => setFcpOpen(true)}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.step, pressed && { opacity: 0.85 }]}
                >
                  <View style={s.stepGlyph}>
                    <Text style={s.stepGlyphText}>F</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName}>Traer mis equipos de la Federación</Text>
                    <Text style={s.rowMeta}>Busca el club y elige cuáles</Text>
                  </View>
                  <IconChevron size={14} color={c.textFaint} />
                </Pressable>
              </StaggerRow>
            ) : null}
            <StaggerRow index={1}>
              <Pressable
                onPress={goCreate}
                accessibilityRole="button"
                style={({ pressed }) => [s.step, pressed && { opacity: 0.85 }]}
              >
                <View style={s.stepGlyph}>
                  <Text style={s.stepGlyphText}>＋</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowName}>Crear un equipo a mano</Text>
                  <Text style={s.rowMeta}>Nombre, categoría y género</Text>
                </View>
                <IconChevron size={14} color={c.textFaint} />
              </Pressable>
            </StaggerRow>
          </View>

          <StaggerRow index={2} style={s.trial}>
            <Text style={s.trialTitle}>14 días con todo, sin tarjeta</Text>
            <Text style={s.rowMeta}>Luego eliges plan de club o sigues en gratis</Text>
          </StaggerRow>

          <Pressable
            onPress={() => navigation.replace('Paywall', { intent: 'club' })}
            hitSlop={8}
            accessibilityRole="link"
            style={{ alignSelf: 'center', marginTop: 16 }}
          >
            <Text style={s.link}>Ver planes de club</Text>
          </Pressable>
          <Pressable
            onPress={goTeams}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: 'center', marginTop: 14 }}
          >
            <Text style={s.later}>Lo haré luego</Text>
          </Pressable>
        </ScrollView>

        {club ? (
          <FcpImportSheet
            open={fcpOpen}
            clubId={club.id}
            onClose={() => setFcpOpen(false)}
            onImported={() => {
              setFcpOpen(false);
              goTeams();
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.headerBtn}>
          <IconBack size={18} color={c.text} />
        </Pressable>
        <Text style={s.headerTitle}>Atrás</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>GESTIÓN DE EQUIPOS</Text>
        <Text style={s.title}>¿En qué liga juegan?</Text>

        <View style={s.list}>
          <Option
            id="fcp"
            badge="FCP"
            title="Federación Cántabra de Pádel"
            sub="Calendario, grupos y plantillas oficiales"
          />
          <Option
            id="privada"
            badge="—"
            title="Liga privada"
            sub="SNP, LAPI, interempresas, de club…"
          />
          <Pressable
            onPress={() => setOtherNote((v) => !v)}
            accessibilityRole="button"
            style={[s.row, { opacity: 0.75 }]}
          >
            <View style={s.badge}>
              <Text style={s.badgeText}>···</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowName}>Otra federación</Text>
              <Text style={s.rowMeta}>Irán entrando. Mientras, usa liga privada</Text>
            </View>
          </Pressable>
          {otherNote ? (
            <Text style={s.note}>
              Hoy solo está activa la Federación Cántabra. Elige «Liga privada» y
              podrás cambiarlo cuando llegue la tuya.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[s.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          disabled={submitting}
          onPress={handleActivate}
          accessibilityRole="button"
          style={({ pressed }) => [
            s.ctaBtn,
            submitting && { opacity: 0.5 },
            pressed && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={c.textInverse} />
          ) : (
            <Text style={s.ctaLabel}>Activar</Text>
          )}
        </Pressable>
        <Text style={s.ctaHint}>Se puede cambiar más adelante.</Text>
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
    headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, color: c.textMuted, fontSize: 14, fontWeight: '600' },
    scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 31,
      marginTop: 6,
      marginBottom: 18,
    },
    list: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    badge: {
      minWidth: 48,
      paddingHorizontal: 8,
      height: 34,
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
    rowName: { color: c.text, fontSize: 14.5, fontWeight: '700', letterSpacing: -0.1 },
    rowMeta: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
    cta: { paddingHorizontal: 20, paddingTop: 8 },
    ctaBtn: {
      height: 54,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaLabel: { color: c.textInverse, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    ctaHint: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
    doneIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    stepGlyph: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepGlyphText: { color: c.accent, fontSize: 16, fontWeight: '700' },
    trial: {
      marginTop: 18,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
    },
    trialTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    link: { color: c.accent, fontSize: 14, fontWeight: '700' },
    later: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
  });
