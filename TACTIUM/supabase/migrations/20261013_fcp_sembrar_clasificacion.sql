-- Clasificación «a cero» para los grupos que ya tienen calendario pero aún no
-- clasificación en la web de la Federación.
--
-- POR QUÉ. La FCP publica el calendario de una liga (grupos + enfrentamientos)
-- y deja la tabla de clasificación VACÍA hasta que se juega la primera jornada.
-- El agente solo escribe `fcp_clasificacion` cuando esa tabla trae filas, y toda
-- la app asume que una liga con calendario también tiene clasificación:
--
--   · `fetchCurrentLiga` (mayor id_liga con partidos) salta a la liga nueva en
--     cuanto entra el calendario…
--   · …pero `searchFcpClubs`, `import_fcp_season`, `resolveMainGroup` y el aviso
--     «temporada nueva» buscan el equipo en `fcp_clasificacion`, que para esa
--     liga está vacía. Resultado: «Preparar la temporada nueva» sin equipos,
--     «Traer de la Federación» cayendo a la temporada del año pasado, y el aviso
--     «Temporada nueva en la Federación» pegado a equipos que ya la tienen.
--   · El volcado de plantillas (`--equipos`, `all`) parte de la clasificación,
--     así que las plantillas de la liga nueva dejaban de refrescarse justo
--     cuando el club da de alta fichajes.
--
-- QUÉ HACE. Para cada grupo regular de la liga con partidos y SIN clasificación
-- real, siembra una fila por equipo (nombres tal cual salen en `fcp_partidos`,
-- id_equipo de la inscripción), con `posicion` NULL y todo a 0. `posicion` NULL
-- es la marca de «sembrada»: la app ya la pinta como «–».
--
-- En cuanto el agente escribe la clasificación real (misma clave id_grupo +
-- equipo) la sustituye; y si algún nombre no coincide, la siembra sobrante se
-- borra al detectar que el grupo ya tiene filas con posición.
--
-- Idempotente. Solo service_role (la llama el agente tras cada pasada).

create or replace function public.fcp_sembrar_clasificacion(p_liga integer default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_liga integer := p_liga;
  v_n integer := 0;
begin
  if v_liga is null then
    select max(id_liga) into v_liga from public.fcp_partidos;
  end if;
  if v_liga is null then
    return 0;
  end if;

  -- 1) La siembra de un grupo que ya tiene clasificación real sobra.
  delete from public.fcp_clasificacion c
  where c.id_liga = v_liga
    and c.posicion is null
    and exists (
      select 1 from public.fcp_clasificacion r
      where r.id_grupo = c.id_grupo and r.posicion is not null
    );

  -- 2) Sembrar los grupos regulares con calendario y sin clasificación real.
  with eq as (
    select distinct p.id_liga, p.id_grupo, g.nombre as gnombre, g.genero, btrim(t.equipo) as equipo
    from public.fcp_partidos p
    join public.fcp_grupos g on g.id_grupo = p.id_grupo and g.id_liga = v_liga
    cross join lateral (values (p.equipo_local), (p.equipo_visit)) as t(equipo)
    where p.id_liga = v_liga
      and p.id_grupo !~* '^fase'
      and btrim(coalesce(t.equipo, '')) <> ''
      and t.equipo !~* '^\s*(exento|eliminatoria|descansa)'
      and not exists (
        select 1 from public.fcp_clasificacion c
        where c.id_grupo = p.id_grupo and c.posicion is not null
      )
  ), ins as (
    insert into public.fcp_clasificacion
      (id_liga, id_grupo, posicion, id_equipo, equipo, enf, puntos, pj, pg, sets_favor, sets_contra, updated_at)
    select
      eq.id_liga, eq.id_grupo, null, i.id_equipo, eq.equipo, 0, 0, 0, 0, 0, 0, now()
    from eq
    left join lateral (
      -- El id sale de la inscripción: misma liga, género y nombre, y o bien el
      -- mismo grupo del calendario o la misma categoría (las filas del PDF de
      -- distribución cuelgan de la categoría, no del grupo).
      select x.id_equipo
      from public.fcp_inscripciones x
      where x.id_liga = eq.id_liga
        and x.genero = eq.genero
        and upper(btrim(x.equipo)) = upper(eq.equipo)
        and (
          x.id_grupo = eq.id_grupo
          or regexp_replace(upper(coalesce(x.grupo_nombre, '')), '\s*-\s*GRUPO.*$', '')
             = regexp_replace(upper(eq.gnombre), '\s*-\s*GRUPO.*$', '')
        )
      order by (x.id_grupo = eq.id_grupo) desc, (x.subgrupo is not null) desc
      limit 1
    ) i on true
    on conflict (id_grupo, equipo) do update
      set id_equipo = coalesce(public.fcp_clasificacion.id_equipo, excluded.id_equipo)
      where public.fcp_clasificacion.posicion is null
    returning 1
  )
  select count(*) into v_n from ins;

  return v_n;
end;
$$;

revoke all on function public.fcp_sembrar_clasificacion(integer) from public, anon, authenticated;
grant execute on function public.fcp_sembrar_clasificacion(integer) to service_role;
