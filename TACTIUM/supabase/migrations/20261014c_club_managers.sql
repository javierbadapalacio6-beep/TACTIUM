-- Gestores adicionales del club, por invitación (14-10-2026, petición de Smash).
-- Un gestor puede hacer lo mismo que el dueño, salvo borrar el club y quitar al dueño.
--
-- 1) CIERRE DE UN AGUJERO: `club_members_admin_insert` dejaba a CUALQUIER usuario con sesión insertarse como
--    administrador de CUALQUIER club (`... OR user_id = auth.uid()`; verificado en una transacción deshecha).
--    La tabla pasa a ser de solo lectura para los clientes: todo cambio va por las RPC de abajo (SECURITY DEFINER).
-- 2) Invitaciones de gestor: un código por persona, de un solo uso, 7 días.
-- 3) Al entrar, el gestor pasa a ser capitán de los equipos del club (como el dueño, que lo es de los que crea), y
--    de los equipos nuevos que se creen después.
-- 4) Las RPC de importar la Federación que miraban solo `clubs.owner_id` aceptan a cualquier gestor, y un gestor puede
--    borrar equipos del club.

-- ── 1) Tabla de miembros: solo lectura desde los clientes ─────────────────
drop policy if exists club_members_admin_insert on public.club_members;
drop policy if exists club_members_admin_update on public.club_members;
drop policy if exists club_members_admin_delete on public.club_members;
revoke insert, update, delete, truncate on public.club_members from anon, authenticated;

-- Añadir a un gestor como capitán de todos los equipos del club no debe disparar un «X se ha unido» por equipo
-- (ni al dueño ni al propio gestor). Se salta con una marca de transacción que ponen las RPC de abajo.
create or replace function private.tg_notify_member_joined()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_team_name  text;
  v_actor      text;
  v_role_label text;
begin
  if coalesce(current_setting('tactium.skip_member_joined', true), '') = '1' then
    return new;
  end if;
  select name into v_team_name from public.teams where id = new.team_id;
  v_actor := private.display_name(new.user_id);
  v_role_label := case new.role
                    when 'player'  then 'jugador'
                    when 'captain' then 'capitán'
                    else 'admin' end;

  perform private.notify_team_admins(
    new.team_id, 'member_joined',
    v_actor || ' se ha unido a tu equipo',
    v_actor || ' se ha unido a ' || coalesce(v_team_name, 'tu equipo')
      || ' como ' || v_role_label || '.',
    jsonb_build_object('team_id', new.team_id, 'actor_id', new.user_id, 'role', new.role),
    new.user_id
  );

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
$function$;

-- ── 2) Invitaciones de gestor ─────────────────────────────────────────────
create table if not exists public.club_invitations (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  code       text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  used_by    uuid references auth.users(id) on delete set null
);
alter table public.club_invitations enable row level security;
drop policy if exists club_invitations_admin_select on public.club_invitations;
create policy club_invitations_admin_select on public.club_invitations
  for select using (private.is_club_admin(club_id));
drop policy if exists club_invitations_admin_delete on public.club_invitations;
create policy club_invitations_admin_delete on public.club_invitations
  for delete using (private.is_club_admin(club_id));
revoke all on public.club_invitations from anon;
revoke insert, update, truncate on public.club_invitations from authenticated;

create or replace function public.create_club_invitation(p_club_id uuid)
returns public.club_invitations
language plpgsql security definer set search_path = ''
as $$
declare
  attempt  int := 0;
  new_code text;
  inv      public.club_invitations;
