-- Franjas favoritas de local de un equipo INVITADO, editables por el club sede.
--
-- El club que presta sus pistas ya decide el día/hora/pista de cada partido
-- (`set_venue_matchday_slot`), pero no podía tocar las franjas preferentes del
-- equipo: `teams` sólo la deja editar a su dueño y el invitado no es suyo.
-- Este RPC abre EXCLUSIVAMENTE `preferred_home_slots` para equipos invitados,
-- con las mismas comprobaciones de permiso que el de horarios, y avisa al
-- capitán por la campana (es dato de su equipo y lo cambia otra persona).
--
-- Formato de franja: '<dow>|<HH:MM>' con dow 0=domingo … 6=sábado.

create or replace function public.set_venue_team_slots(
  p_team_id uuid,
  p_slots   text[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_team  public.teams%rowtype;
  v_slot  text;
  v_clean text[] := '{}';
  v_cap   uuid;
begin
  select t.* into v_team from public.teams t where t.id = p_team_id;
  if not found then
    raise exception 'Equipo no encontrado';
  end if;

  -- Sólo equipos INVITADOS: los propios del club se editan por la vía normal
  -- (la RLS ya deja al admin del club tocarlos).
  if v_team.venue_club_id is null
     or v_team.club_id is not distinct from v_team.venue_club_id then
    raise exception 'Ese equipo no es un invitado de tu club';
  end if;

  if not exists (
    select 1 from public.clubs c
     where c.id = v_team.venue_club_id and c.owner_id = auth.uid()
    union
    select 1 from public.club_members cm
     where cm.club_id = v_team.venue_club_id and cm.user_id = auth.uid()
       and cm.role = 'admin'
  ) then
    raise exception 'Solo el club sede puede editar sus franjas'
      using errcode = 'insufficient_privilege';
  end if;

  -- Validación + deduplicado: nada de basura en la columna.
  foreach v_slot in array coalesce(p_slots, '{}'::text[]) loop
    if v_slot !~ '^[0-6]\|([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Franja no válida: %', v_slot;
    end if;
    if not (v_slot = any(v_clean)) then
      v_clean := v_clean || v_slot;
    end if;
  end loop;

  if coalesce(array_length(v_clean, 1), 0) > 12 then
    raise exception 'Demasiadas franjas (máximo 12)';
  end if;

  update public.teams
     set preferred_home_slots = v_clean
   where id = p_team_id;

  -- Aviso al capitán del equipo invitado. Por la campana, no por push: la edge
  -- `send-push` autoriza por club del equipo y aquí el club no es el suyo.
  for v_cap in
    select tm.user_id from public.team_members tm
     where tm.team_id = v_team.id and tm.role = 'captain' and tm.user_id is not null
    union
    select v_team.owner_id
  loop
    if v_cap is not null and v_cap is distinct from auth.uid() then
      insert into public.notifications (user_id, type, title, body, data)
      values (
        v_cap,
        'schedule_set',
        'Franjas de local actualizadas',
        'El club donde juegas de local ha actualizado las franjas horarias '
          || 'preferentes de "' || v_team.name || '".',
        jsonb_build_object('team_id', v_team.id));
    end if;
  end loop;
end;
$function$;

revoke execute on function public.set_venue_team_slots(uuid, text[]) from public, anon;
grant  execute on function public.set_venue_team_slots(uuid, text[]) to authenticated;

comment on function public.set_venue_team_slots(uuid, text[]) is
  'El club sede edita las franjas favoritas de local de un equipo invitado. Sólo esa columna, sólo equipos con venue_club_id = su club.';
