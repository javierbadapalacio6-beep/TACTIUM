-- «Subido a la Federación» AUTOMÁTICO + aviso del lunes a las 14:00 con los equipos que faltan.
--
-- 1) Partidos de LOCAL: en cuanto la Federación muestra día y hora del partido, el horario está subido. Antes había que
--    marcarlo a mano; ahora se marca solo (fcp_uploaded_at) y se avisa a capitanes, gestores del club (propio o sede)
--    y jugadores con app: «Horario subido a la Federación». Marcarlo a mano sigue valiendo (pasa antes que la Federación).
-- 2) Aviso del lunes: la franja de la tarde pasa de las 13:30 a las 14:00 (plazo: lunes 20:00). Ya no cuenta como
--    «sin subir» un partido cuya hora ya figura en la Federación, y el aviso al club dice QUÉ equipos faltan.

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
  v_marked int := 0;
  v_when text;
begin
  select * into p from public.fcp_partidos where id_partido = p_id_partido;
  if not found then return; end if;
  select m0.id, m0.is_home, m0.match_date, m0.match_time, m0.location, m0.tandas, m0.jornada_number, m0.opponent, m0.status,
         s.team_id, t.name as team_name, t.club_id, t.venue_club_id
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

  -- Partido de FUERA: aviso cuando la hora es nueva o cambia; la primera vez, el «Voy / Duda / No» a los jugadores.
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
       and not (v_first and exists (
         select 1 from public.players pl2
          where pl2.team_id = m.team_id and pl2.active = true and pl2.user_id = u.uid));
    perform private.send_availability_messages(v_msgs);

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

  -- Partido de LOCAL: la Federación ya muestra día y hora ⇒ horario SUBIDO. Se marca solo y se avisa a capitanes,
  -- gestores del club (propio o sede) y jugadores con app (una vez: cuando pasa de «sin subir» a «subido»).
  if m.is_home and p.fecha is not null and v_time is not null then
    update public.matchdays set fcp_uploaded_at = now()
     where id = p_matchday_id and fcp_uploaded_at is null;
    get diagnostics v_marked = row_count;
    if v_marked > 0 and m.status = 'upcoming' then
      v_when := to_char(p.fecha, 'DD/MM') || ' ' || to_char(v_time, 'HH24:MI');
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', u.uid, 'type', 'fcp_upload_done', 'category', 'fcp_upload',
               'title', 'Horario subido a la Federación',
               'body', coalesce('J' || m.jornada_number::text, 'Jornada') || coalesce(' vs ' || m.opponent, '')
                       || ' (' || m.team_name || ') · ' || v_when
                       || coalesce(' · ' || nullif(btrim(coalesce(p.lugar, '')), ''), '') || ' ya figura en la Federación.',
               'data', jsonb_build_object('type', 'fcp_upload_done', 'matchdayId', p_matchday_id, 'teamId', m.team_id))),
             '[]'::jsonb)
        into v_msgs
        from (
          select tm.user_id as uid from public.team_members tm
           where tm.team_id = m.team_id and tm.role in ('captain', 'admin')
          union
          select cm.user_id from public.club_members cm
           where cm.role = 'admin' and cm.club_id in (m.club_id, m.venue_club_id)
          union
          select pl.user_id from public.players pl
           where pl.team_id = m.team_id and pl.active = true and pl.user_id is not null
        ) u
       where u.uid is not null;
      perform private.send_availability_messages(v_msgs);
    end if;
  end if;
end $$;

-- ── Aviso del lunes: 09:00 y 14:00 (Madrid) ─────────────────────────────────────────────────────────
create or replace function public.run_fcp_upload_reminders(
  p_force boolean default false, p_dry boolean default false, p_today date default null
) returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_now   timestamp := now() at time zone 'Europe/Madrid';
  v_today date := coalesce(p_today, (now() at time zone 'Europe/Madrid')::date);
  v_slot  text;
  v_key   text;
  v_rows  int;
  v_msgs  jsonb;
  v_sent  int := 0;
