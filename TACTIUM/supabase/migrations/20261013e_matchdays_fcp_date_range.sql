-- Fin de semana de cada jornada mientras el club local no fija día y hora.
-- (aplicada en producción el 13-10-2026 como «matchdays_fcp_date_range»)
-- La Federación publica de cada partido el RANGO de fechas («23 - 25 Oct») mucho antes que el día y la hora
-- exactos; `matchdays.match_date` se queda null hasta entonces. Se guarda aquí ese rango (copiado de
-- fcp_partidos.fecha_rango, y mantenido al día por triggers) para enseñarlo en jornadas y calendario.
alter table public.matchdays add column if not exists fcp_date_range text;

create or replace function private.matchday_set_fcp_range()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.fcp_id_partido is not null then
    select p.fecha_rango into new.fcp_date_range
      from public.fcp_partidos p where p.id_partido = new.fcp_id_partido;
  end if;
  return new;
end $$;

drop trigger if exists matchdays_fcp_range on public.matchdays;
create trigger matchdays_fcp_range
  before insert or update of fcp_id_partido on public.matchdays
  for each row execute function private.matchday_set_fcp_range();

create or replace function private.fcp_partido_range_sync()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.matchdays set fcp_date_range = new.fecha_rango
   where fcp_id_partido = new.id_partido and fcp_date_range is distinct from new.fecha_rango;
  return new;
end $$;

drop trigger if exists fcp_partidos_range_sync on public.fcp_partidos;
create trigger fcp_partidos_range_sync
  after update of fecha_rango on public.fcp_partidos
  for each row execute function private.fcp_partido_range_sync();

-- Las jornadas que ya existen.
update public.matchdays m set fcp_date_range = p.fecha_rango
  from public.fcp_partidos p
 where p.id_partido = m.fcp_id_partido and m.fcp_date_range is distinct from p.fecha_rango;
