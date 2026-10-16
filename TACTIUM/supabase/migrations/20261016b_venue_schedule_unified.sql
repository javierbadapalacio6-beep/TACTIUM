-- Horario de un equipo INVITADO igual que el de uno propio: se pone la hora (y las tandas) y ya está.
--
-- Diferencias que había:
--   · Al poner día/hora/pista a un equipo propio se levanta `home_unconfirmed` (sede de playoff por confirmar). Con
--     un invitado NO: seguía saliendo «por confirmar» aunque el club ya le hubiera puesto la hora.
--   · Las tandas iban en una segunda llamada aparte. Ahora van en la misma.
--
-- `set_venue_matchday_schedule` hace todo en una sola llamada y avisa al capitán con día, hora, pista y tandas.
-- `set_venue_matchday_slot` (la versión sin tandas, que usan las apps ya instaladas) también levanta
-- `home_unconfirmed`, para que ningún cliente antiguo se quede con el problema.

create or replace function public.set_venue_matchday_schedule(
  p_matchday_id uuid,
  p_match_date  date,
  p_match_time  time,
  p_location    text,
  p_tandas      text default null
) returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
declare
  v_team   public.teams%rowtype;
  v_md     public.matchdays%rowtype;
  v_cap    uuid;
  v_body   text;
  v_tandas text := nullif(btrim(coalesce(p_tandas, '')), '');
begin
  select m.* into v_md from public.matchdays m where m.id = p_matchday_id;
  if not found then raise exception 'Jornada no encontrada'; end if;

  select t.* into v_team
    from public.seasons s join public.teams t on t.id = s.team_id
   where s.id = v_md.season_id;
  if not found then raise exception 'Equipo no encontrado'; end if;

  if v_team.venue_club_id is null then
    raise exception 'Ese equipo no juega en tu club';
  end if;
  if not (private.is_club_admin(v_team.venue_club_id)
          or exists (select 1 from public.clubs c where c.id = v_team.venue_club_id and c.owner_id = auth.uid())) then
    raise exception 'Solo el club sede puede poner el horario' using errcode = 'insufficient_privilege';
  end if;
  if not v_md.is_home then
    raise exception 'Ese partido no se juega en tu club';
  end if;
  if not private.valid_tandas(v_tandas, v_team.gender::text) then
    raise exception 'Tandas no válidas para este equipo: %', p_tandas;
  end if;

  update public.matchdays
     set match_date      = coalesce(p_match_date, match_date),
         match_time      = p_match_time,
         location        = p_location,
         tandas          = coalesce(v_tandas, tandas),
         -- Ponerle día, hora y pista ES confirmar que se juega aquí (igual que con un equipo propio).
         home_unconfirmed = false
   where id = p_matchday_id;

  v_body := 'Tu partido de la jornada ' || coalesce(v_md.jornada_number::text, '?')
    || ' contra ' || coalesce(v_md.opponent, 'rival') || ' se juega el '
    || coalesce(to_char(coalesce(p_match_date, v_md.match_date), 'DD/MM'), 'día por confirmar')
    || case when p_match_time is not null then ' a las ' || to_char(p_match_time, 'HH24:MI') else '' end
    || case when p_location is not null then ' (' || p_location || ')' else '' end
    || case when coalesce(v_tandas, v_md.tandas) is not null then ' · tandas ' || coalesce(v_tandas, v_md.tandas) else '' end
    || '.';

  for v_cap in
    select tm.user_id from public.team_members tm
     where tm.team_id = v_team.id and tm.role = 'captain' and tm.user_id is not null
    union
    select v_team.owner_id
  loop
    if v_cap is not null and v_cap is distinct from auth.uid() then
      insert into public.notifications (user_id, type, title, body, data)
      values (v_cap, 'schedule_set', 'Horario de tu partido', v_body,
              jsonb_build_object('matchday_id', p_matchday_id, 'team_id', v_team.id));
    end if;
  end loop;
end $$;

revoke all on function public.set_venue_matchday_schedule(uuid, date, time, text, text) from public, anon;
grant execute on function public.set_venue_matchday_schedule(uuid, date, time, text, text) to authenticated;

-- Versión antigua: lo mismo que antes, y además levanta `home_unconfirmed`.
create or replace function public.set_venue_matchday_slot(
  p_matchday_id uuid, p_match_date date, p_match_time time, p_location text
) returns void
language plpgsql security definer set search_path = 'public', 'pg_temp'
as $$
begin
  perform public.set_venue_matchday_schedule(p_matchday_id, p_match_date, p_match_time, p_location, null);
end $$;

revoke all on function public.set_venue_matchday_slot(uuid, date, time, text) from public, anon;
grant execute on function public.set_venue_matchday_slot(uuid, date, time, text) to authenticated;
