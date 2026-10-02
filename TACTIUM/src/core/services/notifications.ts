import { supabase } from '@core/supabase/client';

// Notificaciones in-app (campanita). La tabla `notifications` no está en los
// tipos generados todavía → casts puntuales, como en casualMatches.ts. Las
// filas SOLO las escriben triggers/edge (SECURITY DEFINER); el cliente solo
// lee, marca leídas y borra (RLS: cada uno ve/actualiza/borra las suyas;
// mismas consultas que tactium-web/lib/queries.ts).

export type NotificationType =
  | 'member_joined'
  | 'joined_team'
  | 'player_claimed'
  | 'matchday_created'
  | 'lineup_published'
  | 'availability_reminder'
  | 'lineup_reminder'
  | 'schedule_set'
  | 'new_follower'
  | 'tournament_bracket'
  | 'tournament_schedule'
  | 'tournament_signup'
  | 'tournament_moved'
  | 'tournament_payment_due'
  // Kudos a un amistoso o a una jornada. data: {type, actor_id, target_kind
  // ('casual'|'league'), target_id}.
  | 'kudos'
  | (string & {});

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

type NotifTable = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => {
      limit: (
        n: number,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => PromiseLike<{ error: { message: string } | null }> & {
      is: (
        col: string,
        val: null,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  delete: () => {
    eq: (col: string, val: string) => PromiseLike<{ error: { message: string } | null }>;
  };
};
const table = (): NotifTable =>
  supabase.from('notifications' as never) as unknown as NotifTable;

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await table()
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as AppNotification[]) ?? [];
}

export async function markAllRead(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  const { error } = await table()
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', uid)
    .is('read_at', null);
  if (error) throw new Error(error.message);
}

/** Marca UN aviso como leído (al tocarlo). */
export async function markOneRead(id: string): Promise<void> {
  const { error } = await table()
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Borra un aviso. La RLS acota a los tuyos. */
export async function deleteNotification(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Vacía la campana entera. */
export async function deleteAllNotifications(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return;
  const { error } = await table().delete().eq('user_id', uid);
  if (error) throw new Error(error.message);
}
