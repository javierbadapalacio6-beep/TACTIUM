import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  BottomSheet,
  IconBall,
  IconCalendar,
  IconCamera,
  IconChevron,
  IconGift,
  IconPlus,
  IconShare,
  IconTeam,
  IconTicket,
  IconTrophy,
} from '@components/ui';
import { TOURNAMENTS_ENABLED } from '@core/config/featureFlags';
import * as SeasonsApi from '@core/services/seasons';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';
import { InvitePlayersSheet } from '@features/team/components/InvitePlayersSheet';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';
import { TeamMembersSheet } from '@features/club/components/TeamMembersSheet';
import { useNavRole } from '@navigation/navRole';
import type { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Action {
  key: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  run: () => void;
}

// Los sheets de RN son <Modal>: abrir uno mientras el anterior aún se cierra
// falla en iOS. Se espera a que termine la animación de cierre.
const AFTER_CLOSE_MS = 380;

/**
 * Hoja «CREAR» del botón central ＋ de la barra. Acciones por rol:
 *  · Capitán: nueva jornada, escanear calendario, amistoso, invitar a la
 *    plantilla, apuntarse a un torneo.
 *  · Jugador / suelto: amistoso, unirse a un equipo, apuntarse a un torneo.
 *  · Club: crear torneo, nuevo equipo, invitar capitán.
 *  · Organizador: crear torneo.
 */
export const CreateSheet: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation<Nav>();
  const role = useNavRole();
  const team = useTeamStore((s) => s.team);
  const teams = useTeamStore((s) => s.teams);
  const club = useClubStore(selectActiveClub);
  const gate = usePremiumGate();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  // Club → «Invitar capitán»: primero se elige el equipo (si hay varios).
  const [pickTeam, setPickTeam] = useState(false);
  const [membersFor, setMembersFor] = useState<{ id: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    if (!open) setPickTeam(false);
  }, [open]);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  /** Cierra la hoja y, tras la animación, ejecuta `fn`. */
  const after = (fn: () => void) => () => {
    onClose();
    setTimeout(fn, AFTER_CLOSE_MS);
  };

  // ── Destinos ──────────────────────────────────────────────────────────
  const goAmistoso = () =>
    navigation.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: 'Amistoso' },
    });

  const goTorneos = () =>
    navigation.navigate('MainTabs', {
      screen: 'Competir',
      params: { screen: 'CompetirRoot', params: { segment: 'torneos' } },
    });

  const goSeasons = () =>
    navigation.navigate('MainTabs', {
      screen: 'Competir',
      params: { screen: 'CompetirRoot', params: { segment: 'liga' } },
    });

  // Nueva jornada / escanear: abre la temporada ACTIVA con el sheet ya
  // abierto. Sin temporada activa, a Temporadas (hay que crearla antes).
  const openSeason = async (autoOpen: 'add' | 'scan') => {
    if (!team) return;
    try {
      const season = await SeasonsApi.fetchActiveSeason(team.id);
      if (!season) {
        toast.info(
          'Primero, una temporada',
          'Crea la temporada y después añade sus jornadas.',
        );
        goSeasons();
        return;
      }
      navigation.navigate('MainTabs', {
        screen: 'Competir',
        params: {
          screen: 'SeasonDetail',
          params: { id: season.id, autoOpen, nonce: Date.now() },
        },
      });
    } catch (e: any) {
      toast.error('No se pudo abrir la temporada', e?.message ?? '');
    }
  };

  const createTournament = () => {
    const nonce = Date.now();
    if (role === 'organizer') {
      navigation.navigate('MainTabs', {
        screen: 'Home',
        params: { screen: 'HomeRoot', params: { createTournament: nonce } },
      });
    } else {
      navigation.navigate('MainTabs', {
        screen: 'Competir',
        params: { screen: 'ClubTournaments', params: { createTournament: nonce } },
      });
    }
  };

  const newClubTeam = () =>
    navigation.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: 'CreateTeamFromClub' },
    });

  const inviteCaptainToClub = () => {
    if (clubTeams.length === 0) {
      toast.info('Primero, un equipo', 'Crea el equipo y después invita a su capitán.');
      after(newClubTeam)();
      return;
    }
    if (clubTeams.length === 1) {
      const t = clubTeams[0];
      after(() => setMembersFor({ id: t.id, name: t.name }))();
      return;
    }
    setPickTeam(true);
  };

  // ── Acciones por rol ─────────────────────────────────────────────────
  const amistoso: Action = {
    key: 'amistoso',
    icon: <IconBall size={20} color={c.accent} />,
    title: 'Registrar amistoso',
    sub: 'Marcador, pareja, rivales y foto del partido.',
    run: after(goAmistoso),
  };
  const torneo: Action = {
    key: 'torneo',
    icon: <IconTicket size={20} color={c.accent} />,
    title: 'Apuntarme a un torneo',
    sub: 'Busca torneos abiertos o entra con tu código.',
    run: after(goTorneos),
  };

  let actions: Action[] = [];
  if (role === 'captain') {
    actions = [
      {
        key: 'jornada',
        icon: <IconCalendar size={20} color={c.accent} />,
        title: 'Nueva jornada',
        sub: 'Añade un partido a la temporada activa.',
        run: after(gate(() => openSeason('add'), 'matchday_create')),
      },
      {
        key: 'scan',
        icon: <IconCamera size={20} color={c.accent} />,
        title: 'Escanear calendario',
        sub: 'Foto del calendario y se crean todas las jornadas.',
        run: after(gate(() => openSeason('scan'), 'calendar_scan')),
      },
      amistoso,
      {
        key: 'invitar',
        icon: <IconShare size={20} color={c.accent} />,
        title: 'Invitar a la plantilla',
        sub: 'Comparte el código para que se unan tus jugadores.',
        run: after(() => setInviteOpen(true)),
      },
      ...(TOURNAMENTS_ENABLED ? [torneo] : []),
    ];
  } else if (role === 'player' || role === 'solo') {
    actions = [
      amistoso,
      {
        key: 'unirme',
        icon: <IconTeam size={20} color={c.accent} />,
        title: 'Unirme a un equipo',
        sub: 'Con el código que te ha enviado tu capitán o tu club.',
        run: after(() => setRedeemOpen(true)),
      },
      ...(TOURNAMENTS_ENABLED ? [torneo] : []),
    ];
  } else if (role === 'club') {
    actions = [
      ...(TOURNAMENTS_ENABLED
        ? [
            {
              key: 'torneo',
              icon: <IconTrophy size={20} color={c.accent} />,
              title: 'Crear torneo',
              sub: 'Categorías, fechas, inscripción y premios.',
              run: after(createTournament),
            },
          ]
        : []),
      {
        key: 'equipo',
        icon: <IconPlus size={18} color={c.accent} />,
        title: 'Nuevo equipo',
        sub: 'Crea un equipo del club y su plantilla.',
        run: after(newClubTeam),
      },
      {
        key: 'capitan',
        icon: <IconGift size={20} color={c.accent} />,
        title: 'Invitar capitán',
        sub: 'Un código de un solo uso para quien llevará el equipo.',
        run: inviteCaptainToClub,
      },
    ];
  } else {
    // Organizador.
    actions = [
      {
        key: 'torneo',
        icon: <IconTrophy size={20} color={c.accent} />,
        title: 'Crear torneo',
        sub: 'Categorías, fechas, inscripción y premios.',
        run: after(createTournament),
      },
    ];
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <Text style={styles.eyebrow}>CREAR</Text>
        {pickTeam ? (
          <>
            <Text style={styles.title}>¿Para qué equipo?</Text>
            <Text style={styles.lede}>
              El código de capitán es de un solo uso y va ligado al equipo.
            </Text>
            <View style={styles.list}>
              {clubTeams.map((t) => (
                <Row
                  key={t.id}
                  icon={<IconTeam size={20} color={c.accent} />}
                  title={t.name}
                  sub={t.category ?? 'Equipo del club'}
                  onPress={after(() => setMembersFor({ id: t.id, name: t.name }))}
                />
              ))}
            </View>
            <Pressable
              onPress={() => setPickTeam(false)}
              hitSlop={8}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>← Volver</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>¿Qué quieres hacer?</Text>
            <View style={styles.list}>
              {actions.map((a) => (
                <Row
                  key={a.key}
                  icon={a.icon}
                  title={a.title}
                  sub={a.sub}
                  onPress={a.run}
                />
              ))}
            </View>
          </>
        )}
      </BottomSheet>

      <InvitePlayersSheet
        open={inviteOpen}
        teamId={team?.id ?? null}
        teamName={team?.name ?? null}
        onClose={() => setInviteOpen(false)}
      />
      <RedeemInvitationSheet
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
      <TeamMembersSheet
        open={membersFor !== null}
        teamId={membersFor?.id ?? null}
        teamName={membersFor?.name ?? null}
        onClose={() => setMembersFor(null)}
      />
    </>
  );
};

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
}> = ({ icon, title, sub, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    title: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 4,
      marginBottom: 14,
    },
    lede: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: -8,
      marginBottom: 14,
    },
    list: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.accent10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    rowSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
    backLink: { alignSelf: 'center', paddingTop: 16, paddingBottom: 4 },
    backLinkText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  });
