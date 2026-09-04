-- COBRO DEL TORNEO AL CERRAR LA INSCRIPCIÓN (sustituye al pago por adelantado).
--
-- Decisión de producto tras la reunión con Smash: al gestor no le sirve limitar
-- plazas. Modelo nuevo: **parejas ilimitadas → se cierra la inscripción → se
-- paga por las parejas REALES → sin pagar no se generan cuadros.**
--
-- Además, el modelo viejo hacía aguas: el tope `max_pairs` se aplica POR
-- DIVISIÓN (género+categoría) en `tournament_signup`, así que un torneo de "40
-- plazas" con tres divisiones admitía 120 parejas habiendo pagado 40.
--
-- Qué cambia aquí, que es solo el guardia:
--   · Un torneo ya NO nace retenido en borrador esperando el pago: nace
--     publicado y la inscripción corre desde el primer día.
--   · El peaje se mueve al momento de GENERAR LOS CUADROS, que en el cliente es
--     justo cuando el torneo pasa a `in_progress` (los cinco generadores de
--     tournaments.ts hacen ese update). Si hay más parejas inscritas que
--     cubiertas, no pasa.
--   · Se retira la regla que invalidaba el cobro al ampliar `max_pairs`: ese
--     campo ya no manda en el precio, ahora es solo un tope opcional de aforo.
--
-- La tabla SIGUE sin conocer los tramos de precio (viven en TS, en la app y en
-- la web): aquí solo se compara "parejas inscritas" contra "parejas cubiertas",
-- que es un dato tonto y suficiente. Quien pone `covered_pairs` es siempre el
-- servidor (checkout/webhook), incluso cuando el importe es 0 (gratis o
-- incluido en el plan): por eso el club pasa por el checkout aunque no pague.

create or replace function public.tournaments_billing_guard()
returns trigger
language plpgsql
as $$
declare
  v_regs int;
begin
  -- (0) El estado de cobro lo escribe SOLO el servidor (service_role vía
  -- checkout/webhook). Si no, el cliente podría marcarse el torneo como pagado.
  if new.billing_status is distinct from old.billing_status
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'El estado de cobro del torneo solo lo cambia el servidor'
      using errcode = 'insufficient_privilege';
  end if;

  -- (1) Torneos del modelo VIEJO que quedaron retenidos en borrador: siguen sin
  -- poder publicarse con el pago pendiente.
  if new.status in ('open', 'in_progress')
     and coalesce(old.status, '') = 'draft'
     and coalesce(new.billing_status, 'none') = 'pending_payment' then
    raise exception 'Torneo con pago pendiente: complétalo para publicarlo'
      using errcode = 'check_violation';
  end if;

  -- (2) EL PEAJE NUEVO: no se generan cuadros con parejas sin cubrir.
  if new.status = 'in_progress' and coalesce(old.status, '') <> 'in_progress' then
    select count(*) into v_regs
      from public.tournament_registrations r
     where r.tournament_id = new.id
       and r.status <> 'withdrawn';
    if v_regs > coalesce(new.covered_pairs, 0) then
      raise exception
        'Cierra el pago del torneo para generar los cuadros: % parejas inscritas y % cubiertas',
        v_regs, coalesce(new.covered_pairs, 0)
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- El trigger ya existe (20260811b); esto solo reemplaza el cuerpo de la función.
