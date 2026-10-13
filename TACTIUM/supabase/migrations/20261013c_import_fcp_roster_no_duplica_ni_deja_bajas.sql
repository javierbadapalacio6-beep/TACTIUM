-- import_fcp_roster (aplicada en producción el 13-10-2026 en dos pasos: «no_duplica_entre_temporadas» y «desactiva_bajas»).
--
-- 1) No duplica entre temporadas. El id de jugador es fcp_{id_equipo}_{slug} y el id_equipo cambia cada temporada, así
--    que al volcar la plantilla 26/27 en un equipo ya volcado con la 25/26 se creaban todos los jugadores otra vez
--    (caso real, MEDIO CUDEYO A: 12 duplicados). Ahora se compara por el slug (apellidos + nombre); si ya está, se
--    re-vincula al id nuevo (para que la próxima vez salte por el id exacto) y no se inserta.
-- 2) Bajas. Los jugadores VINCULADOS a la Federación que ya no figuran en la plantilla oficial del equipo pasan a
--    inactivos. Solo toca a los vinculados (los añadidos a mano no); si la plantilla oficial viniera vacía, no
--    desactiva a nadie.

create or replace function public.import_fcp_roster(p_team_id uuid, p_fcp_id_equipo integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner uuid;
  v_added int := 0;
  r record;
  v_pid uuid;
  v_name text;
  v_slug text;
  v_lkid public.fcp_player_links.id%type;
begin
  select owner_id into v_owner from public.teams where id = p_team_id;
  if v_owner is null then raise exception 'Equipo no encontrado'; end if;
  -- Solo el dueño del equipo o el dueño del club al que pertenece.
  if v_owner <> auth.uid() and not exists (
    select 1 from public.clubs c join public.teams t on t.club_id = c.id
    where t.id = p_team_id and c.owner_id = auth.uid()
  ) then
    raise exception 'Sin permiso sobre este equipo';
  end if;

  for r in
    select * from public.fcp_jugadores
    where id_equipo = p_fcp_id_equipo
    order by puntos desc nulls last
  loop
    if exists (
      select 1 from public.fcp_player_links l
      where l.fcp_id_jugador = r.id_jugador and l.team_id = p_team_id
    ) then
      continue;
    end if;

    -- Ya está en el equipo con el id de otra temporada: se re-vincula y no se duplica.
    v_slug := regexp_replace(r.id_jugador, '^fcp_[0-9]+_', '');
    v_lkid := null;
    select k.id into v_lkid from public.fcp_player_links k
    where k.team_id = p_team_id
      and regexp_replace(k.fcp_id_jugador, '^fcp_[0-9]+_', '') = v_slug
    order by k.linked_at desc limit 1;
    if v_lkid is not null then
      update public.fcp_player_links set fcp_id_jugador = r.id_jugador where id = v_lkid;
      continue;
    end if;

    v_name := btrim(
      coalesce(nullif(btrim(r.nombre_pila), ''), '') || ' ' ||
      coalesce(nullif(btrim(r.apellido1), ''), '') || ' ' ||
      coalesce(nullif(btrim(r.apellido2), ''), '')
    );
    if v_name = '' then v_name := coalesce(r.nombre, 'Jugador'); end if;

    insert into public.players (team_id, name, pts, active)
    values (p_team_id, v_name, coalesce(r.puntos, 0), true)
    returning id into v_pid;

    insert into public.fcp_player_links (fcp_id_jugador, player_id, team_id, confidence, linked_by)
    values (r.id_jugador, v_pid, p_team_id, 'auto', auth.uid());

    v_added := v_added + 1;
  end loop;

  -- Bajas: vinculados a la Federación que ya no figuran en la plantilla oficial.
  if exists (select 1 from public.fcp_jugadores where id_equipo = p_fcp_id_equipo) then
    update public.players p set active = false
    where p.team_id = p_team_id and p.active
      and exists (select 1 from public.fcp_player_links k where k.player_id = p.id and k.team_id = p_team_id)
      and not exists (
        select 1 from public.fcp_player_links k
        join public.fcp_jugadores j
          on j.id_equipo = p_fcp_id_equipo
         and regexp_replace(j.id_jugador, '^fcp_[0-9]+_', '') = regexp_replace(k.fcp_id_jugador, '^fcp_[0-9]+_', '')
        where k.player_id = p.id and k.team_id = p_team_id
      );
  end if;

  return v_added;
end $function$;
