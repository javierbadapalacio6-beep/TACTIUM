import { supabase } from '@core/supabase/client';
import {
  useFavoritesStore,
  type Favorite,
  type FavoriteKind,
} from '@store/favoritesStore';

// `favorites` es posterior a los tipos generados; mismo escape que usan los
// servicios de la federación.
type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

/**
 * Favoritos · puente entre el dispositivo y la cuenta.
 *
 * Los favoritos se marcan SIN cuenta y viven en el dispositivo. Este módulo
 * los sube al iniciar sesión y devuelve la unión de los dos lados, de forma
 * que nadie pierde lo que marcó como invitado ni lo que ya tenía en su cuenta
 * desde otro móvil.
 *
 * Se llama al arrancar con sesión y justo después de iniciarla.
 */

interface Row {
  kind: string;
  ref_id: string;
  label: string | null;
  meta: string | null;
  created_at: string;
}

const toFavorite = (r: Row): Favorite => ({
  kind: r.kind as FavoriteKind,
  refId: r.ref_id,
  label: r.label ?? '—',
  meta: r.meta,
  addedAt: new Date(r.created_at).getTime(),
});

/**
 * Sube los locales, se trae los del servidor y deja el store con la unión.
 * Silencioso a propósito: un favorito que no sincroniza no debe interrumpir
 * el arranque de la app.
 */
export async function syncFavorites(userId: string): Promise<void> {
  const store = useFavoritesStore.getState();
  const local = store.items;

  try {
    if (local.length) {
      // `upsert` sobre (user_id, kind, ref_id): reintentar no duplica.
      const { error } = await rawFrom('favorites').upsert(
        local.map((f) => ({
          user_id: userId,
          kind: f.kind,
          ref_id: f.refId,
          label: f.label,
          meta: f.meta ?? null,
        })),
        { onConflict: 'user_id,kind,ref_id', ignoreDuplicates: true },
      );
      if (error) throw error;
    }

    const { data, error } = await rawFrom('favorites')
      .select('kind, ref_id, label, meta, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    useFavoritesStore.getState().merge(((data ?? []) as Row[]).map(toFavorite));
    useFavoritesStore.getState().markSynced();
  } catch {
    // Se reintenta en el siguiente arranque: `pendingSync` sigue en true.
  }
}

/** Guarda o borra un favorito en el servidor. No hace nada sin sesión. */
export async function pushFavorite(
  fav: { kind: FavoriteKind; refId: string; label: string; meta?: string | null },
  added: boolean,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return; // Invitado: vive solo en el dispositivo hasta que entre.

  try {
    if (added) {
      await rawFrom('favorites').upsert(
        {
          user_id: userId,
          kind: fav.kind,
          ref_id: fav.refId,
          label: fav.label,
          meta: fav.meta ?? null,
        },
        { onConflict: 'user_id,kind,ref_id' },
      );
    } else {
      await rawFrom('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('kind', fav.kind)
        .eq('ref_id', fav.refId);
    }
  } catch {
    // El store local ya está actualizado; el servidor se pone al día en el
    // próximo `syncFavorites`.
  }
}

/**
 * Marca/desmarca en local y, si hay sesión, lo replica en el servidor.
 * Es el único punto por el que debería pasar la UI.
 */
export function toggleFavorite(fav: {
  kind: FavoriteKind;
  refId: string;
  label: string;
  meta?: string | null;
}): void {
  const wasFav = useFavoritesStore.getState().has(fav.kind, fav.refId);
  useFavoritesStore.getState().toggle(fav);
  void pushFavorite(fav, !wasFav);
}
