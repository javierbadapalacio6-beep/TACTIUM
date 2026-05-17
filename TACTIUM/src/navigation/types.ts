import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Auth Stack ─────────────────────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
};

// ─── Onboarding Stack ───────────────────────────────────────────────
export type OnboardingStackParamList = {
  OnboardingChoice: undefined;
  CreateClub: undefined;
  CreateTeamsForClub: undefined;
  CreateTeam: { clubId?: string } | undefined;
  AddPlayers: undefined;
};

// ─── Home Stack (nested under Home tab) ─────────────────────────────
export type HomeStackParamList = {
  HomeRoot: undefined;
  Jornada: { matchdayId?: string };
  Lineup: { matchdayId: string };
  Results: { matchdayId: string; focus?: number };
  Availability: { matchdayId?: string };
};

export type SeasonsStackParamList = {
  SeasonsRoot: undefined;
  SeasonDetail: { id: string };
};

export type TeamStackParamList = {
  TeamRoot: undefined;
};

export type ProfileStackParamList = {
  ProfileRoot: undefined;
};

export type ClubStackParamList = {
  ClubRoot: undefined;
  CreateTeamFromClub: undefined;
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
  Home: undefined;
  Seasons: undefined;
  Team: undefined;
  Profile: undefined;
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

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

export type OnboardingStackScreenProps<
  T extends keyof OnboardingStackParamList,
> = NativeStackScreenProps<OnboardingStackParamList, T>;
