import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Auth Stack ─────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  // Home PÚBLICA: lo primero al abrir sin cuenta. El login es un botón
  // dentro de ella, no la puerta de entrada.
  PublicHome: undefined;
  Login: undefined;
  // Planes visibles SIN cuenta. Solo informan: la suscripción se contrata
  // dentro de la app tras entrar y el torneo se paga por el enlace del correo.
  // `focus` viene del CTA segmentado de la home: abre la pantalla por el
  // carril que el visitante ha elegido.
  Plans: { focus?: 'teams' | 'tournaments' } | undefined;
  // Federación en modo público. Mismos nombres de ruta que en el stack de
  // Temporadas para que las pantallas naveguen igual en los dos sitios.
  Federacion: undefined;
  FcpGroup: { idGrupo: string; nombre?: string };
  FcpTeam: { idEquipo: number; name?: string };
  FcpPlayer: { idJugador: string; name?: string };
};

// ─── Onboarding Stack ───────────────────────────────────────────────
export type OnboardingStackParamList = {
  // Bifurcación inicial: organizar torneos vs gestionar equipos.
  OnboardingIntent: undefined;
  OnboardingChoice: undefined;
  CreateClub: undefined;
  // Paso mínimo (solo nombre) para el club en modo "solo torneos".
  CreateTournamentClub: undefined;
  CreateTeamsForClub: undefined;
  CreateTeam: { clubId?: string } | undefined;
  AddPlayers: undefined;
  // Paywall en onboarding es un gate OBLIGATORIO entre crear el subject
  // (club/team) y los siguientes pasos. Sin sub no se llega a tabs ni a
  // CreateTeamsForClub/AddPlayers. nextScreen indica a dónde saltar tras
  // un trial/compra exitosa — el PaywallScreen hace navigation.replace
  // para que el back NO devuelva al pago.
  Paywall: {
    intent: 'captain' | 'club';
    // Upsell OPCIONAL dentro del onboarding (p.ej. ofrecer el volcado automático
    // en AddPlayers): planes de onboarding pero DESCARTABLE (cerrar/atrás vuelven
    // a la pantalla anterior, sin cerrar sesión). Sin esto es un gate obligatorio.
    optional?: boolean;
    // `nextScreen` tras iniciar trial (solo gate DURO; el upsell opcional lo
    // omite y hace goBack):
    //  · CreateTeamsForClub → flow Club (club ya creado antes del paywall).
    //  · AddPlayers         → flow Capitán (el paywall recibe `pendingTeam`
    //    en params, crea el team tras success y enseguida navega aquí).
    nextScreen?: 'CreateTeamsForClub' | 'AddPlayers';
    // Solo flow Capitán: datos del form de CreateTeam que esperan ser
    // insertados tras arrancar el trial. Permite mostrar paywall después
    // de que el usuario haya rellenado el form (sunk-cost → menos abandono)
    // mientras seguimos respetando el trigger DB `enforce_team_quota`
    // que exige sub activa antes del INSERT.
    pendingTeam?: {
      name: string;
      federation?: string;
      league?: string;
      category?: string;
      group?: string;
      gender?: 'masculino' | 'femenino' | 'mixto';
    };
  };
};

// ─── Home Stack (nested under Home tab) ─────────────────────────────
export type HomeStackParamList = {
  HomeRoot: undefined;
  Amistoso: undefined;
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
  Availability: { matchdayId?: string };
  // Explorar Federación reusado DENTRO del HomeStack para que, abierto desde el
  // atajo de Home, "atrás" vuelva a Inicio (no a Temporadas). Mismos params que
  // en SeasonsStack para reusar los componentes sin cast.
  Federacion: undefined;
  FcpTeam: { idEquipo: number; name?: string };
  FcpPlayer: { idJugador: string; name?: string };
  FcpGroup: { idGrupo: string; nombre?: string };
};

export type SeasonsStackParamList = {
  SeasonsRoot: undefined;
  // `autoOpen` permite que otros screens (ej. el empty state de Home)
  // naveguen aquí abriendo directamente un sheet sin que el user tenga
  // que descubrir el botón. 'scan' = ScanSheet de calendario.
  SeasonDetail: { id: string; autoOpen?: 'scan' };
  // Detalle federativo (Federación Cántabra): equipo rival y jugador.
  FcpTeam: { idEquipo: number; name?: string };
  FcpPlayer: { idJugador: string; name?: string };
  // Navegación libre de la Federación: años → grupos → clasificación/jornadas.
  Federacion: undefined;
  FcpGroup: { idGrupo: string; nombre?: string };
  // Flujo de jornada reusado DENTRO de la stack de Temporadas, para que "atrás"
  // vuelva a la temporada (no a Inicio).
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
  Availability: { matchdayId?: string };
};

export type TeamStackParamList = {
  TeamRoot: undefined;
};

