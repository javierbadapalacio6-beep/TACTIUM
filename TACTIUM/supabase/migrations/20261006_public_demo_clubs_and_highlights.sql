-- Capa pública sin datos de demostración, y dos RPC anon nuevas para la portada.
--
-- 1. `clubs.is_demo`: marca los clubes de las cuentas de demostración (seed
--    `de400000-…`, demo.torneo, smash.*, apple.review: todas @tactium.io).
--    Un trigger la pone sola al crear un club desde una cuenta @tactium.io, así
--    que los seeds de demo no pueden colarse en lo público aunque se olviden.
-- 2. `explore_tournaments` (listado público de la web y Explorar de la app)
--    deja fuera los torneos de clubes demo y los que ya pasaron su última
--    fecha (`ends_on`), aunque nadie los haya cerrado. Quien entra con una
--    cuenta @tactium.io los sigue viendo, para poder hacer demos. Las fichas por
--    enlace o por código (`public_get_tournament`, `tournament_lookup`…) no
--    cambian.
-- 3. `public_site_stats()`: cifras agregadas, sin datos personales.
-- 4. `public_community_highlights()`: clubes y jugadores con perfil público
--    para enseñar en /comunidad antes de buscar.

-- 1 ─────────────────────────────────────────────────────────────────────────
alter table public.clubs add column if not exists is_demo boolean not null default false;

update public.clubs c
   set is_demo = true
 where c.is_demo = false
   and (c.id::text like 'de400000-%'
        or exists (select 1 from auth.users u
                    where u.id = c.owner_id and u.email ilike '%@tactium.io'));

create or replace function public.clubs_mark_demo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.id::text like 'de400000-%'
     or exists (select 1 from auth.users u
                 where u.id = new.owner_id and u.email ilike '%@tactium.io') then
    new.is_demo := true;
  end if;
  return new;
end;
$$;
revoke execute on function public.clubs_mark_demo() from public, anon, authenticated;

drop trigger if exists clubs_mark_demo on public.clubs;
create trigger clubs_mark_demo
  before insert on public.clubs
  for each row execute function public.clubs_mark_demo();

-- ¿Quien llama es una cuenta interna (demo, revisión de Apple, pruebas)?
create or replace function public.is_internal_viewer()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select auth.uid() is not null
     and exists (select 1 from auth.users u
                  where u.id = auth.uid() and u.email ilike '%@tactium.io');
$$;
revoke execute on function public.is_internal_viewer() from public, anon;
grant execute on function public.is_internal_viewer() to authenticated, service_role;

-- 2 ─────────────────────────────────────────────────────────────────────────
-- Cambia el tipo de retorno (añade `ends_on`): hay que borrarla y recrearla.
drop function if exists public.explore_tournaments(text);

create function public.explore_tournaments(p_search text default null)
returns table(
  id uuid, name text, club_name text, cover_url text, location text,
  starts_on date, ends_on date, status text, format text, genders text[],
  categories text[], signup_code text, pair_based boolean, players bigint,
  entry_fee numeric, fee_currency text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select t.id, t.name, c.name, t.cover_url, t.location, t.starts_on, t.ends_on,
    t.status, t.format, t.genders, t.categories, t.signup_code,
    coalesce(t.pair_based, true),
    (select count(*) from public.tournament_registrations r2 where r2.tournament_id = t.id),
    t.entry_fee, t.fee_currency
  from public.tournaments t
  join public.clubs c on c.id = t.club_id
  where t.status in ('open', 'in_progress')
    -- Ya pasó su última fecha: se trata como terminado aunque siga abierto.
    and (t.ends_on is null
         or t.ends_on >= (now() at time zone 'Europe/Madrid')::date)
    and (c.is_demo = false or public.is_internal_viewer())
    and (p_search is null or p_search = ''
      or t.name ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
      or coalesce(t.location, '') ilike '%' || p_search || '%')
  order by (t.starts_on is null), t.starts_on asc, t.created_at desc
$function$;

revoke execute on function public.explore_tournaments(text) from public;
grant execute on function public.explore_tournaments(text) to anon, authenticated, service_role;

-- 3 ─────────────────────────────────────────────────────────────────────────
-- Temporada federada: de agosto a julio.
create or replace function public.public_site_stats()
returns table(
  season_start date,
  closed_matchdays_season bigint,
  active_teams_season bigint,
  fcp_matches bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with s as (
    select make_date(
      extract(year from now())::int - case when extract(month from now()) < 8 then 1 else 0 end,
      8, 1) as d
  ),
  real_teams as (
    select t.id
      from public.teams t
      left join public.clubs c on c.id = t.club_id
     where t.id::text not like 'de400000-%'
       and coalesce(c.is_demo, false) = false
       and not exists (select 1 from auth.users u
                        where u.id = t.owner_id and u.email ilike '%@tactium.io')
  ),
  md as (
    select m.status, se.team_id
      from public.matchdays m
      join public.seasons se on se.id = m.season_id
     where se.team_id in (select id from real_teams)
       and m.match_date >= (select d from s)
  )
  select (select d from s),
         (select count(*) from md where status = 'finished'),
         (select count(distinct team_id) from md),
         (select count(*) from public.fcp_partidos);
$$;

revoke execute on function public.public_site_stats() from public;
grant execute on function public.public_site_stats() to anon, authenticated, service_role;

-- 4 ─────────────────────────────────────────────────────────────────────────
-- Solo lo que ya es público: nombre de club, y jugadores que tienen nombre de
-- usuario (perfil público en /u/…). Sin correos, sin avatares, sin cuentas
-- internas ni clubes demo.
create or replace function public.public_community_highlights()
returns table(type text, id uuid, name text, subtitle text, followers_count integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  (
    select 'club'::text, c.id, c.name,
           case when c.tournaments_only then 'Organiza torneos'
                else (select case when count(*) = 1 then '1 equipo'
                                  else count(*)::text || ' equipos' end
                        from public.teams t where t.club_id = c.id)
           end,
           (select count(*)::int from public.follows f where f.target_type = 'club' and f.target_id = c.id)
      from public.clubs c
     where c.is_demo = false
       and (exists (select 1 from public.teams t where t.club_id = c.id)
            or exists (select 1 from public.tournaments tt where tt.club_id = c.id and tt.status <> 'draft'))
     order by 5 desc, c.created_at desc
     limit 8
  )
  union all
  (
    select 'user'::text, p.id, p.username,
           'Jugador',
           (select count(*)::int from public.follows f where f.target_type = 'user' and f.target_id = p.id)
      from public.profiles p
      join auth.users u on u.id = p.id
     where nullif(btrim(p.username), '') is not null
       and u.email not ilike '%@tactium.io'
     order by 5 desc, p.updated_at desc nulls last
     limit 8
  );
$$;

revoke execute on function public.public_community_highlights() from public;
grant execute on function public.public_community_highlights() to anon, authenticated, service_role;
