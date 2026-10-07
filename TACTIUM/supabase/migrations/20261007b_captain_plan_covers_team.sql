-- «El plan Capitán cubre al equipo» (2026-10-07)
--
-- Reglas:
--   1. Si alguna capitana (o el dueño) de un equipo INDEPENDIENTE (club_id null)
--      tiene un plan Capitán vivo (plan_tier='captain', estado premium y periodo
--      vigente; incluye la prueba de BD `trial_*`), TODAS las capitanas de ESE
--      equipo tienen Pro en ese equipo.
--   2. Máximo 3 capitanas (captain/admin) por equipo independiente. Se exige en
--      un trigger de team_members, así vale para el canje del código de capitán
--      y para el ascenso de jugador a capitán. Los equipos que ya tuvieran más
--      no se tocan: solo no se deja añadir otra.
--   3. Solo vale en ese equipo: en otro equipo hace falta otro plan.
--   4. Equipos de club: sin cambios (cobertura dura del club).
--   5. Jugadores: sin cambios (siempre libres).

-- ── 1. ¿Qué plan Capitán cubre este equipo? ─────────────────────────────────
create or replace function private.team_captain_cover(p_team_id uuid)
returns table (
  sub_id        uuid,
  payer_user_id uuid,
  period_end    timestamptz,
  status        public.subscription_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.subject_id, s.current_period_end, s.status
    from public.teams t
    join public.subscriptions s
      on s.subject_type = 'user'
     and s.plan_tier = 'captain'
     and s.status in ('trialing','active','grace_period')
     and s.current_period_end > now()
   where t.id = p_team_id
     and t.club_id is null
     and (
       s.subject_id = t.owner_id
       or exists (
         select 1 from public.team_members tm
          where tm.team_id = t.id
            and tm.user_id = s.subject_id
            and tm.role in ('captain','admin')
       )
     )
   order by s.current_period_end desc
   limit 1;
$$;

revoke all on function private.team_captain_cover(uuid) from public, anon, authenticated;

-- ── 2. fn_has_premium_access acepta la cobertura por equipo ──────────────────
-- Única función auxiliar de «¿es Pro?» en servidor: la usan create_time_poll,
-- remind_time_poll y remind_pending_availability. Cambiarla aquí vale para
-- todas.
create or replace function public.fn_has_premium_access(p_user_id uuid, p_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_club_id uuid;
  v_role public.team_role;
begin
  if p_user_id is null or p_team_id is null then
    return false;
  end if;

  select club_id into v_club_id
  from public.teams
  where id = p_team_id;

  -- 1) Herencia desde club: cualquier sub activa del club cubre a sus capitanes
  if v_club_id is not null then
    if exists (
      select 1 from public.subscriptions s
      where s.subject_type = 'club'
        and s.subject_id = v_club_id
        and s.status in ('trialing','active','grace_period')
        and s.current_period_end > now()
    ) then
      return true;
    end if;
  end if;

  -- 2) Rol del user en el team
  select role into v_role
  from public.team_members
  where team_id = p_team_id and user_id = p_user_id
  limit 1;

  -- Players son siempre free
  if v_role = 'player' then
    return true;
  end if;

  if v_role in ('captain','admin') then
    -- 3a) Captain/admin con sub propia activa
    if exists (
      select 1 from public.subscriptions s
      where s.subject_type = 'user'
        and s.subject_id = p_user_id
        and s.plan_tier = 'captain'
        and s.status in ('trialing','active','grace_period')
        and s.current_period_end > now()
    ) then
      return true;
    end if;

    -- 3b) Equipo independiente cubierto por el plan de otra capitana (o del
    --     dueño) de ESE equipo.
    if v_club_id is null and exists (select 1 from private.team_captain_cover(p_team_id)) then
      return true;
    end if;
  end if;

  return false;
end;
$function$;

