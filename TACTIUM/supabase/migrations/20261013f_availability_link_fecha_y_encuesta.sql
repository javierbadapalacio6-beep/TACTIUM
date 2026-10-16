-- Enlace público de disponibilidad (sin app): fecha del fin de semana y encuesta de hora.
-- (aplicada en producción el 13-10-2026 en dos pasos: «availability_link_fecha_fin_de_semana» y
--  «availability_link_encuesta_de_hora»; aquí el resultado final)
--
-- · Mientras el club no fija día y hora, el enlace pone el fin de semana de la Federación («23 - 25 Oct»,
--   matchdays.fcp_date_range).
-- · Los jugadores sin cuenta (la mayoría) no pueden votar la hora en la app; con el mismo enlace marcan las horas que
--   les van, igual que responden Voy / Duda / No. Misma confianza y mismo freno (300 escrituras por enlace y hora).
--
-- Se envuelve la RPC de 20261010: la original pasa a `_base` (sin acceso público) y la nueva devuelve lo mismo más
-- `fcp_date_range` y `time_poll` (la encuesta abierta con sus horas y los votos por jugador, o null).

alter function public.public_availability_by_token(text) rename to public_availability_by_token_base;
revoke all on function public.public_availability_by_token_base(text) from public, anon, authenticated;

create or replace function public.public_availability_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v      jsonb := public.public_availability_by_token_base(p_token);
  v_md   uuid;
  v_rng  text;
  v_poll jsonb;
begin
  select s.matchday_id into v_md from private.availability_link_state(p_token) s;
  if v_md is not null then
    select m.fcp_date_range into v_rng from public.matchdays m where m.id = v_md;
  end if;
  if coalesce(v->>'valid', 'false') = 'true' and v_md is not null then
    select jsonb_build_object(
             'id', p.id,
             'message', p.message,
             'deadline', p.deadline,
             'options', (select coalesce(jsonb_agg(jsonb_build_object(
                           'id', o.id, 'date', o.match_date, 'time', to_char(o.match_time, 'HH24:MI'))
                           order by o.position), '[]'::jsonb)
                         from public.matchday_time_poll_options o where o.poll_id = p.id),
             'votes', (select coalesce(jsonb_object_agg(vt.player_id::text, to_jsonb(vt.option_ids)), '{}'::jsonb)
                       from public.matchday_time_poll_votes vt where vt.poll_id = p.id))
      into v_poll
      from public.matchday_time_polls p
     where p.matchday_id = v_md and p.status = 'open'
     limit 1;
  end if;
  return v || jsonb_build_object('fcp_date_range', v_rng, 'time_poll', v_poll);
end $$;

revoke all on function public.public_availability_by_token(text) from public;
grant execute on function public.public_availability_by_token(text) to anon, authenticated;

-- Votar las horas desde el enlace. Siempre devuelve {ok, reason?}; los fallos esperados no son excepciones.
create or replace function public.public_vote_time_poll(
  p_token      text,
  p_player_id  uuid,
  p_option_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_md   uuid;
  v_why  text;
  v_team uuid;
  v_poll public.matchday_time_polls;
  v_ids  uuid[];
  v_cnt  integer;
  v_t    text := lower(btrim(coalesce(p_token, '')));
begin
  select s.matchday_id, s.reason into v_md, v_why from private.availability_link_state(p_token) s;
  if v_why is not null then
    return jsonb_build_object('ok', false, 'reason', v_why);
  end if;

  select * into v_poll from public.matchday_time_polls
   where matchday_id = v_md and status = 'open' limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_poll');
  end if;
  if v_poll.deadline is not null and v_poll.deadline <= now() then
    return jsonb_build_object('ok', false, 'reason', 'poll_closed');
  end if;

  v_team := private.team_for_matchday(v_md);
  if p_player_id is null or not exists (
       select 1 from public.players p where p.id = p_player_id and p.team_id = v_team and p.active) then
    return jsonb_build_object('ok', false, 'reason', 'no_player');
  end if;

  -- Solo horas de ESTA encuesta, sin repetir.
  select coalesce(array_agg(distinct o.id), '{}') into v_ids
    from public.matchday_time_poll_options o
   where o.poll_id = v_poll.id and o.id = any(coalesce(p_option_ids, '{}'));
  if cardinality(v_ids) <> cardinality(array(select distinct unnest(coalesce(p_option_ids, '{}'::uuid[])))) then
    return jsonb_build_object('ok', false, 'reason', 'bad_option');
  end if;

  update public.availability_links l
     set writes_count = case when now() - l.writes_window_start > interval '1 hour' then 1 else l.writes_count + 1 end,
         writes_window_start = case when now() - l.writes_window_start > interval '1 hour' then now() else l.writes_window_start end
   where l.token = v_t
  returning l.writes_count into v_cnt;
  if v_cnt > 300 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  -- Sin user_id: el jugador no tiene cuenta (o vota desde el enlace). Si luego vota en la app, se pisa por (poll, player).
  insert into public.matchday_time_poll_votes (poll_id, player_id, user_id, option_ids, updated_at)
  values (v_poll.id, p_player_id, null, v_ids, now())
  on conflict (poll_id, player_id) do update
    set option_ids = excluded.option_ids, updated_at = now();

  return jsonb_build_object('ok', true, 'option_ids', to_jsonb(v_ids));
end $$;

revoke all on function public.public_vote_time_poll(text, uuid, uuid[]) from public;
grant execute on function public.public_vote_time_poll(text, uuid, uuid[]) to anon, authenticated;
