-- Fotos por pareja de una jornada (además de la foto general del equipo, `matchdays.photo_url`).
-- El capitán sube una foto por pista/pareja al bucket público `match-photos`
-- (path `{team_id}/{matchday_id}-p{pista}.jpg`; la RLS del bucket ya limita la escritura al admin del equipo).
-- Sirven para compartirlas en redes (carrusel de Instagram) con el resultado de la pareja.

create table if not exists public.match_pair_photos (
  id           uuid primary key default gen_random_uuid(),
  matchday_id  uuid not null references public.matchdays(id) on delete cascade,
  court_number int  not null check (court_number between 1 and 8),
  photo_url    text not null,
  updated_at   timestamptz not null default now(),
  unique (matchday_id, court_number)
);

alter table public.match_pair_photos enable row level security;

drop policy if exists match_pair_photos_member_select on public.match_pair_photos;
create policy match_pair_photos_member_select on public.match_pair_photos
  for select using (private.is_team_member(private.team_for_matchday(matchday_id)));

drop policy if exists match_pair_photos_admin_write on public.match_pair_photos;
create policy match_pair_photos_admin_write on public.match_pair_photos
  for all to authenticated
  using (private.is_team_admin(private.team_for_matchday(matchday_id)))
  with check (private.is_team_admin(private.team_for_matchday(matchday_id)));
