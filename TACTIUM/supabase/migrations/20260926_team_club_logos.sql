-- Logo de equipo y de club (escudo). Lo suben el capitán/admin desde la web;
-- la app lo leerá cuando lo soporte. Aplicada en producción el 2026-09-26.
alter table public.teams add column if not exists logo_url text;
alter table public.clubs add column if not exists logo_url text;

-- Bucket público `logos`: `teams/<team_id>/…` y `clubs/<club_id>/…`.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists logos_public_read on storage.objects;
create policy logos_public_read on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists logos_admin_insert on storage.objects;
create policy logos_admin_insert on storage.objects
  for insert with check (
    bucket_id = 'logos' and (
      ((storage.foldername(name))[1] = 'teams' and private.is_team_admin(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'clubs' and private.is_club_admin(((storage.foldername(name))[2])::uuid))
    )
  );

drop policy if exists logos_admin_update on storage.objects;
create policy logos_admin_update on storage.objects
  for update using (
    bucket_id = 'logos' and (
      ((storage.foldername(name))[1] = 'teams' and private.is_team_admin(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'clubs' and private.is_club_admin(((storage.foldername(name))[2])::uuid))
    )
  );

drop policy if exists logos_admin_delete on storage.objects;
create policy logos_admin_delete on storage.objects
  for delete using (
    bucket_id = 'logos' and (
      ((storage.foldername(name))[1] = 'teams' and private.is_team_admin(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'clubs' and private.is_club_admin(((storage.foldername(name))[2])::uuid))
    )
  );
