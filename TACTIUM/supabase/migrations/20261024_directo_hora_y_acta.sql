-- ═════════════════════════════════════════════════════════════════════════
-- Directo: se activa a la hora del partido y se sincroniza con el acta
-- (2026-10-24)
--
-- Antes el «EN DIRECTO» solo existía si alguien pulsaba «Marcar» (se creaba la
-- fila de live_matches), y un resultado metido a mano en el acta no se veía
-- en el directo: la pista seguía «en juego» y el total no lo contaba.
--
-- live_matchday_state pasa a devolver, además:
--   · match_date / match_time de la jornada → el cliente activa el directo
--     cuando llega la hora (sin tocar nada) y lo apaga al cerrar todas las
--     pistas o el acta;
--   · result_sets por pista → los sets del acta (match_results sin W.O.), que
--     mandan sobre un directo que se quedó a medias.
--
-- Solo se añaden claves al JSON: los clientes viejos las ignoran.
-- ═════════════════════════════════════════════════════════════════════════

create or replace function public.live_matchday_state(p_matchday_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_team uuid;
  v_admin boolean;
begin
  v_team := private.team_for_matchday(p_matchday_id);
  if v_team is null or not private.is_team_member(v_team) then
    raise exception 'No tienes acceso a esta jornada';
  end if;
  v_admin := private.is_team_admin(v_team);

  return (
    select jsonb_build_object(
      'matchday_id', m.id,
      'matchday_status', m.status::text,
      'match_date', m.match_date,
      'match_time', m.match_time,
      'is_admin', v_admin,
      'can_score', private.can_score_live(m.id, 1),
      'share_token', (select s.token from public.live_shares s where s.matchday_id = m.id),
      'courts', coalesce((
        select jsonb_agg(x.j order by x.court_number)
        from (
          select cn.court_number,
            jsonb_build_object(
              'court_number', cn.court_number,
              'player_a', (select jsonb_build_object('id', lp.player_a_id, 'name', lp.player_a_name)
                           from public.lineup_pairs lp join public.lineup_variants v on v.id = lp.variant_id and v.is_active
                           where lp.matchday_id = m.id and lp.court_number = cn.court_number and lp.player_a_id is not null limit 1),
              'player_b', (select jsonb_build_object('id', lp.player_b_id, 'name', lp.player_b_name)
                           from public.lineup_pairs lp join public.lineup_variants v on v.id = lp.variant_id and v.is_active
                           where lp.matchday_id = m.id and lp.court_number = cn.court_number and lp.player_b_id is not null limit 1),
              'forfeit', coalesce((select bool_or(r.forfeit) from public.match_results r
                                   where r.matchday_id = m.id and r.court_number = cn.court_number), false),
              'forfeit_us', coalesce((select bool_or(r.forfeit_us) from public.match_results r
                                      where r.matchday_id = m.id and r.court_number = cn.court_number and r.forfeit), false),
              'result_sets', coalesce((select jsonb_agg(jsonb_build_object('us', r.us, 'them', r.them) order by r.set_number)
                                       from public.match_results r
                                       where r.matchday_id = m.id and r.court_number = cn.court_number
                                         and not r.forfeit and r.us is not null and r.them is not null), '[]'::jsonb),
              'live', (select private.live_json(lm) from public.live_matches lm
                       where lm.matchday_id = m.id and lm.court_number = cn.court_number)
            ) as j
          from (
            select l.court_number from public.lineups l
              join public.lineup_variants v on v.id = l.variant_id and v.is_active
             where l.matchday_id = m.id
            union
            select lm.court_number from public.live_matches lm where lm.matchday_id = m.id
            union
            select r.court_number from public.match_results r where r.matchday_id = m.id
          ) cn
        ) x
      ), '[]'::jsonb)
    )
    from public.matchdays m
    where m.id = p_matchday_id
  );
end;
$$;

revoke all on function public.live_matchday_state(uuid) from public, anon;
grant execute on function public.live_matchday_state(uuid) to authenticated;