begin
  if not p_force then
    if extract(isodow from v_now) <> 1 then return jsonb_build_object('skipped', 'no_es_lunes'); end if;
    v_slot := case
      when extract(hour from v_now) = 9 and extract(minute from v_now) < 30 then 'manana'
      when extract(hour from v_now) = 14 and extract(minute from v_now) < 30 then 'tarde'
      else null end;
    if v_slot is null then return jsonb_build_object('skipped', 'fuera_de_franja'); end if;
    v_key := to_char(v_today, 'YYYY-MM-DD') || '-' || v_slot;
    if not p_dry then
      insert into public.fcp_upload_reminder_log (run_key) values (v_key) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then return jsonb_build_object('skipped', 'ya_enviado', 'key', v_key); end if;
    end if;
  else
    v_slot := 'tarde';
  end if;

  with pend as (
    select m.id as matchday_id, m.jornada_number, m.opponent, m.match_time, t.id as team_id, t.name as team_name,
           t.club_id, t.venue_club_id, coalesce(t.club_id, t.venue_club_id) as club
      from public.matchdays m
      join public.seasons s on s.id = m.season_id
      join public.teams t on t.id = s.team_id
     where m.is_home
       and m.status = 'upcoming'
       and m.fcp_uploaded_at is null
       and t.federation = 'FCantP'
       -- Si la Federación ya muestra día y hora del partido, está subido aunque nadie lo marcara.
       and not exists (
         select 1 from public.fcp_partidos fp
          where fp.id_partido = m.fcp_id_partido
            and fp.fecha is not null and nullif(btrim(coalesce(fp.hora, '')), '') is not null)
       and coalesce(m.match_date, private.fcp_range_start(m.fcp_date_range, v_today))
           between v_today and v_today + 6
  ), club_admins as (
    select distinct cm.user_id, cm.club_id from public.club_members cm where cm.role = 'admin'
  ), cap_msgs as (
    select jsonb_build_object(
             'user_id', tm.user_id, 'type', 'fcp_upload_reminder', 'category', 'fcp_upload',
             'title', case when v_slot = 'tarde' then 'Último aviso: sube la hora a la Federación'
                           else 'Sube la hora a la Federación' end,
             'body', coalesce('J' || p.jornada_number::text, 'Jornada') || coalesce(' vs ' || p.opponent, '')
                     || ' (' || p.team_name || '): plazo hoy hasta las 20:00.'
                     || case when p.match_time is null then ' Aún no tiene hora: pídesela a tu club.' else '' end,
             'data', jsonb_build_object('type', 'fcp_upload_reminder', 'matchdayId', p.matchday_id, 'teamId', p.team_id)) as msg
      from pend p
      join public.team_members tm on tm.team_id = p.team_id and tm.role in ('captain', 'admin')
     where not exists (
       select 1 from club_admins ca
        where ca.user_id = tm.user_id and ca.club_id in (p.club_id, p.venue_club_id))
  ), club_msgs as (
    select jsonb_build_object(
             'user_id', ca.user_id, 'type', 'fcp_upload_reminder', 'category', 'fcp_upload',
             'title', case when v_slot = 'tarde' then 'Último aviso: ' else '' end
                      || count(*) || case when count(*) = 1 then ' horario' else ' horarios' end
                      || ' sin subir a la Federación',
             'body', 'Plazo hoy hasta las 20:00. Aún sin subir: '
                     || array_to_string((array_agg(p.team_name || coalesce(' (J' || p.jornada_number::text || ')', '')
                                                   order by p.team_name))[1:6], ', ')
                     || case when count(*) > 6 then ' y ' || (count(*) - 6) || ' más.' else '.' end,
             'data', jsonb_build_object('type', 'fcp_upload_reminder', 'clubId', p.club)) as msg
      from pend p
      join club_admins ca on ca.club_id in (p.club_id, p.venue_club_id)
     group by ca.user_id, p.club
  )
  select coalesce(jsonb_agg(msg), '[]'::jsonb) into v_msgs
    from (select msg from cap_msgs union all select msg from club_msgs) x;

  if p_dry then
    return jsonb_build_object('dry', true, 'slot', v_slot, 'today', v_today, 'count', jsonb_array_length(v_msgs), 'msgs', v_msgs);
  end if;
  v_sent := private.send_availability_messages(v_msgs);
  return jsonb_build_object('slot', v_slot, 'mensajes', jsonb_array_length(v_msgs), 'pushes', v_sent);
end $$;

revoke all on function public.run_fcp_upload_reminders(boolean, boolean, date) from public, anon, authenticated;
