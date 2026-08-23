-- Blindaje del periodo de suscripcion (independiente del RPC de sync).
--
-- Sintoma observado en dev/sandbox: una compra creo una sub 'active' cuyo
-- current_period_end era = a la hora de compra (periodo de duracion 0), por lo
-- que "no se activaba" en las comprobaciones por fecha. Causa: el entitlement
-- de RevenueCat en sandbox puede llegar sin expirationDate valido y el periodo
-- sale degenerado. En produccion el expirationDate es real, pero blindamos por
-- si acaso, y para CUALQUIER via de escritura (webhook, RPC, manual).
--
-- Este trigger, ANTES de insert/update, si la sub esta en estado premium-activo
-- y su periodo es DEGENERADO (nulo o de duracion <= 0), recalcula el fin desde
-- el inicio segun billing_period. No toca subs no-premium ni periodos validos.

create or replace function public._subscription_fix_degenerate_period()
returns trigger
language plpgsql
as $$
declare
  v_start timestamptz;
begin
  if NEW.status in ('trialing', 'active', 'grace_period')
     and (
       NEW.current_period_end is null
       or NEW.current_period_end <= coalesce(NEW.current_period_start, NEW.created_at, now())
     ) then
    v_start := coalesce(NEW.current_period_start, NEW.created_at, now());
    NEW.current_period_start := v_start;
    -- ::text para no depender de las etiquetas exactas del enum (evita error
    -- de cast si algun literal no existe como valor del enum).
    NEW.current_period_end := v_start + case NEW.billing_period::text
      when 'yearly' then interval '1 year'
      when 'weekly' then interval '7 days'
      else interval '1 month'  -- monthly y cualquier otro/nulo
    end;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_subscription_fix_period on public.subscriptions;
create trigger trg_subscription_fix_period
  before insert or update on public.subscriptions
  for each row
  execute function public._subscription_fix_degenerate_period();
