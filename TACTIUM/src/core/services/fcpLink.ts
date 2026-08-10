// Vínculo del usuario TACTIUM con su ficha de jugador de la Federación
// (profiles.fcp_id_jugador). Permite mostrar sus stats federativas en Stats.
// El matching por nombre lo resuelve `resolveFcpPlayer` de [[fcpSearch]].
import { supabase } from '@core/supabase/client';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

/** id_jugador FCP vinculado al usuario (null si no ha vinculado). */
export async function getMyFcpLink(userId: string): Promise<string | null> {
  const { data } = await rawFrom('profiles')
    .select('fcp_id_jugador')
    .eq('id', userId)
    .maybeSingle();
  return data ? ((data as { fcp_id_jugador: string | null }).fcp_id_jugador ?? null) : null;
}

/** Vincula (o desvincula con null) la ficha FCP del usuario. */
export async function setMyFcpLink(userId: string, idJugador: string | null): Promise<void> {
  const { error } = await rawFrom('profiles')
    .update({ fcp_id_jugador: idJugador })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}
