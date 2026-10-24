-- ═════════════════════════════════════════════════════════════════════════
-- «Alineación subida a la Federación» + avisos antes del partido (2026-10-24)
--
-- Igual que con la hora (20261014): la alineación de cada partido hay que
-- subirla a la web de la Federación ANTES de jugar. El capitán la marca como
-- subida en TACTIUM y, mientras no lo esté, le llegan varios avisos antes del
-- partido: 24 h, 3 h y 1 h antes (cada uno una sola vez por partido).
--
-- Aplica a todos los partidos por jugar de equipos de la Federación Cántabra
-- (local y visitante) que tengan fecha y hora. Reutiliza el canal de avisos de
-- la convocatoria (private.send_availability_messages: bandeja + push, respeta
-- notifications_enabled).
-- ═════════════════════════════════════════════════════════════════════════

alter table public.matchdays
  add column if not exists lineup_fcp_uploaded_at timestamptz,
  add column if not exists lineup_fcp_uploaded_by uuid references auth.users(id) on delete set null;

-- Avisos ya mandados (uno por partido y franja): el cron pasa cada 15 min y no debe repetir.
create table if not exists public.lineup_upload_reminder_log (
  run_key text primary key,
  created_at timestamptz not null default now()
);
alter table public.lineup_upload_reminder_log enable row level security;
revoke all on public.lineup_upload_reminder_log from anon, authenticated;

-- ── Marcar / quitar la marca (solo el capitán del equipo) ──────────────
create or replace function public.set_lineup_fcp_uploaded(p_matchday_id uuid, p_uploaded boolean default true)
returns boolean
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  r      record;
  v_msgs jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión' using errcode = '42501'; end if;

  select m.id, m.jornada_number, m.opponent, m.lineup_fcp_uploaded_at,
         t.id as team_id, t.name as team_name, t.club_id, t.venue_club_id
    into r
    from public.matchdays m
    join public.seasons s on s.id = m.season_id
    join public.teams t on t.id = s.team_id
   where m.id = p_matchday_id and private.is_team_admin(t.id);
  if not found then
    raise exception 'Solo el capitán puede marcar la alineación como subida' using errcode = '42501';
  end if;

  if p_uploaded then
    if r.lineup_fcp_uploaded_at is not null then return false; end if;
    update public.matchdays
       set lineup_fcp_uploaded_at = now(), lineup_fcp_uploaded_by = v_uid
     where id = r.id;
    -- Avisa a los gestores del club (propio o sede) y a los demás capitanes del equipo.
    v_msgs := coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', u.uid, 'type', 'lineup_upload_done', 'category', 'fcp_upload',
               'title', 'Alineación subida a la Federación',
               'body', coalesce('J' || r.jornada_number::text, 'Jornada') || coalesce(' vs ' || r.opponent, '')
                       || ' (' || r.team_name || '): la alineación ya figura en la Federación.',
               'data', jsonb_build_object('type', 'lineup_upload_done', 'matchdayId', r.id, 'teamId', r.team_id)))
        from (
          select tm.user_id as uid from public.team_members tm
           where tm.team_id = r.team_id and tm.role in ('captain', 'admin')
          union
          select cm.user_id from public.club_members cm
           where cm.role = 'admin' and cm.club_id in (r.club_id, r.venue_club_id)
        ) u
       where u.uid is distinct from v_uid
    ), '[]'::jsonb);
    perform private.send_availability_messages(v_msgs);
  else
    if r.lineup_fcp_uploaded_at is null then return false; end if;
    update public.matchdays
       set lineup_fcp_uploaded_at = null, lineup_fcp_uploaded_by = null
     where id = r.id;
  end if;
  return true;
end $$;

revoke all on function public.set_lineup_fcp_uploaded(uuid, boolean) from public, anon;
grant execute on function public.set_lineup_fcp_uploaded(uuid, boolean) to authenticated;

