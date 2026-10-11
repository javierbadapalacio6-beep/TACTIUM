-- Crons y claves para los informes por formato y los reels de prueba (redes-publicar v8).
-- NO aplicado: cambia la base de datos de producción. Se aplica a mano (SQL Editor de Supabase,
-- proyecto aabgnylvmntkzmgixlpe) o con permiso explícito, DESPUÉS de desplegar la función.

-- 1. Informes de feed a las 48 h (como antes) + recordatorio a las 24 h de cada reel de prueba subido a mano
--    (esos reels quedan en estado 'avisada': el bot no puede subirlos por API).
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
--   ig_reels_prueba          AVISO | off                     → a la hora de cada reel, el bot manda el vídeo y el
--                                                              pie a Telegram para subirlo A MANO como reel de
--                                                              prueba (Instagram no deja subirlos por API)
--   ig_reels_prueba_piezas   R1,R2,…                         → solo esos (vacío = todos los reels)
--   meta_seguidores          1000                            → objetivo que sale en el resumen del lunes
-- Un reel de prueba NUNCA se publica normal por el camino automático.
-- Ejemplo:
-- insert into public.redes_config (clave, valor, actualizado) values
--   ('ig_reels_prueba', 'AVISO', now()),
--   ('ig_reels_prueba_piezas', 'H1', now())
-- on conflict (clave) do update set valor = excluded.valor, actualizado = now();
