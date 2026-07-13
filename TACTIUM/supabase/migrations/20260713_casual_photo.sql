-- ════════════════════════════════════════════════════════════════════
-- Migración 2026-07-13 · Foto del amistoso (portada estilo Strava)
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- Idempotente. (Se aplica en prod vía MCP el 2026-07-13.)
--
-- PARA QUÉ: permite fijar una foto "portada" a cada amistoso/entreno, igual
-- que las jornadas de liga. El creador la sube al bucket público match-photos
-- con path `casual/{created_by}/{match_id}.jpg` y se guarda en
-- casual_matches.photo_url. RLS: lectura pública (ya existe), escritura solo
-- del creador (foldername[2] = auth.uid()). Reutiliza el bucket match-photos.
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna portada del amistoso
alter table public.casual_matches
  add column if not exists photo_url text;

comment on column public.casual_matches.photo_url is
  'URL pública de la foto/portada del amistoso (bucket match-photos, path casual/{created_by}/{match_id}.jpg).';

-- 2) Política de escritura de fotos de amistoso sobre el bucket match-photos.
-- La lectura pública ya la cubre match_photos_public_read (migración
-- 20260712). Path 'casual/{uid}/{match_id}.jpg' → foldername[1]='casual',
-- foldername[2]=uid. Se añade sin tocar la política de liga (RLS hace OR de
-- políticas permisivas): un write de liga la cumple por la suya y uno de
-- amistoso por esta.
drop policy if exists match_photos_casual_write on storage.objects;
create policy match_photos_casual_write on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'match-photos'
    and (storage.foldername(name))[1] = 'casual'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'match-photos'
    and (storage.foldername(name))[1] = 'casual'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
