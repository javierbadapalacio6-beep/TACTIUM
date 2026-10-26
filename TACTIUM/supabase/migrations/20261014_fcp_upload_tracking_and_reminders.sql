-- «Subido a la Federación» + avisos del lunes.
--
-- Los horarios de local se publican en la web de la Federación, y los sube el CAPITÁN de cada equipo antes del
-- lunes a las 20:00 de la semana de la jornada. TACTIUM:
--   1) deja marcar cada partido de local como «Subido a la Federación» (capitán o club) y avisa a la otra parte;
--   2) el lunes por la mañana (09:00) y a las 13:30 (hora de Madrid) recuerda, a capitanes y a clubs, lo que
--      todavía no está subido, con el plazo de las 20:00.

alter table public.matchdays
  add column if not exists fcp_uploaded_at timestamptz,
  add column if not exists fcp_uploaded_by uuid references auth.users(id) on delete set null;

-- Primer día de «23 - 25 Oct» / «30 Oct - 1 Nov». Null si no se entiende.
create or replace function private.fcp_range_start(p_range text, p_ref date default current_date)
returns date
language plpgsql immutable
as $$
declare
  m   text[];
  mon int;
  r   date;
begin
  m := regexp_match(btrim(coalesce(p_range, '')),
         '^(\d{1,2})\s*([A-Za-záéíóúÁÉÍÓÚ]{3})?\.?\s*[-–—]\s*(\d{1,2})\s*([A-Za-záéíóúÁÉÍÓÚ]{3})\.?$');
  if m is null then return null; end if;
  mon := array_position(array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
                        lower(coalesce(m[2], m[4])));
  if mon is null then return null; end if;
  begin
    r := make_date(extract(year from p_ref)::int, mon, m[1]::int);
  exception when others then
    return null;
  end;
  if r < p_ref - 180 then r := (r + interval '1 year')::date;
  elsif r > p_ref + 185 then r := (r - interval '1 year')::date;
  end if;
  return r;
end $$;

-- Registro de las tandas de avisos ya mandadas (una por franja y día): el cron pasa cada 30 min y no debe repetir.
create table if not exists public.fcp_upload_reminder_log (
  run_key text primary key,
  created_at timestamptz not null default now()
);
alter table public.fcp_upload_reminder_log enable row level security;
revoke all on public.fcp_upload_reminder_log from anon, authenticated;

-- ── Marcar como subido / quitar la marca ───────────────────────────────
create or replace function public.set_fcp_uploaded(p_matchday_ids uuid[], p_uploaded boolean default true)
returns integer
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  r      record;
  v_n    int := 0;
  v_msgs jsonb := '[]'::jsonb;
  v_when text;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;

  for r in
    select m.id, m.jornada_number, m.opponent, m.match_date, m.match_time, m.location, m.fcp_uploaded_at,
           m.fcp_date_range, t.id as team_id, t.name as team_name, t.club_id, t.venue_club_id
      from public.matchdays m
      join public.seasons s on s.id = m.season_id
      join public.teams t on t.id = s.team_id
     where m.id = any(p_matchday_ids)
       and m.is_home
       and (private.is_team_admin(t.id)
            or (t.venue_club_id is not null and private.is_club_admin(t.venue_club_id)))
  loop
    if p_uploaded then
      if r.fcp_uploaded_at is not null then continue; end if;
      update public.matchdays set fcp_uploaded_at = now(), fcp_uploaded_by = v_uid where id = r.id;
      v_n := v_n + 1;

      v_when := coalesce(
        nullif(btrim(coalesce(to_char(r.match_date, 'DD/MM'), '') || ' ' || coalesce(to_char(r.match_time, 'HH24:MI'), '')), ''),
        r.fcp_date_range);
      -- Avisa a la otra parte: capitanes del equipo y gestores del club (propio o sede), salvo quien lo marca.
      v_msgs := v_msgs || coalesce((
        select jsonb_agg(jsonb_build_object(
                 'user_id', u.uid, 'type', 'fcp_upload_done', 'category', 'fcp_upload',
                 'title', 'Horario subido a la Federación',
                 'body', coalesce('J' || r.jornada_number::text, 'Jornada') || coalesce(' vs ' || r.opponent, '')
                         || ' (' || r.team_name || ')' || coalesce(' · ' || v_when, '') || ' ya figura en la Federación.',
                 'data', jsonb_build_object('type', 'fcp_upload_done', 'matchdayId', r.id, 'teamId', r.team_id)))
        from (
          select tm.user_id as uid from public.team_members tm
           where tm.team_id = r.team_id and tm.role in ('captain', 'admin')
          union
          select cm.user_id from public.club_members cm
           where cm.role = 'admin' and cm.club_id in (r.club_id, r.venue_club_id)
        ) u
        where u.uid is distinct from v_uid
      ), '[]'::jsonb);
    else
      if r.fcp_uploaded_at is null then continue; end if;
      update public.matchdays set fcp_uploaded_at = null, fcp_uploaded_by = null where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;

  perform private.send_availability_messages(v_msgs);
  return v_n;
end $$;

revoke all on function public.set_fcp_uploaded(uuid[], boolean) from public, anon;
grant execute on function public.set_fcp_uploaded(uuid[], boolean) to authenticated;

-- ── Avisos del lunes (09:00 y 13:30, hora de Madrid) ───────────────────
-- Partidos de LOCAL de equipos de la Federación Cántabra, por jugar, sin marcar como subidos y cuya jornada cae en
-- los próximos 6 días. Capitanes: un aviso por partido. Clubs: un único aviso con el recuento (si alguien es a la
-- vez capitán y gestor, solo recibe el del club, para no llenarle el móvil).
-- `p_dry` devuelve los mensajes sin mandarlos; `p_today` simula otro día (pruebas); `p_force` se salta el reloj.
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
      when extract(hour from v_now) = 13 and extract(minute from v_now) >= 30 then 'tarde'
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
             'body', 'Plazo hoy hasta las 20:00.'
                     || case when count(*) filter (where p.match_time is null) > 0
                             then ' ' || count(*) filter (where p.match_time is null) || ' aún sin hora.' else '' end,
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

-- Cada 30 min los lunes (UTC): la función solo actúa a las 09:00 y a las 13:30 de Madrid (con horario de verano o sin él).
select cron.unschedule('fcp-upload-reminders') where exists (select 1 from cron.job where jobname = 'fcp-upload-reminders');
select cron.schedule('fcp-upload-reminders', '0,30 * * * 1', $$select public.run_fcp_upload_reminders();$$);
