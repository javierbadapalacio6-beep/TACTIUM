-- ─────────────────────────────────────────────────────────────────────────
-- Notificaciones IN-APP (campanita). Aditivo y compatible: nada de lo actual
-- lo usa hasta que la app (por OTA) lo consuma. RLS: cada uno ve SOLO las
-- suyas. Inserta SOLO server-side (triggers/edge, SECURITY DEFINER).
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- (Aplicada en prod vía MCP el 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- El cliente solo puede tocar sus filas (marcar leído). No puede insertar.
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on public.notifications to authenticated;

-- ── Helpers (SECURITY DEFINER) ─────────────────────────────────────────────

-- Inserta una notificación para un usuario.
create or replace function private.notify(
  p_user uuid, p_type text, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
$$;

-- Notifica a los admins de un equipo (capitán/admin del equipo + club_admin
-- del club dueño), EXCLUYENDO al actor. Misma lógica que private.is_team_admin.
create or replace function private.notify_team_admins(
  p_team uuid, p_type text, p_title text, p_body text,
  p_data jsonb, p_exclude uuid
) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, type, title, body, data)
  select distinct r.u, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from (
    select tm.user_id as u
    from public.team_members tm
    where tm.team_id = p_team and tm.role in ('captain','admin')
    union
    select cm.user_id
    from public.teams t
    join public.club_members cm on cm.club_id = t.club_id
    where t.id = p_team and t.club_id is not null and cm.role = 'admin'
  ) r
  where r.u is distinct from p_exclude;
$$;

-- Nombre a mostrar de un usuario (username → full_name → 'Alguien').
create or replace function private.display_name(p_user uuid)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.full_name), ''), 'Alguien')
  from public.profiles p where p.id = p_user;
$$;

-- ── Triggers de "unirse / vincularse" ──────────────────────────────────────

-- Alguien se une a un equipo (INSERT en team_members vía redeem del código).
create or replace function private.tg_notify_member_joined()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_team_name  text;
  v_actor      text;
  v_role_label text;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  v_actor := private.display_name(new.user_id);
  v_role_label := case new.role
                    when 'player'  then 'jugador'
                    when 'captain' then 'capitán'
                    else 'admin' end;

  -- A los admins del equipo (excl. el que entra). En la creación del equipo el
  -- único admin es el propio owner → excluido → no se genera nada.
  perform private.notify_team_admins(
    new.team_id, 'member_joined',
    v_actor || ' se ha unido a tu equipo',
    v_actor || ' se ha unido a ' || coalesce(v_team_name, 'tu equipo')
      || ' como ' || v_role_label || '.',
    jsonb_build_object('team_id', new.team_id, 'actor_id', new.user_id, 'role', new.role),
    new.user_id
  );

  -- Bienvenida al que entra (solo si NO es la creación de su propio equipo:
  -- ya había otros miembros antes que él).
  if exists (
    select 1 from public.team_members tm
    where tm.team_id = new.team_id and tm.user_id <> new.user_id
  ) then
    perform private.notify(
      new.user_id, 'joined_team',
      'Te has unido a ' || coalesce(v_team_name, 'un equipo'),
      'Ya formas parte de ' || coalesce(v_team_name, 'el equipo') || '. ¡A jugar!',
      jsonb_build_object('team_id', new.team_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_member_joined on public.team_members;
create trigger notify_member_joined
  after insert on public.team_members
  for each row execute function private.tg_notify_member_joined();

-- Alguien se vincula a una ficha de la plantilla (players.user_id NULL → valor,
-- vía claim_player). Aporta "con quién se ha vinculado (Y)".
create or replace function private.tg_notify_player_claimed()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_team_name text;
  v_actor     text;
begin
  select name into v_team_name from public.teams where id = new.team_id;
  v_actor := private.display_name(new.user_id);
  perform private.notify_team_admins(
    new.team_id, 'player_claimed',
    v_actor || ' se ha vinculado a tu equipo',
    v_actor || ' se ha vinculado a la ficha de ' || new.name
      || ' en ' || coalesce(v_team_name, 'tu equipo') || '.',
    jsonb_build_object(
      'team_id', new.team_id, 'actor_id', new.user_id,
      'player_id', new.id, 'player_name', new.name
    ),
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists notify_player_claimed on public.players;
create trigger notify_player_claimed
  after update of user_id on public.players
  for each row when (old.user_id is null and new.user_id is not null)
  execute function private.tg_notify_player_claimed();
