-- Plan Capitán compartido: un plan cubre UN solo equipo (2026-10-07).
--
-- Cierra el resquicio de 20261007b: antes, quien pagaba cubría a todos los
-- equipos independientes donde fuese capitán. Ahora el plan cubre:
--   1. el equipo independiente del que es DUEÑO (si tiene varios, el más antiguo);
--   2. si no es dueño de ninguno, el equipo independiente donde es capitán
--      desde hace más tiempo (la fila de team_members más antigua).
-- Su propio acceso como capitán (fn_has_premium_access, paso 3a) no cambia.
--
-- Además, textos en masculino genérico, como el resto de la app.

-- ── Equipo que cubre el plan Capitán de una persona ─────────────────────────
create or replace function private.captain_plan_team(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select t.id
       from public.teams t
      where t.owner_id = p_user
        and t.club_id is null
      order by t.created_at, t.id
      limit 1),
    (select tm.team_id
       from public.team_members tm
       join public.teams t on t.id = tm.team_id
      where tm.user_id = p_user
        and tm.role in ('captain','admin')
        and t.club_id is null
      order by tm.created_at, tm.team_id
      limit 1)
  );
$$;

revoke all on function private.captain_plan_team(uuid) from public, anon, authenticated;

-- ── Cobertura: solo si el equipo es EL equipo del plan de quien paga ────────
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
     and private.captain_plan_team(s.subject_id) = t.id
   order by s.current_period_end desc
   limit 1;
$$;

revoke all on function private.team_captain_cover(uuid) from public, anon, authenticated;

-- ── Límite de 3 capitanes: mensaje en masculino genérico ────────────────────
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
  if tg_op = 'UPDATE' and old.role in ('captain','admin') and old.team_id = new.team_id then
    return new;
  end if;

  select club_id into v_club_id from public.teams where id = new.team_id;
  if v_club_id is not null then
    return new;  -- equipos de club: sin cambios
  end if;

  perform pg_advisory_xact_lock(hashtext('team_captains:' || new.team_id::text));

  select count(*) into v_others
    from public.team_members
   where team_id = new.team_id
     and role in ('captain','admin')
     and user_id <> new.user_id;

  if v_others >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'Este equipo ya tiene 3 capitanes: el máximo con el plan. Quita a uno para añadir otro.',
      hint    = 'captain_limit';
  end if;

  return new;
end;
$$;

-- ── Quitar capitán: textos en masculino ─────────────────────────────────────
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
    raise exception 'Solo el dueño del equipo o quien paga el plan puede quitar capitanes';
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
    raise exception 'Esa persona no es capitán de este equipo';
  end if;
end;
$$;
