-- FASE 2b · Cobro por torneo: refuerzo (anti doble cobro + bloqueo + ampliación).
--
-- Tres cosas que faltaban en la fase 2:
--   1. Anti DOBLE COBRO: el importe debido se calcula como
--      (precio del tamaño actual) − (lo ya pagado). Necesitamos saber cuántas
--      plazas cubre cada pago → `tournament_payments.covers_pairs`.
--   2. BLOQUEO: un torneo que requiere pago nace en `status='draft'` y no puede
--      publicarse (open) ni arrancar (in_progress) hasta que el webhook confirme.
--   3. AMPLIACIÓN: si el club sube `max_pairs` por encima de lo ya cubierto, el
--      torneo vuelve a "sin evaluar" y hay que pasar de nuevo por el checkout
--      (que cobrará solo la DIFERENCIA).
--
-- Nota de diseño: la tabla NO conoce los tramos de precio (viven en TS, en la
-- app y en la web). Aquí solo guardamos "cuántas plazas hay cubiertas", que es
-- un dato tonto y suficiente para que el trigger haga de guardia.

-- Plazas que cubre cada pago concreto (las que había al cobrarlo).
alter table public.tournament_payments
  add column if not exists covers_pairs integer;

-- Plazas cubiertas del torneo (pagadas, incluidas en el plan o gratis).
-- La escribe SIEMPRE el servidor (checkout/webhook con service_role).
alter table public.tournaments
  add column if not exists covered_pairs integer;

-- ── Guardia de cobro ────────────────────────────────────────────────────────
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
  end if;

  return new;
end;
$$;

drop trigger if exists tournaments_billing_guard_trg on public.tournaments;
create trigger tournaments_billing_guard_trg
  before update on public.tournaments
  for each row
  execute function public.tournaments_billing_guard();

-- Los torneos que ya existen quedan cubiertos por su tamaño actual: este cobro
-- no es retroactivo (si no, al primer UPDATE se les invalidaría el estado).
update public.tournaments
   set covered_pairs = greatest(coalesce(max_pairs, 0), coalesce(covered_pairs, 0))
 where covered_pairs is null;
