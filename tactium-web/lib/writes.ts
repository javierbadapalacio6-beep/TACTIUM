/**
 * Interruptor de escrituras.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────
 * La web apunta a la base de datos de PRODUCCIÓN, la misma que usa la app
 * móvil. Ahí hay clubes, equipos y actas de usuarios reales. Mientras se
 * desarrolla, un INSERT o un UPDATE de prueba no es un error recuperable: es
 * un dato falso en la temporada de alguien.
 *
 * Por eso todas las mutaciones pasan por `guardedWrite`. Con el interruptor en
 * "off" (el valor por defecto) la operación NO se envía: se devuelve un
 * resultado bloqueado y la interfaz lo dice. El código de escritura está
 * completo y probado en su forma, pero no toca nada.
 *
 * Para activarlo: `NEXT_PUBLIC_TACTIUM_WRITES=on` en `.env.local`.
 */

export const WRITES_ENABLED =
  process.env.NEXT_PUBLIC_TACTIUM_WRITES === "on";

export type WriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; blocked: true; reason: string }
  | { ok: false; blocked: false; reason: string };

export const READ_ONLY_MESSAGE =
  "Modo solo lectura · la web no escribe en la base de datos de producción";

/**
 * Envuelve una mutación. Si las escrituras están apagadas, devuelve bloqueado
 * sin llegar a ejecutar `run`.
 *
 * @example
 * const res = await guardedWrite("guardar alineación", async () => {
 *   const { error } = await sb.from("lineups").upsert(rows);
 *   if (error) throw error;
 *   return true;
 * });
 */
export async function guardedWrite<T>(
  what: string,
  run: () => Promise<T>
): Promise<WriteResult<T>> {
  if (!WRITES_ENABLED) {
    return {
      ok: false,
      blocked: true,
      reason: `${READ_ONLY_MESSAGE} · «${what}» no se ha guardado`,
    };
  }
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    return {
      ok: false,
      blocked: false,
      reason: e instanceof Error ? e.message : `No se pudo ${what}`,
    };
  }
}