-- ── Avisos pendientes ahora mismo ──────────────────────────────────────
-- Franjas: 24, 3 y 1 hora antes. Una franja solo "toca" mientras faltan entre (franja - 30 min) y la franja, para
-- que un partido al que se pone hora tarde no dispare los tres de golpe. `run_key` evita repetir.
create or replace function private.lineup_upload_due(p_now timestamptz default now())
returns table (
  run_key text, matchday_id uuid, team_id uuid, team_name text, jornada_number int,
  opponent text, kickoff timestamptz, slot_h int
)
language sql stable security definer set search_path = 'public', 'pg_temp'
as $$
  select m.id::text || '-' || s.h as run_key, m.id, t.id, t.name, m.jornada_number, m.opponent,
         k.kickoff, s.h
    from public.matchdays m
    join public.seasons se on se.id = m.season_id
    join public.teams t on t.id = se.team_id
    cross join lateral (select ((m.match_date + m.match_time)::timestamp at time zone 'Europe/Madrid') as kickoff) k
    join (values (24), (3), (1)) as s(h)
      on k.kickoff - p_now <= make_interval(hours => s.h)
     and k.kickoff - p_now >  make_interval(hours => s.h) - interval '30 minutes'
   where m.status = 'upcoming'
     and m.match_date is not null and m.match_time is not null
     and m.lineup_fcp_uploaded_at is null
     and t.federation = 'FCantP'
     and not exists (select 1 from public.lineup_upload_reminder_log l where l.run_key = m.id::text || '-' || s.h);
$$;
revoke all on function private.lineup_upload_due(timestamptz) from public, anon, authenticated;

create or replace function public.run_lineup_upload_reminders(p_dry boolean default false, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_msgs jsonb;
  v_sent int := 0;
begin
  if not p_dry then
    -- Reserva las franjas antes de mandar: si dos ejecuciones se pisan, solo una avisa.
    create temp table _due on commit drop as
      with d as (select * from private.lineup_upload_due(p_now)),
           ins as (insert into public.lineup_upload_reminder_log (run_key)
                   select run_key from d on conflict do nothing returning run_key)
      select d.* from d join ins using (run_key);
  else
    create temp table _due on commit drop as select * from private.lineup_upload_due(p_now);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', tm.user_id, 'type', 'lineup_upload_reminder', 'category', 'fcp_upload',
           'title', case d.slot_h
                      when 24 then 'Mañana juegas: sube la alineación'
                      when 3  then 'Sube la alineación a la Federación'
                      else 'Última hora: alineación sin subir' end,
           'body', coalesce('J' || d.jornada_number::text, 'Jornada') || coalesce(' vs ' || d.opponent, '')
                   || ' (' || d.team_name || ') es a las '
                   || to_char(d.kickoff at time zone 'Europe/Madrid', 'HH24:MI')
                   || '. Súbela a la Federación antes del partido y márcalo en TACTIUM.',
           'data', jsonb_build_object('type', 'lineup_upload_reminder', 'matchdayId', d.matchday_id, 'teamId', d.team_id))),
         '[]'::jsonb)
    into v_msgs
    from _due d
    join public.team_members tm on tm.team_id = d.team_id and tm.role in ('captain', 'admin');

  if p_dry then
    return jsonb_build_object('dry', true, 'count', jsonb_array_length(v_msgs), 'msgs', v_msgs);
  end if;
  v_sent := private.send_availability_messages(v_msgs);
  return jsonb_build_object('mensajes', jsonb_array_length(v_msgs), 'pushes', v_sent);
end $$;
revoke all on function public.run_lineup_upload_reminders(boolean, timestamptz) from public, anon, authenticated;

-- Cada 15 min.
select cron.unschedule('lineup-upload-reminders') where exists (select 1 from cron.job where jobname = 'lineup-upload-reminders');
select cron.schedule('lineup-upload-reminders', '*/15 * * * *', $$select public.run_lineup_upload_reminders();$$);
