-- ─────────────────────────────────────────────────────────────────────────
-- FIX: canjear un código de invitación NO debe DEGRADAR a un miembro que ya
-- tiene un rol superior (captain/admin) — típicamente el DUEÑO del equipo que
-- canjea un código de jugador de su propio equipo. Antes:
--   on conflict (team_id,user_id) do update set role = excluded.role
-- pisaba captain → player y dejaba al dueño sin poder gestionar su equipo.
-- Ahora: conserva el rol superior existente; solo sube de player a captain.
--
-- CÓMO APLICAR: Supabase Dashboard → SQL Editor → pegar → Run.
-- (Aplicada en prod vía MCP el 2026-07-17.)
-- ─────────────────────────────────────────────────────────────────────────

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
  if inv.used_at is not null then raise exception 'Código ya usado'; end if;
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

  update public.team_invitations
     set used_at = now(), used_by = auth.uid()
   where id = inv.id
   returning * into inv;

  return inv;
end;
$function$;

-- Restaurar a CAPITÁN a los dueños de equipo que quedaron degradados a
-- 'player' por el bug anterior.
update public.team_members tm
set role = 'captain'
from public.teams t
where t.id = tm.team_id
  and t.owner_id = tm.user_id
  and tm.role = 'player';
