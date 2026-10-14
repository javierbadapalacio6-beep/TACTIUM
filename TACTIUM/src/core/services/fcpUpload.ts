import { supabase } from '@core/supabase/client';

// «Subido a la Federación»: los capitanes suben la hora de los partidos de local a la web de la Federación antes
// del lunes a las 20:00, y aquí queda marcado. La RPC `set_fcp_uploaded` y las columnas
// `matchdays.fcp_uploaded_at/_by` (migración 20261014) aún no están en los tipos generados → casts puntuales.

export interface FcpUploadState {
  uploadedAt: Date | null;
  uploadedBy: string | null;
}

/** Estado de un partido. */
export async function fetchFcpUpload(matchdayId: string): Promise<FcpUploadState> {
  const raw = supabase.from.bind(supabase) as unknown as (t: string) => any;
  const { data } = await raw('matchdays')
    .select('fcp_uploaded_at, fcp_uploaded_by')
    .eq('id', matchdayId)
    .maybeSingle();
  return {
    uploadedAt: data?.fcp_uploaded_at ? new Date(data.fcp_uploaded_at) : null,
    uploadedBy: data?.fcp_uploaded_by ?? null,
  };
}

/** Qué partidos de una lista ya están subidos (para los horarios del club). */
export async function fetchFcpUploadedIds(matchdayIds: string[]): Promise<Set<string>> {
  if (matchdayIds.length === 0) return new Set();
  const raw = supabase.from.bind(supabase) as unknown as (t: string) => any;
  const { data } = await raw('matchdays')
    .select('id, fcp_uploaded_at')
    .in('id', matchdayIds);
  const out = new Set<string>();
  for (const r of (data ?? []) as { id: string; fcp_uploaded_at: string | null }[])
    if (r.fcp_uploaded_at) out.add(r.id);
  return out;
}

/** Marca (o desmarca) partidos de local como subidos. Avisa a la otra parte al marcar. Devuelve cuántos cambió. */
export async function setFcpUploaded(matchdayIds: string[], uploaded = true): Promise<number> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc('set_fcp_uploaded', {
    p_matchday_ids: matchdayIds,
    p_uploaded: uploaded,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
