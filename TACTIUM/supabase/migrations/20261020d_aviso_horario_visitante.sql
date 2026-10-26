-- Partidos de VISITANTE: cuando la Federación publica (o cambia) la hora, llega un aviso a la app al equipo.
-- El horario de un partido de fuera lo fija el otro club, así que el equipo solo se entera mirando la Federación.
-- Se avisa solo cuando el horario de la Federación es distinto del que teníamos (primera publicación o cambio).
-- Destinatarios: capitanes/gestores del equipo y jugadores con app. Tipo `away_schedule_published`.

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
     where u.uid is not null;
    perform private.send_availability_messages(v_msgs);
  end if;
end $$;
