-- Kudos en los detalles de partido (rediseño bloque «Partido», 2026-10). APLICADA en producción el 2026-10-04.
-- El código de app y web ya funciona sin esto: si los campos no
-- vienen, lee el recuento de `activity_kudos` (RLS de lectura para usuarios
-- con sesión) y, si tampoco puede, oculta el contador. El botón usa
-- toggle_activity_kudos en todo caso.
--
--  1. public_get_matchday devuelve además kudos_count e i_gave_kudos.
--     Cambia el tipo de retorno → hay que recrear la función.
--  2. activity_kudos_summary(kind, id): lo mismo para el detalle de amistoso
--     (que se lee por tabla, no por RPC).

drop function if exists public.public_get_matchday(uuid);
create function public.public_get_matchday(p_id uuid)
 returns table(
   id uuid, jornada_number int, match_date date, opponent text, is_home boolean,
   score_for int, score_against int, outcome text, photo_url text,
   team_name text, category text, group_name text, courts jsonb,
   kudos_count int, i_gave_kudos boolean
 )
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select m.id, m.jornada_number, m.match_date, m.opponent, m.is_home,
         m.score_for, m.score_against, m.outcome::text, m.photo_url,
         t.name, t.category, t.group_name,
         coalesce((
           select jsonb_agg(cc order by cc->>'court_number')
           from (
             select jsonb_build_object(
               'court_number', r.court_number,
               'forfeit', bool_or(r.forfeit),
               'forfeit_us', bool_or(r.forfeit_us) filter (where r.forfeit),
               'pair', (
                 select nullif(trim(
                   coalesce(lp.player_a_name, '') ||
                   case when nullif(lp.player_b_name, '') is not null
                        then ' / ' || lp.player_b_name else '' end), '')
                 from public.lineup_pairs lp
                 join public.lineup_variants v on v.id = lp.variant_id
                 where lp.matchday_id = m.id and lp.court_number = r.court_number and v.is_active
                 limit 1
               ),
               'sets', coalesce(
                 jsonb_agg(jsonb_build_object('us', r.us, 'them', r.them) order by r.set_number)
                   filter (where not r.forfeit and r.us is not null and r.them is not null),
                 '[]'::jsonb)
             ) as cc
             from public.match_results r
             where r.matchday_id = m.id
             group by r.court_number
           ) courts_sub
         ), '[]'::jsonb),
         (select count(*)::int from public.activity_kudos k
           where k.target_kind = 'league' and k.target_id = m.id),
         coalesce((select true from public.activity_kudos k
           where k.target_kind = 'league' and k.target_id = m.id
             and k.user_id = auth.uid() limit 1), false)
  from public.matchdays m
  join public.seasons s on s.id = m.season_id
  join public.teams t on t.id = s.team_id
  where m.id = p_id;
$function$;

grant execute on function public.public_get_matchday(uuid) to anon, authenticated;

create or replace function public.activity_kudos_summary(p_kind text, p_target_id uuid)
 returns table(kudos_count int, i_gave_kudos boolean)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int,
         coalesce(bool_or(k.user_id = auth.uid()), false)
  from public.activity_kudos k
  where k.target_kind = p_kind and k.target_id = p_target_id;
$function$;

revoke execute on function public.activity_kudos_summary(text, uuid) from public, anon;
grant execute on function public.activity_kudos_summary(text, uuid) to authenticated;
