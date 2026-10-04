import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';

// ─── Auth Stack ─────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  // Home PÚBLICA: lo primero al abrir sin cuenta. El login es un botón
  // dentro de ella, no la puerta de entrada.
  PublicHome: undefined;
  // `mode: 'email'` abre directamente el formulario de email (si no, la
  // pantalla de elección Apple/Google/email). `tab` elige la pestaña del
  // formulario: todo acceso de «crear cuenta» llega con `tab: 'signup'`, y
  // «Ya tengo cuenta» con `tab: 'signin'`.
  Login: { mode?: 'choice' | 'email'; tab?: 'signin' | 'signup' } | undefined;
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
  // Pregunta única del onboarding: capitanear, club, torneos o jugador
  // invitado (antes eran dos pantallas, Intent y Choice).
  OnboardingIntent: undefined;
  CreateClub: undefined;
  // Paso mínimo (solo nombre) para el club en modo "solo torneos".
  CreateTournamentClub: undefined;
  CreateTeamsForClub: undefined;
  CreateTeam: { clubId?: string } | undefined;
  // Paso 2. `importedPlayers` llega cuando la plantilla ya se volcó de la
  // federación en el paso 1 (se enseña como hecha).
  AddPlayers: { importedPlayers?: number } | undefined;
  // Paso 3: pedir los avisos explicando para qué sirven. Termina el onboarding.
  OnboardingNotifications: undefined;
  // Paywall dentro del onboarding: SOLO como upsell opcional y descartable
  // (p. ej. ofrecer el volcado automático). La prueba de 14 días sin tarjeta
  // arranca sola al crear el primer equipo independiente o el club.
  Paywall: {
    intent: 'captain' | 'club';
    optional?: boolean;
  };
};

// ─── Rutas de detalle compartidas ───────────────────────────────────
// La barra es la MISMA para todos los roles (Inicio · Competir · ＋ · Equipo ·
// Perfil). Varias pestañas empujan las mismas pantallas de detalle; se declaran
// una vez y cada stack las incluye con los MISMOS params, para que una pantalla
// (Jornada, FcpTeam…) funcione igual esté en la stack que esté.
type MatchdayRoutes = {
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
  Availability: { matchdayId?: string };
};

// Explorador de la Federación (Cántabra): años → grupos → clasificación.
type FcpRoutes = {
  Federacion: undefined;
  FcpTeam: { idEquipo: number; name?: string };
  FcpPlayer: { idJugador: string; name?: string };
  FcpGroup: { idGrupo: string; nombre?: string };
};

// Gestión del club (club_admin).
type ClubRoutes = {
  // Horarios de local del club (asignar hora a los partidos de local).
  ClubSchedule: undefined;
  CreateTeamFromClub: undefined;
};

type TournamentRoutes = {
  // Detalle EDITABLE de un torneo del club (gestión).
  TournamentDetail: { tournamentId: string };
};

// ─── Pestaña Inicio ─────────────────────────────────────────────────
// El root cambia por rol: HomeScreen / SoloHomeScreen (jugador, capitán,
// suelto), ClubDashboardScreen (club) o ClubTournamentsScreen (organizador).
export type HomeStackParamList = {
  // `createTournament` (nonce): abre el asistente de crear torneo al llegar
  // (organizador, desde el botón ＋).
  HomeRoot: { createTournament?: number } | undefined;
  Amistoso: undefined;
} & MatchdayRoutes &
  FcpRoutes &
  ClubRoutes &
  TournamentRoutes;

// ─── Pestaña Competir ───────────────────────────────────────────────
// Root con selector «Liga · Federación · Torneos». Registra todas las rutas de
// detalle de esos tres mundos.
export type CompetirSegment = 'liga' | 'federacion' | 'torneos';

export type CompetirStackParamList = {
  CompetirRoot: { segment?: CompetirSegment } | undefined;
  // Gestión de torneos del club con equipos (Competir › Torneos › «Gestionar
  // torneos»). `createTournament` (nonce) abre el asistente — botón ＋.
  ClubTournaments: { createTournament?: number } | undefined;
  // `autoOpen` abre directamente un sheet de la temporada (pasando por el
  // gate premium): 'scan' = escáner de calendario, 'add' = nueva jornada.
  // `nonce` re-dispara el autoOpen si la temporada ya estaba en la stack.
  SeasonDetail: { id: string; autoOpen?: 'scan' | 'add'; nonce?: number };
  // Horarios de local (raíz embebida de Liga para el club).
  ClubSchedule: undefined;
} & MatchdayRoutes &
  FcpRoutes &
  TournamentRoutes;

// ─── Pestaña Equipo ─────────────────────────────────────────────────
// Root por rol: TeamScreen (capitán/jugador), ClubTeamsScreen (club), CTA de
// activar la gestión de equipos (organizador) o estado vacío (suelto).
// ClubTeamPreview = dashboard de SOLO LECTURA de un equipo del club.
export type TeamStackParamList = {
  TeamRoot: undefined;
  ClubTeamPreview: undefined;
} & MatchdayRoutes;

export type ProfileStackParamList = {
  ProfileRoot: undefined;
};

// ─── Bottom Tabs ────────────────────────────────────────────────────
// `Create` es el botón central ＋: no es una pantalla, abre la hoja CREAR.
export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Competir: NavigatorScreenParams<CompetirStackParamList> | undefined;
  Create: undefined;
  Team: NavigatorScreenParams<TeamStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

// ─── Root Stack ─────────────────────────────────────────────────────
export type RootStackParamList = {
  AuthFlow: NavigatorScreenParams<AuthStackParamList> | undefined;
  OnboardingFlow: undefined;
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  // Modales presentados encima de las tabs
  Paywall: { intent?: string } | undefined;
  Subscription: undefined;
  ClubBilling: undefined;
  // Ajustes del club (nombre, federación y borrar club) y elegir qué equipos
  // cubre el plan cuando hay más equipos que plazas.
  ClubSettings: undefined;
  ClubCoverTeams: undefined;
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
  // Unirse a un equipo desde el enlace de invitación `tactium.io/i/{code}`.
  // Vista previa + unirse; existe con y sin sesión y en el onboarding.
  JoinTeam: { code: string };
  // La pantalla de Avisos (la del paso 3 del onboarding, sin barra) como modal,
  // UNA vez, para quien no pasa por el onboarding de equipo.
  PushPrompt: undefined;
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

export type CompetirStackScreenProps<T extends keyof CompetirStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CompetirStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type TeamStackScreenProps<T extends keyof TeamStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<TeamStackParamList, T>,
    TabScreenProps<keyof TabParamList>
  >;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingStackScreenProps<
  T extends keyof OnboardingStackParamList,
> = NativeStackScreenProps<OnboardingStackParamList, T>;