begin
  if auth.uid() is null or not private.is_club_admin(p_club_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  -- Freno: no más de 20 invitaciones abiertas a la vez.
  if (select count(*) from public.club_invitations
       where club_id = p_club_id and used_at is null and expires_at > now()) >= 20 then
    raise exception 'Hay demasiadas invitaciones abiertas. Revoca alguna.' using errcode = '22023';
  end if;
  loop
    attempt := attempt + 1;
    new_code := private.gen_invitation_code();
    -- Que no choque con un código de equipo (los dos se canjean desde el mismo sitio).
    continue when exists (select 1 from public.team_invitations where code = new_code);
    begin
      insert into public.club_invitations (club_id, code, created_by)
      values (p_club_id, new_code, auth.uid())
      returning * into inv;
      return inv;
    exception when unique_violation then
      if attempt > 8 then raise; end if;
    end;
  end loop;
end $$;

create or replace function public.preview_club_invitation(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  i public.club_invitations;
  c public.clubs;
begin
  select * into i from public.club_invitations where code = upper(btrim(coalesce(p_code, ''))) limit 1;
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  if i.used_at is not null then return jsonb_build_object('valid', false, 'reason', 'used'); end if;
  if i.expires_at <= now() then return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
  select * into c from public.clubs where id = i.club_id;
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  return jsonb_build_object(
    'valid', true,
    'club', jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url),
    'invited_by', (select pr.full_name from public.profiles pr where pr.id = i.created_by),
    'teams_count', (select count(*) from public.teams t where t.club_id = c.id));
end $$;

create or replace function public.redeem_club_invitation(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.club_invitations;
  c   public.clubs;
  v_already boolean;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion'; end if;
  select * into inv from public.club_invitations
   where code = upper(btrim(coalesce(p_code, ''))) for update;
  if inv.id is null then raise exception 'Codigo no valido'; end if;
  if inv.used_at is not null then raise exception 'Codigo ya usado'; end if;
  if inv.expires_at < now() then raise exception 'Codigo caducado'; end if;
  select * into c from public.clubs where id = inv.club_id;
  if c.id is null then raise exception 'Codigo no valido'; end if;

  select exists (select 1 from public.club_members where club_id = inv.club_id and user_id = auth.uid()) into v_already;
  insert into public.club_members (club_id, user_id, role)
  values (inv.club_id, auth.uid(), 'admin')
  on conflict (club_id, user_id) do update set role = 'admin';

  -- Capitán de los equipos del club (no de los invitados, que son de otros). Conserva un rol superior.
  perform set_config('tactium.skip_member_joined', '1', true);
  insert into public.team_members (team_id, user_id, role)
  select t.id, auth.uid(), 'captain' from public.teams t where t.club_id = inv.club_id
  on conflict (team_id, user_id) do update
    set role = case when public.team_members.role in ('captain', 'admin') then public.team_members.role else 'captain' end;

  perform set_config('tactium.skip_member_joined', '', true);
  update public.club_invitations set used_at = now(), used_by = auth.uid() where id = inv.id;
  return jsonb_build_object('club_id', c.id, 'club_name', c.name, 'already_manager', v_already);
end $$;

-- ── Gestores del club: ver y quitar ───────────────────────────────────────
create or replace function public.list_club_managers(p_club_id uuid)
returns table (user_id uuid, full_name text, email text, is_owner boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_club_admin(p_club_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select cm.user_id, pr.full_name, pr.email, (cm.user_id = c.owner_id), cm.created_at
      from public.club_members cm
      join public.clubs c on c.id = cm.club_id
      left join public.profiles pr on pr.id = cm.user_id
     where cm.club_id = p_club_id and cm.role = 'admin'
     order by (cm.user_id = c.owner_id) desc, cm.created_at;
end $$;

create or replace function public.remove_club_manager(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null or not private.is_club_admin(p_club_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select owner_id into v_owner from public.clubs where id = p_club_id;
  if p_user_id = v_owner then
    raise exception 'El dueño del club no se puede quitar' using errcode = '22023';
  end if;
  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
  -- Y la capitanía que tenía por ser gestor, salvo en los equipos que son suyos.
  delete from public.team_members tm
   using public.teams t
   where tm.team_id = t.id and t.club_id = p_club_id
     and tm.user_id = p_user_id and tm.role = 'captain' and t.owner_id <> p_user_id;
end $$;

revoke all on function public.create_club_invitation(uuid) from public, anon;
revoke all on function public.redeem_club_invitation(text) from public, anon;
revoke all on function public.list_club_managers(uuid) from public, anon;
revoke all on function public.remove_club_manager(uuid, uuid) from public, anon;
revoke all on function public.preview_club_invitation(text) from public;
grant execute on function public.create_club_invitation(uuid) to authenticated;
grant execute on function public.redeem_club_invitation(text) to authenticated;
grant execute on function public.list_club_managers(uuid) to authenticated;
grant execute on function public.remove_club_manager(uuid, uuid) to authenticated;
grant execute on function public.preview_club_invitation(text) to anon, authenticated;

-- ── 3) Los gestores son capitanes de los equipos NUEVOS del club ──────────
create or replace function private.club_managers_captain_on_new_team()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.club_id is not null then
    perform set_config('tactium.skip_member_joined', '1', true);
    insert into public.team_members (team_id, user_id, role)
    select new.id, cm.user_id, 'captain'
      from public.club_members cm
     where cm.club_id = new.club_id and cm.role = 'admin'
    on conflict (team_id, user_id) do nothing;
    perform set_config('tactium.skip_member_joined', '', true);
  end if;
  return new;
end $$;

drop trigger if exists club_managers_captain_on_new_team on public.teams;
create trigger club_managers_captain_on_new_team
  after insert on public.teams
  for each row execute function private.club_managers_captain_on_new_team();

-- ── 4) Lo que antes miraba solo al dueño ──────────────────────────────────
-- Importar equipos/plantillas de la Federación: el equipo es de «un dueño de club» → cualquier gestor del club.
do $$
declare
  fn  text;
  def text;
  nw  text;
begin
  foreach fn in array array['import_fcp_roster', 'import_fcp_season', 'apply_fcp_season_update'] loop
    select pg_get_functiondef(p.oid) into def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = fn limit 1;
    if def is null then continue; end if;
    nw := replace(def, 'c.owner_id = auth.uid()', 'private.is_club_admin(c.id)');
    if nw <> def then execute nw; end if;
  end loop;
end $$;

-- Un gestor puede borrar equipos del club (antes solo el dueño del equipo).
drop policy if exists teams_owner_delete on public.teams;
create policy teams_owner_delete on public.teams
  for delete using (auth.uid() = owner_id or (club_id is not null and private.is_club_admin(club_id)));
