-- ════════════════════════════════════════════════════════════════════════════
-- Encuesta de hora de la jornada (2026-10-06)
--
-- El calendario lo pone la Federación, pero la HORA (y a veces el día dentro
-- del finde) la pone cada equipo. El capitán propone de 2 a 4 opciones de día
-- y hora, los jugadores marcan en cuáles PUEDEN (multiselección) y el capitán
-- fija la ganadora: se escribe en `matchdays.match_date / match_time`, así que
-- el club la ve en Horarios sin hacer nada más.
--
--   · Crear: capitán o admin del club del equipo (private.is_team_admin). Pro.
--   · Votar: el jugador con ficha vinculada (players.user_id). Gratis.
--   · Recordar a los que faltan: capitán, Pro, 1 vez / 12 h (como la
--     disponibilidad).
--   · Fijar: capitán. Cierra la encuesta y avisa a todo el equipo.
--
-- No se mezcla con `availability` (Voy/Duda/No): son preguntas distintas. La
-- interfaz las cruza al enseñar resultados.
--
-- `home_unconfirmed` NO se toca: marca que la SEDE (de quién es el partido en
-- casa) es una propuesta de playoff, no la hora.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tablas ───────────────────────────────────────────────────────────────
create table if not exists public.matchday_time_polls (
  id               uuid primary key default gen_random_uuid(),
  matchday_id      uuid not null references public.matchdays(id) on delete cascade,
  team_id          uuid not null references public.teams(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  message          text check (message is null or char_length(message) <= 280),
  deadline         timestamptz,
  status           text not null default 'open' check (status in ('open','fixed','cancelled')),
  fixed_option_id  uuid,
  last_reminded_at timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now()
);
-- Una sola encuesta abierta por jornada.
create unique index if not exists matchday_time_polls_one_open
  on public.matchday_time_polls (matchday_id) where status = 'open';
create index if not exists matchday_time_polls_team_idx
  on public.matchday_time_polls (team_id, created_at desc);

create table if not exists public.matchday_time_poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.matchday_time_polls(id) on delete cascade,
  match_date date not null,
  match_time time not null,
  position   smallint not null default 0,
  unique (poll_id, match_date, match_time)
);
create index if not exists matchday_time_poll_options_poll_idx
  on public.matchday_time_poll_options (poll_id, position);

do $$ begin
  alter table public.matchday_time_polls
    add constraint matchday_time_polls_fixed_fk
    foreign key (fixed_option_id) references public.matchday_time_poll_options(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Un voto por jugador y encuesta. `option_ids` vacío = «ninguna me va»
-- (distinto de no haber votado: sin fila).
create table if not exists public.matchday_time_poll_votes (
  poll_id    uuid not null references public.matchday_time_polls(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  option_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (poll_id, player_id)
);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
alter table public.matchday_time_polls enable row level security;
alter table public.matchday_time_poll_options enable row level security;
alter table public.matchday_time_poll_votes enable row level security;

drop policy if exists time_polls_member_select on public.matchday_time_polls;
create policy time_polls_member_select on public.matchday_time_polls
  for select to authenticated using (private.is_team_member(team_id));

drop policy if exists time_poll_options_member_select on public.matchday_time_poll_options;
create policy time_poll_options_member_select on public.matchday_time_poll_options
  for select to authenticated using (
    exists (select 1 from public.matchday_time_polls p
             where p.id = poll_id and private.is_team_member(p.team_id)));

drop policy if exists time_poll_votes_member_select on public.matchday_time_poll_votes;
create policy time_poll_votes_member_select on public.matchday_time_poll_votes
  for select to authenticated using (
    exists (select 1 from public.matchday_time_polls p
             where p.id = poll_id and private.is_team_member(p.team_id)));

-- Votos: solo el propio jugador vinculado y con la encuesta abierta. El cliente
-- usa la RPC `vote_time_poll`, pero la política deja la regla escrita también
-- en la tabla.
create or replace function private.can_vote_time_poll(p_poll_id uuid, p_player_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.matchday_time_polls p
      join public.players pl on pl.id = p_player_id and pl.team_id = p.team_id
     where p.id = p_poll_id
       and p.status = 'open'
       and (p.deadline is null or p.deadline > now())
       and pl.user_id = auth.uid()
       and pl.active = true);
$$;

drop policy if exists time_poll_votes_self_insert on public.matchday_time_poll_votes;
create policy time_poll_votes_self_insert on public.matchday_time_poll_votes
  for insert to authenticated
  with check (private.can_vote_time_poll(poll_id, player_id));
drop policy if exists time_poll_votes_self_update on public.matchday_time_poll_votes;
create policy time_poll_votes_self_update on public.matchday_time_poll_votes
  for update to authenticated
  using (private.can_vote_time_poll(poll_id, player_id))
  with check (private.can_vote_time_poll(poll_id, player_id));
drop policy if exists time_poll_votes_self_delete on public.matchday_time_poll_votes;
create policy time_poll_votes_self_delete on public.matchday_time_poll_votes
  for delete to authenticated
  using (private.can_vote_time_poll(poll_id, player_id));
-- Encuestas y opciones: sin políticas de escritura. Solo las RPC (SECURITY
-- DEFINER), que comprueban capitán/admin.

-- ── 3. Texto de una opción: «sáb 18/10 · 10:30» ─────────────────────────────
create or replace function private.time_poll_option_label(p_date date, p_time time)
returns text
language sql immutable set search_path = ''
as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from p_date)::int + 1]
         || ' ' || to_char(p_date, 'DD/MM') || ' · ' || to_char(p_time, 'HH24:MI');
