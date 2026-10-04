import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconCheck } from '@components/ui';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useTeamStore } from '@store/teamStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { clubCoverage } from '@core/entitlements/coverage';
import { CLUB_PLANS, PLAN_BY_TIER, isLiveSub } from '@core/subscriptions/plans';
import { toast } from '@store/toastStore';
import { tapSuccess } from '../clubOps';

import type { RootStackScreenProps } from '@navigation/types';

const genderShort = (g: string | null) =>
  g === 'femenino' ? 'Fem.' : g === 'mixto' ? 'Mixto' : g === 'masculino' ? 'Masc.' : null;

/**
 * «Elige qué equipos cubre». Con más equipos que plazas la cobertura automática
 * se para (cubrir es permanente hasta que acabe el periodo) y el club elige
 * aquí, con la regla a la vista. Usa el mismo `coverTeams` del store.
 */
export const ClubCoverTeamsScreen = ({ navigation }: RootStackScreenProps<'ClubCoverTeams'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const coverTeams = useTeamStore((s) => s.coverTeams);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const coverage = clubCoverage(club?.id ?? null, teams, subscriptions);

  const plan = useMemo(() => {
    if (!club) return null;
    const sub = subscriptions.find(
      (s) => s.subject_type === 'club' && s.subject_id === club.id && isLiveSub(s),
    );
    return sub ? PLAN_BY_TIER[sub.plan_tier] : null;
  }, [subscriptions, club]);
  const nextPlan = plan
    ? CLUB_PLANS.find((p) => p.teamQuota > plan.teamQuota) ?? null
    : null;

  const clubTeams = useMemo(
    () =>
      (club ? teams.filter((t) => t.club_id === club.id) : [])
        .slice()
        .sort((a, b) => Number(!!b.covered) - Number(!!a.covered) || a.name.localeCompare(b.name)),
    [teams, club],
  );
  const free = Math.max(0, coverage.quota - coverage.used);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const left = clubTeams.filter((t) => !t.covered && !picked.includes(t.id));

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < free ? [...prev, id] : prev,
    );

  const confirm = () => {
    if (!picked.length || busy) return;
    const names = clubTeams.filter((t) => picked.includes(t.id)).map((t) => t.name);
    Alert.alert(
      picked.length === 1 ? `Cubrir ${names[0]}` : `Cubrir ${picked.length} equipos`,
      'Cubrir un equipo es permanente hasta que acabe el periodo del plan. ¿Seguimos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cubrir',
          onPress: async () => {
            setBusy(true);
            try {
              await coverTeams(picked);
              tapSuccess();
              toast.success(
                picked.length === 1 ? 'Equipo cubierto' : 'Equipos cubiertos',
                'Su capitán ya tiene Pro con el plan del club.',
              );
              setPicked([]);
            } catch (e: any) {
              toast.error('No se pudo cubrir', e?.message ?? 'Inténtalo de nuevo.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const btnLabel =
    picked.length === 0
      ? free > 0
        ? 'Elige un equipo'
        : 'No te quedan plazas'
      : `Cubrir ${picked.length === 1 ? clubTeams.find((t) => t.id === picked[0])?.name ?? '' : `${picked.length} equipos`} · ${coverage.used + picked.length} de ${coverage.quota}`;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {plan ? `${plan.displayName.toUpperCase()} · ${coverage.quota} PLAZAS` : 'SIN PLAN'}
        </Text>
        <Text style={styles.title}>Elige qué equipos cubre</Text>
        {plan ? (
          <Text style={styles.lede}>
            Tienes {clubTeams.length} {clubTeams.length === 1 ? 'equipo' : 'equipos'} y{' '}
            {coverage.quota} plazas. Cubrir es permanente hasta que acabe el periodo.
          </Text>
        ) : (
          <Text style={styles.lede}>
            El club no tiene un plan activo. Con un plan de club, sus capitanes tienen Pro sin
            pagar nada.
          </Text>
        )}

        <View style={styles.list}>
          {clubTeams.map((t, i) => {
            const on = picked.includes(t.id);
            const locked = !!t.covered;
            const disabled = !plan || locked || (!on && picked.length >= free);
            return (
              <Pressable
                key={t.id}
                onPress={() => toggle(t.id)}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: locked || on, disabled }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowDivider,
                  on && { backgroundColor: c.accent10 },
                  disabled && !locked && { opacity: 0.5 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[styles.check, (locked || on) && styles.checkOn]}>
                  {locked || on ? <IconCheck size={12} color={c.textInverse} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[genderShort(t.gender), t.category, locked ? 'cubierto' : on ? 'elegido' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {plan && left.length > 0 ? (
          <Text style={styles.note}>
            {left.length === 1 ? 'El capitán de ' : 'Los capitanes de '}
            {left.map((t) => t.name).join(', ')}{' '}
            {left.length === 1 ? 'sigue' : 'siguen'} pudiendo usar TACTIUM gratis, o pagar su plan
            de capitán.
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {plan ? (
          <>
            <Pressable
              onPress={confirm}
              disabled={!picked.length || busy}
              style={({ pressed }) => [
                styles.primary,
                (!picked.length || busy) && { opacity: 0.45 },
                pressed && picked.length > 0 && { opacity: 0.85 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={c.textInverse} />
              ) : (
                <Text style={styles.primaryText} numberOfLines={1}>
                  {btnLabel}
                </Text>
              )}
            </Pressable>
            {nextPlan ? (
              <Pressable
                onPress={() => navigation.navigate('Paywall', { intent: 'upgrade' })}
                hitSlop={8}
                style={{ alignSelf: 'center', marginTop: 12 }}
              >
                <Text style={styles.link}>
                  o pasar a {nextPlan.displayName} ({nextPlan.teamQuota} equipos)
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Paywall', { intent: 'club' })}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>Ver planes de club</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 6 },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
    list: {
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 56,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: c.hair },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: c.accent, borderColor: c.accent },
    name: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    meta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    note: { color: c.textFaint, fontSize: 12.5, lineHeight: 18, marginTop: 14 },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      backgroundColor: c.background,
    },
    primary: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primaryText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    link: { color: c.accent, fontSize: 13, fontWeight: '600' },
  });
