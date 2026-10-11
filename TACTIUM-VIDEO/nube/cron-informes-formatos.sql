-- Crons y claves para los informes por formato y los reels de prueba (redes-publicar v8).
-- NO aplicado: cambia la base de datos de producción. Se aplica a mano (SQL Editor de Supabase,
-- proyecto aabgnylvmntkzmgixlpe) o con permiso explícito, DESPUÉS de desplegar la función.

-- 0. Columna por pieza (APLICADA el 11-10-2026): null = sigue la clave global; 'no' = normal; 'MANUAL' | 'SS_PERFORMANCE' = reel de prueba.
-- alter table public.redes_publicaciones add column if not exists prueba text;
-- alter table public.redes_publicaciones add constraint redes_publicaciones_prueba_chk
--   check (prueba is null or prueba in ('no','MANUAL','SS_PERFORMANCE'));

-- 1. Informes de feed: a las 48 h; a las 24 h los reels de prueba publicados por la API; y el recordatorio de las 24 h
--    de los reels de prueba subidos a mano (estado 'avisada').
select cron.alter_job(
  (select jobid from cron.job where jobname = 'redes-informes'),
  command := $cmd$
    select public.redes_llamar('{"accion":"informes"}'::jsonb)
    where exists (
      select 1 from public.redes_publicaciones
      where estado = 'publicada' and informe_at is null and ig_media_id is not null
        and tipo in ('reel','carrusel','post')
        and publicada_at <= now() - interval '48 hours'
        and publicada_at >= now() - interval '7 days'
    ) or exists (
      select 1 from public.redes_publicaciones
      where estado = 'publicada' and informe_at is null and ig_media_id is not null
        and tipo = 'reel' and prueba in ('MANUAL','SS_PERFORMANCE')
        and publicada_at <= now() - interval '24 hours'
        and publicada_at >= now() - interval '7 days'
    ) or exists (
      select 1 from public.redes_publicaciones
      where estado = 'avisada' and tipo = 'reel'
        and actualizado <= now() - interval '24 hours'
        and actualizado >= now() - interval '72 hours'
    );
  $cmd$
);

-- 2. Informe de historias: cada hora (una sola llamada a la API; informa las que llevan 16-24 h,
--    hayan salido de la función o se hayan subido a mano desde el aviso de Telegram).
select cron.schedule(
  'redes-historias',
  '25 * * * *',
  $cmd$ select public.redes_llamar('{"accion":"historias"}'::jsonb); $cmd$
);

-- 3. Claves de configuración (todas opcionales; vacías = comportamiento anterior):
--   ig_reels_prueba          off | MANUAL | SS_PERFORMANCE | AVISO   → valor por defecto de los reels cuya columna
--                                                              `prueba` está vacía. MANUAL / SS_PERFORMANCE los
--                                                              publican como reel de prueba por la API; AVISO manda
--                                                              el vídeo y el pie a Telegram para subirlo a mano
--   ig_reels_prueba_piezas   R1,R2,…                         → limita la global a esas piezas (vacío = todos)
--   meta_seguidores          1000                            → objetivo que sale en el resumen del lunes
-- Si Instagram rechaza una prueba, NUNCA se publica normal en su lugar: se avisa por Telegram para subirlo a mano.
-- Ejemplo:
-- insert into public.redes_config (clave, valor, actualizado) values
--   ('ig_reels_prueba', 'AVISO', now()),
--   ('ig_reels_prueba_piezas', 'H1', now())
-- on conflict (clave) do update set valor = excluded.valor, actualizado = now();
