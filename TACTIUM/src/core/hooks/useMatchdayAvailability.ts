import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import * as AvailabilityApi from '@core/services/availability';
import type {
  AvailabilityMap,
  AvailabilityStatus,
  MaybeReason,
} from '@core/services/availability';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';

/**
 * Disponibilidad de UNA jornada: respuestas, cierre de la duda, último
 * recordatorio y recuento sobre la plantilla activa. Refresca al ganar foco.
 * `respond` es optimista: pinta al momento y deshace si el servidor falla.
 */
export function useMatchdayAvailability(matchdayId: string | null | undefined) {
  const players = useTeamStore((s) => s.players);
  const [map, setMap] = useState<AvailabilityMap>({});
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [lastReminder, setLastReminder] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(map);
  mapRef.current = map;

  const refresh = useCallback(async () => {
    if (!matchdayId) {
      setMap({});
      setDeadline(null);
      setLastReminder(null);
      return;
    }
    setLoading(true);
    try {
      const [m, d, r] = await Promise.all([
        AvailabilityApi.fetchAvailability(matchdayId),
        AvailabilityApi.fetchMaybeDeadline(matchdayId).catch(() => null),
        AvailabilityApi.fetchLastReminder(matchdayId).catch(() => null),
      ]);
      setMap(m);
      setDeadline(d);
      setLastReminder(r);
    } catch (e) {
      console.warn('useMatchdayAvailability', e);
    } finally {
      setLoading(false);
    }
  }, [matchdayId]);

  useEffect(() => {
    setMap({});
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Al volver a la app (p. ej. tras contestar desde la notificación).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTimeout(refresh, 800);
    });
    return () => sub.remove();
  }, [refresh]);

  const respond = useCallback(
    async (
      playerId: string,
      status: AvailabilityStatus,
      extra?: { reason?: MaybeReason | null; note?: string | null },
    ): Promise<boolean> => {
      if (!matchdayId) return false;
      const prev = mapRef.current[playerId];
      setMap((m) => ({
        ...m,
        [playerId]: {
          ...(prev ?? ({ matchday_id: matchdayId, player_id: playerId } as never)),
          status,
          available: status === 'yes',
          reason: status === 'maybe' ? extra?.reason ?? null : null,
          note: extra?.note ?? null,
          auto_resolved: false,
        },
      }));
      try {
        const row = await AvailabilityApi.respondAvailability({
          matchdayId,
          playerId,
          status,
          reason: extra?.reason,
          note: extra?.note,
        });
        setMap((m) => ({ ...m, [playerId]: row }));
        return true;
      } catch (e: any) {
        setMap((m) => {
          const next = { ...m };
          if (prev) next[playerId] = prev;
          else delete next[playerId];
          return next;
        });
        toast.error('No se guardó tu respuesta', e?.message ?? 'Revisa la conexión e inténtalo de nuevo.');
        return false;
      }
    },
    [matchdayId],
  );

  const clear = useCallback(
    async (playerId: string) => {
      if (!matchdayId) return;
      const prev = mapRef.current[playerId];
      setMap((m) => {
        const next = { ...m };
        delete next[playerId];
        return next;
      });
      try {
        await AvailabilityApi.clearAvailability(matchdayId, playerId);
      } catch (e: any) {
        if (prev) setMap((m) => ({ ...m, [playerId]: prev }));
        toast.error('No se pudo quitar la respuesta', e?.message ?? 'Inténtalo de nuevo.');
      }
    },
    [matchdayId],
  );

  const activeIds = useMemo(() => players.map((p) => p.id), [players]);
  const counts = useMemo(
    () => AvailabilityApi.countAvailability(activeIds, map),
    [activeIds, map],
  );

  const maybeClosed = deadline ? Date.now() >= deadline.getTime() : false;

  return {
    map,
    counts,
    deadline,
    maybeClosed,
    lastReminder,
    setLastReminder,
    loading,
    refresh,
    respond,
    clear,
  };
}

/** «Faltan 24:49 h» / «Faltan 2 d» hasta una fecha. */
export function formatTimeLeft(to: Date, now = Date.now()): string {
  const ms = to.getTime() - now;
  if (ms <= 0) return 'cerrado';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} días`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, '0')} h`;
}