$$;

-- Destinatarios: jugadores activos con cuenta + capitanes/admins del equipo.
create or replace function private.time_poll_team_users(p_team_id uuid)
returns table (user_id uuid)
language sql stable security definer set search_path = ''
as $$
  select p.user_id from public.players p
   where p.team_id = p_team_id and p.active = true and p.user_id is not null
  union
  select tm.user_id from public.team_members tm
   where tm.team_id = p_team_id and tm.user_id is not null;
$$;

-- ── 4. Crear ────────────────────────────────────────────────────────────────
-- p_options: [{"date":"2026-10-18","time":"10:30"}, …] (2 a 4).
create or replace function public.create_time_poll(
  p_matchday_id uuid,
  p_options     jsonb,
  p_message     text default null,
  p_deadline    timestamptz default null
) returns uuid
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_team uuid := private.team_for_matchday(p_matchday_id);
  v_md   public.matchdays;
  v_poll uuid;
  v_n    int;
  v_opt  jsonb;
  v_i    int := 0;
  v_j    text;
  v_msgs jsonb;
begin
  if v_uid is null or v_team is null or not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede proponer horas' using errcode = '42501';
  end if;
  if not public.fn_has_premium_access(v_uid, v_team) then
    raise exception 'La encuesta de hora es una función del plan' using errcode = 'P0001',
      hint = 'premium_required';
  end if;

  select * into v_md from public.matchdays where id = p_matchday_id;
  if v_md.status = 'finished' then
    raise exception 'Esa jornada ya se jugó' using errcode = '22023';
  end if;

  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'Faltan las opciones' using errcode = '22023';
  end if;
  select count(distinct ((o->>'date') || ' ' || (o->>'time')))
    into v_n from jsonb_array_elements(p_options) o;
  if v_n < 2 or v_n > 4 or jsonb_array_length(p_options) <> v_n then
    raise exception 'Propón entre 2 y 4 opciones distintas' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_options) o
              where (o->>'date') is null or (o->>'time') is null
                 or (o->>'date')::date < current_date) then
    raise exception 'Cada opción necesita día y hora, y no puede ser un día pasado' using errcode = '22023';
  end if;
  if p_deadline is not null and p_deadline <= now() then
    raise exception 'La fecha límite tiene que ser futura' using errcode = '22023';
  end if;

  if exists (select 1 from public.matchday_time_polls
              where matchday_id = p_matchday_id and status = 'open') then
    raise exception 'Ya hay una encuesta abierta para esta jornada' using errcode = '23505';
  end if;

  insert into public.matchday_time_polls (matchday_id, team_id, created_by, message, deadline)
  values (p_matchday_id, v_team, v_uid, nullif(left(trim(coalesce(p_message, '')), 280), ''), p_deadline)
  returning id into v_poll;

  for v_opt in select * from jsonb_array_elements(p_options) loop
    insert into public.matchday_time_poll_options (poll_id, match_date, match_time, position)
    values (v_poll, (v_opt->>'date')::date, (v_opt->>'time')::time, v_i);
    v_i := v_i + 1;
  end loop;

  -- Aviso a todo el equipo menos a quien la crea.
  v_j := 'J' || v_md.jornada_number::text;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.user_id,
           'type', 'time_poll_open',
           'category', 'time_poll',
           'title', v_j || ' · ¿A qué hora jugamos?',
           'body', 'Vs ' || v_md.opponent || '. Marca las horas que te van'
                   || coalesce(' antes del ' || to_char(p_deadline at time zone 'Europe/Madrid', 'DD/MM "a las" HH24:MI'), '')
                   || '.',
           'data', jsonb_build_object('type', 'time_poll_open', 'matchdayId', p_matchday_id,
                                      'pollId', v_poll))), '[]'::jsonb)
    into v_msgs
    from private.time_poll_team_users(v_team) u
   where u.user_id <> v_uid;
  perform private.send_availability_messages(v_msgs);

  return v_poll;
