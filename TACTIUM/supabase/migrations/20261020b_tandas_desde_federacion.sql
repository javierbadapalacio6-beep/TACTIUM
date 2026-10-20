-- Las tandas vienen de la Federación (orden_tandas del partido) y mandan sobre lo que haya escrito a mano.
--
-- Hasta ahora solo se copiaban al importar la temporada: si la Federación las publicaba después (o las
-- corregía) la jornada se quedaba sin ellas o con otras. Mismo patrón que `fcp_date_range`: triggers que
-- mantienen `matchdays.tandas` al día. Solo se aplican valores VÁLIDOS para el género del equipo
-- (masculino: suma 5 y ≤ 3 tandas; femenino: suma 4 y ≤ 2). Si la Federación no las da, o dan algo inválido,
-- no se toca lo que hay (las tandas puestas a mano siguen).

create or replace function private.fcp_tandas_clean(p_raw text)
returns text
language sql immutable
as $$ select nullif(regexp_replace(coalesce(p_raw, ''), '\s+', '', 'g'), '') $$;

-- Tandas de la Federación para una jornada, ya limpias y validadas con el género de su equipo (null si no hay/no valen).
create or replace function private.fcp_tandas_for_matchday(p_matchday_id uuid, p_id_partido text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when private.valid_tandas(private.fcp_tandas_clean(p.orden_tandas), t.gender::text)
              then private.fcp_tandas_clean(p.orden_tandas) end
    from public.fcp_partidos p
    join public.matchdays m on m.id = p_matchday_id
    join public.seasons s on s.id = m.season_id
    join public.teams t on t.id = s.team_id
   where p.id_partido = p_id_partido
$$;

-- Al enlazar una jornada con un partido (o crearla ya enlazada).
create or replace function private.matchday_set_fcp_tandas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v text;
begin
  if new.fcp_id_partido is not null then
    v := private.fcp_tandas_for_matchday(new.id, new.fcp_id_partido);
    if v is not null then new.tandas := v; end if;
  end if;
  return new;
end $$;

drop trigger if exists matchdays_fcp_tandas on public.matchdays;
create trigger matchdays_fcp_tandas
  before insert or update of fcp_id_partido on public.matchdays
  for each row execute function private.matchday_set_fcp_tandas();

-- Cuando la Federación publica o cambia las tandas de un partido.
create or replace function private.fcp_partido_tandas_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record; v text;
begin
  for r in select id from public.matchdays where fcp_id_partido = new.id_partido loop
    v := private.fcp_tandas_for_matchday(r.id, new.id_partido);
    if v is not null then
      update public.matchdays set tandas = v where id = r.id and tandas is distinct from v;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists fcp_partidos_tandas_sync on public.fcp_partidos;
create trigger fcp_partidos_tandas_sync
  after insert or update of orden_tandas on public.fcp_partidos
  for each row execute function private.fcp_partido_tandas_sync();

-- Las jornadas que ya existen.
update public.matchdays m
   set tandas = private.fcp_tandas_for_matchday(m.id, m.fcp_id_partido)
 where m.fcp_id_partido is not null
   and private.fcp_tandas_for_matchday(m.id, m.fcp_id_partido) is not null
   and m.tandas is distinct from private.fcp_tandas_for_matchday(m.id, m.fcp_id_partido);
