import type { DownloadPlatform } from "@/lib/download";
import { supabaseAnon } from "@/lib/supabase/anon";
import { WRITES_ENABLED } from "@/lib/writes";

/**
 * Apunta una visita a `/descargar`: club (o nulo) y sistema. Nada más: ni IP,
 * ni User-Agent, ni cookie, así que no hay dato personal que declarar.
 *
 * Dos destinos:
 *  1. Una línea JSON en el log del servidor, siempre. Vercel la conserva poco
 *     tiempo, pero basta para ver en caliente que el QR funciona.
 *  2. La tabla `download_visits`, por la RPC `log_download_visit` (migración
 *     `20261016e_download_visits.sql`). Es lo que da el recuento por club.
 *
 * La tabla solo se escribe desde el hosting (`VERCEL`) y con las escrituras
 * activas: en local la web apunta a la base de datos de producción y una
 * prueba con `?club=smash` falsearía el recuento de ese club. Si la RPC no
 * existe en la base a la que apunta (otro proyecto Supabase), la llamada falla
 * en silencio y el log sigue valiendo.
 *
 * Se llama dentro de `after()`: nunca retrasa ni rompe la redirección.
 */
export async function recordDownloadVisit(visit: {
  club: string | null;
  platform: DownloadPlatform;
}): Promise<void> {
  console.log(`[descargar] ${JSON.stringify(visit)}`);

  if (!WRITES_ENABLED || !process.env.VERCEL) return;
  const sb = supabaseAnon();
  if (!sb) return;
  try {
    const { error } = await sb.rpc("log_download_visit", {
      p_club: visit.club,
      p_platform: visit.platform,
    });
    // PGRST202: la RPC todavía no está creada. Esperado hasta aplicar la migración.
    if (error && error.code !== "PGRST202") {
      console.warn(`[descargar] no se pudo guardar la visita: ${error.message}`);
    }
  } catch {
    /* sin red o sin Supabase: la visita queda solo en el log */
  }
}
