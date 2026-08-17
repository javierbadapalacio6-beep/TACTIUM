-- GATE DE PAGO OBLIGATORIO · nadie se inscribe hasta publicar (pagar) el torneo.
--
-- Regla de negocio: para crear un torneo hay que pagar su publicación ANTES de
-- que nadie se una ni se pueda añadir a nadie. Traducción a la BD:
--
--   1. Un torneo NACE como borrador (`status='draft'`). El default de la columna
--      pasa a 'draft' para que ningún cliente pueda saltárselo.
--   2. GUARDIA de inscripciones: no se puede insertar en `tournament_registrations`
--      si el torneo padre sigue en 'draft'. Esto tapa TODOS los caminos a la vez
--      (RPC `tournament_signup`, alta manual del organizador, o cualquier insert
--      directo), porque la fuente de verdad es la BD, no la interfaz.
--
-- Publicar = pagar: el checkout/webhook (service_role) hace `draft → open` cuando
-- el pago se confirma (o al instante si el torneo es gratis / va incluido en el
-- plan). Esa mitad ya existe (trigger `tournaments_billing_guard`).
--
-- SEGURO AHORA: no quedan torneos en la tabla, así que no hay que indultar a
-- ninguno existente (si los hubiera, un torneo ya abierto seguiría abierto: el
-- guardia solo mira 'draft').

-- (1) Torneo nace como borrador.
alter table public.tournaments
  alter column status set default 'draft';

-- (2) Guardia: bloquear inscripciones mientras el torneo sea borrador.
create or replace function public.tournament_registration_gate()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
    from public.tournaments
   where id = new.tournament_id;

  if v_status is null then
    raise exception 'El torneo no existe'
      using errcode = 'foreign_key_violation';
  end if;

  if v_status = 'draft' then
    raise exception 'El torneo aún no está publicado: págalo para abrir las inscripciones'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_registration_gate_trg on public.tournament_registrations;
create trigger tournament_registration_gate_trg
  before insert on public.tournament_registrations
  for each row
  execute function public.tournament_registration_gate();
