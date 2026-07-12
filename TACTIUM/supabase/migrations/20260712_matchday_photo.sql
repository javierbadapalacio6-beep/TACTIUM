-- ════════════════════════════════════════════════════════════════════
-- Migración 2026-07-12 · Foto de la jornada (portada estilo Strava)
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- Idempotente. (Ya aplicada en prod vía MCP el 2026-07-12.)
--
-- PARA QUÉ: permite fijar una foto "portada" a cada jornada. El capitán la
-- sube (bucket público match-photos, path {team_id}/{matchday_id}.jpg) y se
-- guarda en matchdays.photo_url; todo el equipo la ve y la comparte como
-- tarjeta con el resultado. RLS: lectura pública, escritura solo admin del
-- equipo (misma convención que player-avatars: foldername[1] = team_id).
-- ════════════════════════════════════════════════════════════════════

-- 1) Columna portada del partido
alter table public.matchdays
  add column if not exists photo_url text;

comment on column public.matchdays.photo_url is
  'URL pública de la foto/portada del partido (bucket match-photos).';

-- 2) Bucket público para fotos de partido (imágenes compartibles por diseño)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-photos', 'match-photos', true, 10485760,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 3) Políticas de Storage sobre match-photos
-- Lectura pública (la foto es compartible por diseño; path con uuid).
drop policy if exists match_photos_public_read on storage.objects;
create policy match_photos_public_read on storage.objects
  for select
  using (bucket_id = 'match-photos');

-- Escritura (insert/update/delete): solo admin del equipo dueño del partido.
-- Path '{team_id}/{matchday_id}.jpg' → foldername[1] = team_id.
drop policy if exists match_photos_admin_write on storage.objects;
create policy match_photos_admin_write on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'match-photos'
    and private.is_team_admin((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'match-photos'
    and private.is_team_admin((storage.foldername(name))[1]::uuid)
  );