// Stack de la pestaña Federación (capitán). El root decide en runtime: si el
// equipo hereda una federación con datos (FCantP) → el explorador directo; si
// no → un selector de federaciones. Comparte pantallas fcp_* para navegar.
export type FederacionStackParamList = {
  FederacionRoot: undefined;
  Federacion: undefined;
  FcpTeam: { idEquipo: number; name?: string };
  FcpPlayer: { idJugador: string; name?: string };
  FcpGroup: { idGrupo: string; nombre?: string };
};

export type ProfileStackParamList = {
  ProfileRoot: undefined;
};

export type ClubStackParamList = {
  ClubRoot: undefined;
  CreateTeamFromClub: undefined;
  // Horarios de local del club (asignar hora a los partidos de local).
  ClubSchedule: undefined;
  // La exploración de la Federación ya no vive en el ClubStack: el club_admin
  // tiene su propia pestaña (FederacionTab → FederacionStack), igual que el
  // capitán.
  // Reusadas del HomeStack para que el ClubDashboard pueda navegar
  // directo a una jornada (ej. tap en card de últimos resultados) sin
  // cambiar de tab. Quedan read-only automáticamente para club_admin
  // porque selectIsCaptain devuelve false desde 2026-05-16.
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
};

// Tab dedicada al club_admin para navegar por los equipos del club en
// modo SOLO LECTURA. El root es un listado de equipos; al elegir uno
// se entra a ClubTeamPreview (dashboard curado por equipo) y desde ahí
// se navega a Jornada/Lineup/Results (reusadas del HomeStack — quedan
// read-only porque selectIsCaptain devuelve false para club_admin).
export type ClubTeamsStackParamList = {
  ClubTeamsRoot: undefined;
  ClubTeamPreview: undefined;
  // Jornada/Lineup/Results comparten params con HomeStack para reusar
  // los mismos componentes sin cast de navigation.
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
};

// ─── Bottom Tabs ────────────────────────────────────────────────────
export type TabParamList = {
  Club: undefined;
  ClubTeams: undefined;
  Tournaments: undefined;
  Home: undefined;
  Seasons: undefined;
  Team: undefined;
  Stats: undefined;
  FederacionTab: undefined;
  Profile: undefined;
};

// Stack de la pestaña Torneos (club_admin).
export type TournamentsStackParamList = {
  TournamentsRoot: undefined;
  TournamentDetail: { tournamentId: string };
};

// ─── Root Stack ─────────────────────────────────────────────────────
export type RootStackParamList = {
  AuthFlow: undefined;
  OnboardingFlow: undefined;
  MainTabs: undefined;
  // Modales presentados encima de las tabs
  Paywall: { intent?: string } | undefined;
  Subscription: undefined;
  ClubBilling: undefined;
  // Activar la gestión de equipos en un club "solo torneos": elige federación
  // (opcional) → desbloquea → paywall de suscripción (upsell).
  ActivateTeamManagement: undefined;
  MyData: undefined;
  MyStats: undefined;
  Settings: undefined;
  CasualMatchDetail: { matchId: string };
  // Partido de liga (jornada) en solo lectura, público — al que llevan las
  // fotos de jornada del perfil.
  LeagueMatchDetail: { matchdayId: string };
  // Capa social v1 (feature/perfiles-sociales)
  SearchCommunity: undefined;
  PublicProfile: { type: 'user' | 'club'; id: string };
  Feed: undefined;
  // Inscripción pública a un torneo por código.
  TournamentSignup: { code?: string } | undefined;
  // Explorar torneos abiertos (jugador).
  ExploreTournaments: undefined;
  // Seguir un torneo (vista de solo lectura del jugador). También es el
  // destino del deep link de vuelta tras pagar: `paid` llega como '1' desde
  // `tactium://tournament/{id}?paid=1` y dispara el aviso de pago confirmado.
  TournamentFollow: {
    tournamentId: string;
    initialTab?: 'main' | 'schedule' | 'players' | 'info';
    paid?: string;
  };
};

// ─── Helpers ────────────────────────────────────────────────────────
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> =
  BottomTabScreenProps<TabParamList, T>;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type SeasonsStackScreenProps<T extends keyof SeasonsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SeasonsStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type FederacionStackScreenProps<T extends keyof FederacionStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<FederacionStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type ClubStackScreenProps<T extends keyof ClubStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ClubStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type ClubTeamsStackScreenProps<
  T extends keyof ClubTeamsStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<ClubTeamsStackParamList, T>,
  TabScreenProps<keyof TabParamList>
>;

export type TournamentsStackScreenProps<
  T extends keyof TournamentsStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<TournamentsStackParamList, T>,
  TabScreenProps<keyof TabParamList>
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingStackScreenProps<
  T extends keyof OnboardingStackParamList,
> = NativeStackScreenProps<OnboardingStackParamList, T>;
