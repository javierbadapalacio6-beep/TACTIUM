-- Partidos de VISITANTE: en cuanto la Federación publica la hora por PRIMERA vez, los jugadores con app
-- reciben directamente el «Voy / Duda / No» (sin esperar al ciclo horario de los 7 días). Si la hora solo
-- CAMBIA, siguen recibiendo el aviso de cambio de hora. Capitanes/gestores que no son jugadores con app
-- reciben el aviso «Ya hay hora». Los que ya contestaron esa jornada no reciben el Voy/No.

create or replace function private.fcp_apply_horario(p_matchday_id uuid, p_id_partido text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  m record;
  v_time time;
  v_tandas text;
  v_changed boolean;
  v_first boolean;
  v_msgs jsonb;
begin
  select * into p from public.fcp_partidos where id_partido = p_id_partido;
  if not found then return; end if;
  select m0.id, m0.is_home, m0.match_date, m0.match_time, m0.location, m0.tandas, m0.jornada_number, m0.opponent,
         s.team_id, t.name as team_name
    into m
    from public.matchdays m0
    join public.seasons s on s.id = m0.season_id
    join public.teams t on t.id = s.team_id
   where m0.id = p_matchday_id;
  if not found then return; end if;

  v_tandas := private.fcp_tandas_for_matchday(p_matchday_id, p_id_partido);
  v_time := case when btrim(coalesce(p.hora, '')) ~ '^\d{1,2}:\d{2}$' then btrim(p.hora)::time end;

  v_changed := p.fecha is not null and v_time is not null
               and (m.match_date is distinct from p.fecha or m.match_time is distinct from v_time);
  v_first := m.match_date is null or m.match_time is null;

  update public.matchdays x set
    match_date = case when p.fecha is not null and v_time is not null then p.fecha else x.match_date end,
    match_time = case when p.fecha is not null and v_time is not null then v_time else x.match_time end,
    location   = coalesce(nullif(btrim(coalesce(p.lugar, '')), ''), x.location),
    tandas     = coalesce(v_tandas, x.tandas)
  where x.id = p_matchday_id
    and (
      v_changed
      or (nullif(btrim(coalesce(p.lugar, '')), '') is not null and x.location is distinct from btrim(p.lugar))
      or (v_tandas is not null and x.tandas is distinct from v_tandas)
    );

  -- Aviso en partidos de fuera cuando la hora es nueva o cambia.
  if v_changed and not m.is_home then
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', u.uid, 'type', 'away_schedule_published', 'category', 'schedule',
             'title', case when v_first then 'Ya hay hora para el partido fuera' else 'Cambio de hora en el partido fuera' end,
             'body', coalesce('J' || m.jornada_number::text, 'Jornada') || coalesce(' vs ' || m.opponent, '')
                     || ' (' || m.team_name || ') · ' || to_char(p.fecha, 'DD/MM') || ' ' || to_char(v_time, 'HH24:MI')
                     || coalesce(' · ' || nullif(btrim(coalesce(p.lugar, '')), ''), ''),
             'data', jsonb_build_object('type', 'away_schedule_published', 'matchdayId', p_matchday_id, 'teamId', m.team_id))),
           '[]'::jsonb)
      into v_msgs
      from (
        select tm.user_id as uid from public.team_members tm where tm.team_id = m.team_id
        union
        select pl.user_id from public.players pl
         where pl.team_id = m.team_id and pl.active = true and pl.user_id is not null
      ) u
     where u.uid is not null
       -- Primera publicación: quien ya recibe el Voy/No no necesita además el aviso de hora.
       and not (v_first and exists (
         select 1 from public.players pl2
          where pl2.team_id = m.team_id and pl2.active = true and pl2.user_id = u.uid));
    perform private.send_availability_messages(v_msgs);

    -- Primera publicación: el «Voy / Duda / No» sale ya, a quien aún no ha contestado esa jornada.
    if v_first then
      select coalesce(jsonb_agg(private.availability_message(pl.user_id, p_matchday_id, null)), '[]'::jsonb)
        into v_msgs
        from public.players pl
        left join public.availability a on a.matchday_id = p_matchday_id and a.player_id = pl.id
       where pl.team_id = m.team_id and pl.active = true and pl.user_id is not null
         and a.id is null;
      perform private.send_availability_messages(v_msgs);
    end if;
  end if;
end $$;
