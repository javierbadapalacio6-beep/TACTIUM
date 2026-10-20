-- El horario de un partido es un paquete: fecha, hora, sede y tandas los sube el club local a la Federación a la vez.
-- Hasta ahora solo se copiaban al importar la temporada, y la sincronización de 20261020b solo cubría las tandas:
-- si la Federación publicaba el horario después, la jornada se quedaba sin hora/lugar o con otros.
-- Ahora cuando la Federación da el horario (fecha + hora) se copia el paquete entero; la Federación manda.
-- Lo que no trae (lugar vacío, tandas inválidas para el género) no se toca. Sin horario en la Federación, no se toca nada.

drop trigger if exists matchdays_fcp_tandas on public.matchdays;
drop trigger if exists fcp_partidos_tandas_sync on public.fcp_partidos;
drop function if exists private.matchday_set_fcp_tandas();
drop function if exists private.fcp_partido_tandas_sync();

create or replace function private.fcp_apply_horario(p_matchday_id uuid, p_id_partido text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  v_time time;
  v_tandas text;
begin
  select * into p from public.fcp_partidos where id_partido = p_id_partido;
  if not found then return; end if;

  v_tandas := private.fcp_tandas_for_matchday(p_matchday_id, p_id_partido);
  v_time := case when btrim(coalesce(p.hora, '')) ~ '^\d{1,2}:\d{2}$' then btrim(p.hora)::time end;

  update public.matchdays m set
    match_date = case when p.fecha is not null and v_time is not null then p.fecha else m.match_date end,
    match_time = case when p.fecha is not null and v_time is not null then v_time else m.match_time end,
    location   = coalesce(nullif(btrim(coalesce(p.lugar, '')), ''), m.location),
    tandas     = coalesce(v_tandas, m.tandas)
  where m.id = p_matchday_id
    and (
      (p.fecha is not null and v_time is not null and (m.match_date is distinct from p.fecha or m.match_time is distinct from v_time))
      or (nullif(btrim(coalesce(p.lugar, '')), '') is not null and m.location is distinct from btrim(p.lugar))
      or (v_tandas is not null and m.tandas is distinct from v_tandas)
    );
end $$;

-- Al enlazar una jornada con un partido (o crearla ya enlazada).
create or replace function private.matchday_link_fcp_horario()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.fcp_id_partido is not null then
    perform private.fcp_apply_horario(new.id, new.fcp_id_partido);
  end if;
  return null;
end $$;

create trigger matchdays_fcp_horario
  after insert or update of fcp_id_partido on public.matchdays
  for each row execute function private.matchday_link_fcp_horario();

-- Cuando la Federación publica o cambia el horario de un partido.
create or replace function private.fcp_partido_horario_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in select id from public.matchdays where fcp_id_partido = new.id_partido loop
    perform private.fcp_apply_horario(r.id, new.id_partido);
  end loop;
  return null;
end $$;

create trigger fcp_partidos_horario_sync
  after insert or update of fecha, hora, lugar, orden_tandas on public.fcp_partidos
  for each row execute function private.fcp_partido_horario_sync();

-- Las jornadas que ya existen (solo las que la Federación ya tiene con horario o tandas).
do $$
declare r record;
begin
  for r in
    select m.id, m.fcp_id_partido from public.matchdays m
      join public.fcp_partidos p on p.id_partido = m.fcp_id_partido
     where m.status = 'upcoming'
       and (p.fecha is not null or nullif(btrim(coalesce(p.orden_tandas, '')), '') is not null)
  loop
    perform private.fcp_apply_horario(r.id, r.fcp_id_partido);
  end loop;
end $$;
