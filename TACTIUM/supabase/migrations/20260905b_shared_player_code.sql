-- Código de jugador COMPARTIDO por equipo (uno para toda la plantilla).
--
-- Antes cada invitación era de un solo uso: para meter a 12 jugadores había que
-- generar y repartir 12 códigos. El de CAPITÁN sí tiene sentido que sea de un
-- solo uso (se le da a una persona concreta), pero el de jugador funciona mejor
-- como "código del equipo": uno solo, estable, que el capitán pega en el grupo
-- de WhatsApp y usa toda la plantilla.
--
-- Compatibilidad: los códigos de un solo uso que ya existían siguen valiendo, y
-- el código compartido lleva `expires_at` a 100 años en vez de NULL para que las
-- versiones antiguas de la app (que calculan "activo" con esa fecha) lo sigan
-- viendo válido.

alter table public.team_invitations
  add column if not exists multi_use boolean not null default false;

alter table public.team_invitations
  add column if not exists uses integer not null default 0;

comment on column public.team_invitations.multi_use is
  'Código reutilizable (el de jugador del equipo). Los de un solo uso se marcan con used_at/used_by; estos llevan la cuenta en `uses`.';

-- Como mucho un código compartido por equipo.
create unique index if not exists team_invitations_shared_player_code
  on public.team_invitations (team_id)
  where multi_use and role = 'player';

-- ── Crear invitación ────────────────────────────────────────────────────────
-- Jugador: devuelve SIEMPRE el código compartido del equipo (lo crea la primera
-- vez). Capitán: un código nuevo de un solo uso, como hasta ahora.
create or replace function public.create_team_invitation(
  target_team uuid,
  target_role team_role default 'captain'::team_role)
returns team_invitations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  attempt  int := 0;
  new_code text;
  inv      public.team_invitations;
begin
  if not private.is_team_admin(target_team) then
    raise exception 'No autorizado';
  end if;
  if target_role not in ('captain','player') then
    raise exception 'Rol no permitido';
  end if;

  if target_role = 'player' then
    select * into inv from public.team_invitations
     where team_id = target_team and role = 'player' and multi_use
     limit 1;
    if inv.id is not null then
      return inv;   -- ya existe: el código del equipo no cambia
    end if;
  end if;

  loop
    attempt := attempt + 1;
    new_code := private.gen_invitation_code();
    begin
      insert into public.team_invitations
        (code, team_id, role, created_by, multi_use, expires_at)
      values (
        new_code, target_team, target_role, auth.uid(),
        target_role = 'player',
        case when target_role = 'player'
             then now() + interval '100 years'
             else now() + interval '7 days' end)
      returning * into inv;
      return inv;
    exception
      when unique_violation then
        -- Puede ser choque de código o carrera creando el compartido.
        select * into inv from public.team_invitations
         where team_id = target_team and role = 'player' and multi_use
         limit 1;
        if inv.id is not null then return inv; end if;
        if attempt > 8 then raise; end if;
    end;
  end loop;
end;
$function$;

-- ── Rotar el código compartido ──────────────────────────────────────────────
-- Para cuando se filtra: invalida el actual y devuelve uno nuevo.
create or replace function public.rotate_team_player_code(target_team uuid)
returns team_invitations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inv public.team_invitations;
begin
  if not private.is_team_admin(target_team) then
    raise exception 'No autorizado';
  end if;
  delete from public.team_invitations
   where team_id = target_team and role = 'player' and multi_use;
  select * into inv from public.create_team_invitation(target_team, 'player');
  return inv;
end;
$function$;

revoke execute on function public.rotate_team_player_code(uuid) from public, anon;
grant  execute on function public.rotate_team_player_code(uuid) to authenticated;

-- ── Canjear ─────────────────────────────────────────────────────────────────
-- Igual que antes, salvo que un código compartido no se consume: no se marca
-- used_at y solo suma en `uses`.
create or replace function public.redeem_team_invitation(invitation_code text)
returns team_invitations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  inv             public.team_invitations;
  v_profile_name  text;
  v_match_count   int;
  v_player_id     uuid;
  v_already_bound boolean;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into inv from public.team_invitations
   where code = invitation_code
   for update;

  if inv.id is null then raise exception 'Código no válido'; end if;
  if inv.used_at is not null and not inv.multi_use then
    raise exception 'Código ya usado';
  end if;
  if inv.expires_at < now() then raise exception 'Código caducado'; end if;

  insert into public.team_members (team_id, user_id, role)
  values (inv.team_id, auth.uid(), inv.role)
  on conflict (team_id, user_id) do update
    set role = case
                 when public.team_members.role in ('captain','admin')
                   then public.team_members.role      -- no degradar
                 else excluded.role                    -- player → rol del código
               end;

  -- Auto-claim por nombre cuando entra como player.
  if inv.role = 'player' then
    select exists(
      select 1 from public.players
      where team_id = inv.team_id and user_id = auth.uid()
    ) into v_already_bound;

    if not v_already_bound then
      select trim(coalesce(full_name, '')) into v_profile_name
      from public.profiles
      where id = auth.uid();

      if v_profile_name is not null and length(v_profile_name) > 0 then
        select count(*) into v_match_count
        from public.players
        where team_id = inv.team_id
          and user_id is null
          and active = true
          and lower(trim(name)) = lower(v_profile_name);

        if v_match_count = 1 then
          select id into v_player_id
          from public.players
          where team_id = inv.team_id
            and user_id is null
            and active = true
            and lower(trim(name)) = lower(v_profile_name)
          limit 1;

          update public.players
          set user_id = auth.uid(),
              updated_at = now()
          where id = v_player_id;
        end if;
      end if;
    end if;
  end if;

  if inv.multi_use then
    update public.team_invitations
       set uses = uses + 1
     where id = inv.id
     returning * into inv;
  else
    update public.team_invitations
       set used_at = now(), used_by = auth.uid()
     where id = inv.id
     returning * into inv;
  end if;

  return inv;
end;
$function$;