-- ── 3. RPC para la app y la web: cobertura + capitanas del equipo ───────────
-- p_team_id null → todos los equipos independientes en los que estoy.
-- Solo devuelve equipos de los que la persona que llama es miembro.
create or replace function public.team_captain_coverage(p_team_id uuid default null)
returns table (
  team_id         uuid,
  covered         boolean,
  payer_user_id   uuid,
  payer_name      text,
  period_end      timestamptz,
  captain_count   int,
  captain_limit   int,
  captains        jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  with mine as (
    select t.id, t.owner_id
      from public.teams t
     where t.club_id is null
       and (p_team_id is null or t.id = p_team_id)
       and exists (
         select 1 from public.team_members m
          where m.team_id = t.id and m.user_id = v_uid
       )
  )
  select
    mi.id,
    cov.payer_user_id is not null,
    cov.payer_user_id,
    nullif(trim(coalesce(pp.full_name, pp.username, '')), ''),
    cov.period_end,
    (select count(*)::int from public.team_members tm
      where tm.team_id = mi.id and tm.role in ('captain','admin')),
    3,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id',    tm.user_id,
               'name',       nullif(trim(coalesce(p.full_name, p.username, '')), ''),
               'avatar_url', p.avatar_url,
               'role',       tm.role,
               'is_owner',   tm.user_id = mi.owner_id,
               'is_payer',   tm.user_id = cov.payer_user_id
             ) order by (tm.user_id = mi.owner_id) desc, tm.created_at)
        from public.team_members tm
        left join public.profiles p on p.id = tm.user_id
       where tm.team_id = mi.id and tm.role in ('captain','admin')
    ), '[]'::jsonb)
  from mine mi
  left join lateral private.team_captain_cover(mi.id) cov on true
  left join public.profiles pp on pp.id = cov.payer_user_id;
end;
$$;

revoke all on function public.team_captain_coverage(uuid) from public, anon;
grant execute on function public.team_captain_coverage(uuid) to authenticated;

-- ── 4. Quitar a una capitana (pasa a jugadora) ──────────────────────────────
-- Lo pueden hacer el dueño del equipo o la capitana que paga el plan. Al
-- dueño no se le puede quitar.
create or replace function public.demote_team_captain(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_payer uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select owner_id into v_owner from public.teams where id = p_team_id;
  if not found then
    raise exception 'Equipo no encontrado';
  end if;

  select c.payer_user_id into v_payer from private.team_captain_cover(p_team_id) c;

  if v_uid is distinct from v_owner and v_uid is distinct from v_payer then
    raise exception 'Solo el dueño del equipo o quien paga el plan puede quitar capitanas';
  end if;

  if p_user_id = v_owner then
    raise exception 'Al dueño del equipo no se le puede quitar el rol de capitán';
  end if;

  update public.team_members
     set role = 'player'
   where team_id = p_team_id
     and user_id = p_user_id
     and role in ('captain','admin');

  if not found then
    raise exception 'Esa persona no es capitana de este equipo';
  end if;
end;
$$;

revoke all on function public.demote_team_captain(uuid, uuid) from public, anon;
grant execute on function public.demote_team_captain(uuid, uuid) to authenticated;

-- ── 5. Límite de 3 capitanas por equipo independiente ──────────────────────
create or replace function private.tg_team_captain_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_others  int;
begin
  if new.role not in ('captain','admin') then
    return new;
  end if;
  -- Ya era capitana: no ocupa plaza nueva.
  if tg_op = 'UPDATE' and old.role in ('captain','admin') and old.team_id = new.team_id then
    return new;
  end if;

  select club_id into v_club_id from public.teams where id = new.team_id;
  if v_club_id is not null then
    return new;  -- equipos de club: sin cambios
  end if;

  -- Serializa altas simultáneas en el mismo equipo.
  perform pg_advisory_xact_lock(hashtext('team_captains:' || new.team_id::text));

  select count(*) into v_others
    from public.team_members
   where team_id = new.team_id
     and role in ('captain','admin')
     and user_id <> new.user_id;

  if v_others >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'Este equipo ya tiene 3 capitanas: el máximo con el plan. Quita a una para añadir otra.',
      hint    = 'captain_limit';
  end if;

  return new;
end;
$$;

drop trigger if exists team_captain_limit on public.team_members;
create trigger team_captain_limit
  before insert or update of role, team_id on public.team_members
  for each row execute function private.tg_team_captain_limit();
