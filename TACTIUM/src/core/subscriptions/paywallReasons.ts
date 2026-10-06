// ── Motivos con los que se abre el paywall ──────────────────────────────────
// El paywall lo abren más de 10 sitios. Cada uno pasa su motivo como `intent`
// para que la pantalla diga POR QUÉ estás ahí (bloque de contexto arriba).
//
// Hay tres clases de `intent`:
//   · Familia ('captain' | 'club'): fija qué planes se enseñan. Sin contexto.
//   · Genéricos ('upgrade' | 'change'): cambio de plan desde Mi suscripción.
//     Sin contexto; la familia la decide el rol.
//   · Motivos de gate: llevan su línea de contexto. Algunos fijan además la
//     familia (los que solo existen en el panel del club).
//
// Mismos textos que la web (/pro?motivo=…). Si cambias uno, cámbialo allí.

export type PaywallFamilyIntent = 'captain' | 'club';
export type PaywallGenericIntent = 'upgrade' | 'change';
export type PaywallReason =
  | 'matchday_close'
  | 'lineup_edit'
  | 'lineup_confirm'
  | 'calendar_scan'
  | 'availability_remind'
  | 'roster_import'
  | 'club_roster_import'
  | 'results_edit'
  | 'matchday_create'
  | 'matchday_edit'
  | 'season_create'
  | 'club_manage_team'
  | 'fcp_group'
  | 'trial_expiring';

export type PaywallIntent =
  | PaywallFamilyIntent
  | PaywallGenericIntent
  | PaywallReason;

export type PaywallReasonIcon =
  | 'trophy'
  | 'team'
  | 'camera'
  | 'bell'
  | 'file'
  | 'ball'
  | 'calendar'
  | 'clock';

export interface PaywallReasonCopy {
  icon: PaywallReasonIcon;
  title: string;
  subtitle?: string;
  /** Si el motivo solo existe en una familia, la fija. Si no, manda el rol. */
  family?: PaywallFamilyIntent;
}

const REASONS: Record<Exclude<PaywallReason, 'trial_expiring'>, PaywallReasonCopy> = {
  matchday_close: {
    icon: 'trophy',
    title: 'Cerrar la jornada es Pro',
    subtitle: 'El acta y los resultados quedan para todo el equipo',
  },
  lineup_edit: {
    icon: 'team',
    title: 'Las alineaciones son Pro',
    subtitle: 'Parejas por puntos en 5 variantes, en 90 segundos',
  },
  lineup_confirm: {
    icon: 'team',
    title: 'Las alineaciones son Pro',
    subtitle: 'Parejas por puntos en 5 variantes, en 90 segundos',
  },
  calendar_scan: {
    icon: 'camera',
    title: 'Escanear el calendario es Pro',
    subtitle: 'Una foto y tienes toda la temporada en la agenda',
  },
  availability_remind: {
    icon: 'bell',
    title: 'Recordar a los pendientes es Pro',
    subtitle: 'Un toque y les llega el aviso, sin perseguir a nadie',
  },
  roster_import: {
    icon: 'file',
    title: 'Importar la plantilla es Pro',
    subtitle: 'Todos los jugadores con sus puntos oficiales',
  },
  club_roster_import: {
    icon: 'file',
    title: 'Importar las plantillas es Pro',
    subtitle: 'Cada equipo con sus jugadores y sus puntos oficiales',
    family: 'club',
  },
  results_edit: {
    icon: 'ball',
    title: 'Apuntar resultados es Pro',
    subtitle: 'Set a set, y quedan en el acta para todo el equipo',
  },
  matchday_create: {
    icon: 'calendar',
    title: 'Crear jornadas es Pro',
    subtitle: 'Rival, fecha y pista, y el equipo lo ve en la agenda',
  },
  matchday_edit: {
    icon: 'calendar',
    title: 'Editar jornadas es Pro',
    subtitle: 'Cambia fecha, rival o pista y el equipo lo ve al momento',
  },
  season_create: {
    icon: 'calendar',
    title: 'Crear la temporada es Pro',
    subtitle: 'Calendario, plantilla y jornadas en un solo sitio',
  },
  club_manage_team: {
    icon: 'team',
    title: 'Gestionar los equipos del club es Pro',
    subtitle: 'Plantillas, capitanes y jornadas de todos, desde un panel',
    family: 'club',
  },
  fcp_group: {
    icon: 'trophy',
    title: 'Tu grupo de la Federación es Pro',
    subtitle: 'Clasificación, jornadas y actas de tu grupo, al día',
  },
};

/**
 * Texto del bloque de contexto para un `intent`. `null` = sin bloque (familia,
 * genéricos o un intent desconocido).
 */
export function paywallReasonCopy(
  intent: string | undefined,
  trialDaysLeft: number | null,
): PaywallReasonCopy | null {
  if (!intent) return null;
  if (intent === 'trial_expiring') {
    const title =
      trialDaysLeft == null
        ? 'Tu prueba está acabando'
        : trialDaysLeft <= 0
          ? 'Tu prueba acaba hoy'
          : trialDaysLeft === 1
            ? 'Tu prueba acaba mañana'
            : `Tu prueba acaba en ${trialDaysLeft} días`;
    // Sin subtítulo: debajo va la línea de tiempo de la prueba.
    return { icon: 'clock', title };
  }
  return (REASONS as Record<string, PaywallReasonCopy | undefined>)[intent] ?? null;
}

/** Familia que fija el intent, si la fija. */
export function paywallIntentFamily(
  intent: string | undefined,
): PaywallFamilyIntent | null {
  if (intent === 'captain' || intent === 'club') return intent;
  const r = paywallReasonCopy(intent, null);
  return r?.family ?? null;
}
