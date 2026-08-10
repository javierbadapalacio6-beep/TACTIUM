-- Vista pública (solo lectura) de un partido de liga (jornada), para que las
-- fotos de jornada del perfil lleven a "su partido" en cualquier perfil.
-- Devuelve el resumen (equipo, rival, jornada, fecha, marcador, foto) + los
-- resultados por pista (sets us/them). Las pistas de W.O. van marcadas con
-- forfeit=true (sus sets no tienen marcador) para no pintar "null-null".
-- SECURITY DEFINER: lectura pública, como las fotos que ya se muestran.
create or replace function public.public_get_matchday(p_id uuid)
 returns table(
   id uuid, jornada_number int, match_date date, opponent text, is_home boolean,
   score_for int, score_against int, outcome text, photo_url text,
   team_name text, category text, group_name text, courts jsonb
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
         ), '[]'::jsonb)
  from public.matchdays m
  join public.seasons s on s.id = m.season_id
  join public.teams t on t.id = s.team_id
  where m.id = p_id;
$function$;

grant execute on function public.public_get_matchday(uuid) to anon, authenticated;