end $$;

-- ── 5. Votar (el propio jugador) ────────────────────────────────────────────
create or replace function public.vote_time_poll(p_poll_id uuid, p_option_ids uuid[])
returns public.matchday_time_poll_votes
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := auth.uid();
  v_poll   public.matchday_time_polls;
  v_player uuid;
  v_ids    uuid[];
  v_row    public.matchday_time_poll_votes;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  select * into v_poll from public.matchday_time_polls where id = p_poll_id;
  if not found then
    raise exception 'Encuesta no encontrada' using errcode = 'P0002';
  end if;
  if v_poll.status <> 'open' then
    raise exception 'La encuesta ya está cerrada' using errcode = '22023';
  end if;
  if v_poll.deadline is not null and v_poll.deadline <= now() then
    raise exception 'Se pasó la fecha límite para votar' using errcode = '22023';
  end if;

  select p.id into v_player from public.players p
   where p.team_id = v_poll.team_id and p.user_id = v_uid and p.active = true
   limit 1;
  if v_player is null then
    raise exception 'Solo votan los jugadores del equipo' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct o.id), '{}') into v_ids
    from public.matchday_time_poll_options o
   where o.poll_id = p_poll_id and o.id = any(coalesce(p_option_ids, '{}'));
  if cardinality(v_ids) <> cardinality(array(select distinct unnest(coalesce(p_option_ids, '{}'::uuid[])))) then
    raise exception 'Alguna opción no es de esta encuesta' using errcode = '22023';
  end if;

  insert into public.matchday_time_poll_votes (poll_id, player_id, user_id, option_ids, updated_at)
  values (p_poll_id, v_player, v_uid, v_ids, now())
  on conflict (poll_id, player_id) do update
    set option_ids = excluded.option_ids, user_id = excluded.user_id, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- ── 6. Fijar la ganadora (capitán) ─────────────────────────────────────────
create or replace function public.fix_time_poll(p_poll_id uuid, p_option_id uuid)
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

  update public.matchdays
     set match_date = v_opt.match_date, match_time = v_opt.match_time
   where id = v_poll.matchday_id
  returning * into v_md;

  update public.matchday_time_polls
     set status = 'fixed', fixed_option_id = v_opt.id, closed_at = now()
   where id = p_poll_id;

  v_when := private.time_poll_option_label(v_opt.match_date, v_opt.match_time);

  -- Equipo (menos quien fija).
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
  -- la campana a sus gestores. Lo ven además en Horarios porque se ha escrito
  -- en la jornada.
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

