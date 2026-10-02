-- ════════════════════════════════════════════════════════════════════════════
-- Disponibilidad en un toque (mejora n.º 1 del benchmark, 2026-10-01)
--
-- Antes había tres fuentes que no cuadraban:
--   · la app escribía `players.available` (un sí/no GLOBAL, no por jornada);
--   · la web del capitán escribía `availability` (por jornada);
--   · el recordatorio diario de las 17:00 leía `availability` → avisaba a
--     jugadores que ya habían marcado en la app.
--
-- Ahora la fuente de verdad es `availability` (jornada × jugador) con tres
-- estados: yes · maybe · no. «Sin fila» = sin contestar.
--   · La duda cierra 24 h antes del partido; si sigue en duda pasa a «no».
--   · Recordatorio automático cada 12 h (9:00 y 21:00 Madrid) a quien no ha
--     contestado o está en duda, desde 7 días antes. Sustituye al de las 17:00.
--   · «Recordar ahora» (capitán) es premium y se puede usar 1 vez / 12 h.
--
-- Compatibilidad con builds antiguas (sin OTA aún):
--   · `availability.available` se mantiene = (status = 'yes').
--   · `players.available` se mantiene como ESPEJO de la próxima jornada del
--     equipo (lo siguen leyendo Lineup y el generador de alineaciones).
--   · Si una build antigua cambia `players.available`, se refleja como
--     respuesta a la próxima jornada.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
alter table public.availability
  add column if not exists status text,
  add column if not exists reason text,
  add column if not exists auto_resolved boolean not null default false;

update public.availability
   set status = case when available then 'yes' else 'no' end
 where status is null;

alter table public.availability
  alter column status set default 'yes',
  alter column status set not null;

