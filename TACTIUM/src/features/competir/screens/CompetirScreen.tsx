import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { IconChevron, IconTrophy } from '@components/ui';
import { SegmentedControl, type SegmentOption } from '@components/ui/SegmentedControl';
import { TOURNAMENTS_ENABLED } from '@core/config/featureFlags';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { SeasonsScreen } from '@features/seasons/screens/SeasonsScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FederacionPickerScreen } from '@features/seasons/screens/FederacionPickerScreen';
import { ClubScheduleScreen } from '@features/club/screens/ClubScheduleScreen';
import { ExploreTournamentsScreen } from '@features/tournaments/screens/ExploreTournamentsScreen';
import { NoTeamState } from '@features/team/components/NoTeamState';
import { useNavRole, type NavRole } from '@navigation/navRole';
import type {
  CompetirSegment,
  CompetirStackScreenProps,
} from '@navigation/types';

const LABEL: Record<CompetirSegment, string> = {
  liga: 'Liga',
  federacion: 'Federación',
  torneos: 'Torneos',
};

/** Segmentos de Competir por rol. El organizador no tiene liga. */
function segmentsFor(role: NavRole): CompetirSegment[] {
  if (role === 'organizer') return ['torneos', 'federacion'];
  const all: CompetirSegment[] = ['liga', 'federacion', 'torneos'];
  return TOURNAMENTS_ENABLED ? all : all.filter((s) => s !== 'torneos');
}

/** Segmento por defecto (sin uno recordado): el organizador y el suelto
 *  abren en Torneos (no tienen liga); el resto, en Liga. */
function defaultSegment(role: NavRole): CompetirSegment {
  if ((role === 'organizer' || role === 'solo') && TOURNAMENTS_ENABLED) {
    return 'torneos';
  }
  return role === 'organizer' ? 'federacion' : 'liga';
}

// Último segmento elegido, por rol: en memoria (sin parpadeo al volver a
// montar) y en AsyncStorage (sobrevive al reinicio).
const storageKey = (role: NavRole) => `competir:segment:${role}`;
const memo: Partial<Record<NavRole, CompetirSegment>> = {};

/**
 * Pestaña COMPETIR: selector «Liga · Federación · Torneos» arriba y, debajo,
 * la pantalla del segmento activo. No es un pager nativo: se monta solo el
 * segmento elegido. Las pantallas de los segmentos se pintan EMBEBIDAS en esta
 * raíz (sin su «Atrás» y sin el inset superior, que ya cubre el selector) y
 * navegan con la `navigation` de la stack de Competir, que registra todos sus
 * detalles (SeasonDetail, Jornada, FcpGroup, TournamentDetail…).
 */
