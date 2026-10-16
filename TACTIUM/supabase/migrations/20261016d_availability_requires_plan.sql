-- Que los jugadores respondan a la convocatoria pasa a ser una función con plan (tras la prueba).
--
-- Decisión de producto (16-10-2026): quien entra sin plan tiene todas las funciones durante 14 días; después se
-- bloquean las Pro, y entre ellas «responder a la convocatoria». Reglas:
--
--   · EQUIPOS DE CLUB: no se tocan (los cubre el plan del club).
--   · EQUIPOS INDEPENDIENTES e INVITADOS: los jugadores pueden responder si se cumple ALGO de esto:
--       1) el dueño o algún capitán tiene una suscripción viva (de pago o prueba): `active`/`trialing` y vigente;
--       2) el equipo es NUEVO: se creó hace menos de 14 días;
--       3) margen para los que NUNCA tuvieron prueba (ninguna suscripción del dueño ni de sus capitanes) hasta el
--          30-10-2026. Es el caso de Pádel Cayón A y Atenea, a los que nunca se les ofreció.
--   · Capitanes y admins no se bloquean: sus funciones ya van por el plan.
--
-- Se aplica en el servidor, en los DOS caminos de respuesta (`respond_availability` y el enlace sin cuenta
-- `public_respond_availability`) y en las políticas de la tabla (para la escritura directa).

create or replace function private.team_players_can_respond(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = 'public', 'pg_temp'
as $$
  select coalesce((
    select
      -- Equipos de club: no se tocan.
      t.club_id is not null
      -- Equipo nuevo: 14 días.
      or t.created_at > now() - interval '14 days'
      -- Dueño o algún capitán con suscripción viva (de pago o prueba).
      or exists (
        select 1 from public.subscriptions s
         where s.subject_type = 'user'
           and s.status in ('active', 'trialing')
           and s.current_period_end > now()
           and (s.subject_id = t.owner_id
                or s.subject_id in (select m.user_id from public.team_members m
                                     where m.team_id = t.id and m.role in ('captain', 'admin')))
      )
      -- Margen hasta el 30-10-2026 para quien nunca tuvo ninguna suscripción.
      or (
        now() < timestamptz '2026-10-30 00:00:00+02'
        and not exists (
          select 1 from public.subscriptions s
           where s.subject_type = 'user'
             and (s.subject_id = t.owner_id
                  or s.subject_id in (select m.user_id from public.team_members m
                                       where m.team_id = t.id and m.role in ('captain', 'admin')))
        )
      )
    from public.teams t
    where t.id = p_team_id
  ), true);
$$;
revoke all on function private.team_players_can_respond(uuid) from public, anon, authenticated;

-- Responder con cuenta: se añade el filtro al jugador que responde por sí mismo.
create or replace function public.respond_availability(
  p_matchday_id uuid, p_player_id uuid, p_status text, p_reason text default null, p_note text default null
) returns public.availability
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $function$
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

  select coalesce(p.user_id = v_uid, false) into v_self
    from public.players p where p.id = p_player_id and p.team_id = v_team;
  if not found then
    raise exception 'Jugador no encontrado en este equipo' using errcode = 'P0002';
  end if;
  if not v_self and not private.is_team_admin(v_team) then
    raise exception 'Solo el capitán puede responder por otro jugador' using errcode = '42501';
  end if;

  -- Un jugador responde si el equipo tiene el plan al día (o está en su prueba). El capitán, siempre.
  if not private.is_team_admin(v_team) and not private.team_players_can_respond(v_team) then
    raise exception 'El capitán de tu equipo tiene que activar el plan para poder responder'
      using errcode = 'P0402';
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
end $function$;

-- Responder con el enlace sin cuenta: mismo filtro.
create or replace function public.public_respond_availability(
  p_token text, p_player_id uuid, p_status text, p_reason text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_md   uuid;
  v_why  text;
  v_team uuid;
  v_cnt  integer;
  v_t    text := lower(btrim(coalesce(p_token, '')));
begin
  select s.matchday_id, s.reason into v_md, v_why from private.availability_link_state(p_token) s;
  if v_why is not null then
    return jsonb_build_object('ok', false, 'reason', v_why);
  end if;

  if p_status is null or p_status not in ('yes', 'maybe', 'no') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  if p_status = 'maybe' and p_reason is not null
     and p_reason not in ('trabajo', 'molestias', 'viaje', 'pendiente') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reason');
  end if;

  v_team := private.team_for_matchday(v_md);
  if p_player_id is null or not exists (
       select 1 from public.players p
        where p.id = p_player_id and p.team_id = v_team and p.active) then
    return jsonb_build_object('ok', false, 'reason', 'no_player');
  end if;

  -- El plan del equipo (o su prueba) tiene que estar al día.
  if not private.team_players_can_respond(v_team) then
    return jsonb_build_object('ok', false, 'reason', 'team_not_covered');
  end if;

  if p_status = 'maybe' and now() >= public.availability_maybe_deadline(v_md) then
    return jsonb_build_object('ok', false, 'reason', 'maybe_closed');
  end if;

  update public.availability_links l
     set writes_count = case when now() - l.writes_window_start > interval '1 hour' then 1 else l.writes_count + 1 end,
         writes_window_start = case when now() - l.writes_window_start > interval '1 hour' then now() else l.writes_window_start end
   where l.token = v_t
  returning l.writes_count into v_cnt;
  if v_cnt > 300 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  insert into public.availability
    (matchday_id, player_id, status, reason, note, updated_by, updated_at, auto_resolved, answered_via)
  values (v_md, p_player_id, p_status,
          case when p_status = 'maybe' then p_reason end,
          nullif(left(btrim(coalesce(p_note, '')), 140), ''),
          null, now(), false, 'link')
  on conflict (matchday_id, player_id) do update
    set status = excluded.status, reason = excluded.reason, note = excluded.note,
        updated_by = null, updated_at = now(), auto_resolved = false, answered_via = 'link';

  return jsonb_build_object('ok', true, 'status', p_status);
end $function$;

-- Escritura directa en la tabla (por si algún cliente no usa el RPC): el jugador por sí mismo también pasa el filtro.
alter policy availability_self_or_admin_insert on public.availability
  with check (
    private.is_team_admin(private.team_for_matchday(matchday_id))
    or (exists (select 1 from public.players p where p.id = availability.player_id and p.user_id = auth.uid())
        and private.team_players_can_respond(private.team_for_matchday(matchday_id)))
  );

alter policy availability_self_or_admin_update on public.availability
  using (
    private.is_team_admin(private.team_for_matchday(matchday_id))
    or exists (select 1 from public.players p where p.id = availability.player_id and p.user_id = auth.uid())
  )
  with check (
    private.is_team_admin(private.team_for_matchday(matchday_id))
    or (exists (select 1 from public.players p where p.id = availability.player_id and p.user_id = auth.uid())
        and private.team_players_can_respond(private.team_for_matchday(matchday_id)))
  );