do $$ begin
  alter table public.availability
    add constraint availability_status_chk check (status in ('yes','maybe','no'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.availability
    add constraint availability_reason_chk
    check (reason is null or reason in ('trabajo','molestias','viaje','pendiente'));
exception when duplicate_object then null; end $$;

-- Registro de recordatorios manuales (para el bloqueo de 12 h).
create table if not exists public.availability_reminders (
  id          uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  sent_by     uuid references auth.users(id) on delete set null,
  recipients  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists availability_reminders_md_idx
  on public.availability_reminders (matchday_id, created_at desc);
alter table public.availability_reminders enable row level security;

drop policy if exists availability_reminders_member_select on public.availability_reminders;
create policy availability_reminders_member_select on public.availability_reminders
  for select using (private.is_team_member(private.team_for_matchday(matchday_id)));
-- Sin políticas de escritura: solo escribe la RPC (SECURITY DEFINER).

-- ── 2. Utilidades ───────────────────────────────────────────────────────────
-- Inicio del partido (hora de Madrid). Sin hora → 12:00.
create or replace function private.matchday_starts_at(p_matchday_id uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select ((m.match_date + coalesce(m.match_time, time '12:00'))
           at time zone 'Europe/Madrid')
  from public.matchdays m where m.id = p_matchday_id;
$$;

-- Cierre de la duda: 24 h antes del partido.
create or replace function public.availability_maybe_deadline(p_matchday_id uuid)
returns timestamptz
language sql stable security definer set search_path = ''
as $$ select private.matchday_starts_at(p_matchday_id) - interval '24 hours'; $$;
grant execute on function public.availability_maybe_deadline(uuid) to authenticated;

-- Próxima jornada pendiente de un equipo.
create or replace function private.next_matchday_for_team(p_team_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id
    from public.matchdays m
    join public.seasons s on s.id = m.season_id
   where s.team_id = p_team_id
     and m.status = 'upcoming'
     and m.match_date is not null
     and m.match_date >= current_date
   order by m.match_date, m.match_time nulls last
   limit 1;
$$;

-- ── 3. Coherencia status ↔ available y espejo en players ───────────────────
create or replace function private.availability_sync_status()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status
     and new.available is distinct from old.available then
    -- Cliente antiguo que solo toca `available`.
    new.status := case when new.available then 'yes' else 'no' end;
  elsif tg_op = 'INSERT' and new.status = 'yes' and new.available = false then
    -- Insert antiguo (web) con available=false y status por defecto.
    new.status := 'no';
  end if;
  new.available := (new.status = 'yes');
  if new.status <> 'maybe' then new.reason := null; end if;
  return new;
end $$;

drop trigger if exists availability_sync_status on public.availability;
create trigger availability_sync_status
  before insert or update on public.availability
  for each row execute function private.availability_sync_status();

-- Espejo: si la fila es de la próxima jornada del equipo, players.available
-- refleja «va» (lo leen Lineup y el generador de alineaciones).
create or replace function private.availability_mirror_player()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_md uuid := coalesce(new.matchday_id, old.matchday_id);
  v_pl uuid := coalesce(new.player_id, old.player_id);
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if v_md = private.next_matchday_for_team(private.team_for_matchday(v_md)) then
    update public.players
       set available = case when tg_op = 'DELETE' then false else new.status = 'yes' end
     where id = v_pl
       and available is distinct from
           (case when tg_op = 'DELETE' then false else new.status = 'yes' end);
  end if;
  return null;
end $$;

drop trigger if exists availability_mirror_player on public.availability;
create trigger availability_mirror_player
  after insert or update or delete on public.availability
  for each row execute function private.availability_mirror_player();

-- Compat builds antiguas: tocar players.available = responder a la próxima.
create or replace function private.players_available_to_availability()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_md uuid;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if new.available is not distinct from old.available then return null; end if;
  v_md := private.next_matchday_for_team(new.team_id);
  if v_md is null then return null; end if;
  insert into public.availability (matchday_id, player_id, status, available, updated_by, updated_at)
  values (v_md, new.id, case when new.available then 'yes' else 'no' end,
          new.available, auth.uid(), now())
  on conflict (matchday_id, player_id) do update
    set status = excluded.status, available = excluded.available,
        updated_by = excluded.updated_by, updated_at = now(), auto_resolved = false;
  return null;
end $$;

drop trigger if exists players_available_to_availability on public.players;
create trigger players_available_to_availability
  after update of available on public.players
  for each row execute function private.players_available_to_availability();

-- ── 4. Responder (jugador o capitán por otro) ──────────────────────────────
create or replace function public.respond_availability(
  p_matchday_id uuid,
  p_player_id   uuid,
  p_status      text,
  p_reason      text default null,
  p_note        text default null
) returns public.availability
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_team uuid := private.team_for_matchday(p_matchday_id);
  v_self boolean;
  v_row  public.availability;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_status not in ('yes','maybe','no') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  if p_status = 'maybe' and p_reason is not null
     and p_reason not in ('trabajo','molestias','viaje','pendiente') then
    raise exception 'Motivo no válido' using errcode = '22023';
  end if;

  -- Jugador sin cuenta (user_id null) → v_self = false, no null.
  select coalesce(p.user_id = v_uid, false) into v_self
    from public.players p where p.id = p_player_id and p.team_id = v_team;
  if not found then
    raise exception 'Jugador no encontrado en este equipo' using errcode = 'P0002';
  end if;
  if not v_self and not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede responder por otro jugador' using errcode = '42501';
  end if;

  if p_status = 'maybe' and now() >= public.availability_maybe_deadline(p_matchday_id) then
    raise exception 'Ya no se puede dejar en duda: la convocatoria cierra 24 h antes del partido'
      using errcode = '22023';
  end if;

  insert into public.availability (matchday_id, player_id, status, reason, note, updated_by, updated_at, auto_resolved)
  values (p_matchday_id, p_player_id, p_status,
          case when p_status = 'maybe' then p_reason end,
          nullif(left(trim(coalesce(p_note, '')), 140), ''),
          v_uid, now(), false)
  on conflict (matchday_id, player_id) do update
    set status = excluded.status, reason = excluded.reason, note = excluded.note,
        updated_by = excluded.updated_by, updated_at = now(), auto_resolved = false
  returning * into v_row;

  return v_row;
end $$;
grant execute on function public.respond_availability(uuid, uuid, text, text, text) to authenticated;

-- Quitar respuesta (capitán): vuelve a «sin contestar».
create or replace function public.clear_availability(p_matchday_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
begin
  if not private.is_team_admin(private.team_for_matchday(p_matchday_id)) then
    raise exception 'Solo el capitán puede quitar respuestas' using errcode = '42501';
  end if;
  delete from public.availability where matchday_id = p_matchday_id and player_id = p_player_id;
end $$;
grant execute on function public.clear_availability(uuid, uuid) to authenticated;

-- El jugador marca SU disponibilidad desde builds antiguas: ahora además
-- responde a la próxima jornada (el trigger de players lo hace).
-- (set_player_self_availability no cambia: actualiza players.available.)

-- ── 5. Envío de push (Expo) ─────────────────────────────────────────────────
-- Mensajes: jsonb array de {user_id, title, body, data, category}.
-- Inserta el aviso en la campana y manda push a quien tiene token y avisos on.
create or replace function private.send_availability_messages(p_msgs jsonb)
returns int
language plpgsql security definer set search_path = 'public', 'net'
as $$
declare
  v_chunk jsonb;
  v_total int := 0;
begin
  if p_msgs is null or jsonb_array_length(p_msgs) = 0 then return 0; end if;

  begin
    insert into public.notifications (user_id, type, title, body, data)
    select (m->>'user_id')::uuid, coalesce(m->>'type', 'availability_reminder'),
           m->>'title', m->>'body', m->'data'
      from jsonb_array_elements(p_msgs) m;
  exception when others then
    raise warning 'availability in-app insert failed: %', sqlerrm;
  end;

  for v_chunk in
    with msgs as (
      select jsonb_build_object(
               'to', tok.token, 'sound', 'default', 'channelId', 'default',
               'priority', 'high', 'title', m->>'title', 'body', m->>'body',
               'data', m->'data', 'categoryId', m->>'category') as message
        from jsonb_array_elements(p_msgs) m
        join public.profiles pr on pr.id = (m->>'user_id')::uuid and pr.notifications_enabled = true
        join public.push_tokens tok on tok.user_id = pr.id
    )
    select jsonb_agg(message)
      from (select message, (row_number() over () - 1) / 100 as grp from msgs) x
     group by grp
  loop
    v_total := v_total + jsonb_array_length(v_chunk);
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_chunk,
      headers := jsonb_build_object('Content-Type', 'application/json'));
  end loop;
  return v_total;
end $$;

-- Mensaje para un jugador pendiente (status null) o en duda de una jornada.
create or replace function private.availability_message(
  p_user_id uuid, p_matchday_id uuid, p_status text
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m public.matchdays;
  v_j text;
begin
  select * into m from public.matchdays where id = p_matchday_id;
  v_j := coalesce('J' || m.jornada_number::text, 'la jornada');
  return jsonb_build_object(
    'user_id', p_user_id,
    'type', 'availability_reminder',
    'category', case when p_status = 'maybe' then 'availability_resolve' else 'availability_rsvp' end,
    'title', case when p_status = 'maybe' then '¿Al final juegas?'
                  else v_j || ' · ¿Puedes jugar?' end,
    'body', case when p_status = 'maybe'
                 then 'Estás en duda para ' || v_j || coalesce(' vs ' || m.opponent, '')
                      || '. Decide antes del ' || to_char(
                           public.availability_maybe_deadline(m.id) at time zone 'Europe/Madrid',
                           'DD/MM "a las" HH24:MI') || '.'
                 else coalesce('vs ' || m.opponent || ' · ', '')
                      || to_char(m.match_date, 'DD/MM')
                      || coalesce(' · ' || to_char(m.match_time, 'HH24:MI'), '')
                      || '. Contesta con un toque.' end,
    'data', jsonb_build_object('type', 'availability_reminder', 'matchdayId', m.id,
                               'status', coalesce(p_status, 'pending')));
end $$;

-- ── 6. Recordar ahora (capitán, premium, 1 vez / 12 h) ─────────────────────
create or replace function public.remind_pending_availability(p_matchday_id uuid)
returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_team uuid := private.team_for_matchday(p_matchday_id);
  v_md   public.matchdays;
  v_last timestamptz;
  v_msgs jsonb;
  v_with_app int;
  v_without_app jsonb;
begin
  if v_uid is null or not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede recordar' using errcode = '42501';
  end if;
  if not public.fn_has_premium_access(v_uid, v_team) then
    raise exception 'Recordar ahora es una función del plan' using errcode = 'P0001',
      hint = 'premium_required';
  end if;

  select * into v_md from public.matchdays where id = p_matchday_id;
  if v_md.status <> 'upcoming' or private.matchday_starts_at(p_matchday_id) <= now() then
    raise exception 'La jornada ya no admite recordatorios' using errcode = '22023';
  end if;

  select max(created_at) into v_last
    from public.availability_reminders where matchday_id = p_matchday_id;
  if v_last is not null and v_last > now() - interval '12 hours' then
    raise exception 'Ya recordaste hace menos de 12 horas' using errcode = 'P0001',
      hint = 'cooldown:' || to_char(v_last + interval '12 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;

  -- Pendientes = sin fila o en duda; con cuenta enlazada.
  select coalesce(jsonb_agg(private.availability_message(p.user_id, p_matchday_id, a.status)), '[]'::jsonb),
         count(*)
    into v_msgs, v_with_app
    from public.players p
    left join public.availability a on a.matchday_id = p_matchday_id and a.player_id = p.id
   where p.team_id = v_team and p.active = true and p.user_id is not null
     and (a.id is null or a.status = 'maybe');

  -- Pendientes SIN cuenta: el capitán les escribe por WhatsApp.
  select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.name)), '[]'::jsonb)
    into v_without_app
    from public.players p
    left join public.availability a on a.matchday_id = p_matchday_id and a.player_id = p.id
   where p.team_id = v_team and p.active = true and p.user_id is null
     and (a.id is null or a.status = 'maybe');

  perform private.send_availability_messages(v_msgs);

  insert into public.availability_reminders (matchday_id, sent_by, recipients)
  values (p_matchday_id, v_uid, v_with_app);

  return jsonb_build_object('reminded', v_with_app, 'without_app', v_without_app,
                            'next_allowed_at', now() + interval '12 hours');
end $$;
grant execute on function public.remind_pending_availability(uuid) to authenticated;

-- ── 7. Automático: cada 12 h + cierre de dudas ─────────────────────────────
create or replace function public.run_availability_cycle(p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_hour int := extract(hour from now() at time zone 'Europe/Madrid');
  v_resolved int := 0;
  v_sent int := 0;
  v_msgs jsonb;
begin
  -- a) Cierre: dudas cuyo plazo ya pasó → «no» (+ aviso a jugador y capitán).
  with closed as (
    update public.availability a
       set status = 'no', auto_resolved = true, updated_at = now(), updated_by = null
     where a.status = 'maybe'
       and now() >= public.availability_maybe_deadline(a.matchday_id)
    returning a.matchday_id, a.player_id
  ), info as (
    select c.matchday_id, p.user_id as player_user, p.name, m.jornada_number, m.opponent, t.owner_id
      from closed c
      join public.players p on p.id = c.player_id
      join public.matchdays m on m.id = c.matchday_id
      join public.seasons s on s.id = m.season_id
      join public.teams t on t.id = s.team_id
  )
  select (select count(*) from closed),
         coalesce(jsonb_agg(x.msg), '[]'::jsonb)
    into v_resolved, v_msgs
    from (
      select jsonb_build_object('user_id', player_user, 'type', 'availability_reminder',
               'title', 'Cuentas como «No puedo»',
               'body', 'Tu duda para la J' || coalesce(jornada_number::text, '')
                       || coalesce(' vs ' || opponent, '') || ' no se resolvió a tiempo.',
               'data', jsonb_build_object('type', 'availability_reminder', 'matchdayId', matchday_id)) as msg
        from info where player_user is not null
      union all
      select jsonb_build_object('user_id', owner_id, 'type', 'availability_reminder',
               'title', name || ' no resolvió su duda',
               'body', 'Pasa a «No puedo» para la J' || coalesce(jornada_number::text, '')
                       || coalesce(' vs ' || opponent, '') || '.',
               'data', jsonb_build_object('type', 'availability_reminder', 'matchdayId', matchday_id))
        from info where owner_id is not null
    ) x;
  perform private.send_availability_messages(v_msgs);

  -- b) Recordatorio a las 9:00 y 21:00 (Madrid).
  if p_force or v_hour in (9, 21) then
    with pend as (
      select distinct on (p.user_id) p.user_id, m.id as matchday_id, a.status as a_status
        from public.matchdays m
        join public.seasons s on s.id = m.season_id
        join public.players p on p.team_id = s.team_id and p.active = true and p.user_id is not null
        left join public.availability a on a.matchday_id = m.id and a.player_id = p.id
       where m.status = 'upcoming' and m.match_date is not null
         and m.match_date between current_date and current_date + 7
         and private.matchday_starts_at(m.id) > now()
         and (a.id is null or a.status = 'maybe')
       order by p.user_id, m.match_date, m.match_time nulls last
    )
    select coalesce(jsonb_agg(private.availability_message(user_id, matchday_id, a_status)), '[]'::jsonb)
      into v_msgs
      from pend;
    v_sent := private.send_availability_messages(v_msgs);
  end if;

  return jsonb_build_object('resolved', v_resolved, 'pushes', v_sent);
end $$;
revoke execute on function public.run_availability_cycle(boolean) from public, anon, authenticated;

-- ── 8. El recordatorio de las 17:00 deja de avisar de disponibilidad ───────
--   send_daily_reminders(avail_days, lineup_days): con avail_days = -1 la
--   ventana de disponibilidad queda vacía y solo manda el de alineación.
--   Se activa al cambiar el cron (ver bloque 9).

-- ── 9. Cron ────────────────────────────────────────────────────────────────
--   NO se programa en esta migración: activar a mano tras publicar la OTA,
--   para no mandar push con botones a apps que aún no los entienden.
--
--   select cron.schedule('availability-cycle', '0 * * * *',
--     $c$ select public.run_availability_cycle(); $c$);
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'daily-reminders'),
--     command := 'select public.send_daily_reminders(-1, 3);');
