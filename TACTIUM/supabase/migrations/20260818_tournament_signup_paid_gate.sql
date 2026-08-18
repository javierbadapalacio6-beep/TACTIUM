-- BLINDAJE: en un torneo con cuota (entry_fee > 0) cuyo club está conectado a
-- Stripe, NADIE puede inscribirse gratis. Solo el flujo de pago (webhook) crea
-- la inscripción. Cierra el hueco de apuntarse gratis desde la app/otra vía.
--
-- Mecanismo (sin tocar el RPC grande tournament_signup):
--   · El webhook llama a un WRAPPER `tournament_signup_paid`, que marca un flag
--     transaccional (`tactium.paid_signup='on'`) y delega en tournament_signup.
--   · Un trigger BEFORE INSERT en tournament_registrations bloquea la inserción
--     en torneos con cuota+club conectado salvo que el flag esté puesto.
--   · Las llamadas de cliente (app/web gratis) van a tournament_signup SIN flag
--     → se bloquean para esos torneos; para torneos gratis o club sin conectar,
--     no se bloquea nada.

-- Wrapper que marca el pago confirmado (lo llama SOLO el servidor/webhook).
create or replace function public.tournament_signup_paid(
  p_code text, p1_name text, p1_email text, p1_phone text,
  p2_name text, p2_email text, p2_phone text,
  p_availability text[] default '{}'::text[], p_category text default null,
  p_gender text default null, p_seed_points numeric default null,
  p_league_sum integer default null
) returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
begin
  perform set_config('tactium.paid_signup', 'on', true);  -- transaccional
  return public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum
  );
end;
$$;

-- Guardia: torneo con cuota + club conectado ⇒ solo con el flag de pago.
create or replace function public.tournament_registration_paid_gate()
returns trigger
language plpgsql
as $$
declare
  v_fee numeric;
  v_connected boolean;
begin
  select t.entry_fee, (c.stripe_connect_status = 'active')
    into v_fee, v_connected
    from public.tournaments t
    left join public.clubs c on c.id = t.club_id
   where t.id = new.tournament_id;

  if coalesce(v_fee, 0) > 0
     and coalesce(v_connected, false)
     and coalesce(current_setting('tactium.paid_signup', true), '') <> 'on' then
    raise exception 'Este torneo tiene cuota: paga la inscripción para apuntarte'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_registration_paid_gate_trg on public.tournament_registrations;
create trigger tournament_registration_paid_gate_trg
  before insert on public.tournament_registrations
  for each row
  execute function public.tournament_registration_paid_gate();
