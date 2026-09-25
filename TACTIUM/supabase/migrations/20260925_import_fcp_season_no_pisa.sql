-- Volcar el calendario de una temporada NUEVA ya no pisa la anterior.
--
-- EL PROBLEMA. `import_fcp_season` cogía la temporada ACTIVA del equipo y
-- encajaba cada jornada por su número: buscaba la jornada 1, la encontraba y la
-- ACTUALIZABA. Al volcar la liga siguiente sobre una temporada terminada, las
-- jornadas del año que acaba se sobrescribían con los partidos del que empieza
-- —rival, fecha, resultado y marcador incluidos— y el histórico desaparecía sin
-- que nadie hubiera borrado nada. No saltaba todavía porque la Federación
-- publica el calendario meses después de las inscripciones, pero es cuestión de
-- tiempo: el botón «Volcar jornadas» está a un toque en el aviso de temporada
-- nueva.
--
-- LA SOLUCIÓN. Cada temporada se queda marcada con el grupo federativo del que
-- salió. Si el calendario que llega es de OTRO grupo, se cierra la vigente
-- (igual que «cerrar temporada» en la app: `active=false` y `end_date` a hoy) y
-- se crea una nueva. Nunca se escribe encima de jornadas de otra temporada.
--
-- Para las temporadas que ya existen, sin marca, se deduce del propio
-- histórico: si sus jornadas apuntan a partidos de otro grupo, es otra
-- temporada. Si no tienen jornadas, o son de este grupo, se adopta y se marca.

alter table public.seasons
  add column if not exists fcp_id_grupo text;

comment on column public.seasons.fcp_id_grupo is
  'Grupo de la Federación del que salió el calendario de esta temporada. '
  'Distingue una temporada de la siguiente: el id cambia cada año.';

-- Rellena la marca de las temporadas que ya tienen jornadas volcadas, para que
-- el primer volcado después de esto ya sepa con qué está comparando.
update public.seasons s
set fcp_id_grupo = g.id_grupo
from (
  select distinct on (m.season_id) m.season_id, p.id_grupo
  from public.matchdays m
  join public.fcp_partidos p on p.id_partido = m.fcp_id_partido
  where m.fcp_id_partido is not null
  order by m.season_id, m.jornada_number
) g
where g.season_id = s.id and s.fcp_id_grupo is null;