-- ── 7. Cancelar sin fijar (capitán) ────────────────────────────────────────
create or replace function public.cancel_time_poll(p_poll_id uuid)
returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare v_team uuid;
begin
  select team_id into v_team from public.matchday_time_polls where id = p_poll_id and status = 'open';
  if v_team is null then
    raise exception 'No hay encuesta abierta' using errcode = 'P0002';
  end if;
  if not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede cerrar la encuesta' using errcode = '42501';
  end if;
  update public.matchday_time_polls
     set status = 'cancelled', closed_at = now()
   where id = p_poll_id;
end $$;

-- ── 8. Recordar a los que faltan (capitán, Pro, 1 vez / 12 h) ──────────────
create or replace function public.remind_time_poll(p_poll_id uuid)
returns jsonb
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := auth.uid();
  v_poll public.matchday_time_polls;
  v_md   public.matchdays;
  v_msgs jsonb;
  v_with_app int;
  v_without_app jsonb;
begin
  select * into v_poll from public.matchday_time_polls where id = p_poll_id;
  if not found then
    raise exception 'Encuesta no encontrada' using errcode = 'P0002';
  end if;
  if v_uid is null or not private.is_team_admin(v_poll.team_id) then
    raise exception 'Solo el capitán puede recordar' using errcode = '42501';
  end if;
  if not public.fn_has_premium_access(v_uid, v_poll.team_id) then
    raise exception 'Recordar es una función del plan' using errcode = 'P0001',
      hint = 'premium_required';
  end if;
  if v_poll.status <> 'open' or (v_poll.deadline is not null and v_poll.deadline <= now()) then
    raise exception 'La encuesta ya no admite votos' using errcode = '22023';
  end if;
  if v_poll.last_reminded_at is not null and v_poll.last_reminded_at > now() - interval '12 hours' then
    raise exception 'Ya recordaste hace menos de 12 horas' using errcode = 'P0001',
      hint = 'cooldown:' || to_char(v_poll.last_reminded_at + interval '12 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;

  select * into v_md from public.matchdays where id = v_poll.matchday_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', p.user_id,
           'type', 'time_poll_reminder',
           'category', 'time_poll',
           'title', 'J' || v_md.jornada_number::text || ' · Falta tu voto',
           'body', 'Tu capitán está cuadrando la hora contra ' || v_md.opponent
                   || '. Marca las que te van con un toque.',
           'data', jsonb_build_object('type', 'time_poll_reminder', 'matchdayId', v_md.id,
                                      'pollId', p_poll_id))), '[]'::jsonb),
         count(*)
    into v_msgs, v_with_app
    from public.players p
    left join public.matchday_time_poll_votes v on v.poll_id = p_poll_id and v.player_id = p.id
   where p.team_id = v_poll.team_id and p.active = true and p.user_id is not null
     and p.user_id <> v_uid and v.player_id is null;

  select coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'name', p.name)), '[]'::jsonb)
    into v_without_app
    from public.players p
   where p.team_id = v_poll.team_id and p.active = true and p.user_id is null;

  perform private.send_availability_messages(v_msgs);

  update public.matchday_time_polls set last_reminded_at = now() where id = p_poll_id;

  return jsonb_build_object('reminded', v_with_app, 'without_app', v_without_app,
                            'next_allowed_at', now() + interval '12 hours');
end $$;

-- ── 9. Permisos ─────────────────────────────────────────────────────────────
revoke execute on function public.create_time_poll(uuid, jsonb, text, timestamptz) from public, anon;
revoke execute on function public.vote_time_poll(uuid, uuid[]) from public, anon;
revoke execute on function public.fix_time_poll(uuid, uuid) from public, anon;
revoke execute on function public.cancel_time_poll(uuid) from public, anon;
revoke execute on function public.remind_time_poll(uuid) from public, anon;
grant execute on function public.create_time_poll(uuid, jsonb, text, timestamptz) to authenticated;
grant execute on function public.vote_time_poll(uuid, uuid[]) to authenticated;
grant execute on function public.fix_time_poll(uuid, uuid) to authenticated;
grant execute on function public.cancel_time_poll(uuid) to authenticated;
grant execute on function public.remind_time_poll(uuid) to authenticated;

grant select on public.matchday_time_polls, public.matchday_time_poll_options to authenticated;
grant select, insert, update, delete on public.matchday_time_poll_votes to authenticated;
