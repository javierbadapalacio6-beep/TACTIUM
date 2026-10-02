import { useEffect, useState } from 'react';

import {
  getFcpIdEquipo,
  fetchFcpGroupStandings,
  fetchFcpLastCrossing,
  normFcpName,
  type FcpStandingRow,
  type FcpLastCrossing,
} from '@core/services/fcpSeason';

export interface JornadaFcpContext {
  /** Fila de mi equipo en la clasificación (null sin vínculo FCP). */
  me: FcpStandingRow | null;
  /** Fila del rival, buscada por nombre normalizado. Null si no coincide. */
  rival: FcpStandingRow | null;
  lastCrossing: FcpLastCrossing | null;
  loaded: boolean;
}

const EMPTY: JornadaFcpContext = { me: null, rival: null, lastCrossing: null, loaded: false };

/**
 * Contexto federativo de una jornada: puesto y racha de los dos equipos y el
 * último cruce entre ellos. Todo sale de la clasificación del grupo de MI
 * equipo; si el equipo no está vinculado, o la tabla es de otra temporada
 * (el respaldo de `resolveMainGroupOrPrevious`), o el rival no aparece, se
 * devuelve vacío: mejor no enseñar nada que enseñar un dato inventado.
 */
export function useJornadaFcp(
  teamId: string | null | undefined,
  opponent: string | null | undefined,
  matchDate: string | null | undefined,
): JornadaFcpContext {
  const [ctx, setCtx] = useState<JornadaFcpContext>(EMPTY);

  useEffect(() => {
    let alive = true;
    setCtx(EMPTY);
    if (!teamId || !opponent) {
      setCtx({ ...EMPTY, loaded: true });
      return;
    }
    (async () => {
      try {
        const fcpId = await getFcpIdEquipo(teamId);
        if (fcpId == null) {
          if (alive) setCtx({ ...EMPTY, loaded: true });
          return;
        }
        const st = await fetchFcpGroupStandings(fcpId);
        // Solo la tabla de la temporada del vínculo: si cayó al respaldo de la
        // temporada anterior, mi id no está en ella.
        const me = st.rows.find((r) => r.id_equipo === fcpId) ?? null;
        if (!me || !st.idGrupo) {
          if (alive) setCtx({ ...EMPTY, loaded: true });
          return;
        }
        const target = normFcpName(opponent);
        const rival =
          st.rows.find((r) => r !== me && normFcpName(r.equipo) === target) ?? null;
        let lastCrossing: FcpLastCrossing | null = null;
        if (rival) {
          lastCrossing = await fetchFcpLastCrossing(
            st.idGrupo,
            me.equipo,
            rival.equipo,
            matchDate ?? null,
          ).catch(() => null);
        }
        if (alive) setCtx({ me, rival, lastCrossing, loaded: true });
      } catch (e) {
        console.warn('useJornadaFcp', e);
        if (alive) setCtx({ ...EMPTY, loaded: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [teamId, opponent, matchDate]);

  return ctx;
}
