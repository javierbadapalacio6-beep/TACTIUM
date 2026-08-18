-- CERRAR EL BYPASS DE AMPLIAR PLAZAS.
--
-- El guard `tournaments_billing_guard` ya invalidaba el cobro al ampliar un
-- torneo por encima de lo cubierto (billing_status -> 'none'), pero dejaba el
-- torneo en 'open', así que seguía admitiendo inscripciones: se podía crear un
-- torneo pequeño (gratis/pagado), publicarlo, y luego subirlo a 64 plazas sin
-- pasar por caja.
--
-- Fix: si un torneo ABIERTO se amplía por encima de lo cubierto, vuelve a
-- BORRADOR ('draft'). Así el gate de inscripciones lo bloquea hasta re-publicar
-- (el checkout cobra solo la DIFERENCIA). Un torneo ya en juego ('in_progress')
-- NO se toca.
--
-- SEGURO para la app antigua (flag de cobro apagado): la regla (3) solo salta en
-- torneos ya cubiertos (billing_status in paid/included/free), y esa app nunca
-- los crea (crea 'open' con billing_status='none').

create or replace function public.tournaments_billing_guard()
returns trigger
language plpgsql
as $$
begin
  -- (0) El estado de cobro lo escribe SOLO el servidor (service_role vía
  -- checkout/webhook). Si no, el cliente podría marcarse el torneo como pagado.
  if new.billing_status is distinct from old.billing_status
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'El estado de cobro del torneo solo lo cambia el servidor'
      using errcode = 'insufficient_privilege';
  end if;

  -- (2) No se puede publicar/arrancar un torneo con el pago pendiente.
  if new.status in ('open', 'in_progress')
     and coalesce(old.status, '') = 'draft'
     and coalesce(new.billing_status, 'none') = 'pending_payment' then
    raise exception 'Torneo con pago pendiente: complétalo para publicarlo'
      using errcode = 'check_violation';
  end if;

  -- (3) Ampliar plazas por encima de lo cubierto invalida el cobro anterior:
  -- vuelve a "sin evaluar" para que el checkout cobre la diferencia.
  if new.max_pairs is not null
     and new.max_pairs > coalesce(old.covered_pairs, 0)
     and coalesce(old.billing_status, 'none') in ('paid', 'included', 'free')
     -- ...salvo que sea el propio servidor quien está actualizando la cobertura
     and new.covered_pairs is not distinct from old.covered_pairs then
    new.billing_status := 'none';
    -- Cierra el bypass: si estaba ABIERTO a inscripción, vuelve a borrador para
    -- que se re-publique (pagando la diferencia) antes de admitir más parejas.
    -- Un torneo ya en juego no se retrotrae.
    if coalesce(old.status, '') = 'open' then
      new.status := 'draft';
    end if;
  end if;

  return new;
end;
$$;
