-- Pago de inscripción EN EL CLUB (efectivo/TPV propio), además del online.
-- Opción B: la pareja elige "pagar en el club" al inscribirse → queda
-- registrada como PENDIENTE de pago en el club; el club la confirma al cobrar.
-- TACTIUM no procesa ese dinero → sin comisión (offline).
--
-- Ver TACTIUM/docs/plan-inscripciones-connect.md.

-- Método de pago de la inscripción.
alter table public.tournament_registrations
  add column if not exists payment_method text;  -- 'stripe' | 'offline' | null(gratis)

-- payment_status ahora admite 'pending_club' (offline, esperando el efectivo):
--   not_required (torneo gratis) | paid (online o confirmado en club) | pending_club

-- Alta OFFLINE: inscribe con el flag de pago (para pasar el blindaje, es un pago
-- legítimo aunque en efectivo) y la deja como pendiente de cobro en el club.
create or replace function public.tournament_signup_offline(
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
declare
  v_id uuid;
begin
  perform set_config('tactium.paid_signup', 'on', true);
  v_id := public.tournament_signup(
    p_code, p1_name, p1_email, p1_phone,
    p2_name, p2_email, p2_phone,
    p_availability, p_category, p_gender, p_seed_points, p_league_sum
  );
  update public.tournament_registrations
     set payment_status = 'pending_club', payment_method = 'offline'
   where id = v_id;
  return v_id;
end;
$$;
