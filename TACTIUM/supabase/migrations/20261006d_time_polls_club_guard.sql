-- ════════════════════════════════════════════════════════════════════════════
-- Encuesta de hora · no pisar la hora del club (2026-10-06)
--
-- La encuesta es sobre todo para capitanes por su cuenta (club_id null) y para
-- equipos cuyo club no les pone la hora. Reglas:
--   · Equipo de club (club_id o venue_club_id): solo se puede abrir encuesta en
--     una jornada SIN hora. Si el club ya la puso en Horarios, no.
--   · Al fijar: si mientras se votaba alguien puso otra hora a la jornada (se
--     compara con la foto `base_date/base_time` tomada al crear), el servidor
--     no la pisa: devuelve `hint = time_changed:<fecha>T<hora>` y el capitán
--     elige mantenerla (cancelar) o sobrescribirla (`p_overwrite = true`).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.matchday_time_polls
  add column if not exists base_date date,
  add column if not exists base_time time;

create or replace function private.time_poll_club_managed(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select t.club_id is not null or t.venue_club_id is not null
                     from public.teams t where t.id = p_team_id), false);
$$;

-- Foto de la fecha/hora de la jornada al abrir la encuesta.
create or replace function private.time_poll_snapshot()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select m.match_date, m.match_time into new.base_date, new.base_time
    from public.matchdays m where m.id = new.matchday_id;
  return new;
end $$;

drop trigger if exists time_poll_snapshot on public.matchday_time_polls;
create trigger time_poll_snapshot
  before insert on public.matchday_time_polls
  for each row execute function private.time_poll_snapshot();

-- Equipo de club con la hora ya puesta: no se abre encuesta.
create or replace function private.time_poll_guard_club_time()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_time time;
begin
  if private.time_poll_club_managed(new.team_id) then
    select m.match_time into v_time from public.matchdays m where m.id = new.matchday_id;
    if v_time is not null then
      raise exception 'El club ya ha puesto hora a esta jornada' using errcode = '22023',
        hint = 'club_time_set';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists time_poll_guard_club_time on public.matchday_time_polls;
create trigger time_poll_guard_club_time
  before insert on public.matchday_time_polls
  for each row execute function private.time_poll_guard_club_time();

drop function if exists public.fix_time_poll(uuid, uuid);

create or replace function public.fix_time_poll(
  p_poll_id uuid, p_option_id uuid, p_overwrite boolean default false)
returns public.matchdays
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.matchday_time_polls;
  v_opt  public.matchday_time_poll_options;
  v_md   public.matchdays;
  v_team public.teams;
  v_when text;
  v_msgs jsonb;
begin
  select * into v_poll from public.matchday_time_polls where id = p_poll_id;
  if not found then
    raise exception 'Encuesta no encontrada' using errcode = 'P0002';
  end if;
  if v_uid is null or not private.is_team_admin(v_poll.team_id) then
    raise exception 'Solo el capitán puede fijar la hora' using errcode = '42501';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'La encuesta ya está cerrada' using errcode = '22023';
  end if;
  select * into v_opt from public.matchday_time_poll_options
   where id = p_option_id and poll_id = p_poll_id;
  if not found then
    raise exception 'Esa opción no es de esta encuesta' using errcode = '22023';
  end if;
  select * into v_md from public.matchdays where id = v_poll.matchday_id;
  if v_md.status = 'finished' then
    raise exception 'Esa jornada ya se jugó' using errcode = '22023';
  end if;

  -- Alguien (normalmente el club, desde Horarios) puso hora mientras la
  -- encuesta estaba abierta: no se pisa sin que el capitán lo elija.
  if not coalesce(p_overwrite, false)
     and v_md.match_time is not null
     and (v_md.match_date is distinct from v_poll.base_date
          or v_md.match_time is distinct from v_poll.base_time)
     and (v_md.match_date, v_md.match_time) is distinct from (v_opt.match_date, v_opt.match_time) then
    raise exception 'Mientras votabais se puso otra hora a la jornada' using errcode = 'P0001',
      hint = 'time_changed:' || to_char(v_md.match_date, 'YYYY-MM-DD') || 'T' || to_char(v_md.match_time, 'HH24:MI');
  end if;

  update public.matchdays
     set match_date = v_opt.match_date, match_time = v_opt.match_time
   where id = v_poll.matchday_id
  returning * into v_md;

  update public.matchday_time_polls
     set status = 'fixed', fixed_option_id = v_opt.id, closed_at = now()
   where id = p_poll_id;

  v_when := private.time_poll_option_label(v_opt.match_date, v_opt.match_time);

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.user_id,
           'type', 'time_poll_fixed',
           'title', 'J' || v_md.jornada_number::text || ' · Se juega el ' || v_when,
           'body', 'Vs ' || v_md.opponent || coalesce(' en ' || v_md.location, '')
                   || '. Ya está en el calendario.',
           'data', jsonb_build_object('type', 'time_poll_fixed', 'matchdayId', v_md.id,
                                      'pollId', p_poll_id))), '[]'::jsonb)
    into v_msgs
    from private.time_poll_team_users(v_poll.team_id) u
   where u.user_id <> v_uid;
  perform private.send_availability_messages(v_msgs);

  -- Partido de LOCAL en un club que gestiona horarios (dueño o sede): aviso en
  -- la campana a sus gestores. Lo ven además en Horarios.
  if v_md.is_home then
    select * into v_team from public.teams where id = v_poll.team_id;
    insert into public.notifications (user_id, type, title, body, data)
    select distinct cm.user_id, 'time_poll_fixed',
           v_team.name || ' fija su partido en casa',
           'J' || v_md.jornada_number::text || ' vs ' || v_md.opponent || ': ' || v_when || '.',
           jsonb_build_object('type', 'time_poll_fixed', 'matchdayId', v_md.id,
                              'pollId', p_poll_id, 'for_club', true,
                              'club_id', cm.club_id, 'team_id', v_team.id)
      from public.club_members cm
     where cm.role = 'admin'
       and cm.club_id in (v_team.club_id, v_team.venue_club_id)
       and cm.user_id <> v_uid
       and cm.user_id not in (select u.user_id from private.time_poll_team_users(v_poll.team_id) u);
  end if;

  return v_md;
end $$;

revoke execute on function public.fix_time_poll(uuid, uuid, boolean) from public, anon;
grant execute on function public.fix_time_poll(uuid, uuid, boolean) to authenticated;