create or replace function public.import_fcp_season(
  p_team_id uuid,
  p_fcp_id_equipo integer,
  p_season_name text default 'Liga Cántabra'
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner uuid; v_grupo text; v_teamname text; v_season uuid; r record;
  v_for int; v_against int; v_outcome match_outcome; v_status matchday_status;
  v_parts text[]; v_jn int; v_ctr int := 0; v_created int := 0; v_updated int := 0;
  v_md uuid; v_time time; v_tandas text;
  v_season_grupo text; v_otros int; v_nueva boolean := false;
  v_temporada text; v_etiqueta text; v_nombre text; v_cat text;
begin
  select owner_id into v_owner from public.teams where id = p_team_id;
  if v_owner is null then raise exception 'Equipo no encontrado'; end if;
  if v_owner <> auth.uid() and not exists (
    select 1 from public.clubs c join public.teams t on t.club_id = c.id
    where t.id = p_team_id and c.owner_id = auth.uid()
  ) then raise exception 'Sin permiso sobre este equipo'; end if;

  select id_grupo, equipo into v_grupo, v_teamname
  from public.fcp_clasificacion where id_equipo = p_fcp_id_equipo
  order by (select count(*) from public.fcp_partidos p where p.id_grupo = fcp_clasificacion.id_grupo) desc
  limit 1;
  if v_grupo is null then raise exception 'No encontramos el grupo del equipo en la Federación'; end if;

  select id, fcp_id_grupo into v_season, v_season_grupo
  from public.seasons where team_id = p_team_id and active = true limit 1;

  if v_season is not null then
    if v_season_grupo is null then
      -- Temporada sin marcar: ¿sus jornadas son de otro grupo? Si lo son, es de
      -- otro año y no se toca.
      select count(*) into v_otros
      from public.matchdays m
      join public.fcp_partidos p on p.id_partido = m.fcp_id_partido
      where m.season_id = v_season and p.id_grupo <> v_grupo;
      if v_otros > 0 then v_season_grupo := 'otro'; end if;
    end if;

    if v_season_grupo is not null and v_season_grupo <> v_grupo then
      -- Cerrar y empezar de cero: mismo gesto que «cerrar temporada» en la app.
      update public.seasons
      set active = false, end_date = coalesce(end_date, current_date)
      where id = v_season;
      v_season := null;
      v_nueva := true;
    end if;
  end if;

  if v_season is null then
    -- El nombre lleva la temporada federativa cuando la sabemos: dos temporadas
    -- llamadas igual en el histórico no se distinguen.
    select l.temporada into v_temporada
    from public.fcp_grupos g join public.fcp_ligas l on l.id_liga = g.id_liga
    where g.id_grupo = v_grupo;
    -- La Federación escribe la temporada de tres maneras ("2025", "2026",
    -- "2026/2027"), así que el nombre saldría desparejo en el histórico. Mismo
    -- criterio que `seasonLabel` en la app: siempre curso completo.
    v_temporada := btrim(coalesce(v_temporada, ''));
    if v_temporada ~ '^[0-9]{4}\s*[/-]\s*[0-9]{4}$' then
      v_etiqueta := left(v_temporada, 4) || '/' || right(v_temporada, 4);
    elsif v_temporada ~ '^[0-9]{4}\s*[/-]\s*[0-9]{2}$' then
      v_etiqueta := left(v_temporada, 4) || '/20' || right(v_temporada, 2);
    elsif v_temporada ~ '^[0-9]{4}$' then
      v_etiqueta := (v_temporada::int - 1)::text || '/' || v_temporada;
    else
      v_etiqueta := v_temporada;
    end if;
    v_nombre := p_season_name || coalesce(' ' || nullif(v_etiqueta, ''), '');
    select category into v_cat from public.teams where id = p_team_id;
    insert into public.seasons (team_id, name, category, active, phase, fcp_id_grupo)
    values (p_team_id, v_nombre, v_cat, true, 'liga', v_grupo)
    returning id into v_season;
    v_nueva := true;
  else
    -- Adoptar la temporada vigente: es la de este mismo grupo.
    update public.seasons set fcp_id_grupo = v_grupo
    where id = v_season and fcp_id_grupo is distinct from v_grupo;
  end if;

  for r in
    select * from public.fcp_partidos
    where id_grupo = v_grupo and (equipo_local = v_teamname or equipo_visit = v_teamname)
    order by coalesce(jornada, 9999), fecha nulls last
  loop
    v_ctr := v_ctr + 1;
    v_jn := coalesce(r.jornada, v_ctr);
    v_status := (case when r.estado = 'jugado' then 'finished' else 'upcoming' end)::matchday_status;
    v_for := null; v_against := null; v_outcome := null;
    v_parts := regexp_split_to_array(coalesce(r.resultado, ''), '[/\-]');
    if array_length(v_parts, 1) = 2 then
      begin
        if r.equipo_local = v_teamname then
          v_for := nullif(btrim(v_parts[1]), '')::int; v_against := nullif(btrim(v_parts[2]), '')::int;
        else
          v_for := nullif(btrim(v_parts[2]), '')::int; v_against := nullif(btrim(v_parts[1]), '')::int;
        end if;
      exception when others then v_for := null; v_against := null; end;
    end if;
    if v_status = 'finished' and v_for is not null and v_against is not null then
      v_outcome := (case when v_for > v_against then 'win' when v_for < v_against then 'loss' else 'draw' end)::match_outcome;
    end if;
    v_time := null;
    if r.hora ~ '^[0-9]{1,2}:[0-9]{2}' then
      begin v_time := (substring(r.hora from '^[0-9]{1,2}:[0-9]{2}'))::time; exception when others then v_time := null; end;
    end if;
    v_tandas := nullif(btrim(r.orden_tandas), '');

    select id into v_md from public.matchdays where season_id = v_season and jornada_number = v_jn limit 1;
    if v_md is null then
      insert into public.matchdays
        (season_id, jornada_number, opponent, is_home, match_date, match_time, status, outcome, score_for, score_against, location, fcp_id_partido, tandas)
      values
        (v_season, v_jn,
         case when r.equipo_local = v_teamname then r.equipo_visit else r.equipo_local end,
         (r.equipo_local = v_teamname), r.fecha, v_time, v_status, v_outcome, v_for, v_against, r.lugar, r.id_partido, v_tandas);
      v_created := v_created + 1;
    else
      update public.matchdays set
        opponent = case when r.equipo_local = v_teamname then r.equipo_visit else r.equipo_local end,
        is_home = (r.equipo_local = v_teamname),
        match_date = r.fecha, match_time = v_time,
        status = v_status, outcome = v_outcome,
        score_for = v_for, score_against = v_against, location = r.lugar,
        fcp_id_partido = r.id_partido,
        tandas = coalesce(v_tandas, matchdays.tandas)
      where id = v_md;
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- Una temporada recién creada nacía sin total de jornadas, así que todo lo
  -- que mide progreso ("vas por la 3 de N") se quedaba sin el N. Lo sabemos
  -- aquí: son las que acabamos de recorrer.
  if v_nueva and v_ctr > 0 then
    update public.seasons set total_matchdays = v_ctr
    where id = v_season and total_matchdays is null;
  end if;

  return jsonb_build_object(
    'season_id', v_season, 'created', v_created, 'updated', v_updated,
    'new_season', v_nueva);
end $function$;
