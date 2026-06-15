import type { ScannedPlayer } from '@core/services/imageRecognition';
import type { Player, Side } from '@store/teamStore';

/**
 * Normaliza un nombre para matching: trim + collapse spaces + lowercase
 * + sin acentos. "Javier Pérez", "javier perez " y "JAVIER  PEREZ" mapean
 * al mismo string. Sin esto, escanear el mismo ranking dos veces creaba
 * duplicados en la plantilla.
 */
function normalizeForMatch(s: string): string {
  // U+0300 a U+036F = Combining Diacritical Marks. Tras NFD el "é" se
  // descompone en "e" + combining acute; este replace borra los acentos
  // y deja la letra base.
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export interface BulkUpsertResult {
  added: number;
  updated: number;
}

/**
 * Aplica un batch de jugadores escaneados a la plantilla del team activo
 * usando UPSERT por nombre normalizado:
 *
 *   · Si existe un player con el mismo nombre normalizado → UPDATE de
 *     `pts` (y `position` solo si el OCR aporta una distinta de la
 *     default 'Ambos' que el captain ya pudo haber editado).
 *   · Si no existe → INSERT nuevo con `available: true`.
 *
 * Caso de uso primario: re-escanear el ranking FEP al actualizarse los
 * puntos cada temporada/jornada. El captain quiere ver los nuevos pts
 * en sus jugadores existentes, no que se le clonen las filas.
 *
 * Devuelve `{ added, updated }` para que el caller muestre un toast con
 * el resumen de la operación.
 */
export async function bulkUpsertPlayers(args: {
  scanned: ScannedPlayer[];
  existing: Player[];
  addPlayer: (input: {
    name: string;
    pts: number;
    position: Side;
    available?: boolean;
  }) => Promise<Player>;
  updatePlayer: (id: string, patch: Partial<Player>) => Promise<void>;
}): Promise<BulkUpsertResult> {
  const { scanned, existing, addPlayer, updatePlayer } = args;

  const byNormName = new Map<string, Player>();
  for (const p of existing) {
    byNormName.set(normalizeForMatch(p.name), p);
  }

  let added = 0;
  let updated = 0;

  for (const s of scanned) {
    const key = normalizeForMatch(s.name);
    const match = byNormName.get(key);

    if (match) {
      const patch: Partial<Player> = { pts: s.pts ?? match.pts };
      if (
        s.position &&
        s.position !== 'Ambos' &&
        s.position !== match.position
      ) {
        patch.position = s.position;
      }
      await updatePlayer(match.id, patch);
      updated++;
    } else {
      await addPlayer({
        name: s.name.trim(),
        pts: s.pts ?? 0,
        position: s.position ?? 'Ambos',
        available: true,
      });
      added++;
    }
  }

  return { added, updated };
}