export const CompetirScreen = (props: CompetirStackScreenProps<'CompetirRoot'>) => {
  const { navigation, route } = props;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const role = useNavRole();
  const options: SegmentOption<CompetirSegment>[] = useMemo(
    () => segmentsFor(role).map((k) => ({ key: k, label: LABEL[k] })),
    [role],
  );

  const requested = route.params?.segment;
  const [segment, setSegment] = useState<CompetirSegment>(
    requested ?? memo[role] ?? defaultSegment(role),
  );

  const choose = useCallback(
    (s: CompetirSegment) => {
      setSegment(s);
      memo[role] = s;
      AsyncStorage.setItem(storageKey(role), s).catch(() => {});
    },
    [role],
  );

  // Segmento pedido desde fuera (p. ej. el calendario de Inicio → Liga).
  // Se consume y se limpia: así, volver a pedir el mismo segmento después de
  // cambiar a mano vuelve a funcionar.
  useEffect(() => {
    if (!requested) return;
    choose(requested);
    navigation.setParams({ segment: undefined });
  }, [requested, choose, navigation]);

  // Recupera el último segmento del rol (si no se ha pedido uno).
  useEffect(() => {
    if (requested) return;
    if (memo[role]) {
      setSegment(memo[role]!);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(storageKey(role))
      .then((v) => {
        if (cancelled || !v) return;
        if (segmentsFor(role).includes(v as CompetirSegment)) {
          memo[role] = v as CompetirSegment;
          setSegment(v as CompetirSegment);
        }
      })
      .catch(() => {});
    setSegment(defaultSegment(role));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Si el rol cambia y el segmento ya no existe (p. ej. Liga del organizador).
  const active = options.some((o) => o.key === segment)
    ? segment
    : defaultSegment(role);

  // Las pantallas de segmento leen el inset superior para su cabecera; aquí
  // lo pone el selector, así que les llega a 0.
  const innerInsets = useMemo(() => ({ ...insets, top: 0 }), [insets]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <SegmentedControl options={options} value={active} onChange={choose} />
      </View>
      <SafeAreaInsetsContext.Provider value={innerInsets}>
        <View style={styles.body} key={`${role}:${active}`}>
          <Segment segment={active} role={role} {...props} />
        </View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
};

const Segment: React.FC<
  CompetirStackScreenProps<'CompetirRoot'> & {
    segment: CompetirSegment;
    role: NavRole;
  }
> = ({ segment, role, navigation, route }) => {
  // Las pantallas embebidas están tipadas para su stack de origen; comparten
  // nombres de ruta con la de Competir, así que basta con la misma navigation.
  const nav = navigation as any;
  const rt = route as any;
  const teamFed = useTeamStore((s) => s.team?.federation ?? null);
  const clubFed = useClubStore(selectActiveClub)?.federation ?? null;

  switch (segment) {
    case 'liga':
      if (role === 'club') {
        // El club no tiene «temporadas» propias: su liga son los partidos de
        // sus equipos (horarios de local).
        return <ClubScheduleScreen navigation={nav} route={rt} embedded />;
      }
      if (role === 'solo') {
        return (
          <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
            <NoTeamState text="La liga es cosa de equipos: temporadas, jornadas y alineaciones. Únete al tuyo con la invitación de tu capitán o crea uno." />
            {/* Mientras, la Federación (el suelto también la tiene). */}
            <ManageTournamentsCard
              title="Mientras, mira la Federación"
              text="Clasificaciones, equipos y jugadores"
              onPress={() => nav.navigate('Federacion')}
            />
          </ScrollView>
        );
      }
      return <SeasonsScreen navigation={nav} route={rt} />;

    case 'federacion': {
      // Federación «propia»: la del club (club/organizador) o la del equipo.
      // Con datos (Cántabra) → explorador directo; si no, el selector.
      const fed = role === 'club' || role === 'organizer' ? clubFed : teamFed;
      return fed === FCP_FEDERATION_CODE ? (
        <FederacionScreen navigation={nav} route={rt} embedded />
      ) : (
        <FederacionPickerScreen navigation={nav} route={rt} embedded />
      );
    }

    case 'torneos':
      return (
        <View style={{ flex: 1 }}>
          {role === 'club' || role === 'organizer' ? (
            <ManageTournamentsCard
              onPress={() =>
                role === 'organizer'
                  ? // El organizador gestiona sus torneos desde Inicio.
                    navigation.navigate('Home', { screen: 'HomeRoot' })
                  : navigation.navigate('ClubTournaments')
              }
            />
          ) : (
            // Organizar sin ser club se hace en la web (igual que allí): crear
            // el club «solo torneos» desde aquí cambiaría el rol de la cuenta.
            <ManageTournamentsCard
              title="Organizar un torneo"
              text="Se monta en tactium.io: inscripciones, cuadros y cobros"
              onPress={() =>
                Linking.openURL('https://tactium.io/torneos/organizar').catch(() => {})
              }
            />
          )}
          <ExploreTournamentsScreen navigation={nav} route={rt} embedded />
        </View>
      );
  }
};

/** Acceso a la gestión de torneos del club, encima de Explorar. */
const ManageTournamentsCard: React.FC<{
  onPress: () => void;
  title?: string;
  text?: string;
}> = ({
  onPress,
  title = 'Gestionar torneos',
  text = 'Crear, inscripciones, cuadros, horarios y cobros',
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.manage, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.manageIcon}>
        <IconTrophy size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.manageTitle}>{title}</Text>
        <Text style={styles.manageText} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <IconChevron size={16} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 4,
      backgroundColor: c.background,
    },
    body: { flex: 1 },
    manage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 20,
      marginTop: 12,
      padding: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    manageIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.accent15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
    manageText: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
  });
