-- La alineación que ven los jugadores es una COPIA tomada al pulsar Publicar, no la variante en edición.
--
-- Hasta ahora (20261020, `matchdays.lineup_published_at`) los jugadores leían la variante oficial: el primer
-- borrador quedaba oculto hasta publicar, pero después de publicar cualquier retoque del capitán (probar variantes,
-- cambiar la oficial) se veía EN VIVO. Ahora Publicar congela las parejas en `lineup_published` y los jugadores leen
-- solo esa copia (vista `published_lineup_pairs`). El capitán y el club siguen leyendo lo vivo.
-- Solo se escribe por la RPC `publish_lineup` (la hoja de publicar de la app y de la web).

create table if not exists public.lineup_published (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  court_number integer not null,
  player_a_id uuid references public.players(id) on delete set null,
  player_b_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matchday_id, court_number)
);

alter table public.lineup_published enable row level security;
drop policy if exists lineup_published_member_select on public.lineup_published;
create policy lineup_published_member_select on public.lineup_published
  for select to authenticated
  using (private.is_team_member(private.team_for_matchday(matchday_id)));
-- Sin políticas de escritura: solo la RPC (security definer) inserta.

-- Misma forma que `lineup_pairs`, para que las pantallas no cambien de tipos. `security_invoker`: se aplica la
-- política de arriba (la vista antigua corre como su dueño).
create or replace view public.published_lineup_pairs
with (security_invoker = true) as
select l.id,
       l.matchday_id,
       null::uuid as variant_id,
       l.court_number,
       l.player_a_id,
       l.player_b_id,
       l.created_at,
       l.updated_at,
       coalesce(nullif(pa.alias, ''), pa.name) as player_a_name,
       pa.pts as player_a_pts,
       coalesce(nullif(pb.alias, ''), pb.name) as player_b_name,
       pb.pts as player_b_pts,
       (coalesce(pa.pts, 0) + coalesce(pb.pts, 0)) as pair_points
  from public.lineup_published l
  left join public.players pa on pa.id = l.player_a_id
  left join public.players pb on pb.id = l.player_b_id;
grant select on public.published_lineup_pairs to authenticated;

-- Publicar: copia la variante OFICIAL actual y marca la jornada como publicada.
create or replace function public.publish_lineup(p_matchday_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_variant uuid;
begin
  if auth.uid() is null
     or not private.is_team_admin(private.team_for_matchday(p_matchday_id)) then
    raise exception 'Sin permiso para publicar esta alineación' using errcode = '42501';
  end if;

  select id into v_variant from public.lineup_variants
   where matchday_id = p_matchday_id and is_active limit 1;

  delete from public.lineup_published where matchday_id = p_matchday_id;
  if v_variant is not null then
    insert into public.lineup_published (matchday_id, court_number, player_a_id, player_b_id)
    select p_matchday_id, l.court_number, l.player_a_id, l.player_b_id
      from public.lineups l
     where l.variant_id = v_variant
       and (l.player_a_id is not null or l.player_b_id is not null);
  end if;

  update public.matchdays set lineup_published_at = now() where id = p_matchday_id;
end $$;
revoke all on function public.publish_lineup(uuid) from public, anon;
grant execute on function public.publish_lineup(uuid) to authenticated;

-- Lo que ya estaba publicado: se congela como está ahora (no se esconde nada de golpe).
insert into public.lineup_published (matchday_id, court_number, player_a_id, player_b_id)
select m.id, l.court_number, l.player_a_id, l.player_b_id
  from public.matchdays m
  join public.lineup_variants v on v.matchday_id = m.id and v.is_active
  join public.lineups l on l.variant_id = v.id
 where m.lineup_published_at is not null
   and (l.player_a_id is not null or l.player_b_id is not null)
on conflict (matchday_id, court_number) do nothing;
